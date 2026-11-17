import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import Database from "better-sqlite3";
import {fillRoof} from "../shared/solar";
import {modules} from "../shared/schema";
import {PDFDocument} from "pdf-lib";
import DxfParser from "dxf-parser";
import {proposalDefaults} from "../shared/quote-schema";
import {offsetLocation,tracedRoof} from "../shared/map-geometry";

const base=process.env.AUTH_TEST_BASE||"http://127.0.0.1:5002",origin=new URL(base).origin;
if(!["127.0.0.1","localhost"].includes(new URL(base).hostname))throw Error("Authentication smoke tests are localhost-only.");
const dbPath=process.env.AUTH_TEST_DATABASE||"/tmp/solar-auth-qa.db";
if(!dbPath.startsWith("/tmp/solar-auth-"))throw Error("Only a disposable /tmp/solar-auth-* database may be used for authentication fixtures.");
// Constrain fixture-side imports to the disposable database as well.
process.env.DATABASE_PATH=dbPath;
const {passwordHash}=await import("../server/accounts");
const suffix=randomUUID().slice(0,8),password=process.env.AUTH_TEST_PASSWORD||"Synthetic QA password 4! only",adminEmail=process.env.AUTH_TEST_ADMIN_EMAIL||"admin@example.test";
async function request(path:string,method="GET",body?:unknown,cookie="",headers:Record<string,string>={}){
  return fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:origin,...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
}
const getCookie=(res:Response)=>res.headers.get("set-cookie")!.split(";")[0];
let res=await request("/api/session");assert.equal((await res.json()).mode,"accounts");
res=await request("/api/projects","GET",undefined,"",{"x-visitor-id":"forged-admin"});assert.equal(res.status,401);
res=await request("/api/auth/setup","POST",{email:adminEmail,password,name:"QA Administrator",organisation:"Synthetic Auth QA",setupToken:process.env.AUTH_TEST_SETUP_TOKEN||"synthetic-only-setup-token-not-for-deployment-2026"});
if(res.status===409)res=await request("/api/auth/login","POST",{email:adminEmail,password});
assert.equal(res.status,200,await res.clone().text());
const adminCookie=getCookie(res);assert.ok(res.headers.get("set-cookie")!.includes("HttpOnly"));assert.ok(res.headers.get("set-cookie")!.includes("SameSite=Strict"));
if(new URL(base).protocol==="https:"){assert.ok(adminCookie.startsWith("__Host-solar_session="));assert.ok(res.headers.get("set-cookie")!.includes("Secure"));}
const admin=(await res.json()).identity;
res=await request("/api/auth/setup","POST",{email:"again@example.test",password,name:"Again",organisation:"Again",setupToken:process.env.AUTH_TEST_SETUP_TOKEN||"synthetic-only-setup-token-not-for-deployment-2026"});assert.equal(res.status,409);
res=await request("/api/projects","POST",{name:`Auth smoke ${suffix}`,customer:"Synthetic customer",address:"QA test site only",postcode:"PR7 1AA",type:"Residential",nation:"England"},adminCookie);
assert.equal(res.status,201);let p=await res.json();
p.design.roofs[0].panels=fillRoof(p.design.roofs[0],modules[0],p.design.gap,false,8);
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:1,design:p.design},adminCookie);assert.equal(res.status,200);p=await res.json();
const cookies:Record<string,string>={};
for(const role of ["designer","estimator","reviewer","read-only"]){
  const email=`${role}-${suffix}@example.test`;
  res=await request("/api/account/invitations","POST",{email,role},adminCookie);assert.equal(res.status,201);const invite=await res.json();
  res=await request("/api/auth/join","POST",{email,password,name:`QA ${role}`,token:invite.token});assert.equal(res.status,200);cookies[role]=getCookie(res);
  res=await request("/api/auth/join","POST",{email,password,name:"Replay",token:invite.token});assert.equal(res.status,422);
}
for(const role of ["reviewer","read-only"]){
  res=await request(`/api/projects/${p.id}`,"GET",undefined,cookies[role]);assert.equal(res.status,200);
  res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:2,design:p.design},cookies[role]);assert.equal(res.status,403);
  res=await request(`/api/projects/${p.id}/issues`,"POST",{expectedRevision:2},cookies[role]);assert.equal(res.status,403);
  res=await request("/api/account/invitations","POST",{email:"forbidden@example.test",role:"admin"},cookies[role]);assert.equal(res.status,403);
}
const evidencePdf=await PDFDocument.create();evidencePdf.addPage().drawText("SYNTHETIC QA ONLY - not an engineering report.");
const evidenceBytes=Buffer.from(await evidencePdf.save()),evidenceIds:string[]=[];
for(const kind of ["electrical-report","structural-report","mounting-schedule"]){
  res=await request(`/api/projects/${p.id}/evidence`,"POST",{filename:`synthetic-${kind}.pdf`,kind,author:"Synthetic QA author",date:"2026-11-13",source:"Automated test fixture, not professional evidence.",notes:"Synthetic only.",content:evidenceBytes.toString("base64"),expectedRevision:p.revision},adminCookie);
  assert.equal(res.status,201,await res.clone().text());evidenceIds.push((await res.json()).id);
}
res=await request(`/api/projects/${p.id}/review-submissions`,"POST",{expectedRevision:p.revision},adminCookie);assert.equal(res.status,201);
const submission=await res.json();
const reviewBody={submissionId:submission.id,evidenceIds,scope:"electrical",outcome:"accepted-external-evidence",qualifications:"Synthetic QA only. No professional qualifications asserted.",limitations:"Automated workflow test only, not engineering approval.",declaration:true};
res=await request(`/api/projects/${p.id}/review-decisions`,"POST",reviewBody,adminCookie);assert.equal(res.status,403);
for(const role of ["reviewer","read-only","estimator"]){
  for(const route of ["evidence","review-submissions","technical-issues"]){
    res=await request(`/api/projects/${p.id}/${route}`,"POST",{expectedRevision:p.revision},cookies[role]);assert.equal(res.status,403);
  }
}
for(const role of ["read-only","estimator","designer"]){
  res=await request(`/api/projects/${p.id}/review-decisions`,"POST",reviewBody,cookies[role]);assert.equal(res.status,403);
}
for(const scope of ["electrical","structural","mounting"]){
  res=await request(`/api/projects/${p.id}/review-decisions`,"POST",{...reviewBody,scope},cookies.reviewer);assert.equal(res.status,201,await res.clone().text());
}
res=await request(`/api/projects/${p.id}/evidence/${evidenceIds[0]}/download`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);
assert.deepEqual(Buffer.from(await res.arrayBuffer()),evidenceBytes);assert.ok(res.headers.get("content-disposition")?.includes("attachment"));
assert.ok(res.headers.get("content-security-policy")?.includes("sandbox"));
res=await request(`/api/projects/${p.id}/technical-issues`,"POST",{expectedRevision:p.revision},cookies.designer);assert.equal(res.status,201);
const technicalIssue=await res.json();assert.equal(technicalIssue.template,"technical-review-v1");
res=await request(`/api/technical-issues/${technicalIssue.id}/report.json`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);
const frozenTechnicalReport=await res.json();assert.equal(frozenTechnicalReport.report.releaseAvailable,false);
res=await request(`/api/technical-issues/${technicalIssue.id}/pack.pdf`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);
assert.ok((await PDFDocument.load(await res.arrayBuffer())).getPageCount()>=6);
res=await request(`/api/projects/${p.id}/export/roof.dxf`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);
assert.equal(new DxfParser().parseSync(await res.text())!.entities.filter(e=>e.layer==="R1_MODULES").length,8);
const changed=structuredClone(p.design);changed.notes="Estimator must not change this.";
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:2,design:changed},cookies.estimator);assert.equal(res.status,403);
changed.notes=p.design.notes;changed.pricing.panelSell=121;
changed.pricing.proposal={...proposalDefaults(),companyName:"Synthetic HTTP installer (QA only)",includedScope:"Synthetic commercial scope only, not a validated installation.",items:[
  {id:"included-http",description:"Synthetic included allowance",quantity:1.005,unit:"m",unitPrice:1,included:true},
  {id:"optional-http",description:"Synthetic optional storage",quantity:1,unit:"item",unitPrice:4500,included:false},
]};
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:2,design:changed},cookies.estimator);assert.equal(res.status,200);p=await res.json();
res=await request(`/api/projects/${p.id}/engineering`,"GET",undefined,adminCookie);assert.equal((await res.json()).reviewStatus.electrical,"accepted-external-evidence");
res=await request(`/api/projects/${p.id}/issues`,"POST",{expectedRevision:p.revision},cookies.estimator);assert.equal(res.status,201);
const issue=await res.json();
assert.equal(issue.templateVersion,"preliminary-v4");assert.equal(issue.quoteReport.optionalLines[0].amountPence,450000);
assert.equal(issue.quoteReport.lines.find((l:any)=>l.id==="extra-included-http").amountPence,101);
res=await request(`/api/issues/${issue.id}/quote.json`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);
const frozenQuote=await res.json();assert.equal(frozenQuote.quote.totalPence,issue.totalPence);
res=await request(`/api/issues/${issue.id}/proposal.pdf`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);
assert.ok((await PDFDocument.load(await res.arrayBuffer())).getPageCount()>=4);
res=await request(`/api/projects/${p.id}/revisions`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);assert.ok((await res.json()).length>=3);
res=await request(`/api/projects/${p.id}/restore`,"POST",{revision:1,expectedRevision:p.revision},cookies.estimator);assert.equal(res.status,403);
res=await request(`/api/projects/${p.id}/restore`,"POST",{revision:1,expectedRevision:p.revision},cookies.designer);assert.equal(res.status,200);p=await res.json();
res=await request(`/api/projects/${p.id}/engineering`,"GET",undefined,adminCookie);assert.equal((await res.json()).reviewStatus.electrical,"stale");
res=await request(`/api/projects/${p.id}/review-decisions`,"POST",reviewBody,cookies.reviewer);assert.equal(res.status,409);
res=await request(`/api/technical-issues/${technicalIssue.id}/report.json`,"GET",undefined,adminCookie);assert.deepEqual(await res.json(),frozenTechnicalReport);
res=await request(`/api/issues/${issue.id}/quote.json`,"GET",undefined,adminCookie);assert.deepEqual(await res.json(),frozenQuote);
assert.equal(p.design.pricing.proposal,undefined);
res=await request("/api/projects/import","POST",{format:"solar-workspace-v1",name:`Imported ${suffix}`,design:p.design},cookies.designer);assert.equal(res.status,201);assert.notEqual((await res.json()).id,p.id);
res=await request("/api/account/invitations","POST",{email:"csrf@example.test",role:"admin"},adminCookie,{Origin:"https://attacker.invalid"});assert.equal(res.status,403);
res=await request(`/api/account/members/${admin.id}`,"PUT",{role:"read-only",active:true},adminCookie);assert.equal(res.status,422);
// A second tenant is seeded only in the explicitly disposable local fixture DB.
const fixture=new Database(dbPath);const orgId=randomUUID(),userId=randomUUID(),otherEmail=`other-${suffix}@example.test`;
fixture.prepare("INSERT INTO solar_organisations VALUES(?,?,?)").run(orgId,"Other synthetic tenant",new Date().toISOString());
fixture.prepare("INSERT INTO solar_users VALUES(?,?,?,?,?,?,1,?)").run(userId,orgId,otherEmail,"Other synthetic admin","admin",await passwordHash(password),new Date().toISOString());fixture.close();
res=await request("/api/auth/login","POST",{email:otherEmail,password});assert.equal(res.status,200);const otherCookie=getCookie(res);
res=await request(`/api/projects/${p.id}`,"GET",undefined,otherCookie);assert.equal(res.status,404);
res=await request(`/api/issues/${issue.id}/proposal.pdf`,"GET",undefined,otherCookie);assert.equal(res.status,404);
res=await request(`/api/issues/${issue.id}/quote.json`,"GET",undefined,otherCookie);assert.equal(res.status,404);
for(const path of [`/api/projects/${p.id}/engineering`,`/api/projects/${p.id}/evidence/${evidenceIds[0]}/download`,`/api/technical-issues/${technicalIssue.id}/pack.pdf`,`/api/technical-issues/${technicalIssue.id}/report.json`,`/api/projects/${p.id}/export/roof.dxf`]){
  res=await request(path,"GET",undefined,otherCookie);assert.equal(res.status,404);
}
res=await request(`/api/projects/${p.id}/restore`,"POST",{revision:1,expectedRevision:p.revision},otherCookie);assert.equal(res.status,404);
res=await request("/api/projects","GET",undefined,otherCookie);assert.deepEqual(await res.json(),[]);
res=await request(`/api/projects/${p.id}`,"GET",undefined,adminCookie);p=await res.json();
const mapDesign=structuredClone(p.design),mapOrigin={lng:-2.633,lat:53.654};
mapDesign.mapLocation={...mapOrigin,label:"Synthetic account map pin",source:"manual",capturedAt:new Date().toISOString()};
mapDesign.roofs=[tracedRoof([{x:0,y:0},{x:10,y:0},{x:10,y:-6},{x:0,y:-6}].map(q=>offsetLocation(mapOrigin,q)),20,p.design.roofs[0].id,"Account map QA","traced-street")];
mapDesign.roofs[0].panels=fillRoof(mapDesign.roofs[0],modules[0],mapDesign.gap,false,8);
for(const role of ["read-only","reviewer","estimator"]){
  res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:p.revision,design:mapDesign},cookies[role]);assert.equal(res.status,403);
}
res=await request(`/api/projects/${p.id}`,"PUT",{expectedRevision:p.revision,design:mapDesign},cookies.designer);assert.equal(res.status,200);p=await res.json();
res=await request(`/api/projects/${p.id}/export/site.geojson`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,200);assert.equal((await res.json()).features.length,10);
res=await request(`/api/projects/${p.id}/export/site.geojson`,"GET",undefined,otherCookie);assert.equal(res.status,404);
res=await request("/api/maps/config","GET",undefined,"");assert.equal(res.status,401);
res=await request("/api/account","GET",undefined,adminCookie);const members=(await res.json()).members;
const readonly=members.find((m:any)=>m.email===`read-only-${suffix}@example.test`);
res=await request(`/api/account/members/${readonly.id}`,"PUT",{role:"read-only",active:false},adminCookie);assert.equal(res.status,200);
res=await request(`/api/projects/${p.id}`,"GET",undefined,cookies["read-only"]);assert.equal(res.status,401);
res=await request("/api/auth/logout","POST",undefined,adminCookie);assert.equal(res.status,200);
res=await request("/api/projects","GET",undefined,adminCookie);assert.equal(res.status,401);
console.log("Account HTTP smoke passed: setup, hashed sessions, invitations/replay, server roles, evidence byte integrity/private downloads, independent external reviews, self-review denial, price-only review preservation, stale-review denial, frozen technical reports, PDF/DXF downloads, import/restore, cross-tenant denial, CSRF origin checks, session revocation and logout.");
