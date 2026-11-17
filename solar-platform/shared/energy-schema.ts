import { z } from "zod";

const n=z.number().finite();
export const batterySchema=z.object({
  usableKwh:n.min(0).max(500),chargeKw:n.min(.1).max(250),dischargeKw:n.min(.1).max(250),
  chargeEfficiency:n.min(.5).max(1),dischargeEfficiency:n.min(.5).max(1),
  reservePercent:n.min(0).max(95),initialPercent:n.min(0).max(100),
}).refine(b=>b.initialPercent>=b.reservePercent,{message:"Initial SOC must be at least the reserve."});
export const intervalDatasetSchema=z.object({
  label:z.string().min(1).max(120),timezone:z.enum(["Europe/London","UTC"]),
  intervalMinutes:z.union([z.literal(15),z.literal(30),z.literal(60)]),
  consumptionKind:z.enum(["measured","modelled","synthetic"]),
  pvKind:z.enum(["absent","measured","modelled","synthetic"]),
  pvSystemKwp:n.min(0).max(2000).optional(),
  rows:z.array(z.object({start:z.string().datetime(),consumptionKwh:n.min(0).max(100000),pvKwh:n.min(0).max(100000).optional()})).min(1).max(20000),
});
export const intervalAnalysisSchema=z.object({dataset:intervalDatasetSchema.nullable(),battery:batterySchema});
export type Battery=z.infer<typeof batterySchema>;
export type IntervalDataset=z.infer<typeof intervalDatasetSchema>;
export type IntervalAnalysis=z.infer<typeof intervalAnalysisSchema>;
export const batteryDefaults=():Battery=>({usableKwh:5,chargeKw:3,dischargeKw:3,chargeEfficiency:.95,dischargeEfficiency:.95,reservePercent:0,initialPercent:0});
