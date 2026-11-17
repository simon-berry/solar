import PDFDocument from "pdfkit";
import type {Response} from "express";
import type {Design} from "@shared/schema";
import type {TechnicalIssue} from "./reviews";
import {hardware,assessElectrical,STRING_COLOURS} from "@shared/electrical";
import {dims} from "@shared/solar";
import {roofOutline} from "@shared/map-geometry";

export function technicalPdf(issue:TechnicalIssue,res:Response){
  if(!["technical-review-v1","technical-review-v2"].includes(issue.template))throw new Error("Unsupported technical document template.");
  res.type("application/pdf").attachment(`solar-technical-review-rev-${issue.revision}.pdf`);
  const pdf=new PDFDocument({size:"A3",layout:"landscape",margin:40,info:{Title:`${issue.projectName} - preliminary technical review pack`,Author:issue.author,CreationDate:new Date(issue.createdAt)}});
  pdf.pipe(res);
  const {snapshot:d,report:r}=issue,h=hardware(d),pw=pdf.page.width,ph=pdf.page.height;
  let sheet=0;
  const footer=(title:string)=>{
    // PDFKit otherwise auto-paginates footer text below its normal body margin,
    // splitting graphics save/restore across pages and producing blank sheets.
    const bottom=pdf.page.margins.bottom,oldX=pdf.x,oldY=pdf.y;
    pdf.page.margins.bottom=0;
    pdf.save();pdf.strokeColor("#a1b1a4").lineWidth(.7).rect(30,ph-85,pw-60,55).stroke();
    pdf.font("Helvetica-Bold").fontSize(10).fillColor("#263e2d").text(`${issue.projectName} | ${title}`,42,ph-75,{width:pw-100,height:12,ellipsis:true,lineBreak:false});
    pdf.font("Helvetica").fontSize(8).text(`SW-${issue.projectId.slice(0,8)}-${String(sheet).padStart(2,"0")} | Rev ${issue.revision} | FOR REVIEW | ${issue.createdAt.slice(0,10)} | Author: ${issue.author}`,42,ph-58,{width:pw-100});
    pdf.text(`Issue ${issue.id} | SHA-256 ${issue.hash}`,42,ph-45,{width:pw-100,height:11,lineBreak:false});pdf.restore();
    pdf.page.margins.bottom=bottom;pdf.x=oldX;pdf.y=oldY;
  };
  const page=(title:string,first=false)=>{
    if(!first)pdf.addPage();sheet++;
    pdf.font("Helvetica-Bold").fontSize(19).fillColor("#263e2d").text(title,40,35,{width:pw-80,height:24,ellipsis:true,lineBreak:false});
    pdf.font("Helvetica-Bold").fontSize(10).fillColor("#93492f").text("PRELIMINARY · FOR PROFESSIONAL REVIEW · NOT FOR INSTALLATION OR ENERGISATION",40,65,{width:pw-80});
    footer(title);pdf.y=95;
  };
  const text=(s:string,size=10)=>{
    for(const paragraph of s.split("\n")){
      pdf.font("Helvetica").fontSize(size);
      const height=pdf.heightOfString(paragraph||" ",{width:pw-80,lineGap:3});
      if(pdf.y+height>ph-125)page("Technical notes continued");
      pdf.font("Helvetica").fontSize(size).fillColor("#354c3a").text(paragraph||" ",40,pdf.y,{width:pw-80,lineGap:3});
    }
    pdf.moveDown(.5);
  };
  page("Technical review register",true);
  text(`${d.address}, ${d.postcode} | ${d.nation} | ${d.phase}\nEngineering input SHA-256: ${r.engineeringHash}\nRecorded external evidence: ${r.evidence.length} file(s) | Installation release: UNAVAILABLE`);
  text(`Electrical: ${r.reviewStatus.electrical} | Structural: ${r.reviewStatus.structural} | Mounting: ${r.reviewStatus.mounting}`);
  text(`Survey: ${d.survey?.basis||"unknown"} | assessor: ${d.survey?.assessor||"not recorded"} | survey date: ${d.survey?.date||"unknown"}\nRoof covering: ${d.survey?.covering||"unknown"} | condition: ${d.survey?.condition||"unknown"}\nStructure: ${d.survey?.structure||"not recorded"}\nSupport spacing: ${d.survey?.supportSpacingMm===null||d.survey?.supportSpacingMm===undefined?"unknown":d.survey.supportSpacingMm+" mm"}\nEquipment locations: ${d.survey?.equipmentLocations||"not recorded"}\nAccess: ${d.survey?.access||"not recorded"}`);
  text(`Grid route status: ${d.survey?.gridStatus||"not assessed"} | reference: ${d.survey?.gridReference||"not recorded"}\nPermission responsibilities: ${d.survey?.permissions||"not recorded"}`);
  for(const limitation of r.limitations){if(pdf.y>ph-145)page("Scope and limitations");text(limitation,9);}
  const assignment=new Map<string,{name:string;colour:string}>();
  (d.electrical?.strings||[]).forEach((s,i)=>s.moduleIds.forEach(id=>assignment.set(id,{name:s.name,colour:STRING_COLOURS[i%STRING_COLOURS.length]})));
  for(const roof of d.roofs){
    page(`${roof.name} · roof-plane module and mounting layout`);
    const fit=Math.min((pw-120)/roof.width,(ph-270)/roof.height);
    const denominator=[20,25,50,75,100,125,150,200,250,500,1000,2000].find(n=>72000/(25.4*n)<=fit)||2000,scale=72000/(25.4*denominator);
    const ox=60,oy=125,xy=(x:number,y:number)=>({x:ox+x*scale,y:oy+y*scale});
    pdf.fontSize(10).fillColor("#354c3a").text(`${roof.width} × ${roof.height} m | pitch ${roof.pitch}° | azimuth ${roof.azimuth}° | Scale 1:${denominator} at A3 landscape | roof-plane metres`,40,95,{width:pw-80});
    if(roof.boundary&&issue.template==="technical-review-v2"){
      const outline=roofOutline(roof);pdf.moveTo(ox+outline[0].x*scale,oy+outline[0].y*scale);
      outline.slice(1).forEach(p=>pdf.lineTo(ox+p.x*scale,oy+p.y*scale));pdf.closePath().lineWidth(.8).strokeColor("#526b59").stroke();
    }else{
      pdf.rect(ox,oy,roof.width*scale,roof.height*scale).lineWidth(.8).strokeColor("#526b59").stroke();
      pdf.save().dash(3,{space:3}).strokeColor("#92a794").rect(ox+roof.setback*scale,oy+roof.setback*scale,Math.max(0,roof.width-2*roof.setback)*scale,Math.max(0,roof.height-2*roof.setback)*scale).stroke().restore();
    }
    for(const o of roof.obstacles){const p=xy(o.x,o.y);pdf.rect(p.x,p.y,o.width*scale,o.height*scale).fillAndStroke("#ecdfc5","#997b43");}
    roof.panels.forEach((p,i)=>{
      const a=xy(p.x,p.y),wh=dims(p,h.module),s=assignment.get(p.id);
      pdf.rect(a.x,a.y,wh.width*scale,wh.height*scale).lineWidth(.6).fillAndStroke("#edf1ed",s?.colour||"#59735f");
      pdf.font("Helvetica").fontSize(Math.max(5,Math.min(9,wh.width*scale/4))).fillColor("#233d2b").text(`${i+1}`,a.x+1,a.y+wh.height*scale/2-3,{width:Math.max(8,wh.width*scale-2),align:"center",lineBreak:false});
    });
    for(const rail of d.mounting?.rails.filter(x=>x.roofId===roof.id)||[]){const a=xy(rail.x,rail.y),b=xy(rail.x2,rail.y2);pdf.moveTo(a.x,a.y).lineTo(b.x,b.y).lineWidth(1.4).strokeColor("#176944").stroke();}
    for(const f of d.mounting?.fixings.filter(x=>x.roofId===roof.id)||[]){const a=xy(f.x,f.y);pdf.circle(a.x,a.y,2.3).fill("#a16d1f");}
    for(const b of d.mounting?.ballast.filter(x=>x.roofId===roof.id)||[]){const a=xy(b.x,b.y);pdf.rect(a.x-3,a.y-3,6,6).fill("#795887");pdf.fontSize(6).fillColor("#533961").text(`${b.massKg}kg`,a.x+4,a.y-2,{width:45,lineBreak:false});}
    const by=ph-125,bar=Math.min(5,roof.width/2);
    pdf.moveTo(ox,by).lineTo(ox+bar*scale,by).lineWidth(1).strokeColor("#253f2c").stroke();
    pdf.font("Helvetica").fontSize(8).fillColor("#354c3a").text(`${bar.toFixed(1)} m scale bar | Outline: roof; filled rectangles: modules; green: imported rails; gold: fixings; purple: ballast`,ox,by+7,{width:pw-110});
    pdf.text(issue.template==="technical-review-v2"?`Approximate map trace: ${roof.geo?.basis||"unreferenced polygon"}. Clearance ${roof.setback} m enforced by placement checks, not an inset outline. Source geometry requires survey; no fixing/ballast adequacy is calculated.`:"Not a georeferenced site plan. Source dimensions and all imported mounting geometry require external verification. No fixing/ballast adequacy is calculated.",ox,by+20,{width:pw-110});
    if(issue.template==="technical-review-v2"&&roof.geo)pdf.text(`Local (0,0): ${roof.geo.origin.lat.toFixed(7)}, ${roof.geo.origin.lng.toFixed(7)} | +X bearing ${roof.geo.bearing.toFixed(2)} degrees | captured ${roof.geo.capturedAt} | roof-plane, not a surveyed site plan`,ox,by+34,{width:pw-110});
  }
  page("Equipment, stringing and load information");
  text(`MODULE: ${h.module.name} | ${h.module.watts} W STC | ${h.module.mass} kg/module\nINVERTER: ${d.inverterCount} × ${h.inverter.name} | ${h.inverter.phase}\nHardware provenance: ${d.catalogueSnapshot?.provenance||"unverified-reference"}`);
  text(`Recorded masses: modules ${r.masses.moduleKg.toFixed(2)} kg; ballast ${r.masses.ballastKg.toFixed(2)} kg; additional racking/fixings ${r.masses.additionalKg===null?"UNKNOWN":r.masses.additionalKg.toFixed(2)+" kg"}.\nKnown mass subtotal ${r.masses.knownTotalKg.toFixed(2)} kg is NOT a complete load case or structural assessment.`);
  text(`Mounting family: ${d.mounting?.family||"not recorded"} | external schedule: ${d.mounting?.scheduleReference||"not recorded"}\nSource: ${d.mounting?.source||"not recorded"}`);
  const electrical=r.electricalReport;
  text(`Limited native string assessment: ${electrical.status}. The following is a schedule, not a protective-device SLD or installation wiring diagram.`);
  for(const s of electrical.stringResults){
    if(pdf.y>ph-150)page("String schedule continued");
    text(`${s.name}: ${s.moduleCount} modules -> INV ${s.inverterIndex+1}/MPPT ${s.mpptIndex+1}; cold Voc ${s.coldVoc?.toFixed(1)??"unknown"} V; hot Vmp ${s.hotVmp?.toFixed(1)??"unknown"} V; status ${s.status}`,9);
  }
  text("A full specialist SLD, protection/isolation, conductor sizing/routes, metering, earthing, grid/export controls and any battery installation design must be supplied externally. Native concept drawings do not supply those details.",10);
  page("Stable module identifiers");
  for(const roof of d.roofs)for(let i=0;i<roof.panels.length;i++){
    if(pdf.y>ph-135)page("Stable module identifiers continued");
    const p=roof.panels[i];text(`${roof.name} / plotted ${i+1} = ${p.id} | x ${p.x} m, y ${p.y} m | ${p.landscape?"landscape":"portrait"} | string ${assignment.get(p.id)?.name||"unassigned"}`,8);
  }
  page("Evidence and review register");
  if(!r.evidence.length)text("NO EVIDENCE ATTACHED. This package cannot be represented as an externally reviewed engineering design.");
  for(const e of r.evidence){
    if(pdf.y>ph-175)page("Evidence register continued");
    text(`${e.kind} | ${e.filename} | author ${e.author} | document date ${e.date}\nSource: ${e.source}\nFile SHA-256: ${e.hash}\nEngineering binding: ${e.engineeringHash===r.engineeringHash?"matches these engineering inputs":"STALE / different inputs"}. ${r.currentSubmission?.evidenceIds.includes(e.id)?"Captured in the current submission.":"NOT captured in the current submission."} File is referenced, not reproduced in this PDF.`,9);
  }
  for(const decision of r.decisions){
    if(pdf.y>ph-200)page("External review register continued");
    text(`${decision.scope}: ${decision.outcome} | ${decision.reviewer} | ${decision.createdAt}\nDeclared capability: ${decision.qualifications}\nScope/limitations: ${decision.limitations}\nEvidence cited: ${decision.evidenceIds.map(id=>r.evidence.find(e=>e.id===id)?.filename||id).join("; ")}\nSubmission ${decision.submissionId}. Current scope status is recorded on the cover; historical reviews may be stale.`,9);
  }
  page("Findings and outstanding checks");
  for(const f of r.findings){if(pdf.y>ph-135)page("Findings continued");text(`${f.level.toUpperCase()}: ${f.message}`,9);}
  pdf.end();
}

