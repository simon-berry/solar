import {z} from "zod";
import {simplePolygon} from "./geometry";
const n=z.number().finite();
// A UK-focused working extent, not a jurisdiction/approval determination.
export const geoPointSchema=z.object({lng:n.min(-9).max(2.5),lat:n.min(49).max(61.5)});
export const roofBoundarySchema=z.array(z.object({x:n.min(0).max(80),y:n.min(0).max(60)})).min(3).max(32).refine(simplePolygon,"Roof outline must be a simple polygon of at least 1 m².");
export const roofGeoSchema=z.object({
  origin:geoPointSchema,bearing:n.min(0).max(360),
  basis:z.enum(["traced-street","traced-satellite","manual-anchor"]),
  pitchAtMapping:n.min(0).max(75),widthAtMapping:n.min(2).max(80),heightAtMapping:n.min(2).max(60),
  capturedAt:z.string().datetime(),
});
export const mapLocationSchema=z.object({
  ...geoPointSchema.shape,label:z.string().max(240),source:z.enum(["photon","manual"]),capturedAt:z.string().datetime(),
});
export type GeoPoint=z.infer<typeof geoPointSchema>;
export type Point2={x:number;y:number};
export type SearchPlace={id:string;label:string;lng:number;lat:number;postcode:string;precision:string;attribution:string};
