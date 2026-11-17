import {modules,inverters,type Design,type ElectricalDesign,type ModuleSpec,type InverterSpec,type StringDesign} from "./schema";

export const STRING_COLOURS=["#167451","#35658d","#956c31","#765681","#416b68","#99554e","#637732","#495b90"];
export type ElectricalFinding={id:string;severity:"error"|"review";message:string;stringId?:string;mpptKey?:string};
export type StringResult={id:string;name:string;moduleCount:number;inverterIndex:number;mpptIndex:number;coldVoc:number|null;hotVmp:number|null;coldVmp:number|null;imp:number|null;designIsc:number|null;status:"error"|"incomplete"|"within-reference-limits"};
export type MpptResult={key:string;inverterIndex:number;mpptIndex:number;stringCount:number;operatingCurrent:number;designIsc:number;status:"error"|"incomplete"|"within-reference-limits"};
export type ElectricalReport={
  methodVersion:"reference-stringing-v1";provenance:"unverified-reference"|"manufacturer-datasheet"|"mixed";
  enabled:boolean;status:"disabled"|"error"|"incomplete"|"within-reference-limits";
  assumptions:{minCellTemp:number;maxCellTemp:number;iscFactor:number};
  placed:number;assigned:number;unassignedIds:string[];findings:ElectricalFinding[];
  stringResults:StringResult[];mpptResults:MpptResult[];
  module:ModuleSpec;inverter:InverterSpec;inverterCount:number;
};
export function hardware(d:Design){
  return {
    module:d.catalogueSnapshot?.module.id===d.moduleId?d.catalogueSnapshot.module:modules.find(m=>m.id===d.moduleId)!,
    inverter:d.catalogueSnapshot?.inverter.id===d.inverterId?d.catalogueSnapshot.inverter:inverters.find(i=>i.id===d.inverterId)!,
  };
}
export const electricalDefaults=():ElectricalDesign=>({enabled:true,minCellTemp:-10,maxCellTemp:70,iscFactor:1.25,strings:[]});
export function correctedVoltage(voltage:number,coefficient:number,temp:number){return voltage*(1+coefficient*(temp-25));}
export function assessElectrical(d:Design):ElectricalReport{
  const e=d.electrical||{...electricalDefaults(),enabled:false},h=hardware(d);
  const placed=d.roofs.flatMap(r=>r.panels.map(p=>({id:p.id,roof:r})));
  const byId=new Map(placed.map(p=>[p.id,p])), findings:ElectricalFinding[]=[];
  const assigned=new Set<string>(),seen=new Set<string>();
  const fail=(id:string,message:string,stringId?:string,mpptKey?:string)=>findings.push({id,severity:"error",message,stringId,mpptKey});
  const review=(id:string,message:string,stringId?:string,mpptKey?:string)=>findings.push({id,severity:"review",message,stringId,mpptKey});
  const base={methodVersion:"reference-stringing-v1" as const,provenance:equipmentProvenance(h.module,h.inverter),enabled:e.enabled,
    assumptions:{minCellTemp:e.minCellTemp,maxCellTemp:e.maxCellTemp,iscFactor:e.iscFactor},placed:placed.length,
    module:h.module,inverter:h.inverter,inverterCount:d.inverterCount};
  if(!e.enabled)return {...base,status:"disabled",assigned:0,unassignedIds:placed.map(p=>p.id),findings:[],stringResults:[],mpptResults:[]};
  if(e.minCellTemp>=e.maxCellTemp)fail("temperature","Minimum cell temperature must be lower than maximum cell temperature.");
  if(h.inverter.phase!==d.phase)fail("supply-phase","Reference inverter phase does not match the recorded supply.");
  const stringResults:StringResult[]=e.strings.map(s=>{
    if(seen.has(s.id))fail(`duplicate-string-${s.id}`,"String identifiers must be unique.",s.id);seen.add(s.id);
    if(s.inverterIndex>=d.inverterCount)fail(`inverter-${s.id}`,`${s.name}: assigned inverter no longer exists.`,s.id);
    if(s.mpptIndex>=h.inverter.mpptCount)fail(`mppt-${s.id}`,`${s.name}: MPPT input no longer exists.`,s.id);
    for(const id of s.moduleIds){
      if(!byId.has(id))fail(`missing-${s.id}-${id}`,`${s.name}: assigned module ${id} is no longer in the roof layout.`,s.id);
      else {if(assigned.has(id))fail(`duplicate-${s.id}-${id}`,`${s.name}: a module is assigned more than once.`,s.id);assigned.add(id);}
    }
    const unique=s.moduleIds.length===new Set(s.moduleIds).size&&s.moduleIds.every(id=>byId.has(id));
    const hasModules=s.moduleIds.length>0&&unique;
    if(!s.moduleIds.length)review(`empty-${s.id}`,`${s.name}: assign modules before evaluating.`,s.id);
    const roofs=s.moduleIds.map(id=>byId.get(id)?.roof).filter(Boolean);
    if(new Set(roofs.map(r=>`${r!.pitch}:${r!.azimuth}`)).size>1)review(`orientations-${s.id}`,`${s.name}: mixed roof pitch/orientation needs specialist assessment.`,s.id);
    const coldVoc=hasModules?correctedVoltage(h.module.voc,h.module.betaVoc,e.minCellTemp)*s.moduleIds.length:null;
    const hotVmp=hasModules&&h.module.betaVmp!==undefined?correctedVoltage(h.module.vmp,h.module.betaVmp,e.maxCellTemp)*s.moduleIds.length:null;
    const coldVmp=hasModules&&h.module.betaVmp!==undefined?correctedVoltage(h.module.vmp,h.module.betaVmp,e.minCellTemp)*s.moduleIds.length:null;
    if(hasModules&&h.module.betaVmp===undefined)review(`coefficient-${s.id}`,`${s.name}: missing Vmp temperature coefficient; MPPT voltage checks not evaluated.`,s.id);
    if(coldVoc!==null&&coldVoc>h.inverter.maxDc+1e-6)fail(`voc-${s.id}`,`${s.name}: cold Voc ${coldVoc.toFixed(1)} V exceeds ${h.inverter.maxDc} V DC maximum.`,s.id);
    if(hotVmp!==null&&hotVmp<h.inverter.mpptMin-1e-6)fail(`hot-${s.id}`,`${s.name}: hot Vmp ${hotVmp.toFixed(1)} V is below ${h.inverter.mpptMin} V MPPT minimum.`,s.id);
    if(coldVmp!==null&&coldVmp>h.inverter.mpptMax+1e-6)fail(`cold-${s.id}`,`${s.name}: cold Vmp ${coldVmp.toFixed(1)} V exceeds ${h.inverter.mpptMax} V MPPT maximum.`,s.id);
    if(hasModules&&h.module.imp>h.inverter.maxInputCurrent+1e-6)fail(`input-imp-${s.id}`,`${s.name}: operating current exceeds the per-input reference limit.`,s.id);
    if(hasModules&&h.module.isc*e.iscFactor>h.inverter.maxInputIsc+1e-6)fail(`input-isc-${s.id}`,`${s.name}: factored Isc exceeds the per-input reference limit.`,s.id);
    return {id:s.id,name:s.name,moduleCount:s.moduleIds.length,inverterIndex:s.inverterIndex,mpptIndex:s.mpptIndex,coldVoc,hotVmp,coldVmp,
      imp:hasModules?h.module.imp:null,designIsc:hasModules?h.module.isc*e.iscFactor:null,status:"incomplete"};
  });
  const mpptResults:MpptResult[]=[];
  for(let inv=0;inv<d.inverterCount;inv++)for(let mppt=0;mppt<h.inverter.mpptCount;mppt++){
    const key=`${inv}:${mppt}`,ss=stringResults.filter(s=>s.inverterIndex===inv&&s.mpptIndex===mppt);
    if(!ss.length)continue;
    const op=ss.reduce((sum,s)=>sum+(s.imp||0),0),isc=ss.reduce((sum,s)=>sum+(s.designIsc||0),0);
    if(ss.length>h.inverter.inputsPerMppt)fail(`inputs-${key}`,`INV ${inv+1} / MPPT ${mppt+1}: ${ss.length} strings exceed ${h.inverter.inputsPerMppt} reference inputs.`,undefined,key);
    if(op>h.inverter.maxMpptCurrent+1e-6)fail(`parallel-imp-${key}`,`INV ${inv+1} / MPPT ${mppt+1}: parallel operating current ${op.toFixed(2)} A exceeds ${h.inverter.maxMpptCurrent} A.`,undefined,key);
    if(isc>h.inverter.maxMpptIsc+1e-6)fail(`parallel-isc-${key}`,`INV ${inv+1} / MPPT ${mppt+1}: factored parallel Isc ${isc.toFixed(2)} A exceeds ${h.inverter.maxMpptIsc} A.`,undefined,key);
    if(new Set(ss.filter(s=>s.moduleCount>0).map(s=>s.moduleCount)).size>1)review(`parallel-length-${key}`,`INV ${inv+1} / MPPT ${mppt+1}: unequal parallel string lengths need review.`,undefined,key);
    const roofOrientations=new Set(e.strings.filter(s=>s.inverterIndex===inv&&s.mpptIndex===mppt).flatMap(s=>s.moduleIds).map(id=>byId.get(id)?.roof).filter(Boolean).map(r=>`${r!.pitch}:${r!.azimuth}`));
    if(roofOrientations.size>1)review(`parallel-orientation-${key}`,`INV ${inv+1} / MPPT ${mppt+1}: parallel strings on different roof orientations need review.`,undefined,key);
    mpptResults.push({key,inverterIndex:inv,mpptIndex:mppt,stringCount:ss.length,operatingCurrent:op,designIsc:isc,status:"incomplete"});
  }
  const unassignedIds=placed.filter(p=>!assigned.has(p.id)).map(p=>p.id);
  if(!e.strings.length)review("no-strings","No strings configured. Add a string or use a suggestion.");
  if(!placed.length)review("no-placed-modules","No placed modules to configure.");
  if(unassignedIds.length)review("unassigned",`${unassignedIds.length} placed module(s) remain unassigned.`);
  for(const s of stringResults){
    const own=findings.filter(f=>f.stringId===s.id||f.mpptKey===`${s.inverterIndex}:${s.mpptIndex}`);
    s.status=own.some(f=>f.severity==="error")?"error":own.length||s.hotVmp===null?"incomplete":"within-reference-limits";
  }
  for(const mppt of mpptResults){
    const ss=stringResults.filter(s=>`${s.inverterIndex}:${s.mpptIndex}`===mppt.key);
    mppt.status=ss.some(s=>s.status==="error")?"error":ss.some(s=>s.status==="incomplete")||findings.some(f=>f.id===`parallel-length-${mppt.key}`)?"incomplete":"within-reference-limits";
  }
  return {...base,status:findings.some(f=>f.severity==="error")?"error":findings.length?"incomplete":"within-reference-limits",
    assigned:assigned.size,unassignedIds,findings,stringResults,mpptResults};
}
export function suggestStrings(d:Design):StringDesign[]{
  const {module:m,inverter:inv}=hardware(d),e=d.electrical||electricalDefaults();
  const maxByVoc=Math.floor(inv.maxDc/correctedVoltage(m.voc,m.betaVoc,e.minCellTemp));
  const maxByVmp=m.betaVmp===undefined?maxByVoc:Math.floor(inv.mpptMax/correctedVoltage(m.vmp,m.betaVmp,e.minCellTemp));
  const maxLength=Math.max(1,Math.min(maxByVoc,maxByVmp));
  const strings:StringDesign[]=[];let slot=0;
  for(const roof of d.roofs){
    const count=roof.panels.length;if(!count)continue;
    const groups=Math.ceil(count/maxLength),length=Math.floor(count/groups),remainder=count%groups;
    let offset=0;
    for(let i=0;i<groups;i++){
      const n=length+(i<remainder?1:0),port=slot%(d.inverterCount*inv.mpptCount);
      strings.push({id:`string-${strings.length+1}`,name:`S${String(strings.length+1).padStart(2,"0")}`,inverterIndex:Math.floor(port/inv.mpptCount),mpptIndex:port%inv.mpptCount,
        moduleIds:roof.panels.slice(offset,offset+n).map(p=>p.id)});
      offset+=n;slot++;
    }
  }
  return strings;
}
// Freeze server-authoritative equipment. Ignore new client-supplied limits.
export function freezeHardware(d:Design,previous?:Design):Design{
  const old=previous?.catalogueSnapshot;
  const module=old?.module.id===d.moduleId?old.module:modules.find(m=>m.id===d.moduleId)!;
  const inverter=old?.inverter.id===d.inverterId?old.inverter:inverters.find(i=>i.id===d.inverterId)!;
  return {...d,catalogueSnapshot:{version:module.source||inverter.source?"catalogue-v3":"reference-v2",provenance:equipmentProvenance(module,inverter),module:structuredClone(module),inverter:structuredClone(inverter)}};
}
export function equipmentProvenance(module:ModuleSpec,inverter:InverterSpec):ElectricalReport["provenance"]{
  return module.source&&inverter.source?"manufacturer-datasheet":module.source||inverter.source?"mixed":"unverified-reference";
}
