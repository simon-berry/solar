import {createHash,randomUUID} from "node:crypto";
import type {Identity} from "@shared/access";
import {canDesign} from "@shared/access";
import type {Project,Design} from "@shared/schema";
import {hardware,freezeHardware,assessElectrical} from "@shared/electrical";
import {stableJSON,validateDesign} from "@shared/solar";
import {evidenceUploadSchema,reviewDecisionSchema,type Evidence,type Submission,type Decision,type EngineeringReport,type EvidenceKind} from "@shared/review-schema";
import {sqlite,storage,StorageError} from "./storage";
import {pointInPolygon,segmentInPolygon} from "@shared/geometry";

export function engineeringHash(d:Design){
  const h=hardware(d);
  return createHash("sha256").update(stableJSON({version:"engineering-inputs-v1",site:{address:d.address,postcode:d.postcode,nation:d.nation,...(d.mapLocation?{mapLocation:d.mapLocation}:{})},roofs:d.roofs,module:h.module,inverter:h.inverter,inverterCount:d.inverterCount,gap:d.gap,phase:d.phase,electrical:d.electrical??null,survey:d.survey??null,mounting:d.mounting??null})).digest("hex");
}
// Migration 005: additive evidence/review/technical-issue tables. All metadata scoped.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS solar_evidence(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,project_id TEXT NOT NULL,filename TEXT NOT NULL,kind TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,hash TEXT NOT NULL,author TEXT NOT NULL,date TEXT NOT NULL,source TEXT NOT NULL,notes TEXT NOT NULL,engineering_hash TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,content BLOB NOT NULL);
  CREATE INDEX IF NOT EXISTS evidence_project ON solar_evidence(visitor,project_id);
  CREATE TABLE IF NOT EXISTS solar_review_submissions(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,project_id TEXT NOT NULL,revision INTEGER NOT NULL,engineering_hash TEXT NOT NULL,created_by TEXT NOT NULL,author TEXT NOT NULL,created_at TEXT NOT NULL,evidence_ids TEXT NOT NULL,snapshot TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS submissions_project ON solar_review_submissions(visitor,project_id);
  CREATE TABLE IF NOT EXISTS solar_review_decisions(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,project_id TEXT NOT NULL,submission_id TEXT NOT NULL,scope TEXT NOT NULL,outcome TEXT NOT NULL,reviewer_id TEXT NOT NULL,reviewer TEXT NOT NULL,qualifications TEXT NOT NULL,limitations TEXT NOT NULL,evidence_ids TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS decisions_project ON solar_review_decisions(visitor,project_id);
  CREATE TABLE IF NOT EXISTS solar_technical_issues(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,project_id TEXT NOT NULL,project_name TEXT NOT NULL,revision INTEGER NOT NULL,hash TEXT NOT NULL,created_at TEXT NOT NULL,author TEXT NOT NULL,snapshot TEXT NOT NULL,report TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS technical_issues_project ON solar_technical_issues(visitor,project_id);
`);
if(!(sqlite.prepare("PRAGMA table_info(solar_technical_issues)").all() as {name:string}[]).some(c=>c.name==="template"))
  sqlite.exec("ALTER TABLE solar_technical_issues ADD COLUMN template TEXT NOT NULL DEFAULT 'technical-review-v1'");
const evidenceColumns="id,project_id projectId,filename,kind,mime,size,hash,author,date,source,notes,engineering_hash engineeringHash,revision,created_at createdAt";
const parseSubmission=(r:any):Submission=>({id:r.id,revision:r.revision,engineeringHash:r.engineering_hash,createdBy:r.created_by,author:r.author,createdAt:r.created_at,evidenceIds:JSON.parse(r.evidence_ids)});
const parseDecision=(r:any):Decision=>({id:r.id,submissionId:r.submission_id,scope:r.scope,outcome:r.outcome,reviewerId:r.reviewer_id,reviewer:r.reviewer,qualifications:r.qualifications,limitations:r.limitations,evidenceIds:JSON.parse(r.evidence_ids),createdAt:r.created_at});
export type TechnicalIssue={id:string;projectId:string;projectName:string;revision:number;hash:string;createdAt:string;author:string;template:string;snapshot:Design;report:EngineeringReport};
export class Reviews{
  private project(visitor:string,id:string){const p=storage.get(visitor,id);if(!p)throw new StorageError("Project not found.",404);return p;}
  evidence(visitor:string,id:string){this.project(visitor,id);return sqlite.prepare(`SELECT ${evidenceColumns} FROM solar_evidence WHERE visitor=? AND project_id=? ORDER BY created_at DESC,id DESC`).all(visitor,id) as Evidence[];}
  evidenceFile(visitor:string,projectId:string,id:string){
    this.project(visitor,projectId);
    const row=sqlite.prepare(`SELECT ${evidenceColumns},content FROM solar_evidence WHERE visitor=? AND project_id=? AND id=?`).get(visitor,projectId,id) as (Evidence&{content:Buffer})|undefined;
    if(!row)throw new StorageError("Evidence not found.",404);return row;
  }
  upload(visitor:string,id:string,input:unknown){
    const b=evidenceUploadSchema.parse(input),p=this.project(visitor,id);
    if(p.revision!==b.expectedRevision)throw new StorageError("Saved revision changed. Reload before attaching evidence.",409);
    const content=Buffer.from(b.content,"base64");
    if(content.length>6*1024*1024)throw new StorageError("Evidence files must be at most 6 MiB.",422);
    if(content.toString("base64")!==b.content)throw new StorageError("Invalid or non-canonical base64 file content.",422);
    const mime=content.subarray(0,5).toString()==="%PDF-"?"application/pdf":content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"image/png":content[0]===255&&content[1]===216&&content[2]===255?"image/jpeg":null;
    if(!mime)throw new StorageError("Only PDF, PNG and JPEG evidence is supported; the content signature must match.",422);
    const extension=b.filename.split(".").at(-1)?.toLowerCase();
    if(!(mime==="application/pdf"?extension==="pdf":mime==="image/png"?extension==="png":["jpg","jpeg"].includes(extension||"")))throw new StorageError("Filename extension must match the detected PDF, PNG or JPEG content.",422);
    if(["electrical-report","structural-report","mounting-schedule"].includes(b.kind)&&mime!=="application/pdf")throw new StorageError("Engineering reports and schedules must be PDF files.",422);
    const date=new Date(`${b.date}T00:00:00Z`);
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==b.date)throw new StorageError("Evidence date is not a valid calendar date.",422);
    return sqlite.transaction(()=>{
      const totals=sqlite.prepare("SELECT count(*) n,coalesce(sum(size),0) bytes FROM solar_evidence WHERE visitor=?").get(visitor) as {n:number;bytes:number};
      if(totals.bytes+content.length>200*1024*1024)throw new StorageError("Workspace evidence limit is 200 MiB. Ask the operator about retention/storage before uploading more.",422);
      if(this.evidence(visitor,id).length>=50)throw new StorageError("Maximum 50 evidence files per project.",422);
      const eid=randomUUID(),now=new Date().toISOString(),hash=createHash("sha256").update(content).digest("hex");
      sqlite.prepare("INSERT INTO solar_evidence VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(eid,visitor,id,b.filename,b.kind,mime,content.length,hash,b.author,b.date,b.source,b.notes,engineeringHash(p.design),p.revision,now,content);
      return this.evidence(visitor,id).find(e=>e.id===eid)!;
    })();
  }
  submissions(visitor:string,id:string){return (sqlite.prepare("SELECT id,revision,engineering_hash,created_by,author,created_at,evidence_ids FROM solar_review_submissions WHERE visitor=? AND project_id=? ORDER BY rowid DESC").all(visitor,id) as any[]).map(parseSubmission);}
  decisions(visitor:string,id:string){return (sqlite.prepare("SELECT * FROM solar_review_decisions WHERE visitor=? AND project_id=? ORDER BY rowid DESC").all(visitor,id) as any[]).map(parseDecision);}
  submit(visitor:string,id:string,expectedRevision:number,identity?:Identity){
    if(identity&&visitor!==`org:${identity.orgId}`)throw new StorageError("Organisation scope mismatch.",403);
    if(identity&&!canDesign(identity.role))throw new StorageError("Designer permission required.",403);
    return sqlite.transaction(()=>{
      const p=this.project(visitor,id);if(p.revision!==expectedRevision)throw new StorageError("Saved revision changed. Reload before submitting.",409);
      if(!p.design.roofs.some(r=>r.panels.length))throw new StorageError("Place modules before submitting an engineering package.",422);
      const snapshot=freezeHardware(structuredClone(p.design),p.design),hash=engineeringHash(snapshot),evidenceIds=this.evidence(visitor,id).filter(e=>e.engineeringHash===hash).map(e=>e.id).sort();
      const prior=this.submissions(visitor,id).find(s=>s.revision===p.revision&&s.createdBy===(identity?.id||`preview:${visitor}`)&&stableJSON(s.evidenceIds)===stableJSON(evidenceIds));
      if(prior)return prior;
      const sid=randomUUID(),now=new Date().toISOString();
      sqlite.prepare("INSERT INTO solar_review_submissions VALUES(?,?,?,?,?,?,?,?,?,?)").run(sid,visitor,id,p.revision,hash,identity?.id||`preview:${visitor}`,identity?.name||"Synthetic preview author",now,JSON.stringify(evidenceIds),JSON.stringify(snapshot));
      return this.submissions(visitor,id).find(s=>s.id===sid)!;
    })();
  }
  decide(visitor:string,id:string,input:unknown,identity?:Identity){
    if(!identity||!["admin","reviewer"].includes(identity.role))throw new StorageError("An authenticated administrator or reviewer must record external reviews.",403);
    if(visitor!==`org:${identity.orgId}`)throw new StorageError("Organisation scope mismatch.",403);
    const b=reviewDecisionSchema.parse(input);
    return sqlite.transaction(()=>{
      const p=this.project(visitor,id),submission=this.submissions(visitor,id).find(s=>s.id===b.submissionId);
      if(!submission)throw new StorageError("Submission not found.",404);
      if(submission.createdBy===identity.id)throw new StorageError("The technical author cannot approve or review their own submission.",403);
      if(submission.engineeringHash!==engineeringHash(p.design))throw new StorageError("This submission is stale. Save and submit the current engineering inputs first.",409);
      if(b.outcome==="accepted-external-evidence"&&this.report(visitor,id).findings.some(f=>f.level==="error"))throw new StorageError("Resolve known design errors before accepting external evidence. There is no generic engineering override.",422);
      const evidence=this.evidence(visitor,id);
      if(b.evidenceIds.some(eid=>!submission.evidenceIds.includes(eid)||!evidence.some(e=>e.id===eid&&e.engineeringHash===submission.engineeringHash)))throw new StorageError("Selected evidence must belong to the submitted engineering snapshot.",422);
      const required:Record<string,EvidenceKind>={electrical:"electrical-report",structural:"structural-report",mounting:"mounting-schedule"};
      if(b.outcome==="accepted-external-evidence"&&!b.evidenceIds.some(eid=>evidence.find(e=>e.id===eid)?.kind===required[b.scope]))throw new StorageError(`Accepting ${b.scope} evidence requires a matching ${required[b.scope]} PDF.`,422);
      const did=randomUUID();
      sqlite.prepare("INSERT INTO solar_review_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(did,visitor,id,b.submissionId,b.scope,b.outcome,identity.id,identity.name,b.qualifications,b.limitations,JSON.stringify(b.evidenceIds),new Date().toISOString());
      return this.decisions(visitor,id).find(d=>d.id===did)!;
    })();
  }
  report(visitor:string,id:string):EngineeringReport{
    const p=this.project(visitor,id),d=p.design,hash=engineeringHash(d),evidence=this.evidence(visitor,id),submissions=this.submissions(visitor,id),decisions=this.decisions(visitor,id);
    const currentSubmission=submissions.find(s=>s.engineeringHash===hash)||null;
    const status=(scope:Decision["scope"]):EngineeringReport["reviewStatus"][Decision["scope"]]=>{
      if(!currentSubmission)return submissions.length?"stale":"not-submitted";
      return decisions.find(r=>r.submissionId===currentSubmission.id&&r.scope===scope)?.outcome||"awaiting-review";
    };
    const h=hardware(d),moduleKg=d.roofs.reduce((n,r)=>n+r.panels.length,0)*h.module.mass,ballastKg=(d.mounting?.ballast||[]).reduce((n,b)=>n+b.massKg,0),additionalKg=d.mounting?.additionalMassKg??null;
    const findings=validateDesign(d).map(f=>({id:f.id,message:f.message,level:f.severity==="error"?"error" as const:"review" as const}));
    if(!d.survey||d.survey.basis==="unknown"||!d.survey.structure.trim())findings.push({id:"survey-structure",message:"Survey basis/roof structure is unknown or incomplete.",level:"review"});
    if(!d.mounting?.family||!d.mounting.scheduleReference||!d.mounting.source)findings.push({id:"mounting-source",message:"Record the mounting family, external schedule revision and source.",level:"review"});
    const roofs=new Map(d.roofs.map(r=>[r.id,r]));
    const seen=new Set<string>();
    for(const item of [...(d.mounting?.rails||[]),...(d.mounting?.fixings||[]),...(d.mounting?.ballast||[])]){
      if(seen.has(item.id))findings.push({id:`mounting-duplicate-${item.id}`,message:`Mounting item identifier ${item.id} is repeated.`,level:"error"});seen.add(item.id);
      const roof=roofs.get(item.roofId);
      if(!roof||item.x>roof.width||item.y>roof.height||("x2" in item&&(item.x2>roof.width||item.y2>roof.height))||(roof?.boundary&&(!pointInPolygon(item,roof.boundary)||("x2" in item&&!segmentInPolygon(item,{x:item.x2,y:item.y2},roof.boundary)))))findings.push({id:`mounting-${item.id}`,message:`Mounting item ${item.id} is outside its mapped roof or references a missing roof.`,level:"error"});
      if("x2" in item&&item.x===item.x2&&item.y===item.y2)findings.push({id:`mounting-empty-${item.id}`,message:`Rail ${item.id} has zero length.`,level:"error"});
    }
    return {methodVersion:"external-review-v1",engineeringHash:hash,revision:p.revision,releaseAvailable:false,electricalReport:assessElectrical(d),findings,evidence,submissions,decisions,currentSubmission,
      reviewStatus:{electrical:status("electrical"),structural:status("structural"),mounting:status("mounting")},
      masses:{moduleKg,ballastKg,additionalKg,knownTotalKg:moduleKg+ballastKg+(additionalKg||0),complete:false},
      limitations:["FOR PROFESSIONAL REVIEW ONLY. Installation/energisation release remains unavailable; recorded external reviews are not a native calculation pass or certification.",
        "Native electrical findings remain visible, including errors and missing coefficients. The full specialist diagram, protection, cables, earthing, export controls and applicable approvals require external assessment.",
        "Mass totals include only recorded module, ballast and additional racking masses. They are not wind/snow/uplift, roof support, fixing capacity, ballast design or a structural certificate.",
        "Imported mounting geometry and report contents are not independently validated. Reviewer identity is authenticated but qualifications and professional report coverage are declared by the reviewer, not independently accredited by this software.",
        "Reviews bind the engineering-input hash, not mutable quote prices. Geometry, equipment, electrical, survey or mounting changes stale them; pricing-only changes do not.",
        "Review outcomes cover only evidence captured in that submission and explicitly cited by its decisions. Files attached later are not automatically reviewed, even when their engineering-input hash matches.",
        "Files are private attachments with content hashes and size/type checks, not a malware-scanning service. Keep sensitive or real evidence out of the synthetic preview."],
    };
  }
  technicalIssues(visitor:string,id:string){
    this.project(visitor,id);
    return sqlite.prepare("SELECT id,project_id projectId,project_name projectName,revision,hash,created_at createdAt,author,template FROM solar_technical_issues WHERE visitor=? AND project_id=? ORDER BY rowid DESC").all(visitor,id) as Omit<TechnicalIssue,"snapshot"|"report">[];
  }
  issue(visitor:string,id:string,expectedRevision:number,identity?:Identity){
    if(identity&&visitor!==`org:${identity.orgId}`)throw new StorageError("Organisation scope mismatch.",403);
    if(identity&&!canDesign(identity.role))throw new StorageError("Designer permission required.",403);
    return sqlite.transaction(()=>{
      const p=this.project(visitor,id);if(p.revision!==expectedRevision)throw new StorageError("Saved revision changed. Reload before issuing.",409);
      const snapshot=freezeHardware(structuredClone(p.design),p.design),report=this.report(visitor,id),template=p.design.mapLocation||p.design.roofs.some(r=>r.geo||r.boundary)?"technical-review-v2":"technical-review-v1",hash=createHash("sha256").update(stableJSON({template,snapshot,report})).digest("hex");
      const prior=this.technicalIssues(visitor,id).find(i=>i.hash===hash);if(prior)return this.getIssue(visitor,prior.id)!;
      const tid=randomUUID(),now=new Date().toISOString(),author=identity?.name||"Synthetic preview author";
      sqlite.prepare("INSERT INTO solar_technical_issues(id,visitor,project_id,project_name,revision,hash,created_at,author,snapshot,report,template) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(tid,visitor,id,p.name,p.revision,hash,now,author,JSON.stringify(snapshot),JSON.stringify(report),template);
      return this.getIssue(visitor,tid)!;
    })();
  }
  getIssue(visitor:string,id:string){
    const row=sqlite.prepare("SELECT * FROM solar_technical_issues WHERE visitor=? AND id=?").get(visitor,id) as any;
    if(!row)return undefined;
    return {id:row.id,projectId:row.project_id,projectName:row.project_name,revision:row.revision,hash:row.hash,createdAt:row.created_at,author:row.author,template:row.template,snapshot:JSON.parse(row.snapshot),report:JSON.parse(row.report)} as TechnicalIssue;
  }
}
export const reviews=new Reviews();
