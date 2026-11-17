import type {Express} from "express";
import {z} from "zod";
import {geoPointSchema,type SearchPlace} from "@shared/map-schema";

class MapError extends Error{constructor(message:string,public status=502){super(message);}}
const clean=(v:unknown,max=150)=>typeof v==="string"?v.replace(/[\u0000-\u001f<>]/g,"").trim().slice(0,max):"";
const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export function normalisePlaces(value:unknown):SearchPlace[]{
  const rows=(value as {features?:unknown[]})?.features;
  if(!Array.isArray(rows))throw new MapError("Address provider returned an invalid response.");
  return rows.slice(0,20).flatMap((row:any,i)=>{
    const p=row?.properties,g=row?.geometry,coords=g?.coordinates;
    if(!p||g?.type!=="Point"||!Array.isArray(coords)||clean(p.countrycode,2).toUpperCase()!=="GB")return [];
    const point=geoPointSchema.safeParse({lng:coords[0],lat:coords[1]});if(!point.success)return [];
    const street=[clean(p.housenumber,20),clean(p.street,100)].filter(Boolean).join(" ");
    const parts=[clean(p.name,100),street,clean(p.city||p.town||p.village,80),clean(p.postcode,16),clean(p.state,50)].filter(Boolean);
    const label=Array.from(new Set(parts)).join(", ").slice(0,240);if(!label)return [];
    return [{id:`${clean(String(p.osm_id||i),40)}-${i}`,label,...point.data,postcode:clean(p.postcode,16),precision:clean(p.osm_value||p.type||"Place / approximate",60),attribution:"Address search: Photon / © OpenStreetMap contributors"}];
  }).slice(0,5);
}
export async function limitedBody(response:globalThis.Response,max:number){
  if(!response.ok||!response.body)throw new MapError("Map provider is unavailable. Try again later or use manual coordinates.");
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new MapError("Map provider response exceeded its safe size limit.");parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(parts);
}
function httpsConfig(raw:string){
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.hash)throw Error("Map provider URLs must use HTTPS without embedded credentials or fragments.");
  return u;
}
export function registerMaps(app:Express){
  const endpoint=httpsConfig(process.env.PHOTON_URL||"https://photon.komoot.io/api/");
  const style=httpsConfig(process.env.MAP_STYLE_URL||"https://tiles.openfreemap.org/styles/liberty").href;
  const enabled=process.env.MAPS_ENABLED!=="false",searchEnabled=enabled&&process.env.ADDRESS_SEARCH_ENABLED!=="false";
  const cache=new Map<string,{until:number;places:SearchPlace[]}>(),visitors=new Map<string,{until:number;count:number}>();
  let nextSearch=0;
  const satelliteKey=process.env.MAPTILER_API_KEY||"";
  type Sat={until:number;minzoom:number;maxzoom:number;tileSize:number;attribution:string;template:string};
  let sat:Sat|undefined,satPending:Promise<Sat>|undefined;
  const request=(url:URL|string)=>fetch(url,{signal:AbortSignal.timeout(9000),redirect:"error",headers:{"User-Agent":"SolarWorkspace/0.7 (UK self-hosted design; manual lookup)","Accept":"application/json,image/*"}});
  async function satellite(){
    if(!satelliteKey||!enabled)throw new MapError("Satellite imagery is not configured. Street maps remain available.",503);
    if(sat&&sat.until>Date.now())return sat;
    if(satPending)return satPending;
    satPending=(async()=>{
      const url=new URL("https://api.maptiler.com/tiles/satellite-v4/tiles.json");url.searchParams.set("key",satelliteKey);
      const data=JSON.parse((await limitedBody(await request(url),150000)).toString());
      const template=typeof data.tiles?.[0]==="string"?data.tiles[0]:"";
      const check=new URL(template);
      if(check.protocol!=="https:"||check.hostname!=="api.maptiler.com"||check.username||check.password||!check.pathname.startsWith("/tiles/satellite-v4/")||!template.includes("{z}")||!template.includes("{x}")||!template.includes("{y}"))throw new MapError("Satellite metadata has an unsupported tile template.");
      const minzoom=z.number().int().min(0).max(22).parse(data.minzoom),maxzoom=z.number().int().min(minzoom).max(22).parse(data.maxzoom);
      sat={until:Date.now()+3600000,minzoom,maxzoom,tileSize:data.tileSize===512?512:256,attribution:escape(String(data.attribution||"© MapTiler").replace(/<[^>]*>/g,"").slice(0,2000)),template};
      return sat;
    })();
    try{return await satPending;}finally{satPending=undefined;}
  }
  const fail=(res:any,e:unknown)=>{
    // Provider exceptions may contain credential-bearing URLs: never log/return them.
    res.status(e instanceof MapError?e.status:e instanceof z.ZodError?422:502).json({message:e instanceof MapError?e.message:e instanceof z.ZodError?"Check the map/search inputs and confirm third-party lookup consent.":"Map provider could not complete the request. Use street maps/manual coordinates or retry later."});
  };
  function limit(visitor:string,max:number){
    const now=Date.now();
    for(const [key,v] of Array.from(visitors))if(v.until<=now)visitors.delete(key);
    const item=visitors.get(visitor)||{until:now+60000,count:0};
    if(item.count>=max)throw new MapError("Map request limit reached. Try again in a minute.",429);
    if(!visitors.has(visitor)&&visitors.size>=1000)throw new MapError("Map service is busy. Try again later.",429);
    item.count++;visitors.set(visitor,item);
  }
  app.get("/api/maps/config",(_req,res)=>res.json({enabled,searchEnabled,styleUrl:style,searchHost:endpoint.hostname,satelliteConfigured:!!satelliteKey&&enabled}));
  app.post("/api/maps/search",async(req,res)=>{
    try{
      if(!searchEnabled)throw new MapError("Address lookup is disabled by the server operator. Use manual coordinates.",503);
      const {query}=z.object({query:z.string().trim().min(3).max(180).refine(s=>!/[<>\u0000-\u001f]/.test(s)),consent:z.literal(true)}).parse(req.body);
      limit(`search:${req.identity?.id||req.solarVisitor}`,20);
      const key=query.toLowerCase().replace(/\s+/g," "),now=Date.now();
      for(const [k,v] of Array.from(cache))if(v.until<=now)cache.delete(k);
      const hit=cache.get(key);if(hit)return res.json({places:hit.places,cached:true});
      if(now<nextSearch){res.setHeader("Retry-After","2");throw new MapError("Please wait two seconds before another address lookup.",429);}
      nextSearch=now+1200;
      const url=new URL(endpoint);url.searchParams.set("q",query);url.searchParams.set("limit","5");url.searchParams.set("lang","en");url.searchParams.set("countrycode","GB");url.searchParams.set("bbox","-9,49,2.5,61.5");
      const places=normalisePlaces(JSON.parse((await limitedBody(await request(url),256000)).toString()));
      if(cache.size>=200)cache.delete(cache.keys().next().value!);
      cache.set(key,{until:now+15*60000,places});res.json({places,cached:false});
    }catch(e){fail(res,e);}
  });
  app.get("/api/maps/satellite",async(req,res)=>{
    try{limit(`sat-meta:${req.identity?.id||req.solarVisitor}`,20);const {minzoom,maxzoom,tileSize,attribution}=await satellite();res.json({minzoom,maxzoom,tileSize,attribution});}catch(e){fail(res,e);}
  });
  app.get("/api/maps/satellite/:z/:x/:y",async(req,res)=>{
    try{
      limit(`sat-tile:${req.identity?.id||req.solarVisitor}`,400);
      const b=z.object({z:z.coerce.number().int().min(0).max(22),x:z.coerce.number().int().min(0),y:z.coerce.number().int().min(0)}).parse(req.params);
      if(b.x>=2**b.z||b.y>=2**b.z)throw new MapError("Tile coordinates are out of bounds.",422);
      const meta=await satellite();if(b.z<meta.minzoom||b.z>meta.maxzoom)throw new MapError("Tile zoom is unavailable.",422);
      const url=new URL(meta.template.replace("{z}",String(b.z)).replace("{x}",String(b.x)).replace("{y}",String(b.y)));url.searchParams.set("key",satelliteKey);
      const upstream=await request(url),mime=upstream.headers.get("content-type")?.split(";")[0];
      if(!["image/jpeg","image/png","image/webp"].includes(mime||""))throw new MapError("Satellite provider returned no usable image.");
      const bytes=await limitedBody(upstream,2000000);res.type(mime!).send(bytes);
    }catch(e){fail(res,e);}
  });
}
