import type {Design,Roof,ModuleSpec} from "./schema";
import type {GeoPoint,Point2} from "./map-schema";
import {geoPointSchema} from "./map-schema";
import {simplePolygon} from "./geometry";
import type {Feature,FeatureCollection} from "geojson";
const R=6371008.8,rad=Math.PI/180;
const rounded=(v:number)=>Math.round(v*1000)/1000;
export const normalBearing=(v:number)=>(v%360+360)%360;
// Small-site spherical local tangent approximation. Not a survey projection.
export function groundOffset(origin:GeoPoint,p:GeoPoint):Point2{
  return {x:(p.lng-origin.lng)*rad*R*Math.cos(origin.lat*rad),y:(p.lat-origin.lat)*rad*R};
}
export function offsetLocation(origin:GeoPoint,p:Point2):GeoPoint{
  return {lng:origin.lng+p.x/(R*Math.cos(origin.lat*rad))/rad,lat:origin.lat+p.y/R/rad};
}
export function localToGeo(roof:Roof,p:Point2):GeoPoint{
  if(!roof.geo)throw Error("Roof has no map reference.");
  const b=roof.geo.bearing*rad,y=p.y*Math.cos(roof.pitch*rad);
  return offsetLocation(roof.geo.origin,{x:p.x*Math.sin(b)+y*Math.cos(b),y:p.x*Math.cos(b)-y*Math.sin(b)});
}
export function geoToLocal(roof:Roof,p:GeoPoint):Point2{
  if(!roof.geo)throw Error("Roof has no map reference.");
  const o=groundOffset(roof.geo.origin,p),b=roof.geo.bearing*rad;
  return {x:rounded(o.x*Math.sin(b)+o.y*Math.cos(b)),y:rounded((o.x*Math.cos(b)-o.y*Math.sin(b))/Math.cos(roof.pitch*rad))};
}
export function tracedRoof(points:GeoPoint[],pitch:number,id:string,name:string,basis:"traced-street"|"traced-satellite"):Roof{
  if(points.length<3||points.length>32||!points.every(p=>geoPointSchema.safeParse(p).success)||!Number.isFinite(pitch)||pitch<0||pitch>75)throw Error("Choose 3–32 UK map vertices and a pitch from 0 to 75 degrees.");
  const first=points[0],edge=groundOffset(first,points[1]);
  if(Math.hypot(edge.x,edge.y)<2)throw Error("The first width/ridge edge must be at least 2 m.");
  const bearing=normalBearing(Math.atan2(edge.x,edge.y)/rad),b=bearing*rad;
  const xy=points.map(p=>{const o=groundOffset(first,p);return {x:o.x*Math.sin(b)+o.y*Math.cos(b),y:(o.x*Math.cos(b)-o.y*Math.sin(b))/Math.cos(pitch*rad)};});
  if(xy.some(p=>p.y<-.02))throw Error("Start along the upper/ridge edge and trace clockwise, with the roof slope on the right of the first edge.");
  const minX=Math.min(...xy.map(p=>p.x)),minY=Math.min(...xy.map(p=>p.y));
  const boundary=xy.map(p=>({x:rounded(p.x-minX),y:rounded(p.y-minY)}));
  const width=rounded(Math.max(...boundary.map(p=>p.x))),height=rounded(Math.max(...boundary.map(p=>p.y)));
  if(width<2||width>80||height<2||height>60)throw Error("Traced roof bounds must be 2–80 m wide and 2–60 m on slope. Split larger buildings into supported faces.");
  if(!simplePolygon(boundary))throw Error("Roof outline crosses/touches itself, has duplicate points, or is too small.");
  const groundY=minY*Math.cos(pitch*rad);
  const origin=offsetLocation(first,{x:minX*Math.sin(b)+groundY*Math.cos(b),y:minX*Math.cos(b)-groundY*Math.sin(b)});
  geoPointSchema.parse(origin);
  return {id,name,width,height,pitch,azimuth:Math.round(normalBearing(bearing+90))%360,setback:.4,panels:[],obstacles:[],boundary,
    geo:{origin,bearing,basis,pitchAtMapping:pitch,widthAtMapping:width,heightAtMapping:height,capturedAt:new Date().toISOString()}};
}
export function mapReferenceCurrent(r:Roof){
  return !r.geo||(Math.abs(r.width-r.geo.widthAtMapping)<.01&&Math.abs(r.height-r.geo.heightAtMapping)<.01&&Math.abs(r.pitch-r.geo.pitchAtMapping)<.01&&r.azimuth===Math.round(normalBearing(r.geo.bearing+90))%360);
}
export const roofOutline=(r:Roof):Point2[]=>r.boundary||[{x:0,y:0},{x:r.width,y:0},{x:r.width,y:r.height},{x:0,y:r.height}];
function ring(r:Roof,points:Point2[]){const a=points.map(p=>{const q=localToGeo(r,p);return [q.lng,q.lat];});return [...a,a[0]];}
export function mapFeatures(d:Design,module:ModuleSpec){
  const features:Feature[]=[];
  for(const r of d.roofs){
    if(!r.geo)continue;
    features.push({type:"Feature",properties:{kind:"roof",roofId:r.id,name:r.name,current:mapReferenceCurrent(r)},geometry:{type:"Polygon",coordinates:[ring(r,roofOutline(r))]}});
    for(const p of r.panels){
      const w=p.landscape?module.height:module.width,h=p.landscape?module.width:module.height;
      features.push({type:"Feature",properties:{kind:"module",roofId:r.id,id:p.id,name:p.id},geometry:{type:"Polygon",coordinates:[ring(r,[{x:p.x,y:p.y},{x:p.x+w,y:p.y},{x:p.x+w,y:p.y+h},{x:p.x,y:p.y+h}])]}});
    }
    for(const o of r.obstacles)features.push({type:"Feature",properties:{kind:"obstruction",roofId:r.id,id:o.id,name:o.label},geometry:{type:"Polygon",coordinates:[ring(r,[{x:o.x,y:o.y},{x:o.x+o.width,y:o.y},{x:o.x+o.width,y:o.y+o.height},{x:o.x,y:o.y+o.height}])]}});
  }
  if(d.mapLocation)features.push({type:"Feature",properties:{kind:"site",name:d.mapLocation.label},geometry:{type:"Point",coordinates:[d.mapLocation.lng,d.mapLocation.lat]}});
  return {type:"FeatureCollection",features} as FeatureCollection;
}
