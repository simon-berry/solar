import type {FeatureCollection} from "geojson";
import type {GeoPoint} from "@shared/map-schema";
// Isolate the dynamically loaded Google SDK from typed application geometry.
type SDK=any;
let loading:Promise<SDK>|undefined;
export function loadGoogleMaps(key:string):Promise<SDK>{
  const w=window as unknown as Record<string,any>;
  if(w.google?.maps?.Map)return Promise.resolve(w.google.maps);if(loading)return loading;
  loading=new Promise((resolve,reject)=>{const script=document.createElement("script");const cleanup=()=>{clearTimeout(timer);delete w.__solarMapsReady;};const fail=()=>{cleanup();script.remove();loading=undefined;reject(Error("Google Maps failed to load. Check billing and browser-key restrictions; reload to retry."));};const timer=setTimeout(fail,20000);
    w.__solarMapsReady=()=>{cleanup();if(w.google?.maps?.Map)resolve(w.google.maps);else fail();};const u=new URL("https://maps.googleapis.com/maps/api/js");u.search=new URLSearchParams({key,loading:"async",callback:"__solarMapsReady",v:"quarterly",region:"GB",language:"en"}).toString();script.src=u.href;script.async=true;script.onerror=fail;const nonce=document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;if(nonce)script.nonce=nonce;document.head.append(script);
  });return loading;
}
export type MapHit={kind:string;roofId?:string;id?:string};
export class GoogleSiteMap{
  private map:SDK;private shapes:SDK;private trace:SDK;private listeners:SDK[]=[];
  constructor(private sdk:SDK,element:HTMLElement,p:GeoPoint|undefined,click:(p:GeoPoint,h?:MapHit)=>void){
    this.map=new sdk.Map(element,{center:p||{lat:54,lng:-2.5},zoom:p?18:6,mapTypeId:"roadmap",mapTypeControl:false,streetViewControl:false,scaleControl:true,tilt:0,heading:0,rotateControl:false,clickableIcons:false,disableDoubleClickZoom:true,maxZoom:22});this.shapes=new sdk.Data({map:this.map});this.trace=new sdk.Data({map:this.map});
    this.shapes.setStyle((f:SDK)=>{const k=f.getProperty("kind"),s=f.getProperty("selected"),a=f.getProperty("active");return {clickable:k!=="site",fillColor:k==="module"?"#193d52":k==="obstruction"?"#b87931":"#3f936a",fillOpacity:k==="roof"?.12:.86,strokeColor:s?"#ffcf50":a?"#0b7952":"#516c7d",strokeWeight:s?3:1.5,zIndex:k==="roof"?1:3,icon:{path:sdk.SymbolPath.CIRCLE,scale:7,fillColor:"#087b53",fillOpacity:1,strokeColor:"#fff",strokeWeight:2}};});this.trace.setStyle({clickable:false,strokeColor:"#b25d14",strokeWeight:3,zIndex:10,icon:{path:sdk.SymbolPath.CIRCLE,scale:5,fillColor:"#fff",fillOpacity:1,strokeColor:"#b25d14",strokeWeight:2}});
    this.listeners.push(this.map.addListener("click",(e:SDK)=>{if(e.latLng)click(e.latLng.toJSON());}),this.shapes.addListener("click",(e:SDK)=>{if(e.latLng)click(e.latLng.toJSON(),{kind:e.feature.getProperty("kind"),roofId:e.feature.getProperty("roofId"),id:e.feature.getProperty("id")});}));
  }
  setFeatures(fc:FeatureCollection){this.shapes.forEach((f:SDK)=>this.shapes.remove(f));this.shapes.addGeoJson(fc);}
  setTrace(points:GeoPoint[]){this.trace.forEach((f:SDK)=>this.trace.remove(f));this.trace.addGeoJson({type:"FeatureCollection",features:[...points.map(p=>({type:"Feature",properties:{},geometry:{type:"Point",coordinates:[p.lng,p.lat]}})),...(points.length>1?[{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:points.map(p=>[p.lng,p.lat])}}]:[])]});}
  focus(p:GeoPoint){this.map.panTo(p);this.map.setZoom(18);}
  fit(points:GeoPoint[]){const b=new this.sdk.LatLngBounds();points.forEach(p=>b.extend(p));this.map.fitBounds(b,70);}
  layer(v:"street"|"satellite"){this.map.setMapTypeId(v==="street"?"roadmap":"satellite");this.map.setTilt(0);this.map.setHeading(0);}
  cursor(v:string){this.map.setOptions({draggableCursor:v==="select"?undefined:"crosshair"});}
  resize(){this.sdk.event.trigger(this.map,"resize");}
  destroy(){this.listeners.forEach(l=>l.remove());this.shapes.setMap(null);this.trace.setMap(null);this.sdk.event.clearInstanceListeners(this.map);this.map.getDiv().replaceChildren();}
}
