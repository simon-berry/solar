import type {Design} from "@shared/schema";
// Per-identity, transient only. Cleared when sessions end; durable work needs Save.
export const workspaceDrafts=new Map<string,{design:Design;revision:number;baseline:string}>();
