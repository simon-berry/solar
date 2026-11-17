import {useEffect,useRef,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Map as MapView,NavigationControl,ScaleControl,AttributionControl,LngLatBounds,setWorkerUrl,type GeoJSONSource,type MapMouseEvent} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import {MapPin,Search,MousePointer2,Plus,Undo2,Redo2,RotateCw,Trash2,Scan,SquareDashed,Navigation,Info} from "lucide-react";
import type {Design,Roof,Panel} from "@shared/schema";
import type {GeoPoint,SearchPlace} from "@shared/map-schema";
import {geoPointSchema} from "@shared/map-schema";
import {geoToLocal,localToGeo,mapFeatures,mapReferenceCurrent,roofOutline,tracedRoof} from "@shared/map-geometry";
import {rectangleInPolygon,polygonArea} from "@shared/geometry";
import {hardware} from "@shared/electrical";
import {dims,fillRoof,round,totals,validPlacement} from "@shared/solar";
import {apiRequest,apiUrl} from "@/lib/queryClient";
import {NumericField} from "./solar-ui";
import "./map-designer.css";
import type {FeatureCollection} from "geojson";

setWorkerUrl(workerUrl);
type Tool="select"|"trace"|"panel"|"obstacle"|"move";
type Config={enabled:boolean;searchEnabled:boolean;styleUrl:string;searchHost:string;satelliteConfigured:boolean};
type Props={d:Design;change:(d:Design)=>void;editable:boolean;notice:(s:string)=>void};
const empty:FeatureCollection={type:"FeatureCollection",features:[]};

