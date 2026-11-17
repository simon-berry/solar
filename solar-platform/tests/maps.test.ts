import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import express from "express";
import {defaultDesign,dims,fillRoof,mergeDesignUpdate,stableJSON,totals,validPlacement,validateDesign} from "../shared/solar";
import {designSchema,modules,type Roof} from "../shared/schema";
import {pointInPolygon,polygonArea,rectangleInPolygon,segmentInPolygon,simplePolygon} from "../shared/geometry";
import {geoToLocal,groundOffset,localToGeo,mapFeatures,mapReferenceCurrent,offsetLocation,tracedRoof} from "../shared/map-geometry";
import {limitedBody,normalisePlaces,registerMaps} from "../server/maps";
import {roofSvg} from "../server/documents";
import {stringLayoutSvg} from "../server/electrical-documents";
import {roofDxf} from "../server/technical-documents";
import DxfParser from "dxf-parser";
const origin={lng:-2.633283,lat:53.6539642};
function traced(pitch=35):Roof{
  return tracedRoof([{x:0,y:0},{x:12,y:0},{x:12,y:-8},{x:0,y:-8}].map(p=>offsetLocation(origin,p)),pitch,"mapped","Mapped roof","traced-street");
}
const notch=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:6,y:10},{x:6,y:4},{x:4,y:4},{x:4,y:10},{x:0,y:10}];
test("legacy JSON remains absent rather than acquiring map defaults",()=>{
  const d=defaultDesign(),parsed=designSchema.parse(d);
  assert.equal(stableJSON(parsed),stableJSON(d));assert.equal("mapLocation" in parsed,false);assert.equal("boundary" in parsed.roofs[0],false);
});
test("local ground and pitched roof projections round-trip",()=>{
  for(const pitch of [0,20,35,75]){
    const r=traced(pitch);
    assert.ok(Math.abs(r.width-12)<.002);assert.ok(Math.abs(r.height-8/Math.cos(pitch*Math.PI/180))<.002);
    for(const p of [{x:0,y:0},{x:3,y:2},{x:9,y:4}]){
      const q=geoToLocal(r,localToGeo(r,p));assert.ok(Math.abs(q.x-p.x)<.002);assert.ok(Math.abs(q.y-p.y)<.002);
    }
    assert.equal(r.azimuth,180);assert.equal(mapReferenceCurrent(r),true);
  }
});
test("trace rejects self-crossing, reversed slope, duplicate, oversized and non-UK coordinates",()=>{
  const xy=(p:{x:number;y:number}[])=>p.map(q=>offsetLocation(origin,q));
  assert.throws(()=>tracedRoof(xy([{x:0,y:0},{x:10,y:0},{x:0,y:-8},{x:10,y:-8}]),0,"r","Bad","traced-street"),/crosses/);
  assert.throws(()=>tracedRoof(xy([{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}]),0,"r","Bad","traced-street"),/clockwise/);
  assert.throws(()=>tracedRoof(xy([{x:0,y:0},{x:100,y:0},{x:100,y:-8},{x:0,y:-8}]),0,"r","Bad","traced-street"),/bounds/);
  assert.throws(()=>tracedRoof(xy([{x:0,y:0},{x:10,y:0},{x:10,y:-8},{x:0,y:0}]),0,"r","Bad","traced-street"),/duplicate|crosses/);
  assert.throws(()=>tracedRoof([{lng:100,lat:0},origin,origin],0,"r","Bad","traced-street"),/UK/);
  assert.equal(simplePolygon([{x:0,y:0},{x:1,y:0},{x:2,y:0}]),false);
});
test("concave notches reject bridging rectangles even when every corner is inside",()=>{
  const r={x:2,y:2,width:6,height:6};
  assert.ok([{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}].every(p=>pointInPolygon(p,notch)));
  assert.equal(rectangleInPolygon(r,notch),false);
  assert.equal(rectangleInPolygon({x:.4,y:.4,width:2,height:2},notch,.4),true);
  assert.equal(rectangleInPolygon({x:.39,y:.4,width:2,height:2},notch,.4),false);
  assert.equal(rectangleInPolygon({x:0,y:0,width:10,height:4},notch,0),true);
});
test("diagonal clearance is measured from every roof edge",()=>{
  const triangle=[{x:0,y:0},{x:10,y:0},{x:0,y:10}];
  assert.equal(rectangleInPolygon({x:1,y:1,width:3,height:3},triangle,1),true);
  assert.equal(rectangleInPolygon({x:1,y:1,width:3.5,height:3.5},triangle,1),false);
});
test("polygon auto-fill never spans the notch in either orientation",()=>{
  const d=defaultDesign(),r={...d.roofs[0],width:10,height:10,boundary:notch};
  for(const landscape of [false,true]){
    r.panels=fillRoof(r,modules[0],d.gap,landscape);
    assert.ok(r.panels.length>0);assert.ok(r.panels.every(p=>validPlacement(r,p,modules[0],d.gap)));
    assert.ok(r.panels.every(p=>rectangleInPolygon({...p,...dims(p,modules[0])},notch,.4)));
  }
  d.roofs=[r];assert.equal(totals(d).area,88);
});
test("stale mapped dimensions/pitch/azimuth are explicit blocking findings",()=>{
  for(const patch of [{width:13},{height:12},{pitch:20},{azimuth:90}]){
    const d=defaultDesign({roofs:[{...traced(),...patch}]});
    assert.ok(validateDesign(d).some(f=>f.id==="georeference-mapped"&&f.severity==="error"));
  }
});
test("legacy client merge preserves omitted map fields and explicit null clears them",()=>{
  const d=defaultDesign({roofs:[traced()],mapLocation:{...origin,label:"Test site",source:"manual",capturedAt:new Date().toISOString()}});
  const next=structuredClone(d);delete next.mapLocation;delete next.roofs[0].geo;delete next.roofs[0].boundary;
  assert.equal(stableJSON(mergeDesignUpdate(d,next)),stableJSON(d));
  next.mapLocation=null;next.roofs[0].geo=null;next.roofs[0].boundary=null;
  const merged=mergeDesignUpdate(d,next);assert.equal(merged.mapLocation,null);assert.equal(merged.roofs[0].boundary,null);assert.equal(merged.roofs[0].geo,null);
});
test("GeoJSON uses longitude first, closed polygons and only mapped user geometry",()=>{
  const d=defaultDesign({roofs:[traced(),defaultDesign().roofs[0]],mapLocation:{...origin,label:"Synthetic site",source:"manual",capturedAt:new Date().toISOString()}});
  d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,3);
  const fc=mapFeatures(d,modules[0]);assert.equal(fc.features.length,5);
  for(const f of fc.features)if(f.geometry.type==="Polygon"){
    const ring=f.geometry.coordinates[0];assert.deepEqual(ring[0],ring.at(-1));
    assert.ok(ring.every(p=>p[0]<0&&p[1]>49));
  }
  assert.equal(JSON.stringify(fc).includes("tiles"),false);
});
test("SVG, electrical SVG and DXF preserve polygon vertices",()=>{
  const d=defaultDesign({roofs:[{...traced(0),width:10,height:10,boundary:notch,geo:null}]});
  assert.match(roofSvg("Mapped test",d,1),/<polygon points=/);
  assert.match(stringLayoutSvg("Mapped test",d,1),/<polygon points=/);
  const parsed=new DxfParser().parseSync(roofDxf(d))!;
  const entity=parsed.entities.find(e=>e.layer==="R1_ROOF") as any;
  assert.equal(entity.vertices.length,notch.length);assert.equal(entity.vertices[4].y,-4000);
});
test("rails cannot bridge concave notches even with valid endpoints",()=>{
  assert.equal(segmentInPolygon({x:2,y:8},{x:8,y:8},notch),false);
  assert.equal(segmentInPolygon({x:1,y:2},{x:9,y:2},notch),true);
  assert.equal(segmentInPolygon({x:0,y:0},{x:10,y:0},notch),true);
});
test("provider result normalisation rejects foreign, invalid and malformed features",()=>{
  const f=(properties:any,coordinates:any= [origin.lng,origin.lat])=>({type:"Feature",properties,geometry:{type:"Point",coordinates}});
  const out=normalisePlaces({features:[null,{},f({name:"Chorley <Town> Hall",countrycode:"GB",city:"Chorley",postcode:"PR7 1DP",osm_value:"townhall"}),f({name:"Foreign",countrycode:"US"}),f({name:"NaN",countrycode:"GB"},[NaN,0]),f({name:"Malformed",countrycode:2})]});
  assert.equal(out.length,1);assert.match(out[0].label,/Chorley Town Hall/);assert.equal(out[0].precision,"townhall");
  assert.throws(()=>normalisePlaces({error:true}),/invalid response/);
});
test("provider response streams are bounded",async()=>{
  assert.equal((await limitedBody(new Response("test"),4)).toString(),"test");
  await assert.rejects(limitedBody(new Response("too long"),3),/size limit/);
  await assert.rejects(limitedBody(new Response("unavailable",{status:503}),100),/unavailable/);
});
test("map routes disclose configuration, require manual consent, bound lookup and cache safely",async()=>{
  const originalFetch=globalThis.fetch;let calls=0,lastUrl="";
  globalThis.fetch=async(input:any)=>{
    calls++;lastUrl=String(input);
    if(lastUrl.includes("tiles.json"))return new Response(JSON.stringify({minzoom:0,maxzoom:20,tiles:["https://api.maptiler.com/tiles/satellite-v4/{z}/{x}/{y}.jpg"],attribution:"<b>Example</b>"}));
    return new Response(JSON.stringify({features:[{properties:{name:"Synthetic UK test",countrycode:"GB"},geometry:{type:"Point",coordinates:[origin.lng,origin.lat]}}]}));
  };
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.solarVisitor=req.get("x-test-visitor")||"synthetic";next();});registerMaps(app);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
  const post=(body:unknown,visitor="synthetic")=>originalFetch(base+"/api/maps/search",{method:"POST",headers:{"content-type":"application/json","x-test-visitor":visitor},body:JSON.stringify(body)});
  try{
    const cfg=await (await originalFetch(base+"/api/maps/config")).json();assert.equal(cfg.searchHost,"photon.komoot.io");assert.equal(cfg.satelliteConfigured,false);
    assert.equal((await post({query:"Synthetic"})).status,422);assert.equal(calls,0);
    assert.equal((await post({query:"xx",consent:true})).status,422);
    assert.equal((await post({query:"Synthetic",consent:true})).status,200);assert.equal(calls,1);
    assert.match(lastUrl,/countrycode=GB/);assert.match(lastUrl,/limit=5/);assert.match(lastUrl,/bbox=/);
    const hit=await (await post({query:" synthetic ",consent:true})).json();assert.equal(hit.cached,true);assert.equal(calls,1);
    assert.equal((await post({query:"Different",consent:true})).status,429);assert.equal(calls,1);
    for(let i=0;i<22;i++)await post({query:"Synthetic",consent:true});
    assert.equal((await post({query:"Synthetic",consent:true})).status,429);
    assert.equal((await originalFetch(base+"/api/maps/satellite")).status,503);
    assert.equal((await originalFetch(base+"/api/maps/satellite/1/8/0")).status,422);
  }finally{globalThis.fetch=originalFetch;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("satellite adapter derives metadata and hides its key; raster/error/XYZ guards work",async()=>{
  const originalFetch=globalThis.fetch,oldKey=process.env.MAPTILER_API_KEY;let mode="ok";
  process.env.MAPTILER_API_KEY="SYNTHETIC_ONLY_MAP_QA_KEY";
  globalThis.fetch=async(input:any)=>{
    const url=new URL(input);assert.equal(url.hostname,"api.maptiler.com");assert.equal(url.searchParams.get("key"),"SYNTHETIC_ONLY_MAP_QA_KEY");
    if(url.pathname.endsWith("tiles.json"))return new Response(JSON.stringify({minzoom:0,maxzoom:20,tileSize:512,tiles:["https://api.maptiler.com/tiles/satellite-v4/{z}/{x}/{y}.jpg?key=SYNTHETIC_ONLY_MAP_QA_KEY"],attribution:'<a href="javascript:alert(1)">Example credits</a><img src=x onerror=alert(1)>'}));
    return mode==="ok"?new Response(Buffer.from([137,80,78,71]),{headers:{"content-type":"image/png"}}):new Response("provider error",{headers:{"content-type":"application/json"}});
  };
  const app=express();app.use((req,_res,next)=>{req.solarVisitor="synthetic-satellite";next();});registerMaps(app);
  if(oldKey===undefined)delete process.env.MAPTILER_API_KEY;else process.env.MAPTILER_API_KEY=oldKey;
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try{
    const cfg=await (await originalFetch(base+"/api/maps/config")).text();assert.ok(!cfg.includes("SYNTHETIC_ONLY"));assert.equal(JSON.parse(cfg).satelliteConfigured,true);
    const meta=await (await originalFetch(base+"/api/maps/satellite")).text();assert.ok(!meta.includes("SYNTHETIC_ONLY"));assert.ok(!meta.includes("javascript:"));assert.equal(JSON.parse(meta).tileSize,512);
    let r=await originalFetch(base+"/api/maps/satellite/2/1/1");assert.equal(r.status,200);assert.equal(r.headers.get("content-type"),"image/png");assert.equal((await r.arrayBuffer()).byteLength,4);
    mode="bad";r=await originalFetch(base+"/api/maps/satellite/2/1/2");assert.equal(r.status,502);assert.ok(!(await r.text()).includes("SYNTHETIC_ONLY"));
    assert.equal((await originalFetch(base+"/api/maps/satellite/2/9/1")).status,422);
    assert.equal((await originalFetch(base+"/api/maps/satellite/21/1/1")).status,422);
  }finally{globalThis.fetch=originalFetch;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
