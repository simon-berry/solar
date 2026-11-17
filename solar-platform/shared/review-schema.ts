import {z} from "zod";
const n=z.number().finite(),short=z.string().max(160),notes=z.string().max(3000);
const optionalDate=z.string().max(10).refine(s=>s===""||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s),"Enter a valid calendar date or leave blank.");
export const surveySchema=z.object({
  assessor:short,date:optionalDate,basis:z.enum(["unknown","measured","customer-supplied","remote-estimate","engineer-supplied"]),
  covering:short,structure:notes,condition:z.enum(["unknown","reported-good","defects-noted","specialist-review"]),
  supportSpacingMm:n.min(50).max(10000).nullable(),access:notes,equipmentLocations:notes,
  gridStatus:z.enum(["not-assessed","route-review","evidence-recorded"]),gridReference:short,permissions:notes,
});
const position={id:z.string().min(1).max(80),roofId:z.string().min(1).max(80),x:n.min(0).max(80),y:n.min(0).max(60)};
export const mountingSchema=z.object({
  family:short,scheduleReference:short,source:notes,
  additionalMassKg:n.min(0).max(100000).nullable(),
  rails:z.array(z.object({...position,x2:n.min(0).max(80),y2:n.min(0).max(60)})).max(1000),
  fixings:z.array(z.object({...position,type:short})).max(2000),
  ballast:z.array(z.object({...position,massKg:n.positive().max(5000)})).max(1000),
});
export const evidenceKindSchema=z.enum(["survey-photo","site-plan","electrical-report","structural-report","mounting-schedule","grid-evidence","other"]);
export const evidenceUploadSchema=z.object({
  filename:z.string().min(1).max(120).regex(/^[^/\\\u0000-\u001f]+$/),kind:evidenceKindSchema,
  author:z.string().trim().min(2).max(160),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:z.string().trim().min(2).max(500),notes:z.string().max(2000),content:z.string().min(4).max(8_388_608),
  expectedRevision:z.number().int().positive(),
});
export const reviewDecisionSchema=z.object({
  submissionId:z.string().min(1).max(80),scope:z.enum(["electrical","structural","mounting"]),
  outcome:z.enum(["accepted-external-evidence","changes-required"]),
  qualifications:z.string().trim().min(10).max(1000),limitations:z.string().trim().min(10).max(3000),
  evidenceIds:z.array(z.string().min(1).max(80)).min(1).max(30),declaration:z.literal(true),
});
export type Survey=z.infer<typeof surveySchema>;
export type Mounting=z.infer<typeof mountingSchema>;
export type EvidenceKind=z.infer<typeof evidenceKindSchema>;
export type ReviewDecision=z.infer<typeof reviewDecisionSchema>;
export const surveyDefaults=():Survey=>({assessor:"",date:"",basis:"unknown",covering:"",structure:"",condition:"unknown",supportSpacingMm:null,access:"",equipmentLocations:"",gridStatus:"not-assessed",gridReference:"",permissions:""});
export const mountingDefaults=():Mounting=>({family:"",scheduleReference:"",source:"",additionalMassKg:null,rails:[],fixings:[],ballast:[]});
export type Evidence={id:string;projectId:string;filename:string;kind:EvidenceKind;mime:string;size:number;hash:string;author:string;date:string;source:string;notes:string;engineeringHash:string;revision:number;createdAt:string};
export type Submission={id:string;revision:number;engineeringHash:string;createdBy:string;author:string;createdAt:string;evidenceIds:string[]};
export type Decision={id:string;submissionId:string;scope:ReviewDecision["scope"];outcome:ReviewDecision["outcome"];reviewerId:string;reviewer:string;qualifications:string;limitations:string;evidenceIds:string[];createdAt:string};
export type EngineeringReport={
  methodVersion:"external-review-v1";engineeringHash:string;revision:number;releaseAvailable:false;
  electricalReport:import("./electrical").ElectricalReport;
  findings:{id:string;message:string;level:"error"|"review"}[];
  evidence:Evidence[];submissions:Submission[];decisions:Decision[];currentSubmission:Submission|null;
  reviewStatus:Record<ReviewDecision["scope"],"not-submitted"|"awaiting-review"|"changes-required"|"accepted-external-evidence"|"stale">;
  masses:{moduleKg:number;ballastKg:number;additionalKg:number|null;knownTotalKg:number;complete:false};
  limitations:string[];
};