export function MapDesigner({d,change,editable,notice}:Props){
  const {data:config,error:configError}=useQuery<Config>({queryKey:["/api/maps/config"]});
  const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[mapStatus,setMapStatus]=useState("");
  const [query,setQuery]=useState(""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[results,setResults]=useState<SearchPlace[]|null>(null),[error,setError]=useState("");
  const [applyAddress,setApplyAddress]=useState(false),[lat,setLat]=useState(""),[lng,setLng]=useState("");
  const [roofId,setRoofId]=useState(d.roofs.find(r=>r.geo)?.id||d.roofs[0].id),[selected,setSelected]=useState<string|null>(null);
  const [tool,setTool]=useState<Tool>("select"),[points,setPoints]=useState<GeoPoint[]>([]),[pitch,setPitch]=useState(0),[traceTarget,setTraceTarget]=useState("new");
  const [landscape,setLandscape]=useState(false),[layer,setLayer]=useState<"street"|"satellite">("street"),[satBusy,setSatBusy]=useState(false),[confirmFill,setConfirmFill]=useState(false);
  const [historyCount,setHistoryCount]=useState(0),[futureCount,setFutureCount]=useState(0);
  const history=useRef<Design[]>([]),future=useRef<Design[]>([]);
  const container=useRef<HTMLDivElement>(null),map=useRef<MapView|null>(null);
  const callbacks=useRef({click:(_e:MapMouseEvent)=>{}});
  const roof=d.roofs.find(r=>r.id===roofId)||d.roofs[0],module=hardware(d).module,t=totals(d);
  const panel=roof.panels.find(p=>p.id===selected),obstacle=roof.obstacles.find(o=>o.id===selected),object=panel||obstacle;
  function commit(next:Design){
    if(!editable)return;
    history.current=[...history.current.slice(-29),structuredClone(d)];future.current=[];
    setHistoryCount(history.current.length);setFutureCount(0);change(next);
  }
  function patchRoof(next:Partial<Roof>){commit({...d,roofs:d.roofs.map(r=>r.id===roof.id?{...r,...next}:r)});setConfirmFill(false);}
  function undo(){
    if(!editable)return;const prev=history.current.pop();if(!prev)return;
    future.current.push(structuredClone(d));change(prev);setSelected(null);setTool("select");
    setHistoryCount(history.current.length);setFutureCount(future.current.length);
  }
  function redo(){
    if(!editable)return;const next=future.current.pop();if(!next)return;
    history.current.push(structuredClone(d));change(next);setSelected(null);
    setHistoryCount(history.current.length);setFutureCount(future.current.length);
  }
  function focusRoof(r=roof){
    const m=map.current;if(!m||!r.geo)return;
    const b=new LngLatBounds();roofOutline(r).forEach(p=>{const q=localToGeo(r,p);b.extend([q.lng,q.lat]);});
    m.fitBounds(b,{padding:70,maxZoom:21,duration:500});
  }
  function chooseLocation(p:GeoPoint,label:string,source:"photon"|"manual",postcode=""){
    map.current?.flyTo({center:[p.lng,p.lat],zoom:18,duration:700});
    setLat(p.lat.toFixed(7));setLng(p.lng.toFixed(7));
    if(editable){
      const address=label.split(", ").filter(part=>!postcode||part.toUpperCase()!==postcode.toUpperCase()).join(", ").slice(0,180);
      commit({...d,mapLocation:{...p,label,source,capturedAt:new Date().toISOString()},...(applyAddress&&source==="photon"?{address,...(postcode?{postcode}:{})}:{})});
      notice("Site pin updated. Existing roof drawings have not moved. Save revision to retain the location.");
    }
  }
  async function search(e:React.FormEvent){
    e.preventDefault();setError("");setResults(null);setBusy(true);
    try{const res=await (await apiRequest("POST","/api/maps/search",{query,consent})).json();setResults(res.places);}
    catch(e){setError(e instanceof Error?e.message:"Address lookup failed.");}finally{setBusy(false);}
  }
  function manual(e:React.FormEvent){
    e.preventDefault();const value=geoPointSchema.safeParse({lng:lng.trim()?Number(lng):NaN,lat:lat.trim()?Number(lat):NaN});
    if(!value.success)return setError("Enter UK-region coordinates: latitude 49 to 61.5; longitude −9 to 2.5.");
    setError("");chooseLocation(value.data,"Manually positioned site","manual");
  }
  function finish(){
    try{
      if(!editable)return;
      const old=d.roofs.find(r=>r.id===traceTarget);
      if(traceTarget!=="new"&&(!old||old.panels.length||old.obstacles.length||old.geo))throw Error("Choose a new roof face or an empty, unmapped face. Existing drawings are never overwritten.");
      if(!old&&d.roofs.length>=10)throw Error("This workspace supports up to ten roof faces.");
      const r=tracedRoof(points,pitch,old?.id||crypto.randomUUID(),old?.name||`Mapped roof ${d.roofs.length+1}`,layer==="street"?"traced-street":"traced-satellite");
      commit({...d,roofs:old?d.roofs.map(a=>a.id===old.id?r:a):[...d.roofs,r]});
      setRoofId(r.id);setSelected(null);setPoints([]);setTool("select");
      notice(`Roof traced: ${polygonArea(r.boundary!).toFixed(1)} m² on the assumed roof plane. Verify pitch, downslope direction and all dimensions by survey.`);
    }catch(e){notice(e instanceof Error?e.message:"Could not trace the roof.");}
  }
  function move(x:number,y:number){
    if(!editable||!object)return;
    if(!mapReferenceCurrent(roof))return notice("This map reference is stale. Unlink or retrace it first.");
    x=round(x);y=round(y);
    if(panel){const p={...panel,x,y};if(!validPlacement(roof,p,module,d.gap))return notice("Move blocked: check the actual roof outline, clearance and other objects.");patchRoof({panels:roof.panels.map(a=>a.id===p.id?p:a)});}
    else if(obstacle){
      const o={...obstacle,x,y};
      if(x<0||y<0||x+o.width>roof.width||y+o.height>roof.height||!rectangleInPolygon(o,roofOutline(roof))||roof.panels.some(p=>!validPlacement({...roof,obstacles:roof.obstacles.map(a=>a.id===o.id?o:a)},p,module,d.gap)))return notice("Obstruction move blocked by roof geometry or a module.");
      patchRoof({obstacles:roof.obstacles.map(a=>a.id===o.id?o:a)});
    }setTool("select");
  }
  callbacks.current.click=e=>{
    if(tool==="trace"){
      if(!editable)return;
      if(points.length>=32)return notice("A trace supports up to 32 vertices.");
      setPoints([...points,{lng:e.lngLat.lng,lat:e.lngLat.lat}]);return;
    }
    const m=map.current;if(!m)return;
    if(tool==="select"){
      const hit=m.queryRenderedFeatures(e.point,{layers:["solar-fill"]})[0]?.properties;
      if(hit){setRoofId(String(hit.roofId));setSelected(hit.kind==="roof"?null:String(hit.id));}else setSelected(null);
      setConfirmFill(false);return;
    }
    if(!editable)return;
    if(!roof.geo)return notice("Trace and select a mapped roof first. Existing unmapped roof layouts remain in Roof design.");
    if(!mapReferenceCurrent(roof))return notice("This map reference is stale. Unlink or retrace it first.");
    const p=geoToLocal(roof,{lng:e.lngLat.lng,lat:e.lngLat.lat});
    if(tool==="move"){
      if(!object)return notice("Select a module or obstruction first.");
      const wh=panel?dims(panel,module):{width:obstacle!.width,height:obstacle!.height};
      move(p.x-wh.width/2,p.y-wh.height/2);return;
    }
    if(tool==="panel"){
      if(t.count>=150||t.kwp+module.watts/1000>50)return notice("This alpha supports up to 150 modules and 50 kWp.");
      const wh=dims({id:"",x:0,y:0,landscape},module);
      const next:Panel={id:`M-${crypto.randomUUID().slice(0,8)}`,x:round(p.x-wh.width/2),y:round(p.y-wh.height/2),landscape};
      if(!validPlacement(roof,next,module,d.gap))return notice("Placement blocked: module must fit the traced boundary, setbacks and gaps.");
      patchRoof({panels:[...roof.panels,next]});setSelected(next.id);
    }else if(tool==="obstacle"){
      if(roof.obstacles.length>=30)return notice("This roof supports up to 30 obstructions.");
      const o={id:crypto.randomUUID(),label:"Roof obstruction",x:round(p.x-.5),y:round(p.y-.5),width:1,height:1};
      const next={...roof,obstacles:[...roof.obstacles,o]};
      if(o.x<0||o.y<0||!rectangleInPolygon(o,roofOutline(roof))||roof.panels.some(p=>!validPlacement(next,p,module,d.gap)))return notice("Place the 1 m obstruction inside the roof and clear of modules.");
      patchRoof({obstacles:next.obstacles});setSelected(o.id);setTool("select");
    }
  };
  useEffect(()=>{
    if(!enabled||!config?.enabled||!container.current)return;
    let alive=true;setReady(false);setMapStatus("Loading sourced street geography…");
    const p=d.mapLocation||d.roofs.find(r=>r.geo)?.geo?.origin;
    const m=new MapView({container:container.current,style:config.styleUrl,center:p?[p.lng,p.lat]:[-2.5,54],zoom:p?18:5.5,maxZoom:22,maxPitch:0,renderWorldCopies:false,attributionControl:false,dragRotate:false,pitchWithRotate:false,touchPitch:false});
    map.current=m;
    m.addControl(new NavigationControl({showCompass:true,visualizePitch:false}),"top-right");
    m.addControl(new ScaleControl({maxWidth:120,unit:"metric"}),"bottom-left");
    m.addControl(new AttributionControl({compact:false}),"bottom-right");
    m.on("load",()=>{
      if(!alive)return;
      m.addSource("solar",{type:"geojson",data:structuredClone(empty)});
      m.addLayer({id:"solar-fill",type:"fill",source:"solar",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":["match",["get","kind"],"module","#193d52","obstruction","#b87931","#3f936a"],"fill-opacity":["match",["get","kind"],"roof",.12,.86]}});
      m.addLayer({id:"solar-outline",type:"line",source:"solar",filter:["==",["geometry-type"],"Polygon"],paint:{"line-color":["case",["==",["get","selected"],true],"#ffcf50",["==",["get","active"],true],"#0b7952","#516c7d"],"line-width":["case",["==",["get","selected"],true],3,1.5]}});
      m.addLayer({id:"solar-pin",type:"circle",source:"solar",filter:["==",["get","kind"],"site"],paint:{"circle-radius":7,"circle-color":"#087b53","circle-stroke-color":"#fff","circle-stroke-width":3}});
      m.addSource("trace",{type:"geojson",data:structuredClone(empty)});
      m.addLayer({id:"trace-line",type:"line",source:"trace",filter:["==",["geometry-type"],"LineString"],paint:{"line-color":"#b25d14","line-width":3,"line-dasharray":[2,1]}});
      m.addLayer({id:"trace-points",type:"circle",source:"trace",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":5,"circle-color":"#fff","circle-stroke-color":"#b25d14","circle-stroke-width":2}});
      setReady(true);setMapStatus("");
    });
    m.on("error",()=>{if(alive)setMapStatus("Some map data could not load. Check connectivity, attribution/provider configuration or retry; no imagery is substituted.");});
    m.on("click",e=>callbacks.current.click(e));
    const observer=new ResizeObserver(()=>m.resize());observer.observe(container.current);
    return()=>{alive=false;observer.disconnect();m.remove();map.current=null;};
  },[enabled,config?.enabled,config?.styleUrl]);
  useEffect(()=>{
    const m=map.current;if(!m||!ready)return;
    const fc=mapFeatures(d,module);fc.features.forEach(f=>{f.properties={...f.properties,active:f.properties?.roofId===roof.id,selected:!!selected&&f.properties?.id===selected&&f.properties?.roofId===roof.id};});
    (m.getSource("solar") as GeoJSONSource)?.setData(fc);
    const features:any[]=points.map(p=>({type:"Feature",properties:{},geometry:{type:"Point",coordinates:[p.lng,p.lat]}}));
    if(points.length>1)features.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:points.map(p=>[p.lng,p.lat])}});
    (m.getSource("trace") as GeoJSONSource)?.setData({type:"FeatureCollection",features});
    m.getCanvas().style.cursor=tool==="select"?"grab":"crosshair";
  },[d,ready,roof.id,selected,points,tool,module]);
  async function changeLayer(next:"street"|"satellite"){
    const m=map.current;if(!m||!ready||tool==="trace")return;
    if(next==="street"){if(m.getLayer("satellite-imagery"))m.setLayoutProperty("satellite-imagery","visibility","none");setLayer("street");return;}
    setSatBusy(true);
    try{
      if(!m.getSource("satellite-imagery")){
        const meta=await (await apiRequest("GET","/api/maps/satellite")).json();
        m.addSource("satellite-imagery",{type:"raster",tiles:[apiUrl("/api/maps/satellite/{z}/{x}/{y}")],tileSize:meta.tileSize,minzoom:meta.minzoom,maxzoom:meta.maxzoom,attribution:`<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> | ${meta.attribution}`});
        m.addLayer({id:"satellite-imagery",type:"raster",source:"satellite-imagery"},"solar-fill");
      }m.setLayoutProperty("satellite-imagery","visibility","visible");setLayer("satellite");
    }catch(e){notice(e instanceof Error?e.message:"Satellite is unavailable.");}finally{setSatBusy(false);}
  }
  const tools:[Tool,string,typeof MousePointer2][]=[["select","Select / pan",MousePointer2],["trace","Trace roof",SquareDashed],["panel","Place module",Plus],["obstacle","Obstruction",SquareDashed]];
  return <div className="map-design-workspace">
    <div className="section-intro"><div><h2>Locate. Trace. Design.</h2><p>Find the site and draw a preliminary array in its map location.</p></div><span className="tiny-tag">MAP WORKSPACE</span></div>
    {!enabled&&<div className="map-consent-bar"><div><strong>Enable sourced maps</strong><p>Your viewed area and IP address are sent to the configured map/tile providers. Address search has a separate opt-in; no customer details are sent automatically.</p></div><button data-testid="enable-map" className="button primary" disabled={!config?.enabled} onClick={()=>setEnabled(true)}>Enable third-party map</button></div>}
    <div className="map-layout">
      <aside className="map-location-panel content-panel">
        <div className="panel-heading"><h2>Find a property</h2><MapPin size={18}/></div>
        <div className="content-body form-stack">
          <form onSubmit={search} className="form-stack">
            <label className="field"><span>Address, postcode or place</span><div className="map-search-input"><Search size={16}/><input data-testid="map-address-query" value={query} minLength={3} maxLength={180} placeholder="e.g. Chorley Town Hall" onChange={e=>setQuery(e.target.value)}/></div></label>
            <label className="map-checkbox"><input data-testid="map-search-consent" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Send this search text to {config?.searchHost||"the configured Photon service"}. Do not include customer names or private notes.</span></label>
            <button data-testid="map-search" className="button primary full" disabled={!enabled||!config?.searchEnabled||!consent||query.trim().length<3||busy}><Search size={15}/>{busy?"Searching…":"Search UK locations"}</button>
          </form>
          {error&&<p className="inline-error" role="alert">{error}</p>}
          {results&&<div className="map-results" aria-live="polite">{!results.length?<p>No matching UK locations. Try a nearby named place or manual coordinates.</p>:<><p className="field-note">Choose a result; postcode/place pins are approximate.</p>{results.map(p=><button data-testid={`map-result-${p.id}`} key={p.id} className="map-result" onClick={()=>chooseLocation(p,p.label,"photon",p.postcode)}><strong>{p.label}</strong><span>{p.precision} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span><small>{editable?"Locate & use site pin":"View location"}</small></button>)}<small>Photon / © OpenStreetMap contributors</small></>}</div>}
          {editable&&<label className="map-checkbox"><input type="checkbox" data-testid="map-apply-address" checked={applyAddress} onChange={e=>setApplyAddress(e.target.checked)}/><span>Also replace the project address/postcode when I choose a search result.</span></label>}
          <details className="map-manual"><summary>Enter coordinates manually</summary><form className="form-stack" onSubmit={manual}><label className="field"><span>Latitude</span><input data-testid="map-latitude" inputMode="decimal" value={lat} onChange={e=>setLat(e.target.value)} placeholder="53.65396"/></label><label className="field"><span>Longitude</span><input data-testid="map-longitude" inputMode="decimal" value={lng} onChange={e=>setLng(e.target.value)} placeholder="−2.63328"/></label><button data-testid="map-manual-go" className="button secondary" disabled={!enabled||!ready}>Go to coordinates{editable?" & set pin":""}</button></form></details>
          {d.mapLocation&&<div className="map-site-record"><span className="eyebrow">PROJECT SITE PIN</span><strong>{d.mapLocation.label}</strong><span>{d.mapLocation.lat.toFixed(6)}, {d.mapLocation.lng.toFixed(6)}</span><small>{d.mapLocation.source==="photon"?"Geocoded / approximate":"Manually positioned"} · changing the pin never moves roof drawings.</small><button className="text-button" onClick={()=>map.current?.flyTo({center:[d.mapLocation!.lng,d.mapLocation!.lat],zoom:18})} disabled={!ready}><Navigation size={14}/>Return to site</button></div>}
          <p className="field-note">Search runs only when submitted. Street footprints, geocoder pins and map distances are not verified roof surveys.</p>
        </div>
      </aside>
      <section className="map-editor-column">
        <div className="map-toolbar">
          <div className="map-tools">{tools.map(([key,label,Icon])=><button key={key} data-testid={`map-tool-${key}`} className={`button ${tool===key?"map-tool-active":"secondary"}`} aria-pressed={tool===key} disabled={!ready||(key!=="select"&&!editable)||(tool==="trace"&&key!=="trace")} onClick={()=>{setSelected(null);setTool(key);setConfirmFill(false);}}><Icon size={15}/>{label}</button>)}</div>
          <div className="tool-group"><button className="icon-button" aria-label="Undo map change" data-testid="map-undo" disabled={!editable||!historyCount||tool==="trace"} onClick={undo}><Undo2 size={16}/></button><button className="icon-button" aria-label="Redo map change" data-testid="map-redo" disabled={!editable||!futureCount||tool==="trace"} onClick={redo}><Redo2 size={16}/></button><button className="icon-button" aria-label="Fit selected mapped roof" data-testid="map-fit" disabled={!ready||!roof.geo} onClick={()=>focusRoof()}><Scan size={16}/></button></div>
        </div>
        <div className="map-stage">
          <div ref={container} className="site-map" data-testid="site-map" role="region" aria-label="Interactive UK site design map"/>
          {!enabled&&<div className="map-enable"><MapPin size={30}/><h3>Start with the site</h3><p>Use the consent control above to enable the sourced street map. Then find an address or enter coordinates, trace a roof and design its array.</p><small>{configError?"Map settings could not load.":config&&!config.enabled?"Maps are disabled by the server operator.":"OpenFreeMap streets · MapLibre · no paid key required"}</small></div>}
          {enabled&&<div className="map-layer-switch"><button className={layer==="street"?"active":""} disabled={!ready||tool==="trace"} onClick={()=>changeLayer("street")}>Streets</button><button data-testid="map-satellite" title={config?.satelliteConfigured?"Uses configured licensed MapTiler imagery":"Operator must configure an authorised MapTiler key"} className={layer==="satellite"?"active":""} disabled={!ready||!config?.satelliteConfigured||satBusy||tool==="trace"} onClick={()=>changeLayer("satellite")}>{satBusy?"Loading…":"Satellite"}{!config?.satelliteConfigured?" · not configured":""}</button></div>}
          {enabled&&mapStatus&&<p className="map-status" role="status">{mapStatus}</p>}
        </div>
        <div className="map-instruction"><Info size={15}/><span>{tool==="trace"?`Tracing · ${points.length}/32 vertices. First edge along the upper/ridge edge, then clockwise with the slope to your right. Finish with the button below.`:tool==="panel"?"Click a valid roof position to place the module centre.":tool==="obstacle"?"Click to place a 1 m × 1 m obstruction, clear of modules.":tool==="move"?"Click the new centre for your selection.":"Pan and zoom, or click a mapped roof, module or obstruction to select it."}</span></div>
        {tool==="trace"?<section className="content-panel map-properties"><div className="panel-heading"><h2>Trace a roof face</h2><span className="tiny-tag">{points.length} VERTICES</span></div><div className="content-body"><div className="map-properties-grid"><label className="field"><span>Trace destination</span><select data-testid="map-trace-target" value={traceTarget} onChange={e=>setTraceTarget(e.target.value)}><option value="new">New roof face</option>{d.roofs.filter(r=>!r.geo&&!r.panels.length&&!r.obstacles.length).map(r=><option key={r.id} value={r.id}>Replace empty {r.name}</option>)}</select></label><NumericField label="Assumed roof pitch" value={pitch} min={0} max={75} step={1} suffix="°" onChange={setPitch}/><div className="map-property-actions"><button data-testid="map-finish-trace" className="button primary" disabled={!editable||points.length<3} onClick={finish}>Finish roof</button><button className="button secondary" disabled={!points.length} onClick={()=>setPoints(points.slice(0,-1))}>Undo vertex</button><button className="text-button" onClick={()=>{setPoints([]);setTool("select");}}>Cancel trace</button></div></div><p className="field-note">0° is a plan-plane estimate, not a measured pitch. Non-zero pitch converts horizontal downslope distances into estimated roof-plane length. First-edge direction sets azimuth; verify both externally. Do not click the first point again to close the polygon.</p></div></section>:
        <section className="content-panel map-properties"><div className="panel-heading"><h2>Drawing controls</h2><span className="tiny-tag">{roof.geo?"MAPPED":"NOT YET MAPPED"}</span></div><div className="content-body">
          <div className="map-properties-grid">
            <label className="field"><span>Active roof face</span><select data-testid="map-active-roof" value={roof.id} onChange={e=>{setRoofId(e.target.value);setSelected(null);setConfirmFill(false);setTool("select");const r=d.roofs.find(r=>r.id===e.target.value);if(r)focusRoof(r);}}>{d.roofs.map(r=><option value={r.id} key={r.id}>{r.name}{r.geo?" · mapped":" · unlocated"} · {r.panels.length} modules</option>)}</select></label>
            <label className="field"><span>Selection</span><select data-testid="map-selection" value={selected||""} onChange={e=>{setSelected(e.target.value||null);setTool("select");}}><option value="">Roof properties</option>{roof.panels.map((p,i)=><option key={p.id} value={p.id}>Module {i+1} · {p.id}</option>)}{roof.obstacles.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            <div className="map-roof-summary"><strong>{roof.geo?`${polygonArea(roofOutline(roof)).toFixed(1)} m² roof plane`:"Trace to locate a roof"}</strong><small>{roof.width} × {roof.height} m bounds · {roof.pitch}° pitch · {roof.azimuth}° azimuth</small><small>{roof.geo?`${roof.geo.basis} · approximate coordinates`:"Original layouts stay in Roof design; no map position is invented."}</small></div>
          </div>
          {roof.geo&&!mapReferenceCurrent(roof)&&<p className="inline-error">Map reference is stale. Unlink it in Roof design or retrace before placement.</p>}
          {object?<div className="map-properties-grid map-selection-controls"><NumericField disabled={!editable} label="Map selection X" suffix="m" value={object.x} min={0} max={roof.width} step={.05} onChange={v=>move(v,object.y)}/><NumericField disabled={!editable} label="Map selection Y" suffix="m" value={object.y} min={0} max={roof.height} step={.05} onChange={v=>move(object.x,v)}/><div className="map-property-actions"><button data-testid="map-move-selection" className="button secondary" disabled={!editable||!roof.geo} onClick={()=>setTool("move")}>Move on map</button>{panel&&<button data-testid="map-rotate-selection" className="icon-button" aria-label="Rotate selected module" disabled={!editable} onClick={()=>{const p={...panel,landscape:!panel.landscape};if(validPlacement(roof,p,module,d.gap))patchRoof({panels:roof.panels.map(a=>a.id===p.id?p:a)});else notice("Rotation blocked by roof outline, clearance or another object.");}}><RotateCw size={17}/></button>}<button data-testid="map-remove-selection" className="icon-button" aria-label="Remove map selection" disabled={!editable} onClick={()=>{patchRoof({panels:roof.panels.filter(p=>p.id!==selected),obstacles:roof.obstacles.filter(o=>o.id!==selected)});setSelected(null);setTool("select");}}><Trash2 size={17}/></button></div></div>:
          <div className="map-properties-grid map-selection-controls"><NumericField disabled={!editable} label="Mapped edge clearance" value={roof.setback} min={0} max={3} step={.05} suffix="m" onChange={v=>patchRoof({setback:v})}/><label className="field"><span>Module orientation</span><select data-testid="map-orientation" value={landscape?"landscape":"portrait"} disabled={!editable} onChange={e=>setLandscape(e.target.value==="landscape")}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><button data-testid="map-auto-fill" className="button primary" disabled={!editable||!roof.geo||!mapReferenceCurrent(roof)} onClick={()=>{
            if(roof.panels.length&&!confirmFill){setConfirmFill(true);return;}
            const others=d.roofs.filter(r=>r.id!==roof.id).reduce((n,r)=>n+r.panels.length,0),limit=Math.max(0,Math.min(150-others,Math.floor(50000/module.watts)-others));
            const panels=fillRoof(roof,module,d.gap,landscape,limit);patchRoof({panels});notice(`${panels.length} modules fit this traced boundary. Undo restores the previous layout; verify any electrical string assignments.`);
          }}>{confirmFill?"Confirm replace modules":"Auto-fill traced roof"}</button></div>}
          {confirmFill&&<p className="field-note">This replaces this face's module layout and may stale string assignments. Undo is available until you leave this tab.</p>}
        </div></section>}
        <div className="design-stats"><div><span>Total array</span><strong>{t.kwp.toFixed(2)} <small>kWp</small></strong></div><div><span>Modules</span><strong data-testid="map-module-count">{t.count}</strong></div><div><span>Mapped roof faces</span><strong>{d.roofs.filter(r=>r.geo).length}</strong></div><div><span>Roof-plane area</span><strong>{t.area.toFixed(1)} <small>m²</small></strong></div></div>
      </section>
    </div>
    <p className="workspace-footnote"><Info size={13}/>Preliminary site design, not a survey. No imagery is bundled in exports; saved GeoJSON is available in Documents. Confirm imagery rights, dimensions and engineering externally.</p>
  </div>;
}
