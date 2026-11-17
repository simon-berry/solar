import {test} from "node:test";
import assert from "node:assert/strict";
import {PassThrough} from "node:stream";
import {PDFDocument} from "pdf-lib";
import type {Response} from "express";
import {createHash} from "node:crypto";
import {proposalDefaults,proposalDetailsSchema,quoteLinePence,proposalInk} from "../shared/quote-schema";
import {defaultDesign,fillRoof,totals,quoteReport,mergeDesignUpdate} from "../shared/solar";
import {modules,designSchema} from "../shared/schema";
import {proposalPdf} from "../server/documents";
process.env.DATABASE_PATH=":memory:";
const {storage,sqlite}=await import("../server/storage");
const {engineeringHash}=await import("../server/reviews");
let counter=0;
function fixture(){
  const p=storage.create("quote-qa",{name:`Itemised QA ${++counter}`,customer:"Synthetic customer",address:"Synthetic test only",postcode:"PR7 1AA",nation:"England",type:"Residential"});
  const d=structuredClone(p.design);d.roofs[0].panels=fillRoof(d.roofs[0],modules[0],d.gap,false,8);
  d.pricing.proposal={...proposalDefaults(),companyName:"Synthetic Installer Ltd (QA only)",email:"quote@example.test",includedScope:"Synthetic scope only, not engineering approval.",items:[
    {id:"cable",description:"Synthetic cable allowance",quantity:1.005,unit:"m",unitPrice:1,included:true},
    {id:"optional",description:"OPTIONAL SYNTHETIC STORAGE",quantity:1,unit:"item",unitPrice:4500,included:false},
  ]};
  return storage.save("quote-qa",p.id,p.revision,d);
}
function pdfBytes(issue:Parameters<typeof proposalPdf>[0]){
  const stream=new PassThrough() as PassThrough&{type:()=>unknown;attachment:()=>unknown};
  stream.type=stream.attachment=()=>stream;
  const result=new Promise<Buffer>((resolve,reject)=>{const chunks:Buffer[]=[];stream.on("data",c=>chunks.push(c));stream.on("end",()=>resolve(Buffer.concat(chunks)));stream.on("error",reject);});
  proposalPdf(issue,stream as unknown as Response);return result;
}
test("integer milliunit line rounding handles exact half pennies and safe large totals",()=>{
  assert.equal(quoteLinePence(1.005,100),101);
  assert.equal(quoteLinePence(.005,100),1);
  assert.equal(quoteLinePence(2.345,99),232);
  assert.equal(quoteLinePence(10000,10000000),100000000000);
});
test("light brand colours fall back to dark PDF text without changing the stored accent",()=>{
  assert.equal(proposalInk("#ffffff"),"#203a2c");assert.equal(proposalInk("#ffff00"),"#203a2c");
  assert.equal(proposalInk("#176944"),"#176944");
});
test("included extras reconcile in pennies and optional lines never enter VAT/total",()=>{
  const d=defaultDesign(),base=totals(d);
  d.pricing.proposal={...proposalDefaults(),items:[{id:"a",description:"A",quantity:1.005,unit:"m",unitPrice:1,included:true},{id:"b",description:"B",quantity:1,unit:"item",unitPrice:5000,included:false}]};
  const t=totals(d),report=quoteReport(d);
  assert.equal(t.netPence,base.netPence+101);
  assert.equal(t.vatPence,Math.round(t.netPence*.2));assert.equal(t.totalPence,t.netPence+t.vatPence);
  assert.equal(t.optionalLines[0].amountPence,500000);assert.equal(report.totalPence,t.totalPence);
  assert.equal(report.lines.reduce((sum,l)=>sum+l.amountPence,0),report.netPence);
});
test("quote contracts reject duplicate IDs, precision, unsafe URLs and invalid colour/email",()=>{
  const b=proposalDefaults(),row={id:"a",description:"A",quantity:1,unit:"item",unitPrice:1,included:true};
  for(const patch of [{accent:"red"},{email:"not an email"},{website:"javascript:alert(1)"},{items:[row,row]},{items:[{...row,quantity:1.0001}]},{items:[{...row,unitPrice:1.001}]}])
    assert.equal(proposalDetailsSchema.safeParse({...b,...patch}).success,false);
});
test("legacy omission preserves quote details, explicit null clears, historical restore removes them",()=>{
  const p=fixture(),old=structuredClone(p.design);delete old.pricing.proposal;
  assert.equal(mergeDesignUpdate(p.design,old).pricing.proposal?.companyName,p.design.pricing.proposal?.companyName);
  old.pricing.proposal=null;assert.equal(mergeDesignUpdate(p.design,old).pricing.proposal,null);
  const restored=storage.restore("quote-qa",p.id,1,p.revision);
  assert.equal(restored.design.pricing.proposal,undefined);
  const imported=storage.importProject("quote-qa","Imported itemised QA",p.design);
  assert.deepEqual(imported.design.pricing.proposal,p.design.pricing.proposal);
});
test("quote-only branding/scope/items do not change engineering-input hash",()=>{
  const p=fixture(),hash=engineeringHash(p.design),d=structuredClone(p.design);
  d.pricing.proposal!.companyName="Another declared installer";
  d.pricing.proposal!.items[0].unitPrice=99;d.pricing.proposal!.includedScope="Commercial scope text, not an engineering design.";
  assert.equal(engineeringHash(d),hash);
});
test("branded issues freeze v4 quote money, presentation and optional scope",()=>{
  const p=fixture(),issue=storage.issue("quote-qa",p.id,p.revision),frozen=JSON.stringify(issue.quoteReport);
  assert.equal(issue.templateVersion,"preliminary-v4");
  assert.equal(issue.quoteReport!.optionalLines.length,1);assert.equal(issue.totalPence,totals(p.design).totalPence);
  assert.equal(storage.issue("quote-qa",p.id,p.revision).id,issue.id);
  const d=structuredClone(p.design);d.pricing.proposal!.companyName="Changed later";d.pricing.proposal!.items[0].unitPrice=900;
  storage.save("quote-qa",p.id,p.revision,d);
  assert.equal(JSON.stringify(storage.getIssue("quote-qa",issue.id)!.quoteReport),frozen);
  assert.equal(storage.getIssue("other",issue.id),undefined);
});
test("blank installer blocks v4 issue, while untouched v3 hash envelope stays unchanged",()=>{
  const p=fixture(),d=structuredClone(p.design);d.pricing.proposal!.companyName=" ";
  const next=storage.save("quote-qa",p.id,p.revision,d);assert.throws(()=>storage.issue("quote-qa",p.id,next.revision),/installer\/company/);
  d.pricing.proposal=null;const legacy=storage.save("quote-qa",p.id,next.revision,d),issue=storage.issue("quote-qa",p.id,legacy.revision);
  assert.equal(issue.templateVersion,"preliminary-v3");assert.equal(issue.quoteReport,null);
  const hash=createHash("sha256").update(JSON.stringify({design:issue.snapshot,revision:issue.revision,template:issue.templateVersion,electricalReport:issue.electricalReport,energyReport:issue.energyReport})).digest("hex");
  assert.equal(issue.hash,hash);
});
test("branded PDF parses as four A4 sheets with frozen author/date and no blank footer pages",async()=>{
  const p=fixture(),issue=storage.issue("quote-qa",p.id,p.revision),bytes=await pdfBytes(issue),pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),4);assert.equal(pdf.getAuthor(),issue.quoteReport!.presentation!.companyName);
  assert.equal(pdf.getCreationDate()!.toISOString(),new Date(issue.createdAt).toISOString().replace(/\.\d{3}Z$/,".000Z"));
  for(const page of pdf.getPages()){assert.ok(Math.abs(page.getWidth()-595.28)<.1);assert.ok(Math.abs(page.getHeight()-841.89)<.1);}
});
test("maximum item descriptions and long scope paginate into parseable labelled sheets",async()=>{
  const p=fixture(),d=structuredClone(p.design),presentation=d.pricing.proposal!;
  presentation.companyName="A".repeat(120);presentation.companyAddress="Long synthetic address ".repeat(30);
  presentation.includedScope="Long synthetic inclusion scope. ".repeat(120);
  presentation.excludedScope="Long synthetic exclusion scope. ".repeat(120);
  presentation.items=Array.from({length:40},(_,i)=>({id:`item-${i}`,description:`Synthetic item ${i} ${"x".repeat(210)}`,quantity:1.005,unit:"m" as const,unitPrice:99.99,included:i%2===0}));
  const saved=storage.save("quote-qa",p.id,p.revision,designSchema.parse(d)),issue=storage.issue("quote-qa",p.id,saved.revision);
  const pdf=await PDFDocument.load(await pdfBytes(issue));assert.ok(pdf.getPageCount()>4);assert.ok(pdf.getPageCount()<25);
});
