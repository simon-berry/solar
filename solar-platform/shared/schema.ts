import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { intervalAnalysisSchema } from "./energy-schema";
import {surveySchema,mountingSchema} from "./review-schema";
import {proposalDetailsSchema} from "./quote-schema";
import {roofBoundarySchema,roofGeoSchema,mapLocationSchema} from "./map-schema";

const finite = z.number().finite();
const moduleIdSchema=z.enum(["ref-440","ref-460","ref-500","trina-neg9r28-440","trina-neg9r28-450","trina-neg9r28-460"]);
const inverterIdSchema=z.enum(["ref-inv-5","ref-inv-10","ref-inv-25","sungrow-sg5rs","sungrow-sg6rs"]);
const productSourceSchema=z.object({
  manufacturer:z.string().max(80),model:z.string().max(100),url:z.string().url(),
  documentRevision:z.string().max(100),checkedOn:z.string().max(10),notes:z.string().max(1000),
});
export const panelSchema = z.object({
  id: z.string().min(1).max(80), x: finite.min(0), y: finite.min(0),
  landscape: z.boolean(),
});
export const obstacleSchema = z.object({
  id: z.string().min(1).max(80), label: z.string().min(1).max(60),
  x: finite.min(0), y: finite.min(0), width: finite.min(.1).max(50), height: finite.min(.1).max(50),
});
export const roofSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().min(1).max(60),
  width: finite.min(2).max(80), height: finite.min(2).max(60),
  pitch: finite.min(0).max(75), azimuth: finite.min(0).max(359),
  setback: finite.min(0).max(3),
  panels: z.array(panelSchema).max(150), obstacles: z.array(obstacleSchema).max(30),
  boundary:roofBoundarySchema.nullable().optional(),geo:roofGeoSchema.nullable().optional(),
});
export const moduleSpecSchema=z.object({
  id:moduleIdSchema,name:z.string().max(120),source:productSourceSchema.optional(),
  watts:finite.positive(),width:finite.positive(),height:finite.positive(),mass:finite.positive(),
  voc:finite.positive(),vmp:finite.positive(),isc:finite.positive(),imp:finite.positive(),
  betaVoc:finite.min(-.02).max(0),betaVmp:finite.min(-.02).max(0).optional(),
  cost:finite.min(0).nullable(),
});
export const inverterSpecSchema=z.object({
  id:inverterIdSchema,name:z.string().max(120),source:productSourceSchema.optional(),kw:finite.positive(),
  phase:z.enum(["Single phase","Three phase"]),cost:finite.min(0).nullable(),maxDc:finite.positive(),
  mpptCount:z.number().int().min(1).max(6),inputsPerMppt:z.number().int().min(1).max(4),
  mpptMin:finite.positive(),mpptMax:finite.positive(),
  maxInputCurrent:finite.positive(),maxInputIsc:finite.positive(),
  maxMpptCurrent:finite.positive(),maxMpptIsc:finite.positive(),
});
export const stringSchema=z.object({
  id:z.string().min(1).max(80),name:z.string().trim().min(1).max(40),
  inverterIndex:z.number().int().min(0).max(5),mpptIndex:z.number().int().min(0).max(5),
  moduleIds:z.array(z.string().min(1).max(80)).max(150),
});
export const electricalSchema=z.object({
  enabled:z.boolean(),minCellTemp:finite.min(-40).max(25),maxCellTemp:finite.min(25).max(100),
  iscFactor:finite.min(1).max(2),strings:z.array(stringSchema).max(48),
});
export type StringDesign=z.infer<typeof stringSchema>;
export type ElectricalDesign=z.infer<typeof electricalSchema>;
export type ModuleSpec=z.infer<typeof moduleSpecSchema>;
export type InverterSpec=z.infer<typeof inverterSpecSchema>;
export const designSchema = z.object({
  roofs: z.array(roofSchema).min(1).max(10),
  moduleId: moduleIdSchema,
  inverterId: inverterIdSchema,
  inverterCount: z.number().int().min(1).max(6),
  gap: finite.min(.01).max(.5),
  customer: z.string().min(1).max(120), address: z.string().min(1).max(240),
  postcode: z.string().min(2).max(12),
  nation: z.enum(["England", "Wales", "Scotland", "Northern Ireland"]),
  type: z.enum(["Residential", "Commercial"]),
  phase: z.enum(["Single phase", "Three phase"]),
  notes: z.string().max(3000),
  pricing: z.object({
    panelSell: finite.min(0).max(2000), mountingPerPanel: finite.min(0).max(1000),
    inverterSell: finite.min(0).max(30000), labour: finite.min(0).max(50000),
    access: finite.min(0).max(50000), other: finite.min(0).max(50000),
    vat: z.enum(["0", "5", "20"]), taxBasis: z.string().min(1).max(500),
    proposal:proposalDetailsSchema.nullable().optional(),
  }),
  energy: z.object({
    yieldPerKwp: finite.min(0).max(1600), shadeFactor: finite.min(0).max(1),
    consumption: finite.min(0).max(2000000), selfConsumption: finite.min(0).max(100),
    importRate: finite.min(0).max(3), exportRate: finite.min(0).max(3),
  }),
  electrical:electricalSchema.optional(),
  intervalAnalysis:intervalAnalysisSchema.optional(),
  survey:surveySchema.optional(),
  mounting:mountingSchema.optional(),
  mapLocation:mapLocationSchema.nullable().optional(),
  catalogueSnapshot:z.object({
    version:z.enum(["reference-v2","catalogue-v3"]),module:moduleSpecSchema,inverter:inverterSpecSchema,
    provenance:z.enum(["unverified-reference","manufacturer-datasheet","mixed"]),
  }).optional(),
});
export type Design = z.infer<typeof designSchema>;
export type Roof = z.infer<typeof roofSchema>;
export type Panel = z.infer<typeof panelSchema>;
export type Obstacle = z.infer<typeof obstacleSchema>;

