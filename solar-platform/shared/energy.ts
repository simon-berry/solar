import { intervalDatasetSchema, batterySchema, type IntervalDataset, type Battery } from "./energy-schema";
import type { Design } from "./schema";

export type ImportOptions=Omit<IntervalDataset,"rows"> & {units:"kWh"|"kW";timestampPosition:"start"|"end"};
export type Diagnostics={valid:boolean;problems:string[];gaps:number;missingIntervals:number;duplicates:number;reordered:boolean;coveragePercent:number;observedHours:number;spanHours:number;start:string;end:string};
export type Dispatch={start:string;load:number;pv:number;direct:number;charge:number;discharge:number;import:number;export:number;loss:number;soc:number};
export type Simulation={usableKwh:number;load:number;pv:number;direct:number;charge:number;discharge:number;import:number;export:number;loss:number;initialSoc:number;finalSoc:number;baselineImport:number;baselineExport:number;importReduction:number;terminalReplacementKwh:number;terminalAllowance:number;periodValue:number;cycles:number;maxBalanceError:number};
export type EnergyReport={
  methodVersion:"ac-self-consumption-v1";datasetLabel:string;consumptionKind:IntervalDataset["consumptionKind"];pvKind:IntervalDataset["pvKind"];timezone:string;
  diagnostics:Diagnostics;consumptionKwh:number;peakKw:number;averageKw:number;pvKwh:number|null;
  daily:{date:string;load:number;pv:number}[];monthly:{month:string;load:number;pv:number}[];hourly:{hour:number;averageKw:number|null}[];
  selected:Simulation|null;candidates:Simulation[];suggestedKwh:number|null;blockedReason:string|null;assumptions:string[];
};

// Quoted RFC-style CSV fields, including BOM, CRLF and escaped quotes. No locale-number guessing.
function csvRows(text:string):string[][]{
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false,closed=false;
  const finishField=()=>{row.push(field);field="";closed=false;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field.trim()||closed)throw Error("Malformed CSV quoting.");field="";quoted=true;}
    else if(c===","){finishField();}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;finishField();if(row.some(x=>x.trim()))rows.push(row);row=[];}
    else {if(closed&&!/\s/.test(c))throw Error("Unexpected text after a quoted CSV field.");if(!closed)field+=c;}
    if(rows.length>20001)throw Error("Maximum 20,000 intervals per import.");
  }
  if(quoted)throw Error("Unclosed quoted CSV field.");
  finishField();if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
export function timestampMillis(s:string):number{
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);
  if(!m)throw Error("Use ISO timestamps with Z or an explicit UTC offset, e.g. 2026-07-01T12:00:00+01:00. Local times without an offset are ambiguous at UK clock changes.");
  const [,y,mo,day,h,mi,se="0",offset]=m;
  const days=new Date(Date.UTC(+y,+mo,0)).getUTCDate();
  if(+y<1900||+mo<1||+mo>12||+day<1||+day>days||+h>23||+mi>59||+se>59||
    (offset!=="Z"&&(+offset.slice(1,3)>14||+offset.slice(4)>59||(+offset.slice(1,3)===14&&+offset.slice(4)!==0))))throw Error("Invalid calendar date or UTC offset.");
  const t=Date.parse(s);if(!Number.isFinite(t))throw Error("Invalid timestamp.");return t;
}
export function parseIntervalCsv(text:string,options:ImportOptions):IntervalDataset{
  if(text.length>4_000_000)throw Error("CSV exceeds the 4 MB import limit.");
  const all=csvRows(text.replace(/^\uFEFF/,"")),header=all.shift()?.map(x=>x.trim().toLowerCase())||[];
  if(header.length!==new Set(header).size||header.some(x=>!["timestamp","consumption","pv"].includes(x))||!header.includes("timestamp")||!header.includes("consumption"))
    throw Error("Use exactly timestamp,consumption and optionally pv column headers.");
  if(!all.length||all.length>20000)throw Error("Provide between 1 and 20,000 data intervals.");
  const hasPv=header.includes("pv");
  if(hasPv===(options.pvKind==="absent"))throw Error(hasPv?"Declare whether the PV series is measured, modelled or synthetic.":"No pv column found. Set PV provenance to No PV series.");
  const dt=options.intervalMinutes*60000,factor=options.units==="kW"?options.intervalMinutes/60:1;
  const rows=all.map((r,index)=>{
    try{
      if(r.length!==header.length)throw Error("Column count does not match the header.");
      const value=(name:string)=>{const v=r[header.indexOf(name)].trim();if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v))throw Error(`${name} must be a non-negative number using a decimal point, not a blank or cumulative meter reading.`);
        const n=Number(v)*factor;if(!Number.isFinite(n)||n>100000)throw Error(`${name} exceeds the supported interval energy.`);return n;};
      const start=timestampMillis(r[header.indexOf("timestamp")].trim())-(options.timestampPosition==="end"?dt:0);
      return {start:new Date(start).toISOString(),consumptionKwh:value("consumption"),...(hasPv?{pvKwh:value("pv")}:{})};
    }catch(e){throw Error(`CSV data row ${index+1}: ${(e as Error).message}`);}
  }).sort((a,b)=>a.start.localeCompare(b.start));
  const dataset=intervalDatasetSchema.parse({...options,rows});
  const diag=inspectDataset(dataset);
  if(!diag.valid)throw Error(diag.problems.join(" "));
  return dataset;
}
export function inspectDataset(d:IntervalDataset):Diagnostics{
  const dt=d.intervalMinutes*60000,problems:string[]=[],seen=new Set<number>();
  let gaps=0,missingIntervals=0,duplicates=0,reordered=false,previous:number|undefined;
  const times=d.rows.map(r=>Date.parse(r.start));
  for(let i=0;i<d.rows.length;i++){
    const r=d.rows[i],t=times[i];
    if(!Number.isFinite(t))problems.push("Invalid timestamp.");
    if(seen.has(t))duplicates++;seen.add(t);
    if(previous!==undefined){const diff=t-previous;if(diff<0)reordered=true;
      if(diff>dt){gaps++;missingIntervals+=Math.max(0,Math.round(diff/dt)-1);}
      if(diff!==0&&(diff<dt||diff%dt!==0))problems.push("Intervals overlap, are unsorted or do not match the declared duration.");
    }previous=t;
    if((d.pvKind==="absent")!==(r.pvKwh===undefined))problems.push("PV provenance and row coverage do not match.");
  }
  if(duplicates)problems.push(`${duplicates} duplicate timestamp(s); resolve them in the source file.`);
  const ordered=times.filter(Number.isFinite).sort((a,b)=>a-b),start=ordered[0],end=(ordered.at(-1)??0)+dt;
  const observedHours=d.rows.length*dt/3600000,spanHours=(end-start)/3600000;
  return {valid:!problems.length,problems:Array.from(new Set(problems)),gaps,missingIntervals,duplicates,reordered,
    coveragePercent:spanHours?Math.min(100,observedHours/spanHours*100):0,observedHours,spanHours,
    start:Number.isFinite(start)?new Date(start).toISOString():"",end:new Date(end).toISOString()};
}

