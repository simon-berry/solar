import PDFDocument from "pdfkit";
import type { Response } from "express";
import type { Design, Issue } from "@shared/schema";
import { totals, dims } from "@shared/solar";
import {electricalPdfAppendix} from "./electrical-documents";
import {energyPdfAppendix} from "./energy-documents";
import {brandedProposalPdf} from "./branded-proposal";
import {roofOutline} from "@shared/map-geometry";

export const xml=(s:unknown)=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
const money=(p:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(p/100);
export function roofSvg(name:string,d:Design,revision:number){
  const t=totals(d), blockHeight=510, height=150+d.roofs.length*blockHeight;
  const blocks=d.roofs.map((r,index)=>{
    const scale=Math.min(850/r.width,340/r.height),ox=100,oy=170+index*blockHeight;
    return `<g><text x="60" y="${oy-35}" font-size="18" font-weight="bold">${xml(r.name)} · ${r.width} × ${r.height} m on roof plane · pitch ${r.pitch}° · azimuth ${r.azimuth}°</text>
      <g transform="translate(${ox},${oy})">${r.boundary?`<polygon points="${roofOutline(r).map(p=>`${p.x*scale},${p.y*scale}`).join(" ")}" fill="#e4e9e8" stroke="#6e8482"/>`:`<rect width="${r.width*scale}" height="${r.height*scale}" fill="#e4e9e8" stroke="#6e8482"/><rect x="${r.setback*scale}" y="${r.setback*scale}" width="${Math.max(0,r.width-2*r.setback)*scale}" height="${Math.max(0,r.height-2*r.setback)*scale}" fill="none" stroke="#8b9c94" stroke-dasharray="5 4"/>`}
      ${r.obstacles.map(o=>`<rect x="${o.x*scale}" y="${o.y*scale}" width="${o.width*scale}" height="${o.height*scale}" fill="#e9d9ba" stroke="#9e7f4a"/>`).join("")}
      ${r.panels.map((p,i)=>{const wh=dims(p,t.module);return `<rect x="${p.x*scale}" y="${p.y*scale}" width="${wh.width*scale}" height="${wh.height*scale}" fill="#2a4153" stroke="#bccbd3"/><text x="${(p.x+wh.width/2)*scale}" y="${(p.y+wh.height/2)*scale}" fill="#fff" font-size="12" text-anchor="middle">${i+1}</text>`;}).join("")}
      <text x="0" y="${r.height*scale+30}" font-size="14" fill="#506d58">Roof-plane view. Source dimensions unverified. Clearance ${r.setback} m.</text>
      </g></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}" font-family="Arial,sans-serif"><rect width="1100" height="${height}" fill="white"/>
    <text x="60" y="45" font-size="24" font-weight="bold">${xml(name)} · Roof layout · Rev ${revision}</text>
    <text x="60" y="75" fill="#9a5431" font-size="16">PRELIMINARY · NOT FOR INSTALLATION · not a structural assessment or surveyed site plan</text>
    <text x="60" y="102" font-size="14">${t.count} reference modules · ${t.kwp.toFixed(2)} kWp · dimensions in metres · scale with stated dimensions</text>${blocks}</svg>`;
}
export function schematicSvg(name:string,d:Design,revision:number){
  const t=totals(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440" font-family="Arial,sans-serif">
  <rect width="1100" height="440" fill="white"/><text x="50" y="50" font-size="24" font-weight="bold">${xml(name)} · Equipment concept · Rev ${revision}</text>
  <text x="50" y="85" font-size="16" fill="#9a5431">PRELIMINARY · NOT A WIRING DIAGRAM · NOT FOR INSTALLATION</text>
  <g fill="none" stroke="#546c60" stroke-width="2"><rect x="50" y="160" width="240" height="95"/><path d="M290 207 H400" stroke-dasharray="6 5"/><rect x="400" y="160" width="280" height="95"/><path d="M680 207 H790" stroke-dasharray="6 5"/><rect x="790" y="160" width="250" height="95"/></g>
  <g fill="#273e32" font-size="17" text-anchor="middle"><text x="170" y="196">${t.count} PV modules</text><text x="170" y="225">${t.kwp.toFixed(2)} kWp DC</text><text x="540" y="196">${d.inverterCount} reference inverter(s)</text><text x="540" y="225">${t.acKw} kW AC</text><text x="915" y="196">Proposed grid connection</text><text x="915" y="225">${xml(d.phase)}</text></g>
  <text x="50" y="320" font-size="15" fill="#68786d">No strings, MPPT assignment, cabling, isolation, protection, earthing or export control are specified.</text>
  <text x="50" y="350" font-size="15" fill="#68786d">Dashed lines show conceptual energy flow only. Network route and engineering review required.</text></svg>`;
}
export function proposalPdf(issue:Issue,res:Response){
  if(issue.templateVersion==="preliminary-v4")return brandedProposalPdf(issue,res);
  const d=issue.snapshot,t=totals(d);
  const v3=issue.templateVersion==="preliminary-v3";
  res.type("application/pdf").attachment(`solar-preliminary-proposal-rev-${issue.revision}.pdf`);
  const pdf=new PDFDocument({size:"A4",margin:48,info:{Title:`${issue.projectName} - preliminary proposal`,Author:"Solar Workspace"}});
  pdf.pipe(res);
  const label=(s:string)=>pdf.font("Helvetica-Bold").fontSize(10).fillColor("#56745e").text(s,48,pdf.y,{width:499});
  const body=(s:string)=>pdf.font("Helvetica").fontSize(10).fillColor("#405146").text(s,48,pdf.y,{width:499,lineGap:4});
  pdf.font("Helvetica-Bold").fontSize(24).fillColor("#223e2c").text("solar.");
  pdf.moveDown(.4);label("PRELIMINARY PROPOSAL - NOT FOR INSTALLATION");
  pdf.moveDown();pdf.fontSize(20).fillColor("#203a2c").text(issue.projectName);
  pdf.moveDown(.4);body(`${d.customer}\n${d.address}, ${d.postcode}\n${d.nation} | ${d.type}\nSaved design revision ${issue.revision} | ${new Date(issue.createdAt).toLocaleDateString("en-GB")}`);
  pdf.moveDown(1.4);label("PROPOSED SYSTEM");pdf.moveDown(.4);
  body(`${t.count} x ${t.module.watts} W ${v3?t.module.name:"reference modules"} (${t.kwp.toFixed(2)} kWp DC)\n${d.inverterCount} x ${t.inverter.name} (${t.acKw} kW AC total)\n${d.roofs.length} roof face(s) | ${d.phase}`);
  pdf.moveDown(1.2);label("PRICE ESTIMATE");pdf.moveDown(.5);
  for(const l of t.lines){
    if(!l.unitPence)continue;
    const y=pdf.y;
    pdf.font("Helvetica").fontSize(10).fillColor("#405146").text(`${l.quantity} x ${l.name}`,48,y,{width:340});
    pdf.text(money(l.quantity*l.unitPence),410,y,{width:90,align:"right"});pdf.y=Math.max(pdf.y,y+24);
  }
  pdf.moveDown(.5);
  body(`Subtotal: ${money(t.netPence)}\nVAT (${d.pricing.vat}%): ${money(t.vatPence)}`);
  pdf.font("Helvetica-Bold").fontSize(18).fillColor("#1b663f").text(`Total estimate: ${money(issue.totalPence)}`);
  pdf.moveDown(.8);body(`Tax assumptions: ${d.pricing.taxBasis}`);
  pdf.addPage();
  label("ILLUSTRATIVE PERFORMANCE ONLY");pdf.moveDown(.6);
  body(`Annual generation: ${t.generation.toLocaleString("en-GB")} kWh\nSpecific-yield input: ${d.energy.yieldPerKwp} kWh/kWp\nShade-factor input: ${d.energy.shadeFactor}\nAssumed PV self-consumption: ${d.energy.selfConsumption}% (capped at recorded annual demand)\nRecorded annual demand: ${d.energy.consumption} kWh\nImport/export values: GBP ${d.energy.importRate} / ${d.energy.exportRate} per kWh\nIllustrative annual energy value: ${money(Math.round(t.saving*100))}`);
  pdf.moveDown();
  body(v3?"These annual figures use manual assumptions only, separate from any imported interval analysis in the appendix. They are not an MCS estimate or a performance guarantee. Orientation and pitch do not automatically modify manual yield. Interval battery results are not applied to these annual figures.":"These figures use manual assumptions. They are not an MCS estimate, a weather-data simulation, a time-series consumption model or a performance guarantee. Orientation and pitch do not automatically modify the manual yield. No battery benefits are modelled.");
  pdf.moveDown(1.3);label("SCOPE AND LIMITATIONS");pdf.moveDown(.6);
  body(v3?"This is a development-stage preliminary estimate, not a binding contract. Equipment provenance is recorded in the appendix; reference entries remain unverified. All prices are editable allowances, not supplier quotations. Mounting allowances are not an engineered mounting design. Battery equipment and installation are not automatically priced.":"This is a development-stage preliminary estimate, not a binding contract. All equipment specifications and prices are unverified reference data. Mounting prices are allowances only, not an engineered mounting design.");
  pdf.moveDown();
  body("A confirmed site survey, verified products, electrical design, structural assessment, planning/building requirements and network connection review are required before installation. This document provides no engineering certification, DNO approval or permission to energise.");
  pdf.moveDown();
  body("No payment schedule, warranties or consumer contract terms are established by this preliminary document. Obtain a reviewed formal offer before committing to an installation.");
  pdf.moveDown(1.3);label("DOCUMENT CONTROL");pdf.moveDown(.6);
  body(`Issue: ${issue.id}\nRevision: ${issue.revision}\nCreated: ${issue.createdAt}\nTemplate: ${issue.templateVersion||"preliminary-v1"}\nSHA-256: ${issue.hash}`);
  pdf.fontSize(8).fillColor("#738579").text("This issue is immutable. Later design changes require a new saved revision and proposal.",48,740,{width:490});
  if(["preliminary-v2","preliminary-v3"].includes(issue.templateVersion)&&issue.electricalReport)electricalPdfAppendix(pdf,issue.electricalReport);
  if(v3)energyPdfAppendix(pdf,issue);
  pdf.end();
}
