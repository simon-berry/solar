import {test} from "node:test";
import assert from "node:assert/strict";
import DxfParser from "dxf-parser";
import {PassThrough} from "node:stream";
import {PDFDocument} from "pdf-lib";
import type {Response} from "express";
import type {Identity} from "../shared/access";
import {mountingDefaults,surveyDefaults} from "../shared/review-schema";
import {fillRoof} from "../shared/solar";
import {modules} from "../shared/schema";
import {createHash} from "node:crypto";
import {stableJSON} from "../shared/solar";
import {hardware} from "../shared/electrical";
import {offsetLocation,tracedRoof} from "../shared/map-geometry";
import {roofDxf,technicalPdf} from "../server/technical-documents";
process.env.DATABASE_PATH=":memory:";
const {storage,sqlite}=await import("../server/storage");
const {reviews,engineeringHash}=await import("../server/reviews");
let counter=0;
const author:Identity={id:"author",orgId:"review-qa",orgName:"Synthetic QA",name:"Synthetic Designer",email:"designer@example.test",role:"designer"};
const reviewer:Identity={...author,id:"reviewer",role:"reviewer",name:"Synthetic Reviewer",email:"reviewer@example.test"};
const visitor=`org:${author.orgId}`;
function fixture(){
  const p=storage.create(visitor,{name:`Review QA ${++counter}`,customer:"Synthetic customer",address:"Synthetic site only",postcode:"PR7 1AA",type:"Residential",nation:"England"});
  const d=structuredClone(p.design);d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,8);d.survey={...surveyDefaults(),basis:"measured",assessor:"QA test only",date:"2026-11-13",covering:"Synthetic slate",structure:"Synthetic report fixture, not a real roof."};
  d.mounting={...mountingDefaults(),family:"Synthetic external schedule",scheduleReference:"QA-1",source:"Not an engineered product, QA only.",rails:[{id:"rail-1",roofId:d.roofs[0].id,x:1,y:1,x2:5,y2:1}],fixings:[{id:"fix-1",roofId:d.roofs[0].id,x:1,y:1,type:"synthetic"}],ballast:[{id:"ballast-1",roofId:d.roofs[0].id,x:1,y:1,massKg:12}]};
  return storage.save(visitor,p.id,1,d);
}
const content=Buffer.from("%PDF-1.4\nSYNTHETIC TEST CONTENT ONLY\n%%EOF").toString("base64");
function upload(p:ReturnType<typeof fixture>,kind:"electrical-report"|"structural-report"|"mounting-schedule"="electrical-report"){
  return reviews.upload(visitor,p.id,{filename:`${kind}.pdf`,kind,author:"Synthetic report author",date:"2026-11-13",source:"Synthetic test fixture",notes:"Not professional advice.",content,expectedRevision:p.revision});
}
function decision(submissionId:string,evidenceIds:string[],scope:"electrical"|"structural"|"mounting"="electrical"){
  return {submissionId,evidenceIds,scope,outcome:"accepted-external-evidence" as const,qualifications:"SYNTHETIC TEST identity, no real qualifications asserted.",limitations:"SYNTHETIC TEST ONLY. Not a real review or installation approval.",declaration:true as const};
}
test("engineering hash binds site and engineering inputs but excludes quote/tariff-only changes",()=>{
  const p=fixture(),d=structuredClone(p.design),hash=engineeringHash(d);
  d.pricing.labour+=100;d.energy.importRate+=.01;assert.equal(engineeringHash(d),hash);
  d.address="Different synthetic site";assert.notEqual(engineeringHash(d),hash);
  d.address=p.design.address;d.mounting!.rails[0].x+=.1;assert.notEqual(engineeringHash(d),hash);
});
test("evidence has content hashes, private bytes and an exact saved engineering binding",()=>{
  const p=fixture(),e=upload(p),list=reviews.evidence(visitor,p.id);
  assert.equal(e.engineeringHash,engineeringHash(p.design));assert.equal(e.revision,p.revision);assert.equal(e.hash.length,64);
  assert.equal((list[0] as any).content,undefined);assert.equal(reviews.evidenceFile(visitor,p.id,e.id).content.toString(),Buffer.from(content,"base64").toString());
  assert.throws(()=>reviews.evidenceFile("org:other",p.id,e.id),/not found/);
  assert.throws(()=>reviews.upload(visitor,p.id,{filename:"bad.pdf",kind:"other",author:"QA",date:"2026-11-13",source:"QA",notes:"",content,expectedRevision:p.revision-1}),/revision changed/);
});
test("evidence rejects invalid dates, types, extensions and noncanonical base64",()=>{
  const p=fixture(),base={filename:"fixture.pdf",kind:"electrical-report",author:"QA",date:"2026-11-13",source:"QA",notes:"",content,expectedRevision:p.revision};
  assert.throws(()=>reviews.upload(visitor,p.id,{...base,date:"2026-02-30"}),/calendar date/);
  assert.throws(()=>reviews.upload(visitor,p.id,{...base,filename:"fixture.html"}),/extension/);
  assert.throws(()=>reviews.upload(visitor,p.id,{...base,content:Buffer.from("<script>no</script>").toString("base64")}),/Only PDF/);
  assert.throws(()=>reviews.upload(visitor,p.id,{...base,content:content+" "}),/base64/);
  const png=Buffer.from([137,80,78,71,13,10,26,10]).toString("base64");
  assert.throws(()=>reviews.upload(visitor,p.id,{...base,filename:"photo.png",content:png}),/must be PDF/);
});
test("submission is immutable/idempotent and captures only matching evidence",()=>{
  const p=fixture(),e=upload(p),s=reviews.submit(visitor,p.id,p.revision,author);
  assert.deepEqual(s.evidenceIds,[e.id]);assert.equal(reviews.submit(visitor,p.id,p.revision,author).id,s.id);
  assert.equal((s as any).snapshot,undefined);
  const changed=structuredClone(p.design);changed.survey!.covering="Changed roofing material";
  const next=storage.save(visitor,p.id,p.revision,changed),s2=reviews.submit(visitor,p.id,next.revision,author);assert.deepEqual(s2.evidenceIds,[]);
  assert.equal(reviews.submissions(visitor,p.id).find(x=>x.id===s.id)!.engineeringHash,s.engineeringHash);
});
test("self-review, unauthenticated review, wrong-role and cross-org recording are rejected",()=>{
  const p=fixture(),e=upload(p),s=reviews.submit(visitor,p.id,p.revision,author),b=decision(s.id,[e.id]);
  assert.throws(()=>reviews.decide(visitor,p.id,b),/authenticated/);
  assert.throws(()=>reviews.decide(visitor,p.id,b,author),/administrator or reviewer/);
  assert.throws(()=>reviews.decide(visitor,p.id,b,{...author,role:"admin"}),/own submission/);
  assert.throws(()=>reviews.decide(visitor,p.id,b,{...reviewer,orgId:"other"}),/scope mismatch/);
});
test("external decisions require the exact scope's submitted supporting PDF",()=>{
  const p=fixture(),e=upload(p,"structural-report"),s=reviews.submit(visitor,p.id,p.revision,author);
  assert.throws(()=>reviews.decide(visitor,p.id,decision(s.id,[e.id],"electrical"),reviewer),/electrical-report/);
  assert.throws(()=>reviews.decide(visitor,p.id,decision(s.id,["missing"],"structural"),reviewer),/submitted engineering snapshot/);
  const d=reviews.decide(visitor,p.id,decision(s.id,[e.id],"structural"),reviewer);
  assert.equal(d.reviewerId,reviewer.id);assert.equal(reviews.report(visitor,p.id).reviewStatus.structural,"accepted-external-evidence");
  assert.equal(reviews.report(visitor,p.id).releaseAvailable,false);
});
test("pricing preserves review currency while site/geometry changes stale it",()=>{
  const p=fixture(),e=upload(p),s=reviews.submit(visitor,p.id,p.revision,author);reviews.decide(visitor,p.id,decision(s.id,[e.id]),reviewer);
  const price=structuredClone(p.design);price.pricing.panelSell+=1;const next=storage.save(visitor,p.id,p.revision,price);
  assert.equal(reviews.report(visitor,p.id).reviewStatus.electrical,"accepted-external-evidence");
  const geo=structuredClone(next.design);geo.roofs[0].width+=.1;storage.save(visitor,p.id,next.revision,geo);
  assert.equal(reviews.report(visitor,p.id).reviewStatus.electrical,"stale");
  assert.throws(()=>reviews.decide(visitor,p.id,decision(s.id,[e.id]),reviewer),/stale/);
});
test("known invalid geometry cannot be converted to an accepted review",()=>{
  const p=fixture(),d=structuredClone(p.design);d.roofs[0].width=2;
  const next=storage.save(visitor,p.id,p.revision,d),e=upload(next),s=reviews.submit(visitor,p.id,next.revision,author);
  assert.throws(()=>reviews.decide(visitor,p.id,decision(s.id,[e.id]),reviewer),/known design errors/);
  const b=decision(s.id,[e.id]);reviews.decide(visitor,p.id,{...b,outcome:"changes-required"},reviewer);
  assert.equal(reviews.report(visitor,p.id).reviewStatus.electrical,"changes-required");
});
test("mounting bounds, duplicate identifiers and zero-length rails remain findings",()=>{
  const p=fixture(),d=structuredClone(p.design);d.mounting!.rails[0].x2=0;d.mounting!.rails[0].x=0;d.mounting!.rails[0].y2=d.mounting!.rails[0].y;
  d.mounting!.fixings[0].id="rail-1";d.mounting!.ballast[0].roofId="missing-roof";
  storage.save(visitor,p.id,p.revision,d);const report=reviews.report(visitor,p.id);
  assert.ok(report.findings.some(f=>f.id==="mounting-empty-rail-1"));
  assert.ok(report.findings.some(f=>f.id==="mounting-duplicate-rail-1"));
  assert.ok(report.findings.some(f=>f.id==="mounting-ballast-1"));
  assert.equal(report.masses.additionalKg,null);assert.equal(report.masses.complete,false);
});
test("technical issues freeze design, native findings, metadata and external review state",()=>{
  const p=fixture(),e=upload(p),s=reviews.submit(visitor,p.id,p.revision,author);reviews.decide(visitor,p.id,decision(s.id,[e.id]),reviewer);
  const issue=reviews.issue(visitor,p.id,p.revision,author),frozen=JSON.stringify(issue);
  assert.equal(reviews.issue(visitor,p.id,p.revision,author).id,issue.id);
  const d=structuredClone(p.design);d.roofs[0].width+=1;storage.save(visitor,p.id,p.revision,d);
  assert.equal(JSON.stringify(reviews.getIssue(visitor,issue.id)),frozen);assert.equal(reviews.getIssue("org:other",issue.id),undefined);
  assert.equal(issue.report.electricalReport.module.voc,39.7);
  assert.throws(()=>reviews.issue(visitor,p.id,p.revision,author),/revision changed/);
});
test("DXF is independently parseable with millimetre units, named layers and stable IDs",()=>{
  const p=fixture(),out=roofDxf(p.design),parsed=new DxfParser().parseSync(out)!;
  assert.equal(parsed.header.$INSUNITS,4);assert.ok(parsed.entities.some(e=>e.type==="LWPOLYLINE"));
  assert.equal(parsed.entities.filter(e=>e.layer==="R1_MODULES").length,8);
  assert.ok(parsed.entities.some(e=>e.layer==="R1_RAILS"));assert.ok(parsed.entities.some(e=>e.layer==="R1_FIXINGS"));assert.ok(parsed.entities.some(e=>e.layer==="R1_BALLAST"));
  assert.ok(out.includes("SOLAR_WORKSPACE"));assert.ok(out.includes(p.design.roofs[0].panels[0].id));assert.ok(out.endsWith("0\nEOF\n"));
});
test("a short technical pack has six A3 sheets, not extra footer-overflow pages",async()=>{
  const p=fixture(),issue=reviews.issue(visitor,p.id,p.revision,author);
  assert.equal(issue.template,"technical-review-v1");
  const stream=new PassThrough() as PassThrough&{type:()=>unknown;attachment:()=>unknown};
  stream.type=stream.attachment=()=>stream;
  const chunks:Buffer[]=[];
  const finished=new Promise<Buffer>((resolve,reject)=>{
    stream.on("data",c=>chunks.push(c));stream.on("end",()=>resolve(Buffer.concat(chunks)));stream.on("error",reject);
  });
  technicalPdf(issue,stream as unknown as Response);
  const parsed=await PDFDocument.load(await finished);
  assert.equal(parsed.getPageCount(),6);
  for(const page of parsed.getPages()){
    assert.ok(Math.abs(page.getWidth()-1190.55)<.1);
    assert.ok(Math.abs(page.getHeight()-841.89)<.1);
  }
});
test("legacy engineering envelope is unchanged and map location/geometry stale reviews",()=>{
  const p=fixture(),d=p.design,h=hardware(d);
  const old=createHash("sha256").update(stableJSON({version:"engineering-inputs-v1",site:{address:d.address,postcode:d.postcode,nation:d.nation},roofs:d.roofs,module:h.module,inverter:h.inverter,inverterCount:d.inverterCount,gap:d.gap,phase:d.phase,electrical:d.electrical??null,survey:d.survey??null,mounting:d.mounting??null})).digest("hex");
  assert.equal(engineeringHash(d),old);
  const e=upload(p),s=reviews.submit(visitor,p.id,p.revision,author);reviews.decide(visitor,p.id,decision(s.id,[e.id]),reviewer);
  const mapped=structuredClone(d);mapped.mapLocation={lng:-2.63,lat:53.65,label:"Synthetic UK site",source:"manual",capturedAt:new Date().toISOString()};
  assert.notEqual(engineeringHash(mapped),old);
  mapped.pricing.labour+=25;const mapHash=engineeringHash(mapped);mapped.pricing.labour+=25;assert.equal(engineeringHash(mapped),mapHash);
  storage.save(visitor,p.id,p.revision,mapped);assert.equal(reviews.report(visitor,p.id).reviewStatus.electrical,"stale");
});
test("mapped technical v2 freezes polygons and produces six independently readable A3 sheets",async()=>{
  const p=fixture(),d=structuredClone(p.design),origin={lng:-2.633,lat:53.654};
  const roof=tracedRoof([{x:0,y:0},{x:12,y:0},{x:12,y:-8},{x:7,y:-8},{x:7,y:-5},{x:0,y:-5}].map(q=>offsetLocation(origin,q)),20,d.roofs[0].id,"Synthetic polygon","traced-street");
  roof.panels=fillRoof(roof,modules[0],d.gap,false,8);d.roofs=[roof];
  const saved=storage.save(visitor,p.id,p.revision,d),issue=reviews.issue(visitor,p.id,saved.revision,author);
  assert.equal(issue.template,"technical-review-v2");assert.equal(issue.snapshot.roofs[0].boundary!.length,6);
  const stream=new PassThrough() as PassThrough&{type:()=>unknown;attachment:()=>unknown};stream.type=stream.attachment=()=>stream;
  const chunks:Buffer[]=[];const finished=new Promise<Buffer>((resolve,reject)=>{stream.on("data",c=>chunks.push(c));stream.on("end",()=>resolve(Buffer.concat(chunks)));stream.on("error",reject);});
  technicalPdf(issue,stream as unknown as Response);const pdf=await PDFDocument.load(await finished);
  assert.equal(pdf.getPageCount(),6);assert.ok(pdf.getPages().every(page=>Math.abs(page.getWidth()-1190.55)<.1));
  const frozen=stableJSON(issue),changed=structuredClone(saved.design);changed.roofs[0].geo=null;
  storage.save(visitor,p.id,saved.revision,changed);assert.equal(stableJSON(reviews.getIssue(visitor,issue.id)),frozen);
});