export const projects = sqliteTable("solar_projects", {
  id: text("id").primaryKey(), visitor: text("visitor").notNull(),
  name: text("name").notNull(), sample: integer("sample", { mode: "boolean" }).notNull().default(false),
  revision: integer("revision").notNull().default(1),
  design: text("design", { mode: "json" }).$type<Design>().notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, revision: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const revisions = sqliteTable("solar_revisions", {
  id: text("id").primaryKey(), visitor: text("visitor").notNull(),
  projectId: text("project_id").notNull(), revision: integer("revision").notNull(),
  snapshot: text("snapshot", { mode: "json" }).$type<Design>().notNull(),
  savedAt: text("saved_at").notNull(),
});
export const insertRevisionSchema = createInsertSchema(revisions).omit({ id: true });
export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Revision = typeof revisions.$inferSelect;

export const issues = sqliteTable("solar_issues", {
  id: text("id").primaryKey(), visitor: text("visitor").notNull(), projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(), revision: integer("revision").notNull(),
  snapshot: text("snapshot", { mode: "json" }).$type<Design>().notNull(),
  hash: text("hash").notNull(), createdAt: text("created_at").notNull(),
  totalPence: integer("total_pence").notNull(),
  templateVersion:text("template_version").notNull().default("preliminary-v1"),
  electricalReport:text("electrical_report",{mode:"json"}).$type<import("./electrical").ElectricalReport>(),
  energyReport:text("energy_report",{mode:"json"}).$type<import("./energy").EnergyReport>(),
  quoteReport:text("quote_report",{mode:"json"}).$type<import("./quote-schema").QuoteReport>(),
});
export const insertIssueSchema = createInsertSchema(issues).omit({ id: true });
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issues.$inferSelect;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name").max(100),
  customer: z.string().trim().min(2, "Enter a customer name").max(120),
  address: z.string().trim().min(3, "Enter a site address").max(240),
  postcode: z.string().trim().min(2, "Enter a postcode").max(12),
  type: z.enum(["Residential", "Commercial"]),
  nation: z.enum(["England", "Wales", "Scotland", "Northern Ireland"]),
});
export type CreateProject = z.infer<typeof createProjectSchema>;
export const saveProjectSchema = z.object({
  expectedRevision: z.number().int().min(1), design: designSchema,
});