// 2D R2000 DXF, roof-plane millimetres, named layers, stable IDs in XDATA.
export function roofDxf(d:Design){
  const lines:string[]=[],add=(...v:(string|number)[])=>v.forEach(x=>lines.push(String(x)));
  const escaped=(s:string)=>s.split("").map(c=>{const n=c.charCodeAt(0);return n<32||n>126||c==="\\"?`\\U+${n.toString(16).toUpperCase().padStart(4,"0")}`:c;}).join("");
  const layers=["NOTES",...d.roofs.flatMap((_,i)=>["ROOF","MODULES","IDS","OBSTRUCTIONS","RAILS","FIXINGS","BALLAST"].map(s=>`R${i+1}_${s}`))];
  add(0,"SECTION",2,"HEADER",9,"$ACADVER",1,"AC1015",9,"$INSUNITS",70,4,9,"$MEASUREMENT",70,1,0,"ENDSEC",0,"SECTION",2,"TABLES",0,"TABLE",2,"LAYER",70,layers.length);
  layers.forEach((l,i)=>add(0,"LAYER",100,"AcDbSymbolTableRecord",100,"AcDbLayerTableRecord",2,l,70,0,62,i%7+1,6,"CONTINUOUS"));
  add(0,"ENDTAB",0,"TABLE",2,"APPID",70,1,0,"APPID",100,"AcDbSymbolTableRecord",100,"AcDbRegAppTableRecord",2,"SOLAR_WORKSPACE",70,0,0,"ENDTAB",0,"ENDSEC",0,"SECTION",2,"ENTITIES");
  const extra=(id:string)=>add(1001,"SOLAR_WORKSPACE",1000,escaped(id));
  const polygon=(layer:string,x:number,y:number,w:number,h:number,id:string)=>{add(0,"LWPOLYLINE",100,"AcDbEntity",8,layer,100,"AcDbPolyline",90,4,70,1);[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].forEach(([a,b])=>add(10,a*1000,20,-b*1000));extra(id);};
  const text=(layer:string,x:number,y:number,s:string,size=100)=>add(0,"TEXT",100,"AcDbEntity",8,layer,100,"AcDbText",10,x*1000,20,-y*1000,30,0,40,size,1,escaped(s),100,"AcDbText");
  let offset=0;const h=hardware(d);
  text("NOTES",0,-2,"PRELIMINARY - ROOF-PLANE MILLIMETRES - NOT FOR INSTALLATION",180);
  d.roofs.forEach((r,i)=>{
    const layer=(s:string)=>`R${i+1}_${s}`;
    if(r.boundary){const ring=roofOutline(r);add(0,"LWPOLYLINE",100,"AcDbEntity",8,layer("ROOF"),100,"AcDbPolyline",90,ring.length,70,1);ring.forEach(p=>add(10,(offset+p.x)*1000,20,-p.y*1000));extra(r.id);}
    else polygon(layer("ROOF"),offset,0,r.width,r.height,r.id);
    text(layer("IDS"),offset,-.6,r.name,150);
    r.panels.forEach((p,j)=>{const size=dims(p,h.module);polygon(layer("MODULES"),offset+p.x,p.y,size.width,size.height,p.id);text(layer("IDS"),offset+p.x+.05,p.y+size.height/2,`M${j+1}`,80);});
    r.obstacles.forEach(o=>polygon(layer("OBSTRUCTIONS"),offset+o.x,o.y,o.width,o.height,o.id));
    d.mounting?.rails.filter(x=>x.roofId===r.id).forEach(a=>{add(0,"LINE",100,"AcDbEntity",8,layer("RAILS"),100,"AcDbLine",10,(offset+a.x)*1000,20,-a.y*1000,30,0,11,(offset+a.x2)*1000,21,-a.y2*1000,31,0);extra(a.id);});
    for(const a of [...(d.mounting?.fixings.filter(x=>x.roofId===r.id)||[]),...(d.mounting?.ballast.filter(x=>x.roofId===r.id)||[])]){
      add(0,"CIRCLE",100,"AcDbEntity",8,layer("massKg" in a?"BALLAST":"FIXINGS"),100,"AcDbCircle",10,(offset+a.x)*1000,20,-a.y*1000,30,0,40,40);extra(a.id);
    }
    offset+=r.width+5;
  });
  add(0,"ENDSEC",0,"EOF");return lines.join("\n")+"\n";
}
