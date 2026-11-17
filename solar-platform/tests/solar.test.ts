import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultDesign, fillRoof, validPlacement, totals, validateDesign, overlaps, stableJSON } from "../shared/solar";
import { modules, designSchema } from "../shared/schema";

test("auto-fill observes boundaries, clearances and obstacles",()=>{
  const d=defaultDesign(),r=d.roofs[0],m=modules[0];
  r.obstacles=[{id:"o",label:"Chimney",x:3,y:2,width:1,height:1}];
  r.panels=fillRoof(r,m,d.gap);
  assert.ok(r.panels.length>0);
  assert.ok(r.panels.every(p=>validPlacement(r,p,m,d.gap)));
  assert.equal(new Set(r.panels.map(p=>p.id)).size,r.panels.length);
});
test("portrait and landscape dimensions produce valid layouts",()=>{
  for(const landscape of [false,true]){
    const d=defaultDesign(),r=d.roofs[0];r.panels=fillRoof(r,modules[0],d.gap,landscape);
    assert.ok(r.panels.length>0);assert.ok(r.panels.every(p=>validPlacement(r,p,modules[0],d.gap)));
  }
});
test("clearance equality permitted but gap violation rejected",()=>{
  assert.equal(overlaps({x:0,y:0,width:1,height:1},{x:1.02,y:0,width:1,height:1},.02),false);
  assert.equal(overlaps({x:0,y:0,width:1,height:1},{x:1.01,y:0,width:1,height:1},.02),true);
});
test("auto-fill respects count limits and impossible clearances",()=>{
  const d=defaultDesign(),r=d.roofs[0];
  assert.equal(fillRoof(r,modules[0],d.gap,false,3).length,3);
  r.setback=3;assert.equal(fillRoof(r,modules[0],d.gap).length,0);
});
test("shrinking roof preserves modules and reports errors",()=>{
  const d=defaultDesign();d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap);
  const count=d.roofs[0].panels.length;d.roofs[0].width=2;
  assert.equal(d.roofs[0].panels.length,count);
  assert.ok(validateDesign(d).some(f=>f.severity==="error"));
});
test("quote reconciles in pence with manually selected VAT",()=>{
  const d=defaultDesign();d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,10);
  d.pricing.panelSell=120.99;d.pricing.vat="5";
  const t=totals(d);
  assert.equal(t.kwp,4.4);
  assert.equal(t.totalPence,t.netPence+t.vatPence);
  assert.equal(t.netPence,t.lines.reduce((n,l)=>n+l.quantity*l.unitPence,0));
  assert.equal(t.vatPence,Math.round(t.netPence*.05));
});
test("energy assumption cannot credit more self use than demand",()=>{
  const d=defaultDesign();d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,10);
  d.energy.consumption=100;d.energy.selfConsumption=100;
  const t=totals(d);
  assert.equal(t.selfUsed,100);assert.equal(t.selfUsed+t.exported,t.generation);
});
test("phase mismatch and unknown engineering scope never pass silently",()=>{
  const d=defaultDesign();d.inverterId="ref-inv-25";
  const f=validateDesign(d);
  assert.ok(f.find(a=>a.id==="phase"&&a.severity==="error"));
  for(const id of ["catalogue","survey","electrical","structural","grid","yield"])assert.ok(f.find(a=>a.id===id&&a.severity==="review"));
});
test("schema rejects invalid values and duplicate module IDs are findings",()=>{
  const d=defaultDesign();d.roofs[0].width=NaN;assert.equal(designSchema.safeParse(d).success,false);
  const e=defaultDesign();e.roofs[0].panels=[{id:"same",x:.4,y:.4,landscape:false},{id:"same",x:4,y:.4,landscape:false}];
  assert.ok(validateDesign(e).some(f=>f.id==="duplicate-same"));
});
test("saved-state comparison ignores schema property ordering",()=>{
  const d=defaultDesign();
  assert.equal(stableJSON(d),stableJSON(designSchema.parse(d)));
  assert.equal(stableJSON({a:1,b:{c:2,d:3}}),stableJSON({b:{d:3,c:2},a:1}));
});
