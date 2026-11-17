import PDFDocument from "pdfkit";
import type {Response} from "express";
import type {Issue} from "@shared/schema";
import {totals} from "@shared/solar";
import {electricalPdfAppendix} from "./electrical-documents";
import {energyPdfAppendix} from "./energy-documents";
import {proposalInk,type QuoteLine} from "@shared/quote-schema";

const money=(p:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
export function brandedProposalPdf(issue:Issue,res:Response){
  const q=issue.quoteReport,p=q?.presentation;
  if(!q||!p)throw new Error("Branded proposal has no frozen quote presentation.");
  const d=issue.snapshot,t=totals(d),accent=proposalInk(p.accent);
  res.type("application/pdf").attachment(`solar-branded-proposal-rev-${issue.revision}.pdf`);
  const pdf=new PDFDocument({size:"A4",margin:48,bufferPages:true,info:{Title:`${issue.projectName} - preliminary proposal`,Author:p.companyName,CreationDate:new Date(issue.createdAt)}});
  pdf.pipe(res);
  const page=(title:string,first=false)=>{
    if(!first)pdf.addPage();
    pdf.moveTo(48,28).lineTo(547,28).strokeColor(p.accent).lineWidth(3).stroke();
    pdf.font("Helvetica-Bold").fontSize(11).fillColor(accent).text(p.companyName,48,38,{width:499,height:28,ellipsis:true});
    pdf.font("Helvetica-Bold").fontSize(20).fillColor("#203a2c").text(title,48,78,{width:499});
    pdf.y+=12;
  };
  const body=(value:string,size=10)=>{
    for(const part of value.split(/\r?\n/).filter(x=>x.trim())){
      pdf.font("Helvetica").fontSize(size);
      const height=pdf.heightOfString(part,{width:499,lineGap:3});
      if(pdf.y+height>775)page("Proposal notes continued");
      pdf.fillColor("#405146").text(part,48,pdf.y,{width:499,lineGap:3});
    }
    pdf.moveDown(.6);
  };
  const heading=(s:string)=>{
    if(pdf.y>710)page("Proposal continued");
    pdf.font("Helvetica-Bold").fontSize(11).fillColor(accent).text(s,48,pdf.y,{width:499});pdf.moveDown(.5);
  };
  const lines=(items:QuoteLine[],optional=false)=>{
    for(const line of items){
      if(line.unitPence===0&&!line.id.startsWith("extra-"))continue;
      pdf.font("Helvetica").fontSize(10);
      const description=`${line.name}\n${line.quantity} ${line.unit} x ${money(line.unitPence)}${optional?" | OPTIONAL, EXCLUDED":""}`;
      const height=Math.max(36,pdf.heightOfString(description,{width:355,lineGap:3})+12);
      if(pdf.y+height>765){page(optional?"Optional items continued":"Itemised estimate continued");}
      const y=pdf.y;
      pdf.fillColor("#405146").text(description,48,y,{width:355,lineGap:3});
      pdf.font("Helvetica-Bold").text(money(line.amountPence),416,y,{width:131,align:"right",lineBreak:false});
      pdf.moveTo(48,y+height-6).lineTo(547,y+height-6).lineWidth(.4).strokeColor("#dce3dd").stroke();
      pdf.x=48;pdf.y=y+height;
    }
  };
  const reviewDate=new Date(new Date(issue.createdAt).getTime()+p.validDays*86400000).toISOString().slice(0,10);
  page("Your solar proposal",true);
  body("PRELIMINARY ESTIMATE | NOT A CONTRACT | NOT FOR INSTALLATION",9);
  body(`${issue.projectName}\nPrepared for ${d.customer}\n${d.address}, ${d.postcode}\n${d.nation} | ${d.type}`,12);
  body(`Reference: ${p.reference||issue.id}\nDesign revision: ${issue.revision} | issued ${issue.createdAt.slice(0,10)}\nEstimate review date: ${reviewDate} (${p.validDays} days, not a contractual offer period)\nPrepared by: ${p.preparedBy||"not recorded"}`,9);
  heading("Installer details");
  body([p.companyAddress,p.email,p.phone,p.website,p.companyNumber?`Company registration (declared): ${p.companyNumber}`:"",p.vatNumber?`VAT registration (declared): ${p.vatNumber}`:""].filter(Boolean).join("\n")||"Installer contact details have not been supplied.",9);
  heading("Proposed system");
  body(`${t.count} x ${t.module.watts} W ${t.module.name} | ${t.kwp.toFixed(2)} kWp DC\n${d.inverterCount} x ${t.inverter.name} | ${t.acKw} kW AC | ${d.phase}\nEquipment, site measurements and final installation scope require professional confirmation.`);
  heading("Estimate summary");
  body(`Included items before VAT: ${money(q.netPence)}\nVAT (${q.vatRate}%): ${money(q.vatPence)}`,11);
  pdf.font("Helvetica-Bold").fontSize(22).fillColor(accent).text(`Total estimate ${money(q.totalPence)}`,48,pdf.y,{width:499});
  pdf.moveDown(.6);body("Optional items are excluded from this total. No payment or customer acceptance is collected by this document.",9);
  page("Itemised estimate");
  body("All amounts in GBP. Each included line is rounded to whole pennies, then the selected VAT rate is applied to the combined subtotal.",9);
  lines(q.lines);
  heading("Price reconciliation");
  body(`Subtotal ${money(q.netPence)} | VAT ${money(q.vatPence)} | TOTAL ${money(q.totalPence)}\nTax basis / eligibility assumptions: ${q.taxBasis}`);
  if(q.optionalLines.length){heading("Optional items: not included");body(`These are separate pre-VAT alternatives/allowances, not added to the estimate. The selected ${q.vatRate}% VAT would need confirmation before any revised formal offer.`,9);lines(q.optionalLines,true);}
  page("Scope and next steps");
  heading("Expressly included");body(p.includedScope||"No detailed inclusion schedule supplied. Obtain a confirmed scope before committing.");
  heading("Exclusions and unresolved scope");body(p.excludedScope||"No detailed exclusion schedule supplied. Anything not expressly included requires confirmation.");
  heading("Important limitations");
  body("This is a development-stage preliminary estimate, not a binding offer or installation instruction. No customer contract acceptance, payment schedule, warranty or consumer contract terms are established. Obtain a reviewed formal offer before committing.");
  body("Commercial descriptions, including storage allowances, do not define or extend the engineering design or reviewer approval. Battery compatibility, mounting, electrical protection/cables/earthing, structural design and grid permissions require separate specialist assessment.");
  body("Annual figures below use manual assumptions, not an MCS estimate, weather simulation or performance guarantee. Imported interval analysis is separate; short-period battery values are not annualised or automatically included in quoted benefits.");
  heading("Illustrative annual assumptions");
  body(`Generation ${t.generation} kWh | manual yield ${d.energy.yieldPerKwp} kWh/kWp | shade factor ${d.energy.shadeFactor}\nAnnual demand ${d.energy.consumption} kWh | assumed PV self-use ${d.energy.selfConsumption}% (capped at demand)\nImport/export rates GBP ${d.energy.importRate}/${d.energy.exportRate} per kWh\nIllustrative annual value ${money(Math.round(t.saving*100))}. Not a guaranteed saving.`);
  if(issue.electricalReport)electricalPdfAppendix(pdf,issue.electricalReport);
  energyPdfAppendix(pdf,issue,true);
  const range=pdf.bufferedPageRange();
  for(let index=range.start;index<range.start+range.count;index++){
    pdf.switchToPage(index);
    const bottom=pdf.page.margins.bottom;pdf.page.margins.bottom=0;
    const y=pdf.page.height-36;
    pdf.font("Helvetica").fontSize(7).fillColor("#62756a").text(`Rev ${issue.revision} | preliminary-v4 | Page ${index+1} of ${range.count} | ${p.companyName.slice(0,70)}`,48,y,{width:499,height:10,lineBreak:false,ellipsis:true});
    pdf.fontSize(6).text(`Issue ${issue.id} | SHA-256 ${issue.hash}`,48,y+12,{width:499,height:9,lineBreak:false});
    pdf.page.margins.bottom=bottom;
  }
  pdf.end();
}
