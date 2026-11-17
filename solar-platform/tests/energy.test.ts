import {test} from "node:test";
import assert from "node:assert/strict";
import {parseIntervalCsv,inspectDataset,simulateBattery,analyseEnergy,dispatchCsv,timestampMillis,type ImportOptions} from "../shared/energy";
import {batteryDefaults,intervalDatasetSchema,type IntervalDataset} from "../shared/energy-schema";
import {defaultDesign} from "../shared/solar";
import {modules,inverters,designSchema} from "../shared/schema";
import {freezeHardware,assessElectrical,electricalDefaults,suggestStrings} from "../shared/electrical";

const options:ImportOptions={label:"test",timezone:"Europe/London",consumptionKind:"measured",pvKind:"modelled",intervalMinutes:30,units:"kWh",timestampPosition:"start"};
const csv="timestamp,consumption,pv\n2026-01-01T12:00:00Z,0,2\n2026-01-01T12:30:00Z,2,0\n";
const dataset=()=>parseIntervalCsv(csv,options);
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const withDataset=(ds:IntervalDataset)=>({...defaultDesign(),intervalAnalysis:{dataset:ds,battery:batteryDefaults()}});

test("CSV energy and interval-average power convert explicitly",()=>{
  const a=dataset(),b=parseIntervalCsv(csv,{...options,units:"kW"});
  near(a.rows[0].pvKwh!,2);near(b.rows[0].pvKwh!,1);
  near(parseIntervalCsv(csv.replaceAll("12:30","12:15"),{...options,units:"kW",intervalMinutes:15}).rows[0].pvKwh!,.5);
});
test("CSV handles BOM, CRLF, quoted headers, reordered rows and end stamps",()=>{
  const ds=parseIntervalCsv('\uFEFF"timestamp","consumption","pv"\r\n2026-01-01T13:00:00Z,2,0\r\n2026-01-01T12:30:00Z,0,2\r\n',{...options,timestampPosition:"end"});
  assert.equal(ds.rows[0].start,"2026-01-01T12:00:00.000Z");assert.equal(ds.rows[0].pvKwh,2);
  assert.equal(inspectDataset(ds).coveragePercent,100);
});
test("duplicate timestamps, including equivalent offsets, are rejected",()=>{
  assert.throws(()=>parseIntervalCsv(csv.replace("12:30:00Z","13:00:00+01:00"),options),/duplicate/);
});
test("naive DST times and impossible dates are rejected rather than guessed",()=>{
  for(const t of ["2026-10-25T01:30:00","2026-02-30T12:00:00Z","2026-01-01T24:00:00Z","2026-01-01T00:00:00+14:30"])
    assert.throws(()=>timestampMillis(t));
  assert.equal(timestampMillis("2026-10-25T01:30:00+01:00")+3600000,timestampMillis("2026-10-25T01:30:00+00:00"));
  assert.equal(timestampMillis("2026-01-01T00:00:00.000Z"),timestampMillis("2026-01-01T00:00:00Z"));
});
test("negative, missing, nonnumeric and cumulative-style headers fail",()=>{
  for(const value of ["-1","","NaN","Infinity","1,5"])
    assert.throws(()=>parseIntervalCsv(csv.replace("Z,0,2",`Z,${value},2`),options));
  assert.throws(()=>parseIntervalCsv(csv.replace("consumption","meter_reading"),options),/headers/);
  assert.throws(()=>parseIntervalCsv(csv.replace("timestamp,consumption,pv","timestamp,consumption,consumption"),options),/headers/);
  assert.throws(()=>parseIntervalCsv('timestamp,consumption\n"unfinished',options),/Unclosed/);
});
test("gaps retain observed demand but block battery sizing",()=>{
  const ds=parseIntervalCsv(csv.replace("12:30","13:00"),options),diag=inspectDataset(ds);
  assert.equal(diag.missingIntervals,1);near(diag.coveragePercent,100*2/3);
  const report=analyseEnergy(withDataset(ds))!;assert.equal(report.consumptionKwh,2);assert.equal(report.selected,null);assert.match(report.blockedReason!,/missing/);
});
test("non-grid overlaps cannot be imported",()=>{
  assert.throws(()=>parseIntervalCsv(csv.replace("12:30","12:20"),options),/overlap/);
});
test("no PV permits demand-only analysis, not a fabricated storage result",()=>{
  const ds=parseIntervalCsv("timestamp,consumption\n2026-01-01T00:00:00Z,1\n",{...options,pvKind:"absent"});
  const report=analyseEnergy(withDataset(ds))!;assert.equal(report.pvKwh,null);assert.equal(report.selected,null);
  assert.equal(report.hourly[12].averageKw,null);
  assert.throws(()=>parseIntervalCsv(csv,{...options,pvKind:"absent"}),/Declare/);
  assert.throws(()=>parseIntervalCsv("timestamp,consumption\n2026-01-01T00:00:00Z,1",options),/No pv/);
});
test("local day grouping accounts for 23 and 25 hour UK DST days",()=>{
  for(const [date,count,day] of [["2026-03-29T00:00:00Z",46,"2026-03-29"],["2026-10-24T23:00:00Z",50,"2026-10-25"]] as const){
    const ds:IntervalDataset={...dataset(),pvKind:"absent",rows:Array.from({length:count},(_,i)=>({start:new Date(Date.parse(date)+i*1800000).toISOString(),consumptionKwh:.5}))};
    const r=analyseEnergy(withDataset(ds))!;assert.equal(r.daily.length,1);assert.equal(r.daily[0].date,day);near(r.daily[0].load,count*.5);
  }
});
test("zero capacity exactly matches PV-only balance",()=>{
  const s=simulateBattery(dataset(),{...batteryDefaults(),usableKwh:0},.3,.08);
  near(s.import,2);near(s.export,2);near(s.charge,0);near(s.periodValue,0);near(s.finalSoc,0);
});
test("lossless storage obeys per-interval AC power and energy limits",()=>{
  const b={...batteryDefaults(),usableKwh:1,chargeKw:10,dischargeKw:10,chargeEfficiency:1,dischargeEfficiency:1};
  const s=simulateBattery(dataset(),b,.3,.08);near(s.charge,1);near(s.discharge,1);near(s.import,1);near(s.export,1);near(s.periodValue,.22);
  const limited=simulateBattery(dataset(),{...b,chargeKw:.5},.3,.08);near(limited.charge,.25);near(limited.discharge,.25);
  const dischargeLimited=simulateBattery(dataset(),{...b,dischargeKw:.5},.3,.08);near(dischargeLimited.discharge,.25);near(dischargeLimited.finalSoc,.75);
});
test("efficiencies and reserve conserve energy at the AC bus",()=>{
  const s=simulateBattery(dataset(),{...batteryDefaults(),usableKwh:2,chargeKw:10,dischargeKw:10,chargeEfficiency:.9,dischargeEfficiency:.8},.3,.08);
  near(s.charge,2);near(s.discharge,1.44);near(s.loss,.56);near(s.finalSoc,0);assert.ok(s.maxBalanceError<1e-10);
  near(s.pv+s.import,s.load+s.export+s.loss+s.finalSoc-s.initialSoc);
  const reserve=simulateBattery(dataset(),{...batteryDefaults(),usableKwh:2,reservePercent:50,initialPercent:50},.3,.08);assert.ok(reserve.finalSoc>=1-1e-9);
});
test("opening charge is not free economic value",()=>{
  const ds=dataset();ds.rows.forEach(r=>r.pvKwh=0);
  const s=simulateBattery(ds,{...batteryDefaults(),initialPercent:100},.3,.08);
  assert.ok(s.discharge>0);assert.ok(s.terminalAllowance>0);assert.ok(s.periodValue<=0);
});
test("initial SOC below reserve is invalid",()=>{
  assert.throws(()=>simulateBattery(dataset(),{...batteryDefaults(),reservePercent:20,initialPercent:0},.3,.08),/reserve/);
});
test("high export value can make every nonzero capacity unattractive",()=>{
  const d=withDataset(dataset());d.energy.importRate=.1;d.energy.exportRate=.5;
  const r=analyseEnergy(d)!;assert.equal(r.suggestedKwh,null);assert.ok(r.selected!.periodValue<0);
});
test("capacity comparison chooses the smallest tested size at 90% of best positive value",()=>{
  const r=analyseEnergy(withDataset(dataset()))!,best=Math.max(...r.candidates.map(s=>s.periodValue));
  assert.equal(r.suggestedKwh,r.candidates.find(s=>s.periodValue>=best*.9)!.usableKwh);
  assert.ok(dispatchCsv(withDataset(dataset())).startsWith("start_utc,load_kwh"));
});
test("full-year half-hour input remains below transport and row caps",()=>{
  const ds={...dataset(),rows:Array.from({length:17520},(_,i)=>({start:new Date(Date.UTC(2025,0,1)+i*1800000).toISOString(),consumptionKwh:.3,pvKwh:.1}))};
  assert.equal(intervalDatasetSchema.parse(ds).rows.length,17520);
  assert.ok(Buffer.byteLength(JSON.stringify(withDataset(ds)))<4_000_000);
  assert.throws(()=>intervalDatasetSchema.parse({...ds,rows:Array.from({length:20001},()=>ds.rows[0])}));
});
test("manufacturer catalogue matches exact variants and retains unknowns",()=>{
  const real=modules.filter(m=>m.source);assert.equal(real.length,3);assert.equal(inverters.filter(i=>i.source).length,2);
  for(const m of real){assert.equal(m.betaVmp,undefined);assert.equal(m.cost,null);assert.equal(m.betaVoc,-.0024);assert.equal(m.mass,21);}
  const m=modules.find(m=>m.id==="trina-neg9r28-450")!;assert.equal(m.voc,52.9);assert.equal(m.vmp,44.6);assert.equal(m.imp,10.09);
  const i=inverters.find(i=>i.id==="sungrow-sg5rs")!;assert.equal(i.maxMpptCurrent,16);assert.equal(i.inputsPerMppt,1);assert.equal(i.mpptMin,40);
  assert.equal(modules[0].id,"ref-440");assert.equal(modules[0].source,undefined);
});
test("real hardware is authoritative, source frozen and missing coefficient remains incomplete",()=>{
  const d=defaultDesign({moduleId:"trina-neg9r28-450",inverterId:"sungrow-sg5rs"});
  d.roofs[0].panels=Array.from({length:8},(_,i)=>({id:`m${i}`,x:1,y:1,landscape:false}));
  d.electrical=electricalDefaults();d.electrical.strings=suggestStrings(d);
  const frozen=freezeHardware(d),report=assessElectrical(frozen);
  assert.equal(report.provenance,"manufacturer-datasheet");assert.equal(report.status,"incomplete");assert.equal(report.stringResults[0].hotVmp,null);
  assert.equal(frozen.catalogueSnapshot!.version,"catalogue-v3");
  frozen.catalogueSnapshot!.module.voc=1;
  assert.equal(freezeHardware(frozen).catalogueSnapshot!.module.voc,52.9);
  assert.ok(designSchema.safeParse(freezeHardware(d)).success);
});
test("deterministic stress profile conserves energy and SOC bounds without simultaneous flows",()=>{
  const ds={...dataset(),rows:Array.from({length:1000},(_,i)=>({start:new Date(Date.UTC(2026,0,1)+i*1800000).toISOString(),consumptionKwh:(i*17%47)/10,pvKwh:(i*23%61)/10}))};
  const trace:import("../shared/energy").Dispatch[]=[];
  const b={...batteryDefaults(),usableKwh:13.5,reservePercent:10,initialPercent:40};
  const s=simulateBattery(ds,b,.25,.08,trace);
  assert.ok(s.maxBalanceError<1e-10);near(s.pv+s.import,s.load+s.export+s.loss+s.finalSoc-s.initialSoc);
  for(const r of trace){assert.ok(r.soc>=1.35-1e-9&&r.soc<=13.5+1e-9);assert.ok(!(r.charge>1e-9&&r.discharge>1e-9));assert.ok(r.charge<=1.5+1e-9&&r.discharge<=1.5+1e-9);}
});
