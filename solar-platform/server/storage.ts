import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq, desc } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { projects, revisions, issues, type Project, type Design, type Issue, type CreateProject } from "@shared/schema";
import { defaultDesign, fillRoof, totals, validateDesign,mergeDesignUpdate,quoteReport } from "@shared/solar";
import {assessElectrical,freezeHardware} from "@shared/electrical";
import {analyseEnergy,inspectDataset} from "@shared/energy";

export const sqlite=new Database(process.env.DATABASE_PATH||"data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// Initial additive migration. No destructive schema operations.
sqlite.exec(`
 CREATE TABLE IF NOT EXISTS solar_projects (
 id TEXT PRIMARY KEY, visitor TEXT NOT NULL, name TEXT NOT NULL,
 sample INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
 design TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS projects_visitor ON solar_projects(visitor);
 CREATE TABLE IF NOT EXISTS solar_revisions (
 id TEXT PRIMARY KEY, visitor TEXT NOT NULL, project_id TEXT NOT NULL,
 revision INTEGER NOT NULL, snapshot TEXT NOT NULL, saved_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS revision_unique ON solar_revisions(project_id,revision);
 CREATE TABLE IF NOT EXISTS solar_issues (
 id TEXT PRIMARY KEY, visitor TEXT NOT NULL, project_id TEXT NOT NULL,
 project_name TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL,
 hash TEXT NOT NULL, created_at TEXT NOT NULL, total_pence INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS issues_visitor_project ON solar_issues(visitor,project_id);
`);
// Additive migration 002. Legacy rows and their snapshots are never rewritten.
const issueColumns=sqlite.prepare("PRAGMA table_info(solar_issues)").all() as {name:string}[];
sqlite.transaction(()=>{
  if(!issueColumns.some(c=>c.name==="template_version"))sqlite.exec("ALTER TABLE solar_issues ADD COLUMN template_version TEXT NOT NULL DEFAULT 'preliminary-v1'");
  if(!issueColumns.some(c=>c.name==="electrical_report"))sqlite.exec("ALTER TABLE solar_issues ADD COLUMN electrical_report TEXT");
})();
// Additive migration 003: existing issued payloads and templates are untouched.
if(!(sqlite.prepare("PRAGMA table_info(solar_issues)").all() as {name:string}[]).some(c=>c.name==="energy_report"))
  sqlite.exec("ALTER TABLE solar_issues ADD COLUMN energy_report TEXT");
export const db=drizzle(sqlite);
// Migration 006: freeze monetary line breakdowns without rewriting legacy issues.
if(!(sqlite.prepare("PRAGMA table_info(solar_issues)").all() as {name:string}[]).some(c=>c.name==="quote_report"))
  sqlite.exec("ALTER TABLE solar_issues ADD COLUMN quote_report TEXT");
export class StorageError extends Error { constructor(message:string,public status=400){super(message);} }
export interface IStorage {
  list(visitor:string):Project[];
  get(visitor:string,id:string):Project|undefined;
  create(visitor:string,input:CreateProject):Project;
  save(visitor:string,id:string,expectedRevision:number,design:Design):Project;
  listIssues(visitor:string,id:string):Issue[];
  issue(visitor:string,id:string,expectedRevision:number):Issue;
  getIssue(visitor:string,id:string):Issue|undefined;
}
export class DatabaseStorage implements IStorage {
  list(visitor:string){
    if(!visitor.startsWith("org:"))this.seed(visitor);
    return db.select().from(projects).where(eq(projects.visitor,visitor)).orderBy(projects.name).all();
  }
  get(visitor:string,id:string){return db.select().from(projects).where(and(eq(projects.visitor,visitor),eq(projects.id,id))).get();}
  private insert(visitor:string,name:string,design:Design,sample=false){
    return sqlite.transaction(()=>{
      const now=new Date().toISOString(),id=randomUUID();
      const p=db.insert(projects).values({id,visitor,name,design,sample,revision:1,updatedAt:now}).returning().get();
      db.insert(revisions).values({id:randomUUID(),visitor,projectId:id,revision:1,snapshot:design,savedAt:now}).run();
      return p;
    })();
  }
  create(visitor:string,input:CreateProject){
    const {name,...site}=input;
    const d=defaultDesign({...site,phase:site.type==="Commercial"?"Three phase":"Single phase",
      inverterId:site.type==="Commercial"?"ref-inv-10":"ref-inv-5"});
    if(site.type==="Commercial"){d.roofs[0].width=18;d.roofs[0].height=10;d.roofs[0].pitch=8;}
    return this.insert(visitor,name,d);
  }
  importProject(visitor:string,name:string,design:Design){
    if(design.intervalAnalysis?.dataset){
      const check=inspectDataset(design.intervalAnalysis.dataset);if(!check.valid)throw new StorageError(check.problems.join(" "),422);
    }
    // Imports are new projects, never overwrites. Untrusted hardware metadata is replaced.
    const clean=structuredClone(design);delete clean.catalogueSnapshot;
    return this.insert(visitor,name,freezeHardware(clean));
  }
  listRevisions(visitor:string,id:string){
    return db.select({revision:revisions.revision,savedAt:revisions.savedAt}).from(revisions).where(and(eq(revisions.visitor,visitor),eq(revisions.projectId,id))).orderBy(desc(revisions.revision)).all();
  }
  restore(visitor:string,id:string,revision:number,expectedRevision:number){
    return sqlite.transaction(()=>{
      const previous=this.get(visitor,id);if(!previous)throw new StorageError("Project not found.",404);
      if(previous.revision!==expectedRevision)throw new StorageError("A newer revision exists. Reload before restoring.",409);
      const old=db.select().from(revisions).where(and(eq(revisions.visitor,visitor),eq(revisions.projectId,id),eq(revisions.revision,revision))).get();
      if(!old)throw new StorageError("Revision not found.",404);
      // Restore trusted historical hardware as a new revision; history/issues are never changed.
      return this.save(visitor,id,expectedRevision,structuredClone(old.snapshot),true);
    })();
  }
  save(visitor:string,id:string,expectedRevision:number,design:Design,historical=false){
    return sqlite.transaction(()=>{
      const previous=this.get(visitor,id);
      if(!previous)throw new StorageError("Project not found.",404);
      // Older clients omit fields they do not know; never erase the newer work.
      const merged=historical?design:mergeDesignUpdate(previous.design,design);
      if(merged.intervalAnalysis?.dataset){
        const check=inspectDataset(merged.intervalAnalysis.dataset);
        if(!check.valid)throw new StorageError(check.problems.join(" "),422);
      }
      const frozen=freezeHardware(merged,historical?design:previous.design);
      const now=new Date().toISOString();
      const p=db.update(projects).set({design:frozen,revision:expectedRevision+1,updatedAt:now})
        .where(and(eq(projects.visitor,visitor),eq(projects.id,id),eq(projects.revision,expectedRevision))).returning().get();
      if(!p)throw new StorageError("A newer revision was saved elsewhere. Download your edits or reload before continuing.",409);
      db.insert(revisions).values({id:randomUUID(),visitor,projectId:id,revision:p.revision,snapshot:frozen,savedAt:now}).run();
      return p;
    })();
  }
  listIssues(visitor:string,id:string){return db.select().from(issues).where(and(eq(issues.visitor,visitor),eq(issues.projectId,id))).orderBy(desc(issues.createdAt)).all();}
  issue(visitor:string,id:string,expectedRevision:number){
    return sqlite.transaction(()=>{
      const p=this.get(visitor,id);if(!p)throw new StorageError("Project not found.",404);
      if(p.revision!==expectedRevision)throw new StorageError("The saved revision changed. Refresh before creating a proposal.",409);
      const errors=validateDesign(p.design).filter(f=>f.severity==="error");
      if(errors.length)throw new StorageError(`Resolve design errors first: ${errors[0].message}`,422);
      if(!p.design.pricing.taxBasis.trim())throw new StorageError("Record the tax assumptions first.",422);
      if(p.design.pricing.proposal&&!p.design.pricing.proposal.companyName.trim())throw new StorageError("Record the installer/company name before issuing a branded proposal.",422);
      const snapshot=freezeHardware(structuredClone(p.design),p.design);
      const templateVersion=snapshot.pricing.proposal?"preliminary-v4":"preliminary-v3";
      const electricalReport=assessElectrical(snapshot);
      const energyReport=analyseEnergy(snapshot);
      const frozenQuote=snapshot.pricing.proposal?quoteReport(snapshot):null;
      const hash=createHash("sha256").update(JSON.stringify({design:snapshot,revision:p.revision,template:templateVersion,electricalReport,energyReport,...(frozenQuote?{quoteReport:frozenQuote}:{})})).digest("hex");
      // Idempotent for the same project/revision/content.
      const existing=this.listIssues(visitor,id).find(i=>i.hash===hash);
      if(existing)return existing;
      return db.insert(issues).values({id:randomUUID(),visitor,projectId:id,projectName:p.name,revision:p.revision,
        snapshot,hash,createdAt:new Date().toISOString(),totalPence:frozenQuote?.totalPence??totals(snapshot).totalPence,templateVersion,electricalReport,energyReport,quoteReport:frozenQuote}).returning().get();
    })();
  }
  getIssue(visitor:string,id:string){return db.select().from(issues).where(and(eq(issues.visitor,visitor),eq(issues.id,id))).get();}
  private seed(visitor:string){
    if(db.select({id:projects.id}).from(projects).where(eq(projects.visitor,visitor)).limit(1).get())return;
    sqlite.transaction(()=>{
      const a=defaultDesign({customer:"Alex Morgan (sample)",address:"24 Hawthorn Lane, Chorley (sample)",postcode:"PR7 2AA",
        notes:"Sample site only. Roof dimensions and all equipment specifications are illustrative."});
      a.roofs[0]={...a.roofs[0],name:"South roof",width:11.6,height:7.1,obstacles:[{id:"chimney",label:"Chimney (sample)",x:9.15,y:1.25,width:1.05,height:1.1}]};
      a.roofs[0].panels=Array.from({length:18},(_,i)=>({id:`roof-1-M${String(i+1).padStart(3,"0")}`,x:1.4+(i%6)*1.154,y:.72+Math.floor(i/6)*1.782,landscape:false}));
      this.insert(visitor,"Hawthorn House",a,true);
      const b=defaultDesign({type:"Commercial",customer:"Northgate Workshop (sample)",address:"Northgate Business Park, Preston (sample)",postcode:"PR2 5AB",phase:"Three phase",inverterId:"ref-inv-25",
        moduleId:"ref-500",energy:{yieldPerKwp:820,shadeFactor:.95,consumption:42000,selfConsumption:65,importRate:.23,exportRate:.08}});
      b.roofs[0]={...b.roofs[0],name:"Workshop roof",width:20,height:11,pitch:8,azimuth:175,obstacles:[{id:"rooflight",label:"Rooflight (sample)",x:8,y:4,width:2,height:2}]};
      b.roofs[0].panels=fillRoof(b.roofs[0],{...modulesForSeed()},b.gap,false,54);
      b.pricing={...b.pricing,inverterSell:3300,labour:4500,access:1800};
      this.insert(visitor,"Northgate Workshop",b,true);
      const c=defaultDesign({customer:"Jamie Taylor (sample)",address:"8 Orchard Close, Lancaster (sample)",postcode:"LA1 4AB"});
      c.roofs[0].name="Main roof";c.roofs[0].width=9;c.roofs[0].height=5.5;
      this.insert(visitor,"Orchard Close",c,true);
    })();
  }
}
// Keep fixtures based on the same reference product used by the domain.
import { modules } from "@shared/schema";
function modulesForSeed(){return modules.find(m=>m.id==="ref-500")!;}
export const storage=new DatabaseStorage();