// AC-side interval balance. Charge is AC into battery, discharge is AC out of it.
// SOC is internal usable-window energy; reserve is withheld from that window.
export function simulateBattery(d:IntervalDataset,b:Battery,importRate:number,exportRate:number,trace?:Dispatch[]):Simulation{
  batterySchema.parse(b);
  const diag=inspectDataset(d);
  if(!diag.valid||diag.gaps||d.pvKind==="absent")throw Error("Battery simulation requires contiguous, valid consumption and PV intervals.");
  const min=b.usableKwh*b.reservePercent/100,initialSoc=b.usableKwh*b.initialPercent/100,dt=d.intervalMinutes/60;
  let soc=initialSoc;
  const s:Simulation={usableKwh:b.usableKwh,load:0,pv:0,direct:0,charge:0,discharge:0,import:0,export:0,loss:0,initialSoc,finalSoc:soc,baselineImport:0,baselineExport:0,importReduction:0,terminalReplacementKwh:0,terminalAllowance:0,periodValue:0,cycles:0,maxBalanceError:0};
  for(const row of d.rows){
    const load=row.consumptionKwh,pv=row.pvKwh!,direct=Math.min(load,pv),surplus=pv-direct,deficit=load-direct,before=soc;
    const charge=Math.max(0,Math.min(surplus,b.chargeKw*dt,(b.usableKwh-soc)/b.chargeEfficiency));
    soc+=charge*b.chargeEfficiency;
    const discharge=Math.max(0,Math.min(deficit,b.dischargeKw*dt,(soc-min)*b.dischargeEfficiency));
    soc-=discharge/b.dischargeEfficiency;
    const imp=deficit-discharge,exp=surplus-charge,loss=charge*(1-b.chargeEfficiency)+discharge*(1/b.dischargeEfficiency-1);
    s.load+=load;s.pv+=pv;s.direct+=direct;s.charge+=charge;s.discharge+=discharge;s.import+=imp;s.export+=exp;s.loss+=loss;
    s.baselineImport+=deficit;s.baselineExport+=surplus;
    s.maxBalanceError=Math.max(s.maxBalanceError,Math.abs(pv+imp-load-exp-loss-(soc-before)));
    if(trace)trace.push({start:row.start,load,pv,direct,charge,discharge,import:imp,export:exp,loss,soc});
  }
  s.finalSoc=soc;s.importReduction=s.baselineImport-s.import;
  // Charge replacement cost prevents free opening SOC from inflating savings.
  // This is an explicit terminal allowance, NOT fictitious energy inside the series.
  s.terminalReplacementKwh=Math.max(0,initialSoc-soc)/b.chargeEfficiency;
  s.terminalAllowance=s.terminalReplacementKwh*importRate;
  s.periodValue=s.importReduction*importRate-(s.baselineExport-s.export)*exportRate-s.terminalAllowance;
  s.cycles=b.usableKwh?s.discharge/b.dischargeEfficiency/b.usableKwh:0;
  return s;
}
export function analyseEnergy(d:Design):EnergyReport|null{
  const config=d.intervalAnalysis,ds=config?.dataset;if(!config||!ds)return null;
  const diagnostics=inspectDataset(ds),daily=new Map<string,{date:string;load:number;pv:number}>(),monthly=new Map<string,{month:string;load:number;pv:number}>();
  const hours=Array.from({length:24},(_,hour)=>({hour,energy:0,count:0}));
  const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:ds.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"});
  let consumptionKwh=0,pvKwh=0,peakKw=0;
  for(const row of ds.rows){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(row.start)).map(p=>[p.type,p.value]));
    const key=`${parts.year}-${parts.month}-${parts.day}`,month=key.slice(0,7),h=Number(parts.hour),load=row.consumptionKwh,pv=row.pvKwh||0;
    const day=daily.get(key)||{date:key,load:0,pv:0};day.load+=load;day.pv+=pv;daily.set(key,day);
    const m=monthly.get(month)||{month,load:0,pv:0};m.load+=load;m.pv+=pv;monthly.set(month,m);
    hours[h].energy+=load;hours[h].count++;consumptionKwh+=load;pvKwh+=pv;peakKw=Math.max(peakKw,load*60/ds.intervalMinutes);
  }
  const blockedReason=!diagnostics.valid?diagnostics.problems.join(" "):diagnostics.gaps?"Fill or resolve missing intervals before battery simulation; gaps are not treated as zero demand.":ds.pvKind==="absent"?"Import a separately identified AC PV series to enable battery sizing. Annual manual generation is not converted into invented intervals.":null;
  const selected=blockedReason?null:simulateBattery(ds,config.battery,d.energy.importRate,d.energy.exportRate);
  const capacities=Array.from(new Set([0,2.5,5,7.5,10,13.5,20,30,50,100,config.battery.usableKwh])).sort((a,b)=>a-b);
  const candidates=blockedReason?[]:capacities.map(usableKwh=>simulateBattery(ds,{...config.battery,usableKwh},d.energy.importRate,d.energy.exportRate));
  const best=Math.max(0,...candidates.map(c=>c.periodValue)),suggestedKwh=best>1e-9?candidates.find(c=>c.periodValue>=best*.9)!.usableKwh:null;
  return {methodVersion:"ac-self-consumption-v1",datasetLabel:ds.label,consumptionKind:ds.consumptionKind,pvKind:ds.pvKind,timezone:ds.timezone,diagnostics,
    consumptionKwh,pvKwh:ds.pvKind==="absent"?null:pvKwh,peakKw,averageKw:consumptionKwh/diagnostics.observedHours,
    daily:Array.from(daily.values()),monthly:Array.from(monthly.values()),hourly:hours.map(h=>({hour:h.hour,averageKw:h.count?h.energy/(h.count*ds.intervalMinutes/60):null})),
    selected,candidates,suggestedKwh,blockedReason,assumptions:[
      "Preliminary, generic AC-coupled PV-surplus dispatch, not a manufacturer-approved hybrid/battery design. Separate battery inverter assumed; equipment compatibility, clipping, export limits, standby, degradation and temperature effects excluded.",
      "Consumption must be whole-site gross demand, not net grid import, cumulative meter readings or a tariff bill. PV is AC energy as imported; neither weather nor PV generation is fabricated or automatically scaled after equipment changes.",
      `Constant import/export rates GBP ${d.energy.importRate}/${d.energy.exportRate} per kWh; no time-of-use optimisation, grid charging, standing charges, VAT adjustment, installation cost, payback or guaranteed savings.`,
      "All totals and values apply only to the observed period, not a year. Gaps block dispatch. UTC offsets define instants; the selected timezone controls day/month/hour grouping, including 23/25-hour UK days.",
      "Usable capacity excludes the manufacturer's inaccessible buffer; reserve further withholds part of that usable window. Charging and discharging limits are AC-side. SOC is internal energy, efficiencies applied in each direction.",
      "Period value is incremental versus PV without storage, with an import-rate allowance to replenish any opening SOC deficit at the end. That allowance is outside the physical dispatch period; surplus closing SOC earns no credit.",
      "Suggested capacity is the smallest tested capacity delivering at least 90% of the highest positive SOC-adjusted period value at the same power limits. Not an economic optimum, product recommendation or backup sizing.",
    ]};
}
export function dispatchCsv(d:Design):string{
  const c=d.intervalAnalysis;if(!c?.dataset)throw Error("No interval dataset.");
  const trace:Dispatch[]=[];simulateBattery(c.dataset,c.battery,d.energy.importRate,d.energy.exportRate,trace);
  return "start_utc,load_kwh,pv_kwh,direct_kwh,charge_ac_kwh,discharge_ac_kwh,grid_import_kwh,grid_export_kwh,loss_kwh,soc_internal_kwh\n"+
    trace.map(r=>[r.start,...[r.load,r.pv,r.direct,r.charge,r.discharge,r.import,r.export,r.loss,r.soc].map(n=>n.toFixed(8))].join(",")).join("\n")+"\n";
}
