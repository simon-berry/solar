import type PDFDocument from "pdfkit";
import type { Issue } from "@shared/schema";

export function energyPdfAppendix(pdf:InstanceType<typeof PDFDocument>,issue:Issue,itemised=false){
  const report=issue.energyReport,products=[issue.snapshot.catalogueSnapshot?.module,issue.snapshot.catalogueSnapshot?.inverter];
  pdf.addPage();
  const heading=(s:string)=>{pdf.font("Helvetica-Bold").fontSize(13).fillColor("#203a2c").text(s,48,pdf.y,{width:499});pdf.moveDown(.6);};
  const body=(s:string)=>{pdf.font("Helvetica").fontSize(9).fillColor("#405146").text(s,48,pdf.y,{width:499,lineGap:3});pdf.moveDown(.7);};
  heading("CATALOGUE PROVENANCE - PRELIMINARY");
  for(const p of products.filter(Boolean)){
    body(`${p!.name}\n${p!.source?`${p!.source.manufacturer} | ${p!.source.model}\nDocument: ${p!.source.documentRevision} | checked ${p!.source.checkedOn}\n${p!.source.notes}\nManufacturer datasheet: ${p!.source.url}`:"Unverified legacy reference data; not a manufacturer product."}`);
  }
  body(itemised?"Manufacturer data are transcribed, not independently certified. Prices are editable allowances, not supplier prices. Battery pricing is included only through explicit included quote lines/allowances; optional items are excluded from the total. A commercial storage allowance is not a battery product/installation design.":"Manufacturer data are transcribed, not independently certified. Prices remain editable allowances, not supplier prices. No battery equipment or battery installation price is included unless explicitly entered in Other allowance and described in scope notes.");
  if(!report)return;
  pdf.addPage();heading("INTERVAL CONSUMPTION & BATTERY - PRELIMINARY");
  body(`${report.datasetLabel}\nMethod: ${report.methodVersion}\nConsumption: ${report.consumptionKind} | PV: ${report.pvKind}\nPeriod (UTC, end exclusive): ${report.diagnostics.start} to ${report.diagnostics.end}\nGrouping timezone: ${report.timezone} | Coverage: ${report.diagnostics.coveragePercent.toFixed(2)}%\nObserved demand: ${report.consumptionKwh.toFixed(2)} kWh | Peak interval-average load: ${report.peakKw.toFixed(2)} kW\nPV energy: ${report.pvKwh===null?"not supplied":report.pvKwh.toFixed(2)+" kWh"} | Missing intervals: ${report.diagnostics.missingIntervals}`);
  const b=issue.snapshot.intervalAnalysis!.battery,s=report.selected;
  body(`Generic AC battery assumptions: ${b.usableKwh} kWh usable | charge/discharge ${b.chargeKw}/${b.dischargeKw} kW\nCharge/discharge efficiency: ${b.chargeEfficiency*100}/${b.dischargeEfficiency*100}% | reserve ${b.reservePercent}% | initial SOC ${b.initialPercent}%`);
  if(s)body(`SELECTED CAPACITY - OBSERVED PERIOD ONLY\nGrid import: ${s.import.toFixed(2)} kWh (PV-only baseline ${s.baselineImport.toFixed(2)})\nExport: ${s.export.toFixed(2)} kWh | conversion loss: ${s.loss.toFixed(2)} kWh\nOpening/closing internal SOC: ${s.initialSoc.toFixed(2)}/${s.finalSoc.toFixed(2)} kWh\nTerminal SOC restoration allowance: GBP ${s.terminalAllowance.toFixed(2)}\nSOC-adjusted incremental period value: GBP ${s.periodValue.toFixed(2)}\nSmallest tested capacity at 90% of best positive period value: ${report.suggestedKwh===null?"none":report.suggestedKwh+" kWh"}\nNot an annual saving, payback, product selection, quote inclusion or performance guarantee.`);
  else body(`BATTERY SIMULATION NOT AVAILABLE: ${report.blockedReason}`);
  for(const a of report.assumptions){if(pdf.y>650)pdf.addPage();body(a);}
}
