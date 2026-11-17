import { test } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_PATH=":memory:";
const { storage, sqlite }=await import("../server/storage");
const { fillRoof }=await import("../shared/solar");
const { modules }=await import("../shared/schema");
const {electricalDefaults,suggestStrings}=await import("../shared/electrical");
const {batteryDefaults}=await import("../shared/energy-schema");
const {parseIntervalCsv}=await import("../shared/energy");

test("visitor isolation covers projects, proposals and saved revisions",()=>{
  const a=storage.list("visitor-a"),b=storage.list("visitor-b");
  assert.equal(a.length,3);assert.equal(b.length,3);
  assert.equal(storage.get("visitor-b",a[0].id),undefined);
  assert.throws(()=>storage.save("visitor-b",a[0].id,1,a[0].design),/not found/);
});
test("saved revisions are immutable and conflicting writes fail",()=>{
  const p=storage.list("revision-owner")[0],d=structuredClone(p.design);
  d.notes="Changed working copy";
  const saved=storage.save("revision-owner",p.id,1,d);
  assert.equal(saved.revision,2);
  assert.throws(()=>storage.save("revision-owner",p.id,1,d),/newer revision/);
  const first=sqlite.prepare("SELECT snapshot FROM solar_revisions WHERE project_id=? AND revision=1").get(p.id) as {snapshot:string};
  assert.notEqual(JSON.parse(first.snapshot).notes,d.notes);
});
test("proposal is idempotent and unaffected by subsequent price changes",()=>{
  const p=storage.list("quote-owner")[0],d=structuredClone(p.design);
  d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,10);
  const saved=storage.save("quote-owner",p.id,p.revision,d);
  const issue=storage.issue("quote-owner",p.id,saved.revision);
  const again=storage.issue("quote-owner",p.id,saved.revision);
  assert.equal(again.id,issue.id);
  d.pricing.panelSell=999;
  storage.save("quote-owner",p.id,saved.revision,d);
  assert.equal(storage.getIssue("quote-owner",issue.id)!.totalPence,issue.totalPence);
  assert.notEqual(storage.getIssue("quote-owner",issue.id)!.snapshot.pricing.panelSell,999);
  assert.equal(storage.getIssue("visitor-b",issue.id),undefined);
  assert.throws(()=>storage.issue("quote-owner",p.id,saved.revision),/revision changed/);
});
test("legacy payloads preserve newer electrical work and server ignores hardware tampering",()=>{
  const p=storage.list("electrical-owner")[0],d=structuredClone(p.design);
  d.electrical=electricalDefaults();d.electrical.strings=suggestStrings(d);
  const saved=storage.save("electrical-owner",p.id,p.revision,d);
  const legacy=structuredClone(saved.design);delete legacy.electrical;
  legacy.catalogueSnapshot!.inverter.maxDc=999999;
  const next=storage.save("electrical-owner",p.id,saved.revision,legacy);
  assert.deepEqual(next.design.electrical,saved.design.electrical);
  assert.equal(next.design.catalogueSnapshot!.inverter.maxDc,600);
});
test("electrical report and equipment remain frozen on issued v3 proposals",()=>{
  const p=storage.list("frozen-electrical")[0],d=structuredClone(p.design);
  d.electrical=electricalDefaults();d.electrical.strings=suggestStrings(d);
  const saved=storage.save("frozen-electrical",p.id,p.revision,d);
  const issue=storage.issue("frozen-electrical",p.id,saved.revision);
  assert.equal(issue.templateVersion,"preliminary-v3");
  assert.equal(issue.electricalReport!.status,"within-reference-limits");
  const oldVoc=issue.electricalReport!.stringResults[0].coldVoc;
  d.electrical.minCellTemp=-30;storage.save("frozen-electrical",p.id,saved.revision,d);
  assert.equal(storage.getIssue("frozen-electrical",issue.id)!.electricalReport!.stringResults[0].coldVoc,oldVoc);
});
test("interval data survive legacy saves, can be explicitly cleared, and issue reports stay frozen",()=>{
  const owner="energy-owner",p=storage.list(owner)[0],d=structuredClone(p.design);
  d.intervalAnalysis={battery:batteryDefaults(),dataset:parseIntervalCsv("timestamp,consumption,pv\n2026-01-01T12:00:00Z,0,2\n2026-01-01T12:30:00Z,2,0",{
    label:"Synthetic QA",timezone:"Europe/London",intervalMinutes:30,units:"kWh",timestampPosition:"start",consumptionKind:"synthetic",pvKind:"synthetic"})};
  d.moduleId="trina-neg9r28-450";d.inverterId="sungrow-sg5rs";
  const saved=storage.save(owner,p.id,p.revision,d);
  const issued=storage.issue(owner,p.id,saved.revision),frozen=JSON.stringify(issued.energyReport);
  assert.equal(issued.templateVersion,"preliminary-v3");assert.equal(issued.energyReport!.consumptionKwh,2);
  assert.equal(storage.issue(owner,p.id,saved.revision).id,issued.id);
  const legacy=structuredClone(saved.design);delete legacy.intervalAnalysis;
  legacy.catalogueSnapshot!.module.voc=1;legacy.catalogueSnapshot!.module.source!.url="https://example.com/tamper";
  const next=storage.save(owner,p.id,saved.revision,legacy);
  assert.deepEqual(next.design.intervalAnalysis,saved.design.intervalAnalysis);
  assert.equal(next.design.catalogueSnapshot!.module.voc,52.9);
  assert.ok(next.design.catalogueSnapshot!.module.source!.url.includes("trinasolar"));
  const cleared=storage.save(owner,p.id,next.revision,{...next.design,intervalAnalysis:{...next.design.intervalAnalysis!,dataset:null}});
  assert.equal(cleared.design.intervalAnalysis!.dataset,null);
  assert.equal(JSON.stringify(storage.getIssue(owner,issued.id)!.energyReport),frozen);
  assert.equal(storage.getIssue("other",issued.id),undefined);
});
test("invalid server interval structure cannot be saved, while gaps remain explicit",()=>{
  const owner="energy-invalid",p=storage.list(owner)[0],d=structuredClone(p.design);
  const row={start:"2026-01-01T00:00:00.000Z",consumptionKwh:1,pvKwh:0};
  d.intervalAnalysis={battery:batteryDefaults(),dataset:{label:"test",timezone:"UTC",intervalMinutes:30,consumptionKind:"synthetic",pvKind:"synthetic",rows:[row,row]}};
  assert.throws(()=>storage.save(owner,p.id,p.revision,d),/duplicate/);
  assert.equal(storage.get(owner,p.id)!.revision,p.revision);
  d.intervalAnalysis.dataset!.rows[1]={...row,start:"2026-01-01T01:00:00.000Z"};
  const saved=storage.save(owner,p.id,p.revision,d);
  const issue=storage.issue(owner,p.id,saved.revision);assert.equal(issue.energyReport!.selected,null);assert.equal(issue.energyReport!.diagnostics.missingIntervals,1);
});
test("legacy issue rows retain original snapshot, total and template",()=>{
  const p=storage.list("legacy-electrical")[0],id="legacy-issue-fixture",snapshot=JSON.stringify(p.design);
  sqlite.prepare("INSERT INTO solar_issues(id,visitor,project_id,project_name,revision,snapshot,hash,created_at,total_pence) VALUES(?,?,?,?,?,?,?,?,?)").run(id,"legacy-electrical",p.id,p.name,1,snapshot,"legacy-hash","2026-11-13T00:00:00Z",123456);
  const issue=storage.getIssue("legacy-electrical",id)!;
  assert.equal(issue.templateVersion,"preliminary-v1");assert.equal(issue.totalPence,123456);
  assert.equal(issue.electricalReport,null);assert.equal(JSON.stringify(issue.snapshot),snapshot);
});
