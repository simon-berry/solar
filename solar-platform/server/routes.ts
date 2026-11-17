import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { z } from "zod";
import { createProjectSchema, saveProjectSchema,designSchema } from "@shared/schema";
import { storage, StorageError } from "./storage";
import { proposalPdf, roofSvg, schematicSvg } from "./documents";
import {assessElectrical} from "@shared/electrical";
import {stringLayoutSvg,electricalSchematicSvg} from "./electrical-documents";
import {analyseEnergy,dispatchCsv} from "@shared/energy";
import {registerAccess,accounts} from "./access-routes";
import {canDesign,canQuote} from "@shared/access";
import {stableJSON,mergeDesignUpdate} from "@shared/solar";
import {reviews} from "./reviews";
import {technicalPdf,roofDxf} from "./technical-documents";
import {mountingDefaults} from "@shared/review-schema";
import {registerMaps} from "./maps";
import {mapFeatures} from "@shared/map-geometry";
import {hardware} from "@shared/electrical";

export async function registerRoutes(httpServer:Server,app:Express):Promise<Server>{
  app.get("/api/health",(_req,res)=>res.json({status:"ok",version:"0.7.0",mode:"development-alpha"}));
  registerAccess(app);
  registerMaps(app);
  const wrap=(handler:(req:Request,res:Response)=>unknown)=>(req:Request,res:Response,next:NextFunction)=>{
    try{handler(req,res);}catch(error){
      if(error instanceof z.ZodError)return res.status(422).json({message:error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).slice(0,5).join("; ")});
      if(error instanceof StorageError)return res.status(error.status).json({message:error.message});
      next(error);
    }
  };
  const id=(req:Request)=>String(req.params.id);
  const permit=(req:Request,action:"design"|"quote")=>{if(!(action==="design"?canDesign(req.identity?.role):canQuote(req.identity?.role)))throw new StorageError("Your role does not permit this action.",403);};
  const audit=(req:Request,action:string,target:string)=>{if(req.identity)accounts.audit(req.identity,action,target);};
  app.get("/api/projects",wrap((req,res)=>res.json(storage.list(req.solarVisitor))));
  app.post("/api/projects",wrap((req,res)=>{permit(req,"design");const p=storage.create(req.solarVisitor,createProjectSchema.parse(req.body));audit(req,"project.created",p.id);res.status(201).json(p);}));
  app.post("/api/projects/import",wrap((req,res)=>{
    permit(req,"design");
    const input=z.object({format:z.literal("solar-workspace-v1"),name:z.string().trim().min(2).max(100),design:designSchema}).parse(req.body);
    const p=storage.importProject(req.solarVisitor,input.name,input.design);audit(req,"project.imported",p.id);res.status(201).json(p);
  }));
  app.get("/api/projects/:id",wrap((req,res)=>{
    const p=storage.get(req.solarVisitor,id(req));if(!p)throw new StorageError("Project not found.",404);res.json(p);
  }));
  app.put("/api/projects/:id",wrap((req,res)=>{
    permit(req,"quote");
    const body=saveProjectSchema.parse(req.body);
    if(req.identity?.role==="estimator"){
      const prior=storage.get(req.solarVisitor,id(req));if(!prior)throw new StorageError("Project not found.",404);
      const {pricing:_a,catalogueSnapshot:_s,...before}=prior.design,{pricing:_b,catalogueSnapshot:_t,...after}=mergeDesignUpdate(prior.design,body.design);
      if(stableJSON(before)!==stableJSON(after))throw new StorageError("Estimators may change pricing only. A designer must update site, layout or energy inputs.",403);
    }
    const p=storage.save(req.solarVisitor,id(req),body.expectedRevision,body.design);audit(req,"project.saved",`${p.id}:rev-${p.revision}`);res.json(p);
  }));
  app.get("/api/projects/:id/revisions",wrap((req,res)=>{
    if(!storage.get(req.solarVisitor,id(req)))throw new StorageError("Project not found.",404);res.json(storage.listRevisions(req.solarVisitor,id(req)));
  }));
  app.post("/api/projects/:id/restore",wrap((req,res)=>{
    permit(req,"design");const b=z.object({revision:z.number().int().positive(),expectedRevision:z.number().int().positive()}).parse(req.body);
    const p=storage.restore(req.solarVisitor,id(req),b.revision,b.expectedRevision);audit(req,"project.restored",`${p.id}:from-${b.revision}:to-${p.revision}`);res.json(p);
  }));
  app.get("/api/projects/:id/engineering",wrap((req,res)=>res.json(reviews.report(req.solarVisitor,id(req)))));
  app.get("/api/projects/:id/mounting-template.json",wrap((req,res)=>{
    const p=storage.get(req.solarVisitor,id(req));if(!p)throw new StorageError("Project not found.",404);
    res.attachment("solar-mounting-template.json").json({format:"solar-mounting-v1",...mountingDefaults(),roofIds:p.design.roofs.map(r=>({id:r.id,name:r.name,width:r.width,height:r.height})),instructions:"Roof-plane metres. Populate only from an external manufacturer/engineer schedule. Empty arrays are not a validated mounting design."});
  }));
  app.post("/api/projects/:id/evidence",wrap((req,res)=>{permit(req,"design");const e=reviews.upload(req.solarVisitor,id(req),req.body);audit(req,"evidence.uploaded",e.id);res.status(201).json(e);}));
  app.get("/api/projects/:id/evidence/:evidenceId/download",wrap((req,res)=>{
    const e=reviews.evidenceFile(req.solarVisitor,id(req),String(req.params.evidenceId));
    res.setHeader("Content-Security-Policy","default-src 'none'; sandbox");res.type(e.mime).attachment(e.filename).send(e.content);
  }));
  app.post("/api/projects/:id/review-submissions",wrap((req,res)=>{
    permit(req,"design");const b=z.object({expectedRevision:z.number().int().positive()}).parse(req.body);
    const s=reviews.submit(req.solarVisitor,id(req),b.expectedRevision,req.identity);audit(req,"engineering.submitted",s.id);res.status(201).json(s);
  }));
  app.post("/api/projects/:id/review-decisions",wrap((req,res)=>{
    const d=reviews.decide(req.solarVisitor,id(req),req.body,req.identity);audit(req,"engineering.external-review-recorded",d.id);res.status(201).json(d);
  }));
  app.get("/api/projects/:id/technical-issues",wrap((req,res)=>res.json(reviews.technicalIssues(req.solarVisitor,id(req)))));
  app.post("/api/projects/:id/technical-issues",wrap((req,res)=>{
    permit(req,"design");const b=z.object({expectedRevision:z.number().int().positive()}).parse(req.body);
    const issue=reviews.issue(req.solarVisitor,id(req),b.expectedRevision,req.identity);audit(req,"technical.review-pack-issued",issue.id);res.status(201).json(issue);
  }));
  app.get("/api/technical-issues/:id/pack.pdf",wrap((req,res)=>{
    const issue=reviews.getIssue(req.solarVisitor,id(req));if(!issue)throw new StorageError("Technical issue not found.",404);technicalPdf(issue,res);
  }));
  app.get("/api/technical-issues/:id/report.json",wrap((req,res)=>{
    const issue=reviews.getIssue(req.solarVisitor,id(req));if(!issue)throw new StorageError("Technical issue not found.",404);
    res.attachment(`solar-technical-report-rev-${issue.revision}.json`).json({issueId:issue.id,hash:issue.hash,revision:issue.revision,template:issue.template,report:issue.report});
  }));
  app.get("/api/projects/:id/issues",wrap((req,res)=>{
    if(!storage.get(req.solarVisitor,id(req)))throw new StorageError("Project not found.",404);
    res.json(storage.listIssues(req.solarVisitor,id(req)));
  }));
  app.post("/api/projects/:id/issues",wrap((req,res)=>{
    permit(req,"quote");
    const {expectedRevision}=z.object({expectedRevision:z.number().int().min(1)}).parse(req.body);
    const issue=storage.issue(req.solarVisitor,id(req),expectedRevision);audit(req,"proposal.issued",issue.id);res.status(201).json(issue);
  }));
  app.get("/api/issues/:id/proposal.pdf",wrap((req,res)=>{
    const issue=storage.getIssue(req.solarVisitor,id(req));if(!issue)throw new StorageError("Document not found.",404);proposalPdf(issue,res);
  }));
  app.get("/api/issues/:id/quote.json",wrap((req,res)=>{
    const issue=storage.getIssue(req.solarVisitor,id(req));if(!issue)throw new StorageError("Document not found.",404);
    if(!issue.quoteReport)throw new StorageError("This legacy issue has no frozen itemised quote report.",404);
    res.attachment(`solar-quote-rev-${issue.revision}.json`).json({issueId:issue.id,revision:issue.revision,hash:issue.hash,template:issue.templateVersion,quote:issue.quoteReport});
  }));
  app.get("/api/issues/:id/electrical.json",wrap((req,res)=>{
    const issue=storage.getIssue(req.solarVisitor,id(req));if(!issue)throw new StorageError("Document not found.",404);
    if(!issue.electricalReport)throw new StorageError("This legacy issue has no frozen electrical report.",404);
    res.attachment(`solar-electrical-rev-${issue.revision}.json`).json({issueId:issue.id,revision:issue.revision,hash:issue.hash,report:issue.electricalReport});
  }));
  app.get("/api/issues/:id/energy.json",wrap((req,res)=>{
    const issue=storage.getIssue(req.solarVisitor,id(req));if(!issue)throw new StorageError("Document not found.",404);
    if(!issue.energyReport)throw new StorageError("This issue has no frozen interval report.",404);
    res.attachment(`solar-energy-rev-${issue.revision}.json`).json({issueId:issue.id,revision:issue.revision,hash:issue.hash,report:issue.energyReport});
  }));
  app.get("/api/projects/:id/electrical",wrap((req,res)=>{
    const p=storage.get(req.solarVisitor,id(req));if(!p)throw new StorageError("Project not found.",404);
    res.json({revision:p.revision,report:assessElectrical(p.design)});
  }));
  app.get("/api/projects/:id/export/:file",wrap((req,res)=>{
    const p=storage.get(req.solarVisitor,id(req));if(!p)throw new StorageError("Project not found.",404);
    const file=String(req.params.file);
    if(file==="site.geojson")return res.type("application/geo+json").attachment(`solar-site-rev-${p.revision}.geojson`).send(JSON.stringify({...mapFeatures(p.design,hardware(p.design).module),revision:p.revision,purpose:"Preliminary user geometry only. Coordinates are approximate; not a survey. No provider imagery included."}));
    if(file==="roof.dxf")return res.type("application/dxf").attachment(`solar-roof-rev-${p.revision}.dxf`).send(roofDxf(p.design));
    if(["energy.json","dispatch.csv"].includes(file)){
      const report=analyseEnergy(p.design);if(!report)throw new StorageError("Import and save interval data first.",422);
      if(file==="energy.json")return res.attachment(`solar-energy-rev-${p.revision}.json`).json({revision:p.revision,report});
      if(report.blockedReason)throw new StorageError(report.blockedReason,422);
      return res.type("text/csv").attachment(`solar-dispatch-rev-${p.revision}.csv`).send(dispatchCsv(p.design));
    }
    if(["strings.svg","electrical.svg","electrical.json"].includes(file)){
      if(!p.design.electrical?.enabled)throw new StorageError("Enable and save an electrical string model first.",422);
      if(file==="electrical.json")return res.attachment(`solar-electrical-rev-${p.revision}.json`).json({revision:p.revision,report:assessElectrical(p.design)});
      res.setHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; sandbox");
      return res.type("image/svg+xml").attachment(`solar-${file}`).send(file==="strings.svg"?stringLayoutSvg(p.name,p.design,p.revision):electricalSchematicSvg(p.name,p.design,p.revision));
    }
    if(file==="project.json"){
      // Do not expose visitor scope identifiers or internal storage metadata.
      return res.attachment("solar-project.json").json({format:"solar-workspace-v1",name:p.name,revision:p.revision,design:p.design,exportedAt:new Date().toISOString(),purpose:"preliminary"});
    }
    if(!["roof.svg","schematic.svg"].includes(file))throw new StorageError("Export not found.",404);
    res.setHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.type("image/svg+xml").attachment(`solar-${file}`).send(file==="roof.svg"?roofSvg(p.name,p.design,p.revision):schematicSvg(p.name,p.design,p.revision));
  }));
  app.use("/api",(_req,res)=>res.status(404).json({message:"API endpoint not found."}));
  return httpServer;
}
