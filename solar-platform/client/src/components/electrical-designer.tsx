import {useState} from "react";
import {Plus,Trash2,Info,GitBranch,Undo2,ArrowRight,CheckCircle2,AlertTriangle} from "lucide-react";
import type {Design,ElectricalDesign,Roof,StringDesign} from "@shared/schema";
import {assessElectrical,electricalDefaults,hardware,suggestStrings,STRING_COLOURS} from "@shared/electrical";
import {dims} from "@shared/solar";
import {NumericField} from "./solar-ui";
import {roofOutline} from "@shared/map-geometry";

const statusText=(status:string)=>status==="error"?"Needs attention":status==="incomplete"?"Incomplete":status==="disabled"?"Not configured":"Within reference limits";
export function ElectricalDesigner({design:d,onChange,onNotice}:{design:Design;onChange:(d:Design)=>void;onNotice:(s:string)=>void}){
  const e=d.electrical||{...electricalDefaults(),enabled:false};
  const report=assessElectrical(d),hw=hardware(d);
  const [selected,setSelected]=useState("");
  const [roofId,setRoofId]=useState(d.roofs[0].id);
  const [previous,setPrevious]=useState<ElectricalDesign|null>(null);
  const roof=d.roofs.find(r=>r.id===roofId)||d.roofs[0];
  const current=e.strings.find(s=>s.id===selected)||e.strings[0];
  const labels=new Map(d.roofs.flatMap(r=>r.panels).map((p,i)=>[p.id,`M${String(i+1).padStart(2,"0")}`]));
  function change(next:ElectricalDesign){setPrevious(structuredClone(e));onChange({...d,electrical:next});}
  function patchString(patch:Partial<StringDesign>){if(current)change({...e,strings:e.strings.map(s=>s.id===current.id?{...s,...patch}:s)});}
  function assign(id:string){
    if(!current){onNotice("Add or suggest a string before assigning modules.");return;}
    const already=current.moduleIds.includes(id);
    change({...e,strings:e.strings.map(s=>({...s,moduleIds:s.id===current.id?(already?s.moduleIds.filter(m=>m!==id):[...s.moduleIds.filter(m=>m!==id),id]):s.moduleIds.filter(m=>m!==id)}))});
  }
  function addString(){
    const s={id:crypto.randomUUID(),name:`S${String(e.strings.length+1).padStart(2,"0")}`,inverterIndex:0,mpptIndex:0,moduleIds:[]};
    change({...e,strings:[...e.strings,s]});setSelected(s.id);
  }
  const currentResult=report.stringResults.find(s=>s.id===current?.id);
  return <>
    <div className="section-intro"><div><h2>Strings & MPPT inputs</h2><p>Assign modules and evaluate explicit reference limits.</p></div>
      <span className="sample-tag">{report.provenance==="manufacturer-datasheet"?"Manufacturer-backed inputs":report.provenance==="mixed"?"Mixed reference / manufacturer inputs":"Unverified reference data"}</span></div>
    <div className="electrical-disclaimer"><Info size={17}/><p>These are limited reference checks, not electrical certification. Cables, protection, earthing, start-up behaviour and manufacturer-specific restrictions still require specialist design.</p></div>
    <div className="electrical-actions">
      <label className="electrical-switch"><input data-testid="enable-electrical" type="checkbox" checked={e.enabled} onChange={ev=>change({...e,enabled:ev.target.checked})}/><span>Enable draft string model</span></label>
      <div>
        <button data-testid="undo-electrical" className="button secondary" disabled={!previous} onClick={()=>{if(previous){const restore=previous;setPrevious(null);onChange({...d,electrical:restore});}}}><Undo2 size={15}/>Undo change</button>
        <button data-testid="add-string" className="button secondary" disabled={!e.enabled||e.strings.length>=48} onClick={addString}><Plus size={15}/>Add string</button>
        <button data-testid="suggest-strings" className="button primary" disabled={!e.enabled||!report.placed} onClick={()=>{
          const strings=suggestStrings(d);change({...e,strings});setSelected(strings[0]?.id||"");
          onNotice("Balanced strings suggested by roof and voltage ceiling. Existing assignments were replaced; review every result. Undo change restores them.");
        }}><GitBranch size={15}/>{e.strings.length?"Replace with suggestion":"Suggest strings"}</button>
      </div>
    </div>
    {!e.enabled?<section className="electrical-empty content-panel"><GitBranch size={28}/><h3>Start the DC design</h3><p>Enable the draft model to assign placed modules to strings and inverter inputs. Existing projects remain usable without it.</p></section>:<>
      <div className={`electrical-summary electrical-status-${report.status}`}>
        <span data-testid="electrical-status">{report.status==="within-reference-limits"?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}<strong>{statusText(report.status)}</strong></span>
        <span data-testid="assigned-module-count"><strong>{report.assigned} / {report.placed}</strong> modules assigned</span>
        <span><strong>{e.strings.length}</strong> strings</span>
        <span><strong>{report.unassignedIds.length}</strong> unassigned</span>
      </div>
      <div className="electrical-workbench">
        <section className="content-panel">
          <div className="panel-heading"><h2>Module assignments</h2><label className="electrical-roof-select"><span className="sr-only">Assignment roof</span><select data-testid="electrical-roof" value={roof.id} onChange={ev=>setRoofId(ev.target.value)}>{d.roofs.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
          <div className="electrical-map-heading"><span>{current?<>Click modules to assign to <strong>{current.name}</strong></>:"Add a string to start assigning."}</span><span>{roof.panels.length} modules on this face</span></div>
          <AssignmentMap roof={roof} design={d} selectedId={current?.id} labels={labels} assign={assign}/>
          <div className="string-legend"><span><i style={{background:"#a4b0b3"}}/>Unassigned</span>{e.strings.map((s,i)=><button data-testid={`legend-string-${i}`} className={s.id===current?.id?"active":""} key={s.id} onClick={()=>setSelected(s.id)}><i style={{background:STRING_COLOURS[i%STRING_COLOURS.length]}}/>{s.name}</button>)}</div>
        </section>
        <aside className="content-panel string-properties">
          <div className="panel-heading"><h2>String properties</h2><span className="tiny-tag">{current?`${current.moduleIds.length} MODULES`:"NO STRING"}</span></div>
          <div className="content-body form-stack">
            {current?<>
              <label className="field"><span>Selected string</span><select data-testid="selected-string" value={current.id} onChange={ev=>setSelected(ev.target.value)}>{e.strings.map((s,i)=><option key={`${s.id}-${i}`} value={s.id}>{s.name} · {s.moduleIds.length} modules</option>)}</select></label>
              <label className="field"><span>String name</span><input data-testid="string-name" maxLength={40} value={current.name} onChange={ev=>patchString({name:ev.target.value||"String"})}/></label>
              <div className="field-grid">
                <label className="field"><span>Inverter</span><select data-testid="string-inverter" value={current.inverterIndex} onChange={ev=>patchString({inverterIndex:Number(ev.target.value)})}>
                  {current.inverterIndex>=d.inverterCount&&<option value={current.inverterIndex}>Missing INV {current.inverterIndex+1}</option>}
                  {Array.from({length:d.inverterCount},(_,i)=><option key={i} value={i}>INV {i+1}</option>)}</select></label>
                <label className="field"><span>MPPT input</span><select data-testid="string-mppt" value={current.mpptIndex} onChange={ev=>patchString({mpptIndex:Number(ev.target.value)})}>
                  {current.mpptIndex>=hw.inverter.mpptCount&&<option value={current.mpptIndex}>Missing MPPT {current.mpptIndex+1}</option>}
                  {Array.from({length:hw.inverter.mpptCount},(_,i)=><option key={i} value={i}>MPPT {i+1}</option>)}</select></label>
              </div>
              <dl className="spec-list"><div><dt>Cold Voc</dt><dd data-testid="selected-cold-voc">{currentResult?.coldVoc?.toFixed(1)??"Not evaluated"}{currentResult?.coldVoc!=null?" V":""}</dd></div><div><dt>Hot Vmp</dt><dd>{currentResult?.hotVmp?.toFixed(1)??"Not evaluated"}{currentResult?.hotVmp!=null?" V":""}</dd></div><div><dt>Operating current</dt><dd>{currentResult?.imp?.toFixed(2)??"Not evaluated"}{currentResult?.imp!=null?" A":""}</dd></div></dl>
              <div><span className="field-label">Assigned modules</span><div className="assigned-chips">{current.moduleIds.length?current.moduleIds.map((id,i)=><button data-testid={`unassign-module-${i}`} key={`${id}-${i}`} title={`Unassign ${labels.get(id)||id}`} className={!labels.has(id)?"missing":""} onClick={()=>assign(id)}>{labels.get(id)||"Missing module"}<span aria-hidden="true">×</span></button>):<p className="field-note">Click placed modules in the layout.</p>}</div></div>
              <button data-testid="remove-string" className="button danger full" onClick={()=>{change({...e,strings:e.strings.filter(s=>s.id!==current.id)});setSelected("");}}><Trash2 size={15}/>Remove string</button>
            </>:<p className="field-note">Add a string or use the suggestion. A suggestion is not an optimised or approved electrical design.</p>}
          </div>
        </aside>
      </div>
      <div className="two-column electrical-lower">
        <section className="content-panel"><div className="panel-heading"><h2>Calculation assumptions</h2><span className="tiny-tag">CELL TEMPERATURES</span></div><div className="content-body form-stack">
          <div className="field-grid">
            <NumericField label="Minimum cell temperature" suffix="°C" value={e.minCellTemp} min={-40} max={25} step={1} onChange={v=>change({...e,minCellTemp:v})}/>
            <NumericField label="Maximum cell temperature" suffix="°C" value={e.maxCellTemp} min={25} max={100} step={1} onChange={v=>change({...e,maxCellTemp:v})}/>
          </div>
          <NumericField label="Isc design factor" suffix="×" value={e.iscFactor} min={1} max={2} step={.05} onChange={v=>change({...e,iscFactor:v})}/>
          <p className="field-note">Inputs are designer assumptions, not weather observations or mandated factors. Voltage coefficients use fractional change per °C, referenced to 25°C. No current-temperature or irradiance model is included.</p>
        </div></section>
        <section className="content-panel"><div className="panel-heading"><h2>Reference inverter limits</h2></div><div className="content-body form-stack">
          <p className="muted">{hw.inverter.name}</p>
          <dl className="spec-list"><div><dt>Absolute maximum DC</dt><dd>{hw.inverter.maxDc} V</dd></div><div><dt>MPPT voltage range</dt><dd>{hw.inverter.mpptMin}–{hw.inverter.mpptMax} V</dd></div><div><dt>Inputs per MPPT</dt><dd>{hw.inverter.inputsPerMppt}</dd></div><div><dt>Input operating / factored Isc</dt><dd>{hw.inverter.maxInputCurrent} / {hw.inverter.maxInputIsc} A</dd></div><div><dt>MPPT operating / factored Isc</dt><dd>{hw.inverter.maxMpptCurrent} / {hw.inverter.maxMpptIsc} A</dd></div></dl>
          <p className="field-note">Reference values only. Manufacturer restrictions, connector topology and start-up voltage are not represented.</p>
        </div></section>
      </div>
      <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>String schedule</h2><span className="tiny-tag">{report.methodVersion}</span></div>
        <div className="table-wrap"><table><thead><tr><th>String</th><th>Modules</th><th>Destination</th><th>Cold Voc</th><th>Hot Vmp</th><th>Result</th></tr></thead><tbody>
          {report.stringResults.map((s,i)=><tr key={`${s.id}-${i}`}><td><button className="text-button" data-testid={`select-string-row-${i}`} onClick={()=>setSelected(s.id)}><i className="string-swatch" style={{background:STRING_COLOURS[i%STRING_COLOURS.length]}}/>{s.name}</button></td><td>{s.moduleCount}</td><td>INV {s.inverterIndex+1} / MPPT {s.mpptIndex+1}</td><td>{s.coldVoc===null?"Not evaluated":`${s.coldVoc.toFixed(1)} V`}</td><td>{s.hotVmp===null?"Not evaluated":`${s.hotVmp.toFixed(1)} V`}</td><td className={`result-${s.status}`}>{statusText(s.status)}</td></tr>)}
          {!report.stringResults.length&&<tr><td colSpan={6}>No strings configured.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Parallel-input checks</h2><span className="tiny-tag">SUMMED PER MPPT</span></div>
        <div className="table-wrap"><table><thead><tr><th>Inverter / MPPT</th><th>Strings</th><th>Operating current</th><th>Factored Isc</th><th>Result</th></tr></thead><tbody>{report.mpptResults.map(m=><tr key={m.key}><td>INV {m.inverterIndex+1} / MPPT {m.mpptIndex+1}</td><td>{m.stringCount} / {hw.inverter.inputsPerMppt}</td><td>{m.operatingCurrent.toFixed(2)} / {hw.inverter.maxMpptCurrent} A</td><td>{m.designIsc.toFixed(2)} / {hw.inverter.maxMpptIsc} A</td><td className={`result-${m.status}`}>{statusText(m.status)}</td></tr>)}{!report.mpptResults.length&&<tr><td colSpan={5}>No MPPT assignments to evaluate.</td></tr>}</tbody></table></div>
      </section>
      <section className="content-panel electrical-findings"><div className="panel-heading"><h2>Findings & limitations</h2><span className="tiny-tag">{report.findings.length} CONFIGURATION FINDINGS</span></div>
        {report.findings.map((f,i)=><div data-testid={`electrical-finding-${i}`} key={`${f.id}-${i}`} className={`check-row ${f.severity}`}><AlertTriangle size={15}/><div><strong>{f.message}</strong></div><span>{f.severity==="error"?"Fix":"Review"}</span></div>)}
        {!report.findings.length&&<div className="check-row"><CheckCircle2 size={16}/><div><strong>Implemented checks are within the reference limits.</strong><p>This does not establish that the installation or equipment is compliant or safe.</p></div></div>}
        <div className="check-row"><Info size={16}/><div><strong>Specialist review remains required.</strong><p>Unverified data, wind/snow/roof capacity, cable sizing, voltage rise, protection, earthing, DNO route and manufacturer instructions are outside this reference assessment.</p></div></div>
      </section>
    </>}
  </>;
}

function AssignmentMap({roof,design:d,selectedId,labels,assign}:{roof:Roof;design:Design;selectedId?:string;labels:Map<string,string>;assign:(id:string)=>void}){
  const module=hardware(d).module,ss=d.electrical?.strings||[];
  const textSize=Math.max(.34,(roof.width+2)/40);
  return <div className="assignment-map"><svg viewBox={`-1 -1 ${roof.width+2} ${roof.height+2}`} aria-label={`Electrical assignments on ${roof.name}`}>
    <polygon points={roofOutline(roof).map(p=>`${p.x},${p.y}`).join(" ")} fill="#e0e7e4" stroke="#9aaba2" strokeWidth=".025"/>
    {roof.obstacles.map(o=><rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} fill="#d6c8ad" stroke="#9d875a" strokeWidth=".025"/>)}
    {roof.panels.map((p,i)=>{const index=ss.findIndex(s=>s.moduleIds.includes(p.id)),owner=ss[index],size=dims(p,module),selected=owner?.id===selectedId;
      return <g data-testid={`assign-module-${i}`} key={p.id} role="button" tabIndex={0} aria-label={`${labels.get(p.id)}: ${owner?.name||"unassigned"}. Assign to selected string`} onClick={()=>assign(p.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();assign(p.id);}}}>
        <rect x={p.x} y={p.y} {...size} rx=".035" fill={index<0?"#5d7266":STRING_COLOURS[index%STRING_COLOURS.length]} stroke={selected?"#183e2a":"#e7f0e9"} strokeWidth={selected?".07":".025"}/>
        <text x={p.x+size.width/2} y={p.y+size.height/2-textSize*.12} fontSize={textSize} textAnchor="middle" fill="#fff" pointerEvents="none">{labels.get(p.id)}</text>
        <text x={p.x+size.width/2} y={p.y+size.height/2+textSize*1.05} fontSize={textSize} textAnchor="middle" fill="#fff" pointerEvents="none">{owner?`S${String(index+1).padStart(2,"0")}`:"-"}</text>
      </g>;
    })}
    {!roof.panels.length&&<text x={roof.width/2} y={roof.height/2} textAnchor="middle" fill="#53695b" fontSize=".4">Place modules in Roof design first.</text>}
  </svg></div>;
}
