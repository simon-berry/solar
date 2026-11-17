import {test} from "node:test";
import assert from "node:assert/strict";
import {modules,designSchema,type Design} from "../shared/schema";
import {defaultDesign,fillRoof,validateDesign} from "../shared/solar";
import {assessElectrical,correctedVoltage,electricalDefaults,suggestStrings,freezeHardware} from "../shared/electrical";

function fixture(count=18):Design{
  const d=defaultDesign();d.roofs[0].width=40;d.roofs[0].height=20;
  d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,count);
  d.electrical=electricalDefaults();return d;
}
test("legacy designs have no active electrical model",()=>{
  const d=defaultDesign(),r=assessElectrical(d);
  assert.equal(r.status,"disabled");assert.equal(r.stringResults.length,0);
  assert.equal(designSchema.safeParse(d).success,true);
});
test("temperature corrections use fractional coefficients and a 25 C reference",()=>{
  assert.ok(Math.abs(correctedVoltage(39.7,-.0025,-10)-43.17375)<1e-8);
  assert.equal(correctedVoltage(39.7,-.0025,25),39.7);
});
test("balanced suggestion covers every module without duplication",()=>{
  const d=fixture();d.electrical!.strings=suggestStrings(d);
  assert.deepEqual(d.electrical!.strings.map(s=>s.moduleIds.length),[9,9]);
  const report=assessElectrical(d);
  assert.equal(report.status,"within-reference-limits");assert.equal(report.assigned,18);assert.equal(report.unassignedIds.length,0);
  assert.ok(Math.abs(report.stringResults[0].coldVoc!-388.56375)<1e-6);
  assert.ok(Math.abs(report.stringResults[0].hotVmp!-258.462)<1e-6);
  assert.equal(report.stringResults[0].imp,13.25); // Series count never multiplies current.
  assert.equal(report.stringResults[0].designIsc,17.375);
});
test("cold overvoltage is a blocking reference finding",()=>{
  const d=fixture();
  d.electrical!.strings=[{id:"s1",name:"S01",inverterIndex:0,mpptIndex:0,moduleIds:d.roofs[0].panels.map(p=>p.id)}];
  assert.ok(assessElectrical(d).findings.some(f=>f.id==="voc-s1"&&f.severity==="error"));
  assert.ok(validateDesign(d).some(f=>f.id==="electrical-voc-s1"));
});
test("short hot-voltage string is not treated as valid",()=>{
  const d=fixture(3);d.electrical!.strings=suggestStrings(d);
  assert.ok(assessElectrical(d).findings.some(f=>f.id.startsWith("hot-")));
});
test("empty strings and unassigned modules are incomplete, not zero-value passes",()=>{
  const d=fixture(9);d.electrical!.strings=[{id:"s1",name:"Empty",inverterIndex:0,mpptIndex:0,moduleIds:[]}];
  const r=assessElectrical(d);assert.equal(r.status,"incomplete");assert.equal(r.stringResults[0].coldVoc,null);assert.equal(r.unassignedIds.length,9);
});
test("duplicate, orphan and removed-inverter assignments are reported",()=>{
  const d=fixture();d.electrical!.strings=suggestStrings(d);
  d.electrical!.strings[1].moduleIds.push(d.electrical!.strings[0].moduleIds[0],"deleted-module");
  d.electrical!.strings[1].inverterIndex=1;
  const r=assessElectrical(d);
  assert.equal(r.status,"error");
  for(const prefix of ["duplicate-","missing-","inverter-"])assert.ok(r.findings.some(f=>f.id.startsWith(prefix)));
});
test("per-MPPT parallel current, short-circuit current and input-count limits aggregate",()=>{
  const d=fixture(27),all=d.roofs[0].panels.map(p=>p.id);
  d.electrical!.strings=Array.from({length:3},(_,i)=>({id:`s${i}`,name:`S${i}`,inverterIndex:0,mpptIndex:0,moduleIds:all.slice(i*9,i*9+9)}));
  const r=assessElectrical(d);
  assert.equal(r.mpptResults[0].operatingCurrent,39.75);assert.equal(r.mpptResults[0].designIsc,52.125);
  for(const prefix of ["inputs-","parallel-imp-","parallel-isc-"])assert.ok(r.findings.some(f=>f.id.startsWith(prefix)));
  assert.ok(r.stringResults.every(s=>s.status==="error"));
});
test("per-input current checks are independent from aggregate MPPT checks",()=>{
  const d=fixture(9);d.electrical!.strings=suggestStrings(d);d.electrical!.iscFactor=2;
  assert.ok(assessElectrical(d).findings.some(f=>f.id.startsWith("input-isc-")));
});
test("unequal parallel string lengths require review",()=>{
  const d=fixture(17);d.electrical!.strings=suggestStrings(d);
  d.electrical!.strings.forEach(s=>s.mpptIndex=0);
  const r=assessElectrical(d);assert.equal(r.status,"incomplete");assert.ok(r.findings.some(f=>f.id.startsWith("parallel-length-")));
});
test("missing Vmp coefficient is not guessed from Voc",()=>{
  let d=freezeHardware(fixture(9));d.electrical!.strings=suggestStrings(d);
  delete d.catalogueSnapshot!.module.betaVmp;
  const r=assessElectrical(d);assert.equal(r.status,"incomplete");assert.equal(r.stringResults[0].hotVmp,null);
  assert.ok(r.findings.some(f=>f.id.startsWith("coefficient-")));
});
test("mixed roof orientation in a string requires review",()=>{
  const d=fixture(9),second={...structuredClone(d.roofs[0]),id:"roof2",azimuth:90,panels:[{id:"extra",x:1,y:1,landscape:false}]};
  d.roofs.push(second);d.electrical!.strings=suggestStrings(d);
  d.electrical!.strings[0].moduleIds.push("extra");d.electrical!.strings.pop();
  assert.ok(assessElectrical(d).findings.some(f=>f.id.startsWith("orientations-")));
});
test("parallel strings on different roof orientations flag both strings for review",()=>{
  const d=fixture(9),second={...structuredClone(d.roofs[0]),id:"roof2",azimuth:90,panels:d.roofs[0].panels.map(p=>({...p,id:`second-${p.id}`}))};
  d.roofs.push(second);d.electrical!.strings=suggestStrings(d);d.electrical!.strings.forEach(s=>s.mpptIndex=0);
  const r=assessElectrical(d);assert.ok(r.findings.some(f=>f.id==="parallel-orientation-0:0"));
  assert.ok(r.stringResults.every(s=>s.status==="incomplete"));
});
test("exact DC maximum and current thresholds are inclusive",()=>{
  const d=freezeHardware(fixture(9));d.catalogueSnapshot!.module.voc=600/9;d.catalogueSnapshot!.module.betaVoc=0;
  d.catalogueSnapshot!.inverter.maxInputCurrent=d.catalogueSnapshot!.module.imp;
  d.electrical!.strings=suggestStrings(d);
  assert.equal(assessElectrical(d).status,"within-reference-limits");
});
test("invalid temperature ordering is a known error",()=>{
  const d=fixture(9);d.electrical!.minCellTemp=25;d.electrical!.maxCellTemp=25;
  assert.ok(assessElectrical(d).findings.some(f=>f.id==="temperature"));
});
test("server hardware freezing ignores supplied limits and preserves legitimate snapshots",()=>{
  const original=freezeHardware(fixture(9));
  const tampered=structuredClone(original);tampered.catalogueSnapshot!.inverter.maxDc=999999;
  assert.equal(freezeHardware(tampered,original).catalogueSnapshot!.inverter.maxDc,600);
  assert.equal(freezeHardware(tampered).catalogueSnapshot!.inverter.maxDc,600);
});
test("suggestions keep roofs separate and do not silently fix infeasible current capacity",()=>{
  const d=fixture(80);d.electrical!.strings=suggestStrings(d);
  assert.equal(new Set(d.electrical!.strings.flatMap(s=>s.moduleIds)).size,80);
  assert.equal(assessElectrical(d).status,"error");
});
