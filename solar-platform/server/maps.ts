import type {Express} from "express";
import {z} from "zod";
import {geoPointSchema,type SearchPlace} from "@shared/map-schema";
class MapError extends Error{constructor(message:string,public status=502){super(message);}}
export async function limitedBody(r:globalThis.Response,max:number){
  if(!r.ok||!r.body)throw new MapError("Google service unavailable.");
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new MapError("Provider response exceeded its safe size limit.");parts.push(value);}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(parts);
}
const clean=(s:string,max=240)=>s.replace(/[\u0000-\u001f<>]/g,"").trim().slice(0,max);
const component=z.object({long_name:z.string(),short_name:z.string(),types:z.array(z.string())});
const result=z.object({place_id:z.string(),formatted_address:z.string(),address_components:z.array(component),geometry:z.object({location:geoPointSchema,location_type:z.string()})});
export function normalisePlaces(input:unknown):SearchPlace[]{
  const d=z.object({status:z.string(),results:z.array(z.unknown()).optional()}).safeParse(input);
  if(!d.success)throw new MapError("Google returned an invalid response.");
  if(d.data.status==="ZERO_RESULTS")return [];
  if(d.data.status!=="OK")throw new MapError("Google geocoding failed. Check billing, restrictions and quota.",d.data.status==="OVER_QUERY_LIMIT"?429:502);
  if(!d.data.results)throw new MapError("Google returned an invalid response.");
  return d.data.results.slice(0,20).flatMap(row=>{const p=result.safeParse(row);if(!p.success)return [];const r=p.data;
    if(!r.address_components.some(c=>c.types.includes("country")&&c.short_name==="GB"))return [];
    const label=clean(r.formatted_address);if(!label)return [];
    return [{id:clean(r.place_id,200),label,...r.geometry.location,postcode:clean(r.address_components.find(c=>c.types.includes("postal_code"))?.long_name||"",16),precision:clean(r.geometry.location_type,60),attribution:"Google Maps"}];
  }).slice(0,5);
}
const n=z.number().finite().nonnegative();
export const buildingSchema=z.object({name:z.string().max(300),center:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}),imageryQuality:z.string().max(30),imageryDate:z.object({year:z.number().int(),month:z.number().int().min(1).max(12).optional(),day:z.number().int().min(1).max(31).optional()}).optional(),solarPotential:z.object({maxArrayPanelsCount:n.int().optional(),maxArrayAreaMeters2:n.optional(),maxSunshineHoursPerYear:n.optional(),panelCapacityWatts:n.optional(),roofSegmentStats:z.array(z.object({pitchDegrees:n.max(90),azimuthDegrees:n.max(360),stats:z.object({areaMeters2:n.optional()}).optional()})).max(1000).optional()})});
export function registerMaps(app:Express){
  const on=process.env.MAPS_ENABLED!=="false",browser=process.env.GOOGLE_MAPS_BROWSER_API_KEY||"",geo=process.env.GOOGLE_GEOCODING_API_KEY||"",solar=process.env.GOOGLE_SOLAR_API_KEY||"";
  const searchEnabled=on&&!!geo&&process.env.ADDRESS_SEARCH_ENABLED!=="false",solarEnabled=on&&!!solar;
  const counters=new Map<string,{until:number;count:number}>();
  function limit(key:string,max:number){const now=Date.now();for(const [k,v] of counters)if(v.until<=now)counters.delete(k);const v=counters.get(key)||{until:now+60000,count:0};if(v.count>=max||(!counters.has(key)&&counters.size>=2000))throw new MapError("Google request limit reached. Retry in a minute.",429);v.count++;counters.set(key,v);}
  async function request(url:URL,key:string,isSolar=false){
    const r=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(9000),headers:{Accept:"application/json",...(isSolar?{"X-Goog-Api-Key":key}:{})}});
    if(!r.ok){await r.body?.cancel().catch(()=>{});if(r.status===404&&isSolar)throw new MapError("No Google Solar coverage at this location/quality. Continue manual design or try exact roof coordinates.",404);if(r.status===429)throw new MapError("Google quota exceeded.",429);throw new MapError("Google rejected the request. Check API enablement, billing and key restrictions.");}
    return JSON.parse((await limitedBody(r,2000000)).toString());
  }
  const fail=(res:any,e:unknown)=>{if(e instanceof MapError&&e.status===429)res.setHeader("Retry-After","60");res.status(e instanceof MapError?e.status:e instanceof z.ZodError?422:502).json({message:e instanceof MapError?e.message:e instanceof z.ZodError?"Check inputs and confirm consent.":"Google request failed. Check configuration or retry later."});};
  app.get("/api/maps/config",(_req,res)=>{res.setHeader("Cache-Control","private, no-store");res.json({provider:"google",enabled:on&&!!browser,browserKey:on?browser:"",searchEnabled,solarEnabled,satelliteConfigured:on&&!!browser});});
  app.post("/api/maps/search",async(req,res)=>{try{
    const {query}=z.object({query:z.string().trim().min(3).max(180).refine(s=>!/[<>\u0000-\u001f]/.test(s)),consent:z.literal(true)}).parse(req.body);
    if(!searchEnabled)throw new MapError("Google geocoding is not configured. Use manual coordinates.",503);
    limit(`geo:${req.identity?.id||req.ip||req.solarVisitor}`,20);limit("global:geo",120);
    const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");url.search=new URLSearchParams({address:query,components:"country:GB",region:"uk",language:"en",key:geo}).toString();
    res.setHeader("Cache-Control","private, no-store");res.json({places:normalisePlaces(await request(url,geo)),cached:false});
  }catch(e){fail(res,e);}});
  app.post("/api/maps/solar/building-insights",async(req,res)=>{try{
    const b=geoPointSchema.extend({consent:z.literal(true),quality:z.enum(["HIGH","MEDIUM","LOW"]).default("HIGH")}).parse(req.body);
    if(!solarEnabled)throw new MapError("Google Solar API is not configured.",503);
    limit(`solar:${req.identity?.id||req.ip||req.solarVisitor}`,10);limit("global:solar",60);
    const url=new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");url.search=new URLSearchParams({"location.latitude":String(b.lat),"location.longitude":String(b.lng),requiredQuality:b.quality}).toString();
    const d=buildingSchema.safeParse(await request(url,solar,true));if(!d.success)throw new MapError("Google Solar returned an invalid building response.");
    res.setHeader("Cache-Control","private, no-store");res.json({provider:"google",building:d.data});
  }catch(e){fail(res,e);}});
  app.get(["/api/maps/satellite","/api/maps/satellite/:z/:x/:y"],(_req,res)=>res.status(410).json({message:"Provider changed to Google Maps. Reload the application."}));
}
