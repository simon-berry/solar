import type {Design} from "@shared/schema";
import {assessElectrical,STRING_COLOURS,type ElectricalReport} from "@shared/electrical";
import {dims} from "@shared/solar";
import {roofOutline} from "@shared/map-geometry";

const esc=(s:unknown)=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
export function stringLayoutSvg(name:string,d:Design,revision:number){
  const report=assessElectrical(d),ss=d.electrical?.strings||[];
  const legendHeight=Math.ceil(ss.length/3)*44,header=160+legendHeight,height=header+d.roofs.length*460;
  let offset=0;
  const blocks=d.roofs.map((r,index)=>{
    const scale=Math.min(850/r.width,300/r.height),oy=header+index*460,ox=90;
    const panels=r.panels.map((p,i)=>{
      const owner=ss.findIndex(s=>s.moduleIds.includes(p.id)),size=dims(p,report.module);
      const x=p.x*scale,y=p.y*scale,w=size.width*scale,h=size.height*scale;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${owner<0?"#5d7266":STRING_COLOURS[owner%STRING_COLOURS.length]}" stroke="#fff"/>
      <text x="${x+w/2}" y="${y+h/2-2}" font-size="12" fill="white" text-anchor="middle">M${String(offset+i+1).padStart(2,"0")}</text>
      <text x="${x+w/2}" y="${y+h/2+13}" font-size="12" fill="white" text-anchor="middle">${owner<0?"-":`S${String(owner+1).padStart(2,"0")}`}</text>`;
    }).join("");
    offset+=r.panels.length;
    return `<g><text x="60" y="${oy-20}" font-size="16" font-weight="bold">${esc(r.name)} · ${r.width} × ${r.height} m on roof plane</text>
    <g transform="translate(${ox},${oy})">${r.boundary?`<polygon points="${roofOutline(r).map(p=>`${p.x*scale},${p.y*scale}`).join(" ")}" fill="#e1e8e3" stroke="#829787"/>`:`<rect width="${r.width*scale}" height="${r.height*scale}" fill="#e1e8e3" stroke="#829787"/>`}
    ${r.obstacles.map(o=>`<rect x="${o.x*scale}" y="${o.y*scale}" width="${o.width*scale}" height="${o.height*scale}" fill="#dcccb0" stroke="#9d8459"/>`).join("")}${panels}
    <text x="0" y="${r.height*scale+28}" font-size="13" fill="#536959">Identifiers correspond to the string schedule. Dimensions unverified.</text></g></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}" font-family="Arial,sans-serif"><rect width="1100" height="${height}" fill="white"/>
    <text x="60" y="45" font-size="24" font-weight="bold">${esc(name)} · String layout · Rev ${revision}</text>
    <text x="60" y="76" font-size="16" fill="#93532c">PRELIMINARY · REFERENCE DATA · NOT FOR INSTALLATION</text>
    <text x="60" y="102" font-size="14">${report.assigned} / ${report.placed} modules assigned · ${esc(report.status)} · not a certified electrical design</text>
    ${ss.map((s,i)=>`<rect x="${60+(i%3)*340}" y="${122+Math.floor(i/3)*44}" width="12" height="12" fill="${STRING_COLOURS[i%STRING_COLOURS.length]}"/><text x="${80+(i%3)*340}" y="${133+Math.floor(i/3)*44}" font-size="12">S${String(i+1).padStart(2,"0")} · ${esc(s.name)}</text><text x="${80+(i%3)*340}" y="${149+Math.floor(i/3)*44}" font-size="12">INV ${s.inverterIndex+1} / MPPT ${s.mpptIndex+1}</text>`).join("")}
    ${blocks}</svg>`;
}
export function electricalSchematicSvg(name:string,d:Design,revision:number){
  const report=assessElectrical(d),ss=d.electrical?.strings||[];
  const groups=new Map<string,typeof ss>();
  for(const s of ss){const key=`${s.inverterIndex}:${s.mpptIndex}`;groups.set(key,[...(groups.get(key)||[]),s]);}
  const height=230+Array.from(groups.values()).reduce((sum,g)=>sum+Math.max(150,g.length*110)+35,0);
  let y=175;
  const blocks=Array.from(groups.entries()).map(([key,strings])=>{
    const [inv,mppt]=key.split(":").map(Number),h=Math.max(150,strings.length*110),centre=y+h/2;
    const valid=inv<d.inverterCount&&mppt<report.inverter.mpptCount;
    const lines=strings.map((s,i)=>{
      const index=ss.findIndex(a=>a.id===s.id),colour=STRING_COLOURS[index%STRING_COLOURS.length],yy=y+i*110;
      const result=report.stringResults.find(a=>a.id===s.id);
      return `<rect x="55" y="${yy}" width="475" height="85" rx="3" fill="white" stroke="${colour}" stroke-width="2"/>
      <text x="70" y="${yy+24}" font-size="15" font-weight="bold" fill="${colour}">S${String(index+1).padStart(2,"0")} · ${esc(s.name)} · ${s.moduleIds.length} modules</text>
      <text x="70" y="${yy+48}" font-size="14">Cold Voc: ${result?.coldVoc?.toFixed(1)??"not evaluated"} V · Hot Vmp: ${result?.hotVmp?.toFixed(1)??"not evaluated"} V</text>
      <text x="70" y="${yy+70}" font-size="13" fill="#617564">Imp: ${result?.imp?.toFixed(2)??"not evaluated"} A · factored Isc: ${result?.designIsc?.toFixed(2)??"not evaluated"} A</text>
      <path d="M530 ${yy+42} H625 V${centre} H740" fill="none" stroke="${colour}" stroke-width="2"/>`;
    }).join("");
    const output=`${lines}<rect x="740" y="${centre-48}" width="305" height="96" rx="4" fill="#eef3ee" stroke="${valid?"#566d5d":"#a04432"}" stroke-width="2"/>
      <text x="892" y="${centre-17}" font-size="18" text-anchor="middle">INV ${inv+1} / MPPT ${mppt+1}</text>
      <text x="892" y="${centre+8}" font-size="14" text-anchor="middle">${valid?"Reference input group":"Unresolved destination"}</text>
      <text x="892" y="${centre+30}" font-size="13" text-anchor="middle">Protection / isolation unspecified</text>`;
    y+=h+35;return output;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}" font-family="Arial,sans-serif"><rect width="1100" height="${height}" fill="white"/>
    <text x="55" y="43" font-size="24" font-weight="bold">${esc(name)} · DC string concept · Rev ${revision}</text>
    <text x="55" y="75" font-size="16" fill="#93532c">PRELIMINARY · NOT A COMPLETE WIRING DIAGRAM · NOT FOR INSTALLATION</text>
    <text x="55" y="103" font-size="14">No AC design, cable sizing, protective devices, earthing, connector specification or grid approval.</text>
    <text x="55" y="129" font-size="14">Reference check status: ${esc(report.status)} · cell temperature ${report.assumptions.minCellTemp} to ${report.assumptions.maxCellTemp} °C</text>
    ${blocks||'<text x="55" y="185" font-size="16">No strings configured. Nothing has been electrically evaluated.</text>'}</svg>`;
}
export function electricalPdfAppendix(pdf:PDFKit.PDFDocument,report:ElectricalReport){
  if(!report.enabled)return;
  pdf.addPage();
  const text=(s:string,bold=false)=>pdf.font(bold?"Helvetica-Bold":"Helvetica").fontSize(bold?12:10).fillColor("#2d4936").text(s,48,pdf.y,{width:499,lineGap:4});
  text("FROZEN ELECTRICAL REFERENCE REPORT",true);pdf.moveDown();
  text("PRELIMINARY - NOT ELECTRICAL CERTIFICATION - NOT FOR INSTALLATION");
  pdf.moveDown();
  text(`Status: ${report.status}\nMethod: ${report.methodVersion}\nEquipment: ${report.module.name} / ${report.inverter.name}\nAssigned modules: ${report.assigned} of ${report.placed}\nCell temperatures: ${report.assumptions.minCellTemp} to ${report.assumptions.maxCellTemp} C\nIsc multiplier: ${report.assumptions.iscFactor}`);
  pdf.moveDown(.5);
  text(`Module STC inputs: Voc ${report.module.voc} V; Vmp ${report.module.vmp} V; Imp ${report.module.imp} A; Isc ${report.module.isc} A.\nRelative temperature coefficients: Voc ${(report.module.betaVoc*100).toFixed(3)}%/C; Vmp ${report.module.betaVmp===undefined?"not available":`${(report.module.betaVmp*100).toFixed(3)}%/C`}.`);
  pdf.moveDown();
  text("STRING SCHEDULE",true);
  for(const s of report.stringResults){
    if(pdf.y>680){pdf.addPage();text("ELECTRICAL REFERENCE REPORT - CONTINUED",true);pdf.moveDown();}
    text(`${s.name}: ${s.moduleCount} modules -> INV ${s.inverterIndex+1} / MPPT ${s.mpptIndex+1}\nCold Voc ${s.coldVoc?.toFixed(1)??"not evaluated"} V | Hot Vmp ${s.hotVmp?.toFixed(1)??"not evaluated"} V | ${s.status}`);
    pdf.moveDown(.5);
  }
  text("REFERENCE LIMITS",true);
  text(`DC maximum ${report.inverter.maxDc} V; MPPT ${report.inverter.mpptMin}-${report.inverter.mpptMax} V.\nPer-input operating/factored Isc ${report.inverter.maxInputCurrent}/${report.inverter.maxInputIsc} A.\nPer-MPPT operating/factored Isc ${report.inverter.maxMpptCurrent}/${report.inverter.maxMpptIsc} A; ${report.inverter.inputsPerMppt} inputs.`);
  pdf.moveDown();text("PARALLEL MPPT RESULTS",true);
  for(const m of report.mpptResults){
    if(pdf.y>680){pdf.addPage();}
    text(`INV ${m.inverterIndex+1} / MPPT ${m.mpptIndex+1}: ${m.stringCount} strings; operating current ${m.operatingCurrent.toFixed(2)} A; factored Isc ${m.designIsc.toFixed(2)} A; ${m.status}`);
  }
  pdf.moveDown();text("FINDINGS",true);
  if(!report.findings.length)text("No implemented-reference limit violations found. This is not a safety or compliance conclusion.");
  for(const f of report.findings){if(pdf.y>700){pdf.addPage();}text(`${f.severity.toUpperCase()}: ${f.message}`);}
  pdf.moveDown();
  text(report.provenance==="unverified-reference"?"Equipment and coefficients are unverified reference values. Start-up behaviour, irradiance/current-temperature effects, cables, protection, earthing, structural suitability and DNO route remain outside this assessment. Results are frozen from the issued revision, not recalculated from later catalogue changes.":`Equipment provenance: ${report.provenance}. Manufacturer-backed inputs are transcribed, not certified; missing coefficients are not inferred. Start-up behaviour, irradiance/current-temperature effects, cables, protection, earthing, structural suitability, grid approval and full manufacturer restrictions remain outside this assessment. Inputs and results are frozen from the issued revision.`);
}