export const modules: ModuleSpec[] = [
  { id:"ref-440", name:"Reference 440 · all-black", watts:440, width:1.134, height:1.762, voc:39.7, vmp:33.2, isc:13.9, imp:13.25, betaVoc:-.0025, betaVmp:-.003, cost:75, mass:21 },
  { id:"ref-460", name:"Reference 460 · high-output", watts:460, width:1.134, height:1.8, voc:41.8, vmp:35.1, isc:13.8, imp:13.1, betaVoc:-.0025, betaVmp:-.003, cost:88, mass:22 },
  { id:"ref-500", name:"Reference 500 · commercial", watts:500, width:1.134, height:1.96, voc:45.2, vmp:38, isc:13.9, imp:13.16, betaVoc:-.0025, betaVmp:-.003, cost:102, mass:25 },
];
export const inverters:InverterSpec[] = [
  { id:"ref-inv-5", name:"Reference 5 kW · single-phase", kw:5, maxDc:600, phase:"Single phase", cost:650,mpptCount:2,inputsPerMppt:2,mpptMin:90,mpptMax:550,maxInputCurrent:16,maxInputIsc:20,maxMpptCurrent:30,maxMpptIsc:40 },
  { id:"ref-inv-10", name:"Reference 10 kW · three-phase", kw:10, maxDc:1000, phase:"Three phase", cost:1350,mpptCount:2,inputsPerMppt:2,mpptMin:160,mpptMax:850,maxInputCurrent:16,maxInputIsc:20,maxMpptCurrent:30,maxMpptIsc:40 },
  { id:"ref-inv-25", name:"Reference 25 kW · three-phase", kw:25, maxDc:1000, phase:"Three phase", cost:2450,mpptCount:3,inputsPerMppt:2,mpptMin:200,mpptMax:850,maxInputCurrent:20,maxInputIsc:25,maxMpptCurrent:40,maxMpptIsc:60 },
];

// Selected exact variants only. No price, stock, MCS-listing or system-compatibility claim.
const trinaSource={
  manufacturer:"Trina Solar",url:"https://static.trinasolar.com/sites/default/files/DT-M-0043-G-EN%20K%20Datasheet_Vertex%20S+_NEG9R.28_2025_B_0.pdf",
  documentRevision:"TSM_EN_2025_B · DT-M-0043-G-EN K",checkedOn:"2026-11-13",
  notes:"STC front-side data. Vmp temperature coefficient not published; hot/cold MPPT voltage checks remain incomplete. Confirm regional variant and current datasheet before procurement. Price unknown.",
};
for(const [watts,voc,vmp,isc,imp] of [[440,52.2,44,10.67,10.01],[450,52.9,44.6,10.74,10.09],[460,53.8,45.4,10.81,10.14]]){
  modules.push({id:`trina-neg9r28-${watts}` as ModuleSpec["id"],name:`Trina Vertex S+ · TSM-${watts}NEG9R.28`,
    watts,voc,vmp,isc,imp,width:1.134,height:1.762,mass:21,betaVoc:-.0024,cost:null,
    source:{...trinaSource,model:`TSM-${watts}NEG9R.28`}});
}
for(const kw of [5,6]){
  inverters.push({id:`sungrow-sg${kw}rs` as InverterSpec["id"],name:`Sungrow SG${kw}.0RS · ${kw} kW`,
    kw,phase:"Single phase",cost:null,maxDc:600,mpptCount:2,inputsPerMppt:1,mpptMin:40,mpptMax:560,
    maxInputCurrent:16,maxInputIsc:20,maxMpptCurrent:16,maxMpptIsc:20,
    source:{manufacturer:"Sungrow",model:`SG${kw}.0RS`,
      url:"https://info-support.sungrowpower.com/application/pdf/2023/07/22/DS_20220714_SG5.0_6.0RS_Datasheet_V12_EN(GL).pdf",
      documentRevision:"2022-07-14 · Version 12 EN(GL)",checkedOn:"2026-11-13",
      notes:"Global variant, not RS-L or RS-ADA. Two MPPTs, one string each; 16 A operating / 20 A short-circuit per MPPT, not 32 A / 40 A per input. 50 V startup is not the 40 V MPPT minimum. UK grid settings, approval, full-power range and exact supplied variant require review. Separate AC-coupled battery inverter assumed in the battery model. Price unknown."}});
}
