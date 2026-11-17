import { modules, inverters, type Design, type Roof, type Panel, type ModuleSpec } from "./schema";
import {hardware,assessElectrical} from "./electrical";
import {quoteLinePence,type QuoteReport,type QuoteLine} from "./quote-schema";
import {polygonArea,rectangleInPolygon,simplePolygon} from "./geometry";
import {mapReferenceCurrent} from "./map-geometry";

export type Rect = { x:number; y:number; width:number; height:number };
export type Finding = { id:string; severity:"error"|"review"; message:string; detail:string };
export function mergeDesignUpdate(previous:Design,next:Design):Design{
  return {...previous,...next,mapLocation:next.mapLocation===undefined?previous.mapLocation:next.mapLocation,
    roofs:next.roofs.map(r=>{const old=previous.roofs.find(a=>a.id===r.id);return {...r,boundary:r.boundary===undefined?old?.boundary:r.boundary,geo:r.geo===undefined?old?.geo:r.geo};}),
    pricing:{...next.pricing,proposal:next.pricing.proposal===undefined?previous.pricing.proposal:next.pricing.proposal},electrical:next.electrical??previous.electrical,intervalAnalysis:next.intervalAnalysis??previous.intervalAnalysis,survey:next.survey??previous.survey,mounting:next.mounting??previous.mounting};
}
export const round = (n:number) => Math.round(n*1000)/1000;
export function stableJSON(value:unknown):string {
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==="object"?
    Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,a])=>[k,canonical(a)])):v;
  return JSON.stringify(canonical(value));
}
export const dims = (p:Panel, m:ModuleSpec) => ({ width:p.landscape ? m.height:m.width, height:p.landscape ? m.width:m.height });
export function overlaps(a:Rect,b:Rect,gap=0) {
  return a.x+a.width+gap>b.x+1e-6 && b.x+b.width+gap>a.x+1e-6 &&
    a.y+a.height+gap>b.y+1e-6 && b.y+b.height+gap>a.y+1e-6;
}
export function validPlacement(roof:Roof, p:Panel, m:ModuleSpec, gap:number, ignoreId=p.id) {
  const r={...p,...dims(p,m)}, s=roof.setback;
  if(r.x<s-1e-6 || r.y<s-1e-6 || r.x+r.width>roof.width-s+1e-6 || r.y+r.height>roof.height-s+1e-6) return false;
  if(roof.boundary&&(!simplePolygon(roof.boundary)||!rectangleInPolygon(r,roof.boundary,s)))return false;
  if(roof.obstacles.some(o=>overlaps(r,o,gap))) return false;
  return !roof.panels.some(other=>other.id!==ignoreId && overlaps(r,{...other,...dims(other,m)},gap));
}
export function fillRoof(roof:Roof,m:ModuleSpec,gap:number,landscape=false,limit=150):Panel[] {
  const w=landscape?m.height:m.width, h=landscape?m.width:m.height;
  const next:Roof={...roof,panels:[]}; let index=1;
  for(let y=roof.setback;y+h<=roof.height-roof.setback+1e-6;y+=h+gap)
    for(let x=roof.setback;x+w<=roof.width-roof.setback+1e-6;x+=w+gap) {
      const p={id:`${roof.id}-M${String(index).padStart(3,"0")}`,x:round(x),y:round(y),landscape};
      if(next.panels.length<limit && validPlacement(next,p,m,gap)) {next.panels.push(p);index++;}
    }
  return next.panels;
}
export function totals(d:Design) {
  const {module,inverter}=hardware(d);
  const count=d.roofs.reduce((a,r)=>a+r.panels.length,0);
  const kwp=count*module.watts/1000;
  const area=d.roofs.reduce((a,r)=>a+(r.boundary?polygonArea(r.boundary):r.width*r.height),0);
  const generation=Math.round(kwp*d.energy.yieldPerKwp*d.energy.shadeFactor);
  // User-supplied assumption only. No MCS or time-series self-consumption claim.
  const selfUsed=Math.min(generation*d.energy.selfConsumption/100,d.energy.consumption);
  const exported=generation-selfUsed;
  const saving=selfUsed*d.energy.importRate+exported*d.energy.exportRate;
  const p=d.pricing;
  const base=[
    {name:module.name,quantity:count,unitPence:Math.round(p.panelSell*100)},
    {name:"Mounting allowance (not engineered)",quantity:count,unitPence:Math.round(p.mountingPerPanel*100)},
    {name:inverter.name,quantity:d.inverterCount,unitPence:Math.round(p.inverterSell*100)},
    {name:"Installation labour",quantity:1,unitPence:Math.round(p.labour*100)},
    {name:"Scaffolding & access",quantity:1,unitPence:Math.round(p.access*100)},
    {name:"Other project allowance",quantity:1,unitPence:Math.round(p.other*100)},
  ];
  const extra=(p.proposal?.items||[]).map(i=>({id:i.id,name:i.description,quantity:i.quantity,unit:i.unit,unitPence:Math.round(i.unitPrice*100),amountPence:quoteLinePence(i.quantity,Math.round(i.unitPrice*100)),included:i.included}));
  const lines:QuoteLine[]=[...base.map((l,i)=>({...l,id:`base-${i}`,unit:"item",amountPence:quoteLinePence(l.quantity,l.unitPence)})),...extra.filter(i=>i.included).map(i=>({...i,id:`extra-${i.id}`}))];
  const optionalLines:QuoteLine[]=extra.filter(i=>!i.included).map(i=>({...i,id:`extra-${i.id}`}));
  const netPence=lines.reduce((a,l)=>a+l.amountPence,0);
  const vatPence=Math.round(netPence*Number(p.vat)/100), totalPence=netPence+vatPence;
  return {module,inverter,count,kwp,area,generation,selfUsed,exported,saving,lines,optionalLines,netPence,vatPence,totalPence,
    acKw:inverter.kw*d.inverterCount, mass:count*module.mass};
}
export function quoteReport(d:Design):QuoteReport{
  const t=totals(d);
  return {methodVersion:"itemised-quote-v1",currency:"GBP",lines:t.lines,optionalLines:t.optionalLines,netPence:t.netPence,
    vatRate:d.pricing.vat,vatPence:t.vatPence,totalPence:t.totalPence,taxBasis:d.pricing.taxBasis,
    presentation:d.pricing.proposal?structuredClone(d.pricing.proposal):null};
}
export function validateDesign(d:Design):Finding[] {
  const t=totals(d), f:Finding[]=[];
  if(!t.count) f.push({id:"empty",severity:"error",message:"No modules placed",detail:"Place at least one module before creating a preliminary proposal."});
  if(t.count>150 || t.kwp>50) f.push({id:"scope",severity:"error",message:"Supported capacity exceeded",detail:"This alpha supports up to 150 modules and 50 kWp DC."});
  const ids=new Set<string>();
  d.roofs.forEach(r=>{
    if(ids.has(r.id)) f.push({id:`duplicate-roof-${r.id}`,severity:"error",message:"Duplicate roof identifier",detail:"Each roof must have a unique identifier."});
    ids.add(r.id);
    if(r.boundary&&(!simplePolygon(r.boundary)||r.boundary.some(p=>p.x>r.width+.001||p.y>r.height+.001)))
      f.push({id:`boundary-${r.id}`,severity:"error",message:`${r.name}: invalid roof boundary`,detail:"Retrace a simple polygon inside its declared roof-plane bounds."});
    if(!mapReferenceCurrent(r))f.push({id:`georeference-${r.id}`,severity:"error",message:`${r.name}: map reference is stale`,detail:"Mapped dimensions, pitch or azimuth changed. Unlink the map reference or retrace before using this layout."});
    r.obstacles.forEach(o=>{
      if(o.x+o.width>r.width+1e-6||o.y+o.height>r.height+1e-6||(r.boundary&&!rectangleInPolygon(o,r.boundary)))
        f.push({id:`obstacle-${o.id}`,severity:"error",message:`${r.name}: obstruction outside roof`,detail:"Resize or reposition the obstruction within the roof face."});
    });
    r.panels.forEach(p=>{
      if(ids.has(p.id)) f.push({id:`duplicate-${p.id}`,severity:"error",message:"Duplicate module identifier",detail:p.id});
      ids.add(p.id);
      if(!validPlacement(r,p,t.module,d.gap)) f.push({id:p.id,severity:"error",message:`${r.name}: ${p.id.split("-").pop()} conflicts`,detail:"Check roof containment, edge clearance, obstacles and module spacing."});
    });
  });
  if(t.inverter.phase!==d.phase) f.push({id:"phase",severity:"error",message:"Inverter and supply phase differ",detail:"Select compatible reference equipment or update the supply record."});
  if(d.electrical?.enabled)for(const finding of assessElectrical(d).findings)
    f.push({id:`electrical-${finding.id}`,severity:finding.severity,message:finding.message,detail:"Reference stringing check only. Correct the configuration or obtain specialist review."});
  f.push(
    {id:"catalogue",severity:"review",message:t.module.source&&t.inverter.source?"Manufacturer-backed inputs require review":t.module.source||t.inverter.source?"Mixed manufacturer and reference equipment":"Reference equipment only",detail:t.module.source||t.inverter.source?"Exact datasheet revisions are recorded with equipment. Confirm regional variant, current approvals, missing inputs and full manufacturer restrictions. Prices remain editable allowances.":"Sample specifications and prices are not verified manufacturer data."},
    {id:"survey",severity:"review",message:"Site survey not verified",detail:"Roof dimensions, construction, shading and electrical supply require confirmation."},
    {id:"electrical",severity:"review",message:"Electrical design requires review",detail:"Reference string checks are not verified engineering. Protective devices, cables, earthing and the full installation require specialist design."},
    {id:"structural",severity:"review",message:"Structural assessment required",detail:"Panel mass is not a wind, snow, ballast or roof-capacity calculation."},
    {id:"grid",severity:"review",message:d.nation==="Northern Ireland"?"NI grid-route review required":"Grid-connection review required",detail:"No G98/G99/G100 route or network approval is determined by this alpha."},
    {id:"yield",severity:"review",message:"Energy estimate is illustrative",detail:"Uses user-entered yield and self-consumption assumptions; not an MCS estimate or PVGIS result."},
  );
  return f;
}
export function defaultDesign(input?:Partial<Design>):Design {
  return {
    customer:"New customer",address:"Site to confirm",postcode:"UK",nation:"England",type:"Residential",
    phase:"Single phase",notes:"",moduleId:"ref-440",inverterId:"ref-inv-5",inverterCount:1,gap:.02,
    roofs:[{id:"roof-1",name:"Main roof",width:10,height:6,pitch:35,azimuth:180,setback:.4,panels:[],obstacles:[]}],
    pricing:{panelSell:120,mountingPerPanel:65,inverterSell:1050,labour:1800,access:650,other:250,vat:"20",taxBasis:"Tax treatment unconfirmed. Confirm eligibility and tax point before customer use."},
    energy:{yieldPerKwp:850,shadeFactor:.95,consumption:4200,selfConsumption:35,importRate:.25,exportRate:.10},
    ...input,
  };
}
