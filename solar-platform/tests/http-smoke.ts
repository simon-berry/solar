import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fillRoof } from "../shared/solar";
import { modules } from "../shared/schema";
import {electricalDefaults,suggestStrings} from "../shared/electrical";
import {parseIntervalCsv} from "../shared/energy";
import {batteryDefaults} from "../shared/energy-schema";

// Run against a local development/production server. Never point this at customer data.
const base=process.env.SMOKE_BASE_URL||"http://127.0.0.1:5000";
if(!["localhost","127.0.0.1"].includes(new URL(base).hostname))throw new Error("Smoke tests may only target a local server.");
const visitor=`smoke-${randomUUID()}`;
async function request(path:string,method="GET",data?:unknown,owner=visitor){
  return fetch(`${base}${path}`,{method,headers:{"x-visitor-id":owner,"content-type":"application/json"},body:data===undefined?undefined:JSON.stringify(data)});
}
let res=await request("/api/projects");assert.equal(res.status,200);
const projects=await res.json();assert.equal(projects.length,3);
res=await request("/api/projects","POST",{name:"<script>test</script>",customer:"Synthetic QA",address:"Test & example <site>",postcode:"PR7 1AA",type:"Residential",nation:"England"});
assert.equal(res.status,201);const p=await res.json();
res=await request(`/api/projects/${p.id}`,"GET",undefined,"other-visitor");assert.equal(res.status,404);
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:1,design:{...p.design,gap:-1}});assert.equal(res.status,422);
p.design.roofs[0].panels=fillRoof(p.design.roofs[0],modules[0],p.design.gap,false,10);
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:1,design:p.design});assert.equal(res.status,200);
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:1,design:p.design});assert.equal(res.status,409);
res=await request(`/api/projects/${p.id}/issues`,"POST",{expectedRevision:2});assert.equal(res.status,201);const issue=await res.json();
res=await request(`/api/issues/${issue.id}/proposal.pdf`);assert.equal(res.status,200);
assert.ok(res.headers.get("content-disposition")?.includes("attachment"));
const pdf=Buffer.from(await res.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),"%PDF-");
res=await request(`/api/issues/${issue.id}/proposal.pdf`,"GET",undefined,"other-visitor");assert.equal(res.status,404);
res=await request(`/api/projects/${p.id}/export/roof.svg`);assert.equal(res.status,200);
const svg=await res.text();assert.ok(svg.includes("&lt;script&gt;test&lt;/script&gt;"));assert.ok(!svg.includes("<script>"));
res=await request(`/api/projects/${p.id}/export/project.json`);const exported=await res.json();
assert.equal(exported.visitor,undefined);assert.equal(exported.design.customer,"Synthetic QA");
p.design.pricing.panelSell=500;
await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:2,design:p.design});
res=await request(`/api/projects/${p.id}/issues`);const unchanged=(await res.json())[0];
assert.equal(unchanged.totalPence,issue.totalPence);assert.equal(unchanged.snapshot.pricing.panelSell,120);
p.design.electrical=electricalDefaults();p.design.electrical.strings=suggestStrings(p.design);
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:3,design:p.design});assert.equal(res.status,200);
res=await request(`/api/projects/${p.id}/electrical`);assert.equal((await res.json()).report.status,"within-reference-limits");
res=await request(`/api/projects/${p.id}/issues`,"POST",{expectedRevision:4});assert.equal(res.status,201);
const electricalIssue=await res.json();assert.equal(electricalIssue.templateVersion,"preliminary-v3");
for(const path of ["strings.svg","electrical.svg","electrical.json"]){
  res=await request(`/api/projects/${p.id}/export/${path}`);assert.equal(res.status,200);
  assert.ok(res.headers.get("content-disposition")?.includes("attachment"));
  const body=await res.text();assert.ok(!body.includes("<script>"));
}
res=await request(`/api/issues/${electricalIssue.id}/electrical.json`);assert.equal(res.status,200);
const frozenReport=(await res.json()).report;
p.design.electrical.minCellTemp=25;p.design.electrical.maxCellTemp=25;
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:4,design:p.design});assert.equal(res.status,200);
res=await request(`/api/projects/${p.id}/issues`,"POST",{expectedRevision:5});assert.equal(res.status,422);
res=await request(`/api/issues/${electricalIssue.id}/electrical.json`);assert.deepEqual((await res.json()).report,frozenReport);
res=await request(`/api/projects/${p.id}/export/electrical.json`,"GET",undefined,"other-visitor");assert.equal(res.status,404);
res=await request(`/api/issues/${electricalIssue.id}/electrical.json`,"GET",undefined,"other-visitor");assert.equal(res.status,404);
p.design.electrical.minCellTemp=-10;p.design.electrical.maxCellTemp=70;
p.design.moduleId="trina-neg9r28-450";p.design.inverterId="sungrow-sg5rs";
p.design.intervalAnalysis={battery:batteryDefaults(),dataset:parseIntervalCsv("timestamp,consumption,pv\n2026-01-01T12:00:00Z,0,2\n2026-01-01T12:30:00Z,2,0",{
  label:"Synthetic HTTP QA",timezone:"Europe/London",intervalMinutes:30,units:"kWh",timestampPosition:"start",consumptionKind:"synthetic",pvKind:"synthetic"})};
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:5,design:p.design});assert.equal(res.status,200);
const sourced=await res.json();assert.equal(sourced.design.catalogueSnapshot.provenance,"manufacturer-datasheet");
for(const path of ["energy.json","dispatch.csv"]){
  res=await request(`/api/projects/${p.id}/export/${path}`);assert.equal(res.status,200);assert.ok(res.headers.get("content-disposition")?.includes("attachment"));assert.ok((await res.text()).length>100);
  res=await request(`/api/projects/${p.id}/export/${path}`,"GET",undefined,"other-visitor");assert.equal(res.status,404);
}
res=await request(`/api/projects/${p.id}/issues`,"POST",{expectedRevision:6});assert.equal(res.status,201);
const energyIssue=await res.json();assert.equal(energyIssue.energyReport.consumptionKwh,2);
res=await request(`/api/issues/${energyIssue.id}/energy.json`);assert.equal(res.status,200);const frozenEnergy=await res.json();
res=await request(`/api/issues/${energyIssue.id}/proposal.pdf`);assert.equal(res.status,200);assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0,5).toString(),"%PDF-");
p.design.intervalAnalysis.dataset.rows[1].start="2026-01-01T13:00:00.000Z";
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:6,design:p.design});assert.equal(res.status,200);
res=await request(`/api/projects/${p.id}/export/dispatch.csv`);assert.equal(res.status,422);
res=await request(`/api/projects/${p.id}/export/energy.json`);assert.equal((await res.json()).report.selected,null);
res=await request(`/api/issues/${energyIssue.id}/energy.json`);assert.deepEqual(await res.json(),frozenEnergy);
res=await request(`/api/issues/${energyIssue.id}/energy.json`,"GET",undefined,"other-visitor");assert.equal(res.status,404);
p.design.intervalAnalysis.dataset.rows[1].start=p.design.intervalAnalysis.dataset.rows[0].start;
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:7,design:p.design});assert.equal(res.status,422);
p.design.intervalAnalysis.dataset.rows=Array.from({length:17520},(_,i)=>({start:new Date(Date.UTC(2025,0,1)+i*1800000).toISOString(),consumptionKwh:.3,pvKwh:.1}));
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:7,design:p.design});assert.equal(res.status,200);
res=await request(`/api/projects/${p.id}/export/energy.json`);assert.equal(res.status,200);const annual=await res.json();assert.equal(annual.report.diagnostics.observedHours,8760);
console.log("HTTP smoke passed: scoped project writes, hardware provenance, immutable v3 electrical/energy reports, PDF/SVG/JSON/CSV downloads, gap/duplicate blocking, validation, conflicts and escaping.");
