import {useState} from "react";
import {useQuery,useMutation} from "@tanstack/react-query";
import {AlertTriangle,FileText,Download,Upload,ShieldCheck} from "lucide-react";
import type {Design} from "@shared/schema";
import {surveyDefaults,mountingDefaults,mountingSchema,evidenceKindSchema,type Survey,type EvidenceKind,type EngineeringReport,type ReviewDecision} from "@shared/review-schema";
import {canDesign} from "@shared/access";
import {apiRequest,apiUrl,queryClient} from "@/lib/queryClient";
import {useAccess} from "./access";
import {NumericField} from "./solar-ui";
import {hardware} from "@shared/electrical";
import {dims} from "@shared/solar";
import {roofOutline} from "@shared/map-geometry";

const errorText=(e:unknown)=>{const x=e as {issues?:{path:unknown[];message:string}[];message?:string};return x.issues?x.issues.slice(0,3).map(i=>`${i.path.join(".")}: ${i.message}`).join("; "):x.message||"Request failed.";};
export function EngineeringWorkspace({d,change,projectId,revision,dirty}:{d:Design;change:(d:Design)=>void;projectId:string;revision:number;dirty:boolean}){
  const {session}=useAccess(),editable=canDesign(session.identity?.role),survey=d.survey||surveyDefaults(),mounting=d.mounting||mountingDefaults();
  const [message,setMessage]=useState(""),[kind,setKind]=useState<EvidenceKind>("survey-photo"),[author,setAuthor]=useState(""),[docDate,setDocDate]=useState(""),[source,setSource]=useState(""),[notes,setNotes]=useState(""),[uploading,setUploading]=useState(false);
  const {data:report,error}=useQuery<EngineeringReport>({queryKey:["engineering",projectId,revision],queryFn:async()=>(await apiRequest("GET",`/api/projects/${projectId}/engineering`)).json()});
  const refresh=()=>{queryClient.invalidateQueries({queryKey:["engineering",projectId]});queryClient.invalidateQueries({queryKey:["technical-issues",projectId]});};
  const submit=useMutation({mutationFn:async()=>(await apiRequest("POST",`/api/projects/${projectId}/review-submissions`,{expectedRevision:revision})).json(),onSuccess:()=>{refresh();setMessage("Saved engineering snapshot submitted. A different authenticated reviewer must record any external review.");},onError:e=>setMessage(e.message)});
  const patchSurvey=(p:Partial<Survey>)=>change({...d,survey:{...survey,...p}});
  const textField=(key:keyof Survey,label:string,area=false)=><label className="field" key={key}><span>{label}</span>{area?<textarea rows={3} maxLength={3000} value={String(survey[key]??"")} onChange={e=>patchSurvey({[key]:e.target.value})}/>:<input maxLength={160} value={String(survey[key]??"")} onChange={e=>patchSurvey({[key]:e.target.value})}/>}</label>;
  const upload=async(file?:File)=>{
    if(!file)return;setMessage("");setUploading(true);
    try{
      if(dirty)throw Error("Save the design before attaching evidence to its engineering snapshot.");
      if(file.size>6*1024*1024)throw Error("Maximum evidence file size is 6 MiB.");
      const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("Could not read file."));reader.readAsDataURL(file);});
      await apiRequest("POST",`/api/projects/${projectId}/evidence`,{filename:file.name,kind,author,date:docDate,source,notes,content,expectedRevision:revision});
      refresh();setMessage("Evidence attached to the saved engineering hash. Changing engineering inputs will mark its binding stale.");
    }catch(e){setMessage(errorText(e));}finally{setUploading(false);}
  };
  return <>
    <div className="section-intro"><div><h2>Survey & engineering review</h2><p>Evidence-linked review records, not automatic engineering certification.</p></div><span className="warning-label"><AlertTriangle size={15}/> Installation release unavailable</span></div>
    {(message||error)&&<div className="info-box" role="status" data-testid="engineering-message"><FileText size={17}/><p>{message||error?.message}</p></div>}
    {dirty&&<div className="energy-warning"><AlertTriangle size={18}/><p>Unsaved edits are not included in the report below. Save revision before uploading evidence, submitting for review or issuing a frozen technical pack.</p></div>}
    <fieldset disabled={!editable} className="workflow-surface">
      <section className="content-panel"><div className="panel-heading"><h2>Structured survey</h2><span className="tiny-tag">UNKNOWN IS NOT ZERO</span></div><div className="content-body form-stack">
        <div className="field-grid">{textField("assessor","Survey assessor")}<label className="field"><span>Survey date</span><input type="date" value={survey.date} onChange={e=>patchSurvey({date:e.target.value})}/></label>
          <label className="field"><span>Survey basis</span><select data-testid="survey-basis" value={survey.basis} onChange={e=>patchSurvey({basis:e.target.value as Survey["basis"]})}>{["unknown","measured","customer-supplied","remote-estimate","engineer-supplied"].map(v=><option key={v}>{v}</option>)}</select></label>
          <label className="field"><span>Roof condition</span><select value={survey.condition} onChange={e=>patchSurvey({condition:e.target.value as Survey["condition"]})}>{["unknown","reported-good","defects-noted","specialist-review"].map(v=><option key={v}>{v}</option>)}</select></label>
          {textField("covering","Roof covering")}<label className="field"><span>Recorded support spacing (mm; blank if unknown)</span><input type="number" min={50} max={10000} value={survey.supportSpacingMm??""} onChange={e=>{const v=e.target.value;patchSurvey({supportSpacingMm:v===""?null:Number(v)});}}/></label>
        </div>
        {textField("structure","Roof construction, support details, alterations & uncertainties",true)}
        {textField("equipmentLocations","Proposed equipment positions and cable route intent",true)}
        {textField("access","Access, maintenance and site restrictions",true)}
        <div className="field-grid"><label className="field"><span>Grid route record</span><select value={survey.gridStatus} onChange={e=>patchSurvey({gridStatus:e.target.value as Survey["gridStatus"]})}>{["not-assessed","route-review","evidence-recorded"].map(v=><option key={v}>{v}</option>)}</select></label>{textField("gridReference","Grid application / evidence reference")}</div>
        {textField("permissions","Planning/building/grid responsibilities and unresolved requirements",true)}
      </div></section>
      <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>External mounting schedule</h2><span className="tiny-tag">MANUFACTURER / ENGINEER INPUT</span></div><div className="content-body form-stack">
        <div className="field-grid"><label className="field"><span>Mounting family / product</span><input value={mounting.family} maxLength={160} onChange={e=>change({...d,mounting:{...mounting,family:e.target.value}})}/></label><label className="field"><span>Schedule reference and revision</span><input value={mounting.scheduleReference} maxLength={160} onChange={e=>change({...d,mounting:{...mounting,scheduleReference:e.target.value}})}/></label></div>
        <label className="field"><span>Manufacturer/engineer source and scope</span><textarea value={mounting.source} rows={3} maxLength={3000} onChange={e=>change({...d,mounting:{...mounting,source:e.target.value}})}/></label>
        <label className="field"><span>Additional racking/fixing mass (kg; exclude modules and mapped ballast; blank if unknown)</span><input type="number" min={0} max={100000} value={mounting.additionalMassKg??""} onChange={e=>change({...d,mounting:{...mounting,additionalMassKg:e.target.value===""?null:Number(e.target.value)}})}/></label>
        <p className="field-note">Import roof-plane rail segments, fixing points and ballast locations from a documented external schedule. There is no auto-generated fixing spacing, wind/snow/uplift solver or ballast adequacy calculation.</p>
        <div className="energy-import-actions"><a href={apiUrl(`/api/projects/${projectId}/mounting-template.json`)} className="button secondary"><Download size={15}/>Download blank JSON template</a><label className="button secondary"><Upload size={15}/>Import mounting JSON<input data-testid="mounting-json" type="file" accept=".json,application/json" onChange={async e=>{
          const f=e.target.files?.[0];if(!f)return;try{if(f.size>4_000_000)throw Error("Schedule JSON exceeds 4 MB.");const p=JSON.parse(await f.text());if(p.format!=="solar-mounting-v1")throw Error("Expected a solar-mounting-v1 schedule.");const parsed=mountingSchema.parse(p);change({...d,mounting:parsed});setMessage("External mounting geometry loaded as a draft. Save and obtain a professional review; imported coordinates are not validated fixing/ballast design.");}catch(err){setMessage(errorText(err));}e.target.value="";
        }}/></label></div>
        <p className="field-note">{mounting.rails.length} rails · {mounting.fixings.length} fixing points · {mounting.ballast.length} ballast locations. Roof IDs, bounds, repeated IDs and zero-length rails are checked after saving.</p>
      </div></section>
    </fieldset>
    <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Mapped mounting geometry</h2><span className="tiny-tag">EXTERNAL COORDINATES ONLY</span></div><div className="content-body"><MountingPreview d={d}/></div></section>
    <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Evidence register</h2><span className="tiny-tag">PRIVATE · HASHED CONTENT</span></div><div className="content-body">
      <fieldset className="workflow-surface" disabled={!editable||dirty||uploading}><div className="field-grid"><label className="field"><span>Evidence category</span><select data-testid="evidence-kind" value={kind} onChange={e=>setKind(e.target.value as EvidenceKind)}>{evidenceKindSchema.options.map(k=><option key={k}>{k}</option>)}</select></label><label className="field"><span>Document author / source organisation</span><input data-testid="evidence-author" value={author} maxLength={160} onChange={e=>setAuthor(e.target.value)}/></label><label className="field"><span>Document date</span><input data-testid="evidence-date" type="date" value={docDate} onChange={e=>setDocDate(e.target.value)}/></label><label className="field"><span>Source / report reference</span><input data-testid="evidence-source" value={source} maxLength={500} onChange={e=>setSource(e.target.value)}/></label></div>
        <label className="field"><span>Scope notes</span><textarea rows={2} value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></label>
        <label className="field"><span>{uploading?"Uploading…":"Attach PDF, JPEG or PNG (6 MiB maximum)"}</span><input data-testid="evidence-file" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{void upload(e.target.files?.[0]);e.target.value="";}}/></label>
      </fieldset>
      <p className="field-note">Engineering reports/schedules must be PDF. All files are downloaded as attachments, not executed inline; no malware-scanning assurance is provided. Preview files must be synthetic. Existing evidence and review history are not silently deleted.</p>
    </div><div className="table-wrap"><table><thead><tr><th>Document</th><th>Category</th><th>Author / date</th><th>Binding</th><th>Download</th></tr></thead><tbody>{report?.evidence.map(e=><tr key={e.id}><td><strong>{e.filename}</strong><small>SHA {e.hash.slice(0,16)} · {(e.size/1024).toFixed(0)} KiB</small><small>{e.source}</small></td><td>{e.kind}</td><td>{e.author}<small>{e.date}</small></td><td>{e.engineeringHash===report.engineeringHash?"Current input hash":"Stale / other inputs"}</td><td><a className="icon-button" aria-label={`Download ${e.filename}`} href={apiUrl(`/api/projects/${projectId}/evidence/${e.id}/download`)}><Download size={17}/></a></td></tr>)}</tbody></table></div></section>
    {report&&<>
      <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Recorded load information</h2><span className="warning-label">INCOMPLETE LOAD CASE</span></div><div className="content-body"><dl className="spec-list"><div><dt>Module mass</dt><dd>{report.masses.moduleKg.toFixed(2)} kg</dd></div><div><dt>Mapped ballast</dt><dd>{report.masses.ballastKg.toFixed(2)} kg</dd></div><div><dt>Additional racking/fixing mass</dt><dd>{report.masses.additionalKg===null?"Unknown":report.masses.additionalKg.toFixed(2)+" kg"}</dd></div><div><dt>Known mass subtotal</dt><dd>{report.masses.knownTotalKg.toFixed(2)} kg</dd></div></dl><p className="field-note">Not a roof-capacity, wind, snow, uplift, fixing or ballast calculation. Unknown mass is not treated as a complete zero-load case.</p></div></section>
      <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>External professional review</h2><ShieldCheck size={19}/></div><div className="content-body form-stack"><p className="field-note">Reviews bind engineering hash <code className="engineering-hash">{report.engineeringHash}</code>. Equipment, geometry, electrical, survey and mounting changes invalidate that binding; price-only changes do not. The technical author cannot review their own submission.</p><div className="review-status-grid">{(["electrical","structural","mounting"] as const).map(scope=><div key={scope}><span>{scope}</span><strong>{report.reviewStatus[scope]}</strong></div>)}</div>
        <button data-testid="submit-engineering" className="button secondary" disabled={!editable||dirty||submit.isPending} onClick={()=>submit.mutate()}>Submit saved snapshot for review</button>
        <ReviewForm report={report} projectId={projectId} dirty={dirty} complete={()=>{refresh();setMessage("External review recorded. Native findings remain visible and installation release remains unavailable.");}}/>
      </div></section>
      <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Outstanding findings</h2><span className="tiny-tag">{report.findings.length}</span></div>{report.findings.map((f,i)=><div className={`check-row ${f.level}`} key={`${f.id}-${i}`}><AlertTriangle size={16}/><div><strong>{f.message}</strong></div><span>{f.level==="error"?"Fix":"Review"}</span></div>)}</section>
      <details className="energy-method"><summary>Scope and release limitations</summary>{report.limitations.map(x=><p key={x}>{x}</p>)}</details>
    </>}
  </>;
}
function MountingPreview({d}:{d:Design}){
  const [roofId,setRoofId]=useState(d.roofs[0].id),roof=d.roofs.find(r=>r.id===roofId)||d.roofs[0],m=d.mounting||mountingDefaults(),h=hardware(d);
  return <div className="mounting-preview"><label className="field"><span>Mapped roof face</span><select value={roof.id} onChange={e=>setRoofId(e.target.value)}>{d.roofs.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label><svg viewBox={`-1 -1 ${roof.width+2} ${roof.height+2}`} role="img" aria-label="External mounting schedule mapped over the roof-plane module layout">
    <polygon points={roofOutline(roof).map(p=>`${p.x},${p.y}`).join(" ")} fill="#f3f6f0" stroke="#7d9680" strokeWidth=".04"/>
    {roof.panels.map(p=>{const s=dims(p,h.module);return <rect key={p.id} x={p.x} y={p.y} width={s.width} height={s.height} fill="#d4dfd0" stroke="#8aa087" strokeWidth=".025"/>;})}
    {m.rails.filter(r=>r.roofId===roof.id).map((r,i)=><line key={`${r.id}-${i}`} x1={r.x} y1={r.y} x2={r.x2} y2={r.y2} stroke="#166b48" strokeWidth=".09"/>)}
    {m.fixings.filter(r=>r.roofId===roof.id).map((r,i)=><circle key={`${r.id}-${i}`} cx={r.x} cy={r.y} r=".1" fill="#a16d1f"/>)}
    {m.ballast.filter(r=>r.roofId===roof.id).map((r,i)=><rect key={`${r.id}-${i}`} x={r.x-.1} y={r.y-.1} width=".2" height=".2" fill="#795887"/>)}
  </svg><p className="field-note">Green: imported rails · gold: fixing points · purple: ballast positions. Coordinates and adequacy remain subject to the external schedule and professional review.</p></div>;
}
function ReviewForm({report,projectId,dirty,complete}:{report:EngineeringReport;projectId:string;dirty:boolean;complete:()=>void}){
  const {session}=useAccess(),identity=session.identity;
  const [scope,setScope]=useState<ReviewDecision["scope"]>("electrical"),[outcome,setOutcome]=useState<ReviewDecision["outcome"]>("changes-required"),[qualifications,setQualifications]=useState(""),[limitations,setLimitations]=useState(""),[ids,setIds]=useState<string[]>([]),[declaration,setDeclaration]=useState(false);
  const mutation=useMutation({mutationFn:async()=>(await apiRequest("POST",`/api/projects/${projectId}/review-decisions`,{submissionId:report.currentSubmission?.id,scope,outcome,qualifications,limitations,evidenceIds:ids,declaration})).json(),onSuccess:()=>{complete();setDeclaration(false);}});
  const allowed=identity&&["admin","reviewer"].includes(identity.role)&&report.currentSubmission&&report.currentSubmission.createdBy!==identity.id;
  if(!allowed)return <div className="info-box"><ShieldCheck size={17}/><p>{!identity?"Recording an external review requires account-mode authentication, not a synthetic preview identity.":!report.currentSubmission?"Submit a saved snapshot first; prior submissions may be stale.":report.currentSubmission.createdBy===identity.id?"A different authorised reviewer must review this submission. Self-review is blocked.":"Your role cannot record external engineering reviews."}</p></div>;
  const evidence=report.evidence.filter(e=>report.currentSubmission!.evidenceIds.includes(e.id));
  return <form className="form-stack review-decision-form" onSubmit={e=>{e.preventDefault();mutation.mutate();}}><h3>Record external report assessment</h3><div className="field-grid"><label className="field"><span>Scope</span><select data-testid="review-scope" value={scope} onChange={e=>setScope(e.target.value as typeof scope)}>{["electrical","structural","mounting"].map(s=><option key={s}>{s}</option>)}</select></label><label className="field"><span>Outcome</span><select data-testid="review-outcome" value={outcome} onChange={e=>setOutcome(e.target.value as typeof outcome)}><option value="changes-required">Changes required</option><option value="accepted-external-evidence">External report accepted for this snapshot</option></select></label></div>
    <label className="field"><span>Declared professional capability / authority</span><textarea data-testid="review-qualifications" rows={2} minLength={10} maxLength={1000} required value={qualifications} onChange={e=>setQualifications(e.target.value)}/></label>
    <label className="field"><span>Assessment scope, unresolved conditions and limitations</span><textarea data-testid="review-limitations" rows={3} minLength={10} maxLength={3000} required value={limitations} onChange={e=>setLimitations(e.target.value)}/></label>
    <div><span className="field-label">Supporting evidence from the submission</span>{evidence.map(e=><label className="energy-confirm" key={e.id}><input data-testid={`review-evidence-${e.id}`} type="checkbox" checked={ids.includes(e.id)} onChange={event=>setIds(event.target.checked?[...ids,e.id]:ids.filter(id=>id!==e.id))}/>{e.filename} · {e.kind}</label>)}{!evidence.length&&<p className="field-note">No evidence was captured with this submission. A designer must attach reports and submit again.</p>}</div>
    <label className="energy-confirm"><input data-testid="review-declaration" type="checkbox" required checked={declaration} onChange={e=>setDeclaration(e.target.checked)}/>I am authorised and competent for the recorded scope, have inspected the selected external evidence and understand this records an assessment, not a software-issued engineering certificate or installation release.</label>
    {mutation.error&&<p className="inline-error" role="alert">{mutation.error.message}</p>}
    <button data-testid="record-review" className="button primary" disabled={dirty||mutation.isPending||!ids.length||!declaration}>Record external review</button>
  </form>;
}
export function TechnicalIssues({projectId,revision,dirty}:{projectId:string;revision:number;dirty:boolean}){
  const {session}=useAccess();
  const {data=[],error}=useQuery<{id:string;revision:number;hash:string;createdAt:string;author:string}[]>({queryKey:["technical-issues",projectId],queryFn:async()=>(await apiRequest("GET",`/api/projects/${projectId}/technical-issues`)).json()});
  const issue=useMutation({mutationFn:async()=>(await apiRequest("POST",`/api/projects/${projectId}/technical-issues`,{expectedRevision:revision})).json(),onSuccess:()=>queryClient.invalidateQueries({queryKey:["technical-issues",projectId]})});
  return <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Technical review packs</h2><span className="tiny-tag">A3 VECTOR PDF · PRELIMINARY</span></div><div className="content-body"><p className="field-note">Freeze generated roof/mounting layouts, string and load schedules, stable identifiers, findings and evidence/review register. External source documents are referenced, not embedded; download required attachments separately. Every sheet remains not for installation.</p><button data-testid="issue-technical-pack" className="button secondary" disabled={dirty||issue.isPending||!canDesign(session.identity?.role)} onClick={()=>issue.mutate()}>Create frozen review pack</button>{(issue.error||error)&&<p className="inline-error" role="alert">{issue.error?.message||error?.message}</p>}</div><div className="table-wrap"><table><thead><tr><th>Revision</th><th>Issued</th><th>Purpose</th><th>Download</th></tr></thead><tbody>{data.map(i=><tr key={i.id}><td>Rev {i.revision}<small>{i.hash.slice(0,16)}</small></td><td>{new Date(i.createdAt).toLocaleString("en-GB")}<small>{i.author}</small></td><td>For professional review only</td><td><a data-testid={`download-technical-${i.id}`} className="button secondary" href={apiUrl(`/api/technical-issues/${i.id}/pack.pdf`)}><Download size={15}/>PDF</a><a className="text-button" href={apiUrl(`/api/technical-issues/${i.id}/report.json`)}>Frozen JSON</a></td></tr>)}</tbody></table></div></section>;
}
