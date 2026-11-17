import {useState} from "react";
import {useMutation,useQuery} from "@tanstack/react-query";
import {Upload,History,AlertTriangle} from "lucide-react";
import {apiRequest,queryClient} from "@/lib/queryClient";
import type {Project} from "@shared/schema";
import {useAccess} from "./access";
import {canDesign} from "@shared/access";
import {useLocation} from "wouter";

export function ImportProject(){
  const [,navigate]=useLocation(),{session}=useAccess(),[payload,setPayload]=useState<Record<string,unknown>|null>(null),[error,setError]=useState("");
  const mutation=useMutation({mutationFn:async()=>(await apiRequest("POST","/api/projects/import",payload)).json() as Promise<Project>,
    onSuccess:p=>{queryClient.invalidateQueries({queryKey:["/api/projects"]});navigate(`/project/${p.id}/site`);},onError:e=>setError(e.message)});
  return <div className="standalone-page"><div className="eyebrow">PORTABLE PROJECTS</div><h1>Import a project</h1><p className="page-lede">Recover a saved Solar Workspace JSON export as a new project. Existing projects, revision history and issued proposals are never overwritten.</p>
    <section className="content-panel"><div className="panel-heading"><h2>Choose project source</h2><Upload size={19}/></div><div className="content-body form-stack">
      <label className="field"><span>Solar Workspace project JSON (up to 4 MB)</span><input data-testid="import-project-file" type="file" accept=".json,application/json" disabled={!canDesign(session.identity?.role)} onChange={async e=>{
        const file=e.target.files?.[0];setPayload(null);setError("");if(!file)return;
        try{if(file.size>4_000_000)throw Error("Project JSON exceeds 4 MB.");const p=JSON.parse(await file.text());if(!p||p.format!=="solar-workspace-v1"||typeof p.name!=="string"||!p.design)throw Error("Choose a solar-workspace-v1 project export, not an electrical or energy report.");setPayload({format:p.format,name:`${p.name} (imported)`.slice(0,100),design:p.design});}catch(err){setError((err as Error).message);}
      }}/></label>
      {payload&&<label className="field"><span>New project name</span><input data-testid="import-project-name" value={String(payload.name)} minLength={2} maxLength={100} onChange={e=>setPayload({...payload,name:e.target.value})}/></label>}
      <div className="info-box"><AlertTriangle size={18}/><p>Only the exported saved design is imported, not its original organisation, proposals or revision history. Equipment is re-snapshotted from this server's catalogue; supplied hardware limits and provenance are not trusted. Review the layout, electrical inputs, prices and assumptions after importing.</p></div>
      {error&&<p role="alert" className="inline-error">{error}</p>}
      <button data-testid="confirm-project-import" className="button primary" disabled={!payload||mutation.isPending||!canDesign(session.identity?.role)} onClick={()=>mutation.mutate()}>{mutation.isPending?"Importing…":"Import as new project"}</button>
    </div></section>
  </div>;
}
export function RevisionHistory({project,revision,dirty,onRestore}:{project:Project;revision:number;dirty:boolean;onRestore:(p:Project)=>void}){
  const {session}=useAccess(),[confirm,setConfirm]=useState<number|null>(null);
  const {data=[],error}=useQuery<{revision:number;savedAt:string}[]>({queryKey:["/api/projects",project.id,"revisions"]});
  const restore=useMutation({mutationFn:async(n:number)=>(await apiRequest("POST",`/api/projects/${project.id}/restore`,{revision:n,expectedRevision:revision})).json() as Promise<Project>,
    onSuccess:p=>{setConfirm(null);queryClient.invalidateQueries({queryKey:["/api/projects"]});queryClient.invalidateQueries({queryKey:["/api/projects",project.id,"revisions"]});onRestore(p);}});
  return <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Saved revision history</h2><History size={18}/></div><p className="content-body field-note">Restore creates a new current revision using the selected historical design. It never changes old revisions or issued proposals. Save your current edits first; conflicts require a reload.</p>
    {(restore.error||error)&&<p className="content-body inline-error" role="alert">{restore.error?.message||error?.message}</p>}
    {confirm!==null&&<div className="restore-confirm"><p>Restore revision {confirm} as a new revision after {revision}? Your current saved design remains in history.</p><button data-testid="confirm-revision-restore" className="button primary" disabled={restore.isPending||dirty} onClick={()=>restore.mutate(confirm)}>Confirm restore</button><button className="button secondary" onClick={()=>setConfirm(null)}>Cancel</button></div>}
    <div className="table-wrap"><table><thead><tr><th>Revision</th><th>Saved</th><th>Recover</th></tr></thead><tbody>{data.map(r=><tr key={r.revision}><td>Rev {r.revision}{r.revision===revision?" · Current":""}</td><td>{new Date(r.savedAt).toLocaleString("en-GB")}</td><td><button data-testid={`restore-revision-${r.revision}`} className="text-button" disabled={r.revision===revision||dirty||restore.isPending||!canDesign(session.identity?.role)} onClick={()=>setConfirm(r.revision)}>Restore as new revision</button></td></tr>)}</tbody></table></div>
  </section>;
}
