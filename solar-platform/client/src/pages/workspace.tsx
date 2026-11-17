import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Search, FolderOpen, ChevronRight, ArrowUpRight, Check, Save, FileText, LayoutGrid, BookOpen, Info, PanelLeftClose, Menu, ArrowRight, MapPin, House, Building2, AlertTriangle, Download, CheckCircle2, ArrowLeft, CircuitBoard, Layers, ExternalLink } from "lucide-react";
import { apiRequest, queryClient, apiUrl } from "@/lib/queryClient";
import type { Project, Design, Issue, CreateProject } from "@shared/schema";
import { modules, inverters } from "@shared/schema";
import { totals, validateDesign, stableJSON } from "@shared/solar";
import { RoofEditor } from "@/components/roof-editor";
import { money, NumericField, Notice, NewProject } from "@/components/solar-ui";
import {ElectricalDesigner} from "@/components/electrical-designer";
import type {ModuleSpec,InverterSpec} from "@shared/schema";
import {inspectDataset} from "@shared/energy";
import {useAccess,AccountPage} from "@/components/access";
import {ImportProject,RevisionHistory} from "@/components/project-recovery";
import {canDesign,canQuote} from "@shared/access";
import {workspaceDrafts as drafts} from "@/lib/workspace-drafts";
import {TechnicalIssues,EngineeringWorkspace} from "@/components/engineering-workspace";
import {ProposalDetailsEditor} from "@/components/proposal-details";

const EnergyAnalysis=lazy(()=>import("@/components/energy-analysis").then(m=>({default:m.EnergyAnalysis})));
const MapDesigner=lazy(()=>import("@/components/map-designer").then(m=>({default:m.MapDesigner})));
const tabs=[["site","Site details"],["map","Map design"],["design","Roof design"],["equipment","Equipment"],["electrical","Electrical"],["engineering","Survey & review"],["estimates","Estimates"],["energy","Consumption & battery"],["quote","Quote"],["documents","Documents"]] as const;
const date=(s:string)=>new Date(s).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
// Transient draft cache: navigating elsewhere never discards an unsaved edit.
// Deliberately no browser storage; durable work requires Save revision.

export function SolarApp(){
  const {session}=useAccess(),editable=canDesign(session.identity?.role);
  const [location,navigate]=useLocation();
  const {data:projects=[],isLoading,error,refetch}=useQuery<Project[]>({queryKey:["/api/projects"]});
  const [newOpen,setNewOpen]=useState(false),[search,setSearch]=useState(""),[mobileNav,setMobileNav]=useState(false);
  const match=location.match(/^\/project\/([^/]+)\/?([^/]*)/);
  const project=projects.find(p=>p.id===match?.[1]);
  const tab=match?.[2]||"design";
  const create=useMutation({
    mutationFn:async(d:CreateProject)=>(await apiRequest("POST","/api/projects",d)).json() as Promise<Project>,
    onSuccess:p=>{queryClient.invalidateQueries({queryKey:["/api/projects"]});setNewOpen(false);navigate(`/project/${p.id}/site`);setMobileNav(false);},
  });
  useEffect(()=>{if(location==="/"&&projects.length)navigate(`/project/${projects[0].id}/design`,{replace:true});},[location,projects]);
  return <div className={`app-shell ${mobileNav?"nav-open":""}`}>
    <a href="#main" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById("main")?.focus();}}>Skip to workspace</a>
    <aside className="sidebar">
      <div className="brand"><span>solar<span className="brand-period">.</span></span><small>DESIGN WORKSPACE</small></div>
      <div className="workspace-selector"><div className="workspace-avatar">SW</div><div><strong>Solar workspace</strong><span>Development alpha</span></div></div>
      <nav className="global-nav" aria-label="Workspace">
        <Link data-testid="nav-projects" href="/" onClick={()=>setMobileNav(false)} className={location.startsWith("/project")?"active":""}><FolderOpen size={18}/>Projects<span>{projects.length}</span></Link>
        <Link data-testid="nav-catalogue" href="/catalogue" onClick={()=>setMobileNav(false)} className={location==="/catalogue"?"active":""}><BookOpen size={18}/>Equipment library</Link>
        {editable&&<Link data-testid="nav-import" href="/import" onClick={()=>setMobileNav(false)}><Download size={18}/>Import project</Link>}
        <Link data-testid="nav-account" href="/account" onClick={()=>setMobileNav(false)}><House size={18}/>{session.identity?"Team & access":"Workspace access"}</Link>
      </nav>
      <div className="sidebar-label"><span>YOUR PROJECTS</span><button disabled={!editable} data-testid="sidebar-new-project" className="icon-button" aria-label="Create project" onClick={()=>{create.reset();setMobileNav(false);setNewOpen(true);}}><Plus size={16}/></button></div>
      <label className="project-search"><Search size={14}/><input data-testid="search-projects" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a project…" aria-label="Find a project"/></label>
      <div className="project-links">{projects.filter(p=>`${p.name} ${p.design.postcode} ${p.design.customer}`.toLowerCase().includes(search.toLowerCase())).map(p=><Link data-testid={`project-${p.id}`} key={p.id} href={`/project/${p.id}/design`} className={p.id===project?.id?"active":""} onClick={()=>setMobileNav(false)}>{p.design.type==="Residential"?<House size={16}/>:<Building2 size={16}/>}<span>{p.name}<small>{p.design.postcode} {p.sample?"· Sample":""}</small></span><ChevronRight size={13}/></Link>)}
        {search&&!projects.some(p=>`${p.name} ${p.design.postcode} ${p.design.customer}`.toLowerCase().includes(search.toLowerCase()))&&<p className="sidebar-empty">No matching projects.</p>}
      </div>
      <button disabled={!editable} data-testid="new-project" className="new-project-button" onClick={()=>{create.reset();setMobileNav(false);setNewOpen(true);}}><Plus size={16}/> New project</button>
      <div className="sidebar-bottom">
        <Link data-testid="nav-about" href="/about" onClick={()=>setMobileNav(false)}><Info size={16}/>Development notes<ArrowUpRight size={14}/></Link>
        <div className="development-status"><span className="small-dot"/>{session.identity?session.identity.orgName:"Preview workspace"}<small>{session.identity?session.identity.role:"Use test data only"}</small></div>
        <span className="sidebar-attribution">Built with Perplexity</span>
      </div>
    </aside>
    <button className="mobile-scrim" data-testid="close-navigation" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>
    <div className="workspace-shell">
      <header className="topbar">
        <button data-testid="toggle-navigation" className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}>{mobileNav?<PanelLeftClose size={19}/>:<Menu size={19}/>}</button>
        <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13}/><span>{project?"Projects":location==="/catalogue"?"Equipment library":"Development"}</span>{project&&<><ChevronRight size={13}/><strong>{project.name}</strong></>}</div>
        <div className="topbar-right"><span className="preview-chip" data-testid="build-version">ALPHA 0.7</span><span className="avatar">SW</span></div>
      </header>
      <main id="main" tabIndex={-1}>
        {isLoading?<div className="loading-state"><div className="skeleton"/><div className="skeleton"/><p>Opening your workspace…</p></div>:error?<div className="empty-state"><AlertTriangle/><h1>Workspace unavailable</h1><p>Could not reach the development server.</p><button className="button primary" data-testid="retry-projects" onClick={()=>refetch()}>Try again</button></div>:location==="/catalogue"?<Catalogue/>:location==="/about"?<DevelopmentNotes/>:location==="/account"?<AccountPage/>:location==="/import"?<ImportProject/>:project?<ProjectWorkspace key={`${session.identity?.id||"preview"}:${project.id}`} project={project} tab={tab}/>:projects.length&&location!=="/"?<div className="empty-state"><FolderOpen/><h1>Project not found</h1><Link href="/" className="button secondary">Back to projects</Link></div>:!projects.length?<div className="empty-state"><FolderOpen/><h1>Your first solar project</h1><p>Create a project to start designing.</p><button disabled={!editable} className="button primary" onClick={()=>setNewOpen(true)}>Create project</button></div>:null}
      </main>
    </div>
    <NewProject open={newOpen} onClose={()=>setNewOpen(false)} onCreate={d=>create.mutate(d)} pending={create.isPending} error={create.error?.message||""}/>
  </div>;
}

function ProjectWorkspace({project,tab}:{project:Project;tab:string}){
  const {session}=useAccess(),role=session.identity?.role,draftKey=`${session.identity?.id||"preview"}:${project.id}`;
  const workflowRef=useRef<HTMLElement>(null);
  const [workflowScroll,setWorkflowScroll]=useState({left:false,right:false});
  useEffect(()=>{
    const nav=workflowRef.current;if(!nav)return;
    const align=()=>{const active=nav.querySelector<HTMLElement>(".active");if(active){const n=nav.getBoundingClientRect(),a=active.getBoundingClientRect();nav.scrollLeft+=a.left-n.left-(n.width-a.width)/2;}};
    const update=()=>setWorkflowScroll({left:nav.scrollLeft>2,right:nav.scrollLeft+nav.clientWidth<nav.scrollWidth-2});
    const resize=()=>{align();update();};
    resize();const observer=new ResizeObserver(resize);observer.observe(nav);nav.addEventListener("scroll",update,{passive:true});
    return()=>{observer.disconnect();nav.removeEventListener("scroll",update);};
  },[tab]);
  const [d,setD]=useState<Design>(()=>structuredClone(drafts.get(draftKey)?.design||project.design));
  const [revision,setRevision]=useState(drafts.get(draftKey)?.revision||project.revision),[baseline,setBaseline]=useState(drafts.get(draftKey)?.baseline||stableJSON(project.design));
  const [notice,setNotice]=useState(""),[checks,setChecks]=useState(false);
  const [,navigate]=useLocation();
  const dirty=stableJSON(d)!==baseline;
  useEffect(()=>{drafts.set(draftKey,{design:structuredClone(d),revision,baseline});},[d,revision,baseline,draftKey]);
  const t=totals(d), findings=validateDesign(d),errors=findings.filter(f=>f.severity==="error");
  const save=useMutation({
    mutationFn:async(submitted:Design)=> (await apiRequest("PUT",`/api/projects/${project.id}`,{expectedRevision:revision,design:submitted})).json() as Promise<Project>,
    onSuccess:(p,submitted)=>{
      setD(current=>stableJSON(current)===stableJSON(submitted)?p.design:{...current,catalogueSnapshot:p.design.catalogueSnapshot});
      setRevision(p.revision);setBaseline(stableJSON(p.design));queryClient.invalidateQueries({queryKey:["/api/projects"]});setNotice(`Revision ${p.revision} saved. Previous revisions are retained.`);
    },
    onError:e=>setNotice(e.message),
  });
  const issue=useMutation({
    mutationFn:async()=> (await apiRequest("POST",`/api/projects/${project.id}/issues`,{expectedRevision:revision})).json() as Promise<Issue>,
    onSuccess:()=>{queryClient.invalidateQueries({queryKey:["/api/projects",project.id,"issues"]});setNotice("Preliminary proposal created from the saved revision. It will not change with later edits.");navigate(`/project/${project.id}/documents`);},
    onError:e=>setNotice(e.message),
  });
  useEffect(()=>{
    const before=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before);
  },[dirty]);
  // Keep unsaved state within this project across workflow tabs.
  return <div className="project-workspace">
    <section className="project-heading">
      <div><div className="eyebrow">PROJECT WORKSPACE <span className="divider-dot"/> {d.type.toUpperCase()}</div><h1>{project.name}<span className="status-badge">Draft</span>{project.sample&&<span className="sample-tag">Sample project</span>}</h1><p><MapPin size={14}/>{d.address}, {d.postcode}<span className="metadata-divider"/>Rev {revision}<span className="metadata-divider"/><span className={dirty?"unsaved":"saved"} data-testid="save-status">{dirty?"Unsaved changes":"All changes saved"}</span></p></div>
      <div className="heading-actions"><button data-testid="save-project" className="button secondary" disabled={!dirty||save.isPending||!canQuote(role)} onClick={()=>save.mutate(d)}>{save.isPending?<span className="button-spinner"/>:<Save size={16}/>}Save revision</button><button data-testid="open-proposal" className="button primary" onClick={()=>navigate(`/project/${project.id}/quote`)}>Prepare proposal<ArrowUpRight size={16}/></button></div>
    </section>
    <div className="workflow-bar"><nav ref={workflowRef} className="workflow-tabs" aria-label="Project workflow">{tabs.map(([key,label],i)=><Link data-testid={`tab-${key}`} className={tab===key?"active":""} key={key} href={`/project/${project.id}/${key}`}><span>{String(i+1).padStart(2,"0")}</span>{label}</Link>)}</nav>
      {(workflowScroll.left||workflowScroll.right)&&<div className="workflow-scroll-controls"><button data-testid="workflow-scroll-left" className="icon-button" title="Scroll project steps left" aria-label="Scroll project steps left" disabled={!workflowScroll.left} onClick={()=>workflowRef.current?.scrollBy({left:-workflowRef.current.clientWidth*.65,behavior:"smooth"})}><ChevronRight size={17} style={{transform:"rotate(180deg)"}}/></button><button data-testid="workflow-scroll-right" className="icon-button" title="Scroll project steps right" aria-label="Scroll project steps right" disabled={!workflowScroll.right} onClick={()=>workflowRef.current?.scrollBy({left:workflowRef.current.clientWidth*.65,behavior:"smooth"})}><ChevronRight size={17}/></button></div>}
    </div>
    <div className="workspace-content">
      {notice&&<Notice message={notice} close={()=>setNotice("")}/>}
      {role&&!canDesign(role)&&<div className="info-box"><Info size={16}/><p>{role==="estimator"?"Estimator access: pricing and preliminary proposal issuing only. Site, layout, electrical and energy changes require a designer.":role==="reviewer"?"Reviewer access: inspect/download and record external reviews on another author's submitted snapshot. Design and pricing edits remain disabled.":"View/download access only. Your role cannot change designs or issue proposals."}</p></div>}
      <fieldset className="workflow-surface" disabled={!canDesign(role)&&!(tab==="quote"&&canQuote(role))&&tab!=="documents"&&tab!=="engineering"&&tab!=="map"}>
      {tab==="map"?<Suspense fallback={<p className="content-body">Opening map workspace…</p>}><MapDesigner d={d} change={next=>{if(canDesign(role))setD(next);}} editable={canDesign(role)} notice={setNotice}/></Suspense>:tab==="design"?<>
        <div className="section-intro"><div><h2>Build your array</h2><p>Place modules, define obstructions and refine the layout.</p></div><button data-testid="toggle-checks" className={`check-button ${errors.length?"has-errors":""}`} aria-expanded={checks} onClick={()=>setChecks(!checks)}>{errors.length?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>} {errors.length?`${errors.length} layout issue${errors.length>1?"s":""}`:"Layout checks"}<ChevronRight size={14}/></button></div>
        {checks&&<CheckPanel design={d}/>}
        <RoofEditor design={d} onChange={next=>{if(canDesign(role))setD(next);}} onNotice={setNotice}/>
        <p className="workspace-footnote"><Info size={13}/> Preliminary design only. Survey, electrical, structural and grid reviews remain required.</p>
      </>:tab==="site"?<SiteDetails d={d} change={setD}/>:tab==="equipment"?<Equipment d={d} change={setD}/>:tab==="electrical"?<ElectricalDesigner design={d} onChange={next=>{if(canDesign(role))setD(next);}} onNotice={setNotice}/>:tab==="engineering"?<Suspense fallback={<p className="content-body">Opening engineering review…</p>}><EngineeringWorkspace d={d} change={next=>{if(canDesign(role))setD(next);}} projectId={project.id} revision={revision} dirty={dirty}/></Suspense>:tab==="estimates"?<Estimates d={d} change={setD}/>:tab==="energy"?<Suspense fallback={<p className="content-body">Opening interval analysis…</p>}><EnergyAnalysis d={d} change={setD}/></Suspense>:tab==="quote"?<Quote d={d} change={setD} dirty={dirty} issuing={issue.isPending} errors={errors.length} onIssue={()=>issue.mutate()}/>:tab==="documents"?<Documents project={project} revision={revision} dirty={dirty} onRestore={p=>{setD(p.design);setRevision(p.revision);setBaseline(stableJSON(p.design));setNotice(`Restored as revision ${p.revision}. Historical revisions and issued proposals were retained.`);}}/>:<div className="empty-state"><h2>Choose a workflow tab</h2></div>}
      </fieldset>
    </div>
  </div>;
}

function SiteDetails({d,change}:{d:Design;change:(d:Design)=>void}){
  return <><div className="section-intro"><div><h2>Site & customer</h2><p>These inputs stay with every saved revision.</p></div><span className="subtle-status">Survey not verified</span></div>
    <div className="two-column"><section className="content-panel"><div className="panel-heading"><h2>Project details</h2><House size={17}/></div><div className="content-body form-stack">
      {(["customer","address","postcode"] as const).map(k=><label key={k} className="field"><span>{{customer:"Customer name",address:"Site address",postcode:"Postcode"}[k]}</span><input data-testid={`site-${k}`} value={d[k]} maxLength={k==="address"?240:120} onChange={e=>change({...d,[k]:e.target.value})}/></label>)}
      <div className="field-grid"><label className="field"><span>Nation</span><select data-testid="site-nation" value={d.nation} onChange={e=>change({...d,nation:e.target.value as Design["nation"]})}>{["England","Wales","Scotland","Northern Ireland"].map(n=><option key={n}>{n}</option>)}</select></label><label className="field"><span>Project type</span><select data-testid="site-type" value={d.type} onChange={e=>change({...d,type:e.target.value as Design["type"]})}><option>Residential</option><option>Commercial</option></select></label></div>
      <label className="field"><span>Electrical supply</span><select data-testid="site-phase" value={d.phase} onChange={e=>change({...d,phase:e.target.value as Design["phase"]})}><option>Single phase</option><option>Three phase</option></select></label>
    </div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Survey notes</h2><FileText size={17}/></div><div className="content-body"><label className="field"><span>Site observations & assumptions</span><textarea data-testid="survey-notes" rows={9} maxLength={3000} value={d.notes} placeholder="Record roof condition, measurement sources, access restrictions and unknowns…" onChange={e=>change({...d,notes:e.target.value})}/></label><div className="info-box"><Info size={17}/><p>Dimensions and observations are unverified. Use Survey & review for structured survey records, private photos/reports and recorded external assessments; these do not certify measurements or release the design for installation.</p></div></div></section></div>
  </>;
}
function Equipment({d,change}:{d:Design;change:(d:Design)=>void}){
  const t=totals(d);
  return <><div className="section-intro"><div><h2>Equipment selection</h2><p>Manufacturer-backed starter catalogue, alongside separate legacy references.</p></div><span className="sample-tag">Prices remain editable allowances</span></div>
    <div className="two-column"><section className="content-panel"><div className="panel-heading"><h2>PV modules</h2><LayoutGrid size={17}/></div><div className="content-body form-stack">
      <label className="field"><span>Module specification</span><select data-testid="equipment-module" value={d.moduleId} onChange={e=>change({...d,moduleId:e.target.value as Design["moduleId"]})}>{modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <div className="equipment-render"><div className="mini-module"/><div><strong>{t.module.watts} W</strong><span>{t.module.width} × {t.module.height} m</span><span>{t.module.mass} kg per module</span></div></div>
      <ProductSource product={t.module}/>
      <dl className="spec-list"><div><dt>Placed modules</dt><dd>{t.count}</dd></div><div><dt>DC capacity</dt><dd>{t.kwp.toFixed(2)} kWp</dd></div><div><dt>Open-circuit voltage</dt><dd>{t.module.voc} V</dd></div><div><dt>Short-circuit current</dt><dd>{t.module.isc} A</dd></div></dl>
      <p className="field-note">Changing dimensions rechecks your existing layout. Correct conflicts before issuing. Quote prices remain unchanged allowances; review them after equipment changes.</p>
    </div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Inverter</h2><CircuitBoard size={17}/></div><div className="content-body form-stack">
      <label className="field"><span>Inverter specification</span><select data-testid="equipment-inverter" value={d.inverterId} onChange={e=>change({...d,inverterId:e.target.value as Design["inverterId"]})}>{inverters.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <ProductSource product={t.inverter}/>
      <NumericField label="Inverter quantity" value={d.inverterCount} min={1} max={6} step={1} onChange={v=>change({...d,inverterCount:Math.round(v)})}/>
      <dl className="spec-list"><div><dt>Total AC capacity</dt><dd>{t.acKw.toFixed(1)} kW</dd></div><div><dt>Inverter supply</dt><dd>{t.inverter.phase}</dd></div><div><dt>Recorded supply</dt><dd>{d.phase}</dd></div><div><dt>DC / AC ratio</dt><dd>{(t.kwp/t.acKw).toFixed(2)}</dd></div></dl>
      {t.inverter.phase!==d.phase&&<div className="inline-error" role="alert">Inverter phase does not match the recorded supply.</div>}
      <div className="info-box"><Info size={17}/><p>Use the Electrical tab to configure strings and reference MPPT checks. Protective devices, cable sizing and full compliance assessment remain outside this alpha.</p></div>
    </div></section></div>
  </>;
}
function Estimates({d,change}:{d:Design;change:(d:Design)=>void}){
  const t=totals(d);
  const input=(key:keyof Design["energy"],label:string,suffix:string,max:number,step:number)=> <NumericField key={key} label={label} suffix={suffix} value={d.energy[key]} max={max} step={step} onChange={v=>change({...d,energy:{...d.energy,[key]:v}})}/>;
  return <><div className="section-intro"><div><h2>Illustrative energy estimate</h2><p>User-entered assumptions, not an MCS or validated simulation.</p></div><span className="warning-label"><AlertTriangle size={14}/> Preliminary only</span></div>
    <div className="estimate-summary"><div><span>Annual generation</span><strong data-testid="annual-generation">{t.generation.toLocaleString()} <small>kWh</small></strong></div><div><span>PV used on site</span><strong>{Math.round(t.selfUsed).toLocaleString()} <small>kWh</small></strong></div><div><span>PV export</span><strong>{Math.round(t.exported).toLocaleString()} <small>kWh</small></strong></div><div><span>Illustrative annual value</span><strong>{money(Math.round(t.saving*100))}</strong></div></div>
    <div className="two-column"><section className="content-panel"><div className="panel-heading"><h2>Generation assumptions</h2></div><div className="content-body form-stack">
      {input("yieldPerKwp","Specific yield","kWh/kWp",1600,10)}
      {input("shadeFactor","Shade factor","0–1",1,.01)}
      <div className="formula-box"><span>ANNUAL OUTPUT</span><p>{t.kwp.toFixed(2)} kWp × {d.energy.yieldPerKwp} × {d.energy.shadeFactor}</p><strong>{t.generation.toLocaleString()} kWh</strong></div>
      <p className="field-note">The yield is a manual assumption; no weather service, orientation model or shade analysis is connected. Changing azimuth does not automatically change it.</p>
    </div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Consumption & tariffs</h2></div><div className="content-body form-stack">
      {input("consumption","Annual consumption","kWh",2000000,100)}
      {input("selfConsumption","Assumed PV self-consumption","%",100,1)}
      <div className="field-grid">{input("importRate","Import rate","£/kWh",3,.01)}{input("exportRate","Export rate","£/kWh",3,.01)}</div>
      <p className="field-note">On-site use is capped at annual demand. These assumptions are not a time-series energy balance, battery model or guaranteed saving.</p>
    </div></section></div>
  </>;
}
function Quote({d,change,dirty,issuing,errors,onIssue}:{d:Design;change:(d:Design)=>void;dirty:boolean;issuing:boolean;errors:number;onIssue:()=>void}){
  const t=totals(d);
  const fields:[keyof Omit<Design["pricing"],"vat"|"taxBasis"|"proposal">,string][]=[["panelSell","Module unit sell price"],["mountingPerPanel","Mounting per module"],["inverterSell","Inverter unit sell price"],["labour","Installation labour"],["access","Scaffolding & access"],["other","Other allowance"]];
  return <><div className="section-intro"><div><h2>Build the quote</h2><p>Materials follow the design. Prices are editable allowances.</p></div><span className="subtle-status">GBP · preliminary quotation</span></div>
    <div className="quote-layout"><section className="content-panel"><div className="panel-heading"><h2>Price inputs</h2><span className="tiny-tag">SELL PRICES</span></div><div className="content-body"><div className="field-grid">{fields.map(([k,label])=><NumericField key={k} label={label} suffix="£" value={d.pricing[k]} min={0} max={k==="panelSell"?2000:k==="mountingPerPanel"?1000:k==="inverterSell"?30000:50000} step={1} onChange={v=>change({...d,pricing:{...d.pricing,[k]:v}})}/>)}</div>
      <div className="property-divider"/><label className="field"><span>VAT rate (requires confirmation)</span><select data-testid="quote-vat" value={d.pricing.vat} onChange={e=>change({...d,pricing:{...d.pricing,vat:e.target.value as Design["pricing"]["vat"]}})}><option value="20">20%</option><option value="5">5%</option><option value="0">0%</option></select></label>
      <label className="field"><span>Tax basis / eligibility assumptions</span><textarea data-testid="quote-tax-basis" value={d.pricing.taxBasis} maxLength={500} rows={3} onChange={e=>change({...d,pricing:{...d.pricing,taxBasis:e.target.value}})}/></label>
      <p className="field-note">No automatic tax eligibility determination. Confirm the applicable rate and tax point before using a quote with a customer.</p>
      <p className="field-note">Battery modelling does not price equipment or installation. Record storage explicitly as an included additional item below, or a described Other allowance; a commercial line is not a verified battery design.</p>
    </div></section>
    <section className="content-panel quote-summary"><div className="panel-heading"><h2>Proposal summary</h2><FileText size={17}/></div><div className="content-body">
      <div className="quote-site"><strong>{d.customer}</strong><span>{d.address}, {d.postcode}</span><small>{t.count} modules · {t.kwp.toFixed(2)} kWp DC · {t.acKw} kW AC</small></div>
      <div className="quote-line-list">{t.lines.filter(l=>l.unitPence>0||l.id.startsWith("extra-")).map(l=><div key={l.id}><span>{l.name}<small>{l.quantity} {l.unit} × {money(l.unitPence)}</small></span><strong>{money(l.amountPence)}</strong></div>)}</div>
      {!!t.optionalLines.length&&<div className="quote-line-list optional-quote-lines"><h3>Optional: excluded from total</h3>{t.optionalLines.map(l=><div key={l.id}><span>{l.name}<small>{l.quantity} {l.unit} · pre-VAT</small></span><strong>{money(l.amountPence)}</strong></div>)}</div>}
      <dl className="quote-totals"><div><dt>Subtotal</dt><dd>{money(t.netPence)}</dd></div><div><dt>VAT ({d.pricing.vat}%)</dt><dd>{money(t.vatPence)}</dd></div><div className="grand-total"><dt>Total estimate</dt><dd data-testid="quote-total">{money(t.totalPence)}</dd></div></dl>
      <div className="info-box"><Info size={16}/><p>Creates an immutable preliminary PDF. It is not a contract, certified design or approval for installation.</p></div>
      <button data-testid="issue-proposal" className="button primary full" disabled={dirty||issuing||errors>0||!d.pricing.taxBasis.trim()||!!d.pricing.proposal&&!d.pricing.proposal.companyName.trim()} onClick={onIssue}><FileText size={16}/>{issuing?"Creating…":"Create preliminary proposal"}</button>
      <p className="field-note">{dirty?"Save your revision before creating a proposal.":errors>0?"Resolve layout and equipment errors before proceeding.":"The proposal is frozen against this saved revision."}</p>
    </div></section></div>
    <ProposalDetailsEditor d={d} change={change}/>
  </>;
}
function Documents({project,revision,dirty,onRestore}:{project:Project;revision:number;dirty:boolean;onRestore:(p:Project)=>void}){
  const {data:issues=[],isLoading,error}=useQuery<Issue[]>({queryKey:["/api/projects",project.id,"issues"]});
  const hasElectrical=!!project.design.electrical?.enabled;
  const dataset=project.design.intervalAnalysis?.dataset;
  const hasDispatch=useMemo(()=>!!dataset&&dataset.pvKind!=="absent"&&inspectDataset(dataset).valid&&!inspectDataset(dataset).gaps,[dataset]);
  return <><div className="section-intro"><div><h2>Documents & drawing pack</h2><p>Preliminary outputs, traceable to a saved design revision.</p></div><span className="warning-label"><AlertTriangle size={14}/> Not for installation</span></div>
    <section className="content-panel"><div className="panel-heading"><h2>Design exports</h2><span className="tiny-tag">SAVED REV {revision}</span></div><div className="export-grid">
      {[["roof.svg","Roof layout","Scaled roof-plane geometry · SVG",Layers],["roof.dxf","Roof CAD geometry","Roof-plane millimetres · named DXF layers",Layers],["site.geojson","Mapped site geometry","Saved approximate coordinates · no imagery",MapPin],["schematic.svg","Equipment schematic","Concept only · not a wiring diagram",CircuitBoard],["project.json","Project source data","Current saved revision · JSON",FileText]].map(([path,title,description,Icon])=>{
        const I=Icon as typeof Layers;return <div className="export-item" key={String(path)}><I size={21}/><div><h3>{String(title)}</h3><p>{String(description)}</p></div><a data-testid={`download-${String(path)}`} className="icon-button" aria-label={`Download ${title}`} href={apiUrl(`/api/projects/${project.id}/export/${path}`)}><Download size={18}/></a></div>;
      })}
    </div>{dirty&&<p className="export-warning">Unsaved edits are not included. Save your revision before exporting.</p>}</section>
    <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Electrical exports</h2><span className="tiny-tag">REFERENCE DESIGN ONLY</span></div><div className="export-grid">
      {[["strings.svg","String layout","Colour-coded assignments · SVG",Layers],["electrical.svg","DC string schematic","Inverter / MPPT connections · SVG",CircuitBoard],["electrical.json","Electrical check report","Saved assumptions & results · JSON",FileText]].map(([path,title,description,Icon])=>{
        const I=Icon as typeof Layers;return <div className="export-item" key={String(path)}><I size={21}/><div><h3>{String(title)}</h3><p>{String(description)}</p></div>{hasElectrical?<a data-testid={`download-${String(path)}`} className="icon-button" aria-label={`Download ${title}`} href={apiUrl(`/api/projects/${project.id}/export/${path}`)}><Download size={18}/></a>:<button data-testid={`download-${String(path)}`} className="icon-button" aria-label={`Enable and save electrical design to download ${title}`} disabled><Download size={18}/></button>}</div>;
      })}
    </div>{!hasElectrical&&<p className="export-warning">Enable and save a string model in Electrical to create these outputs.</p>}</section>
    <section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Consumption & battery exports</h2><span className="tiny-tag">SAVED REVISION ONLY</span></div><div className="export-grid">{[["energy.json","Interval analysis report","Period totals, assumptions and capacity comparison"],["dispatch.csv","Battery dispatch","Interval AC flows and internal SOC"]].map(([path,title,description])=><div className="export-item" key={path}><FileText size={21}/><div><h3>{title}</h3><p>{description}</p></div>{dataset&&(path!=="dispatch.csv"||hasDispatch)?<a className="icon-button" data-testid={`download-${path}`} aria-label={`Download ${title}`} href={apiUrl(`/api/projects/${project.id}/export/${path}`)}><Download size={18}/></a>:<button className="icon-button" data-testid={`download-${path}`} disabled aria-label={`Import and save contiguous demand and PV data for ${title}`}><Download size={18}/></button>}</div>)}</div><p className="export-warning">Dispatch requires contiguous demand and PV data. Gapped or consumption-only data still supports an analysis report. New proposals freeze the saved interval report in their appendix.</p></section>
    <section className="content-panel document-history"><div className="panel-heading"><h2>Preliminary proposals</h2><span className="tiny-tag">{issues.length} ISSUED</span></div>
      {isLoading?<p className="content-body">Loading proposal history…</p>:error?<p className="content-body inline-error">Could not load proposals. Return to this tab to retry.</p>:issues.length?<div className="table-wrap"><table><thead><tr><th>Document</th><th>Design revision</th><th>Created</th><th>Total</th><th><span className="sr-only">Download</span></th></tr></thead><tbody>{issues.map((i,index)=><tr key={i.id} data-testid={`issue-${i.id}`}><td><span className="document-title"><FileText size={17}/>Proposal {String(issues.length-index).padStart(2,"0")}</span><small>Preliminary · {i.hash.slice(0,12)}{i.electricalReport?.enabled?" · Electrical report frozen":""}</small></td><td>Rev {i.revision}</td><td>{date(i.createdAt)}</td><td>{money(i.totalPence)}</td><td><a data-testid={`download-proposal-${index}`} href={apiUrl(`/api/issues/${i.id}/proposal.pdf`)} className="icon-button" aria-label="Download preliminary proposal PDF"><Download size={17}/></a></td></tr>)}</tbody></table></div>:<div className="documents-empty"><FileText size={25}/><h3>No proposals created yet</h3><p>Prepare your quote, save the revision, then create a preliminary proposal.</p><Link className="text-button" href={`/project/${project.id}/quote`}>Go to quote<ArrowRight size={15}/></Link></div>}
    </section>
    {issues.some(i=>i.energyReport)&&<section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Frozen interval reports</h2><span className="tiny-tag">ISSUED SNAPSHOTS</span></div><div className="content-body energy-import-actions">{issues.filter(i=>i.energyReport).map(i=><a key={i.id} className="button secondary" data-testid={`download-frozen-energy-${i.id}`} href={apiUrl(`/api/issues/${i.id}/energy.json`)}><Download size={15}/>Rev {i.revision} · {i.hash.slice(0,8)} · JSON</a>)}</div></section>}
    <RevisionHistory project={project} revision={revision} dirty={dirty} onRestore={onRestore}/>
    {issues.some(i=>i.quoteReport)&&<section className="content-panel electrical-schedule"><div className="panel-heading"><h2>Frozen itemised quote reports</h2><span className="tiny-tag">ISSUED MONEY & SCOPE</span></div><div className="content-body energy-import-actions">{issues.filter(i=>i.quoteReport).map(i=><a key={i.id} className="button secondary" data-testid={`download-frozen-quote-${i.id}`} href={apiUrl(`/api/issues/${i.id}/quote.json`)}>Rev {i.revision} · {i.hash.slice(0,8)} · Quote JSON</a>)}</div></section>}
    <TechnicalIssues projectId={project.id} revision={revision} dirty={dirty}/>
    <div className="engineering-gate"><AlertTriangle size={21}/><div><h3>Engineering release is not available in this alpha</h3><p>Electrical checks, verified structural evidence, network approval and reviewer permissions are required before installation-ready documents can be issued.</p></div></div>
  </>;
}
function CheckPanel({design}:{design:Design}){
  const findings=validateDesign(design);
  return <section className="check-panel"><div className="panel-heading"><h2>Design review</h2><span className="tiny-tag">PRELIMINARY CHECKS</span></div>{findings.map(f=><div key={f.id} className={`check-row ${f.severity}`}>{f.severity==="error"?<AlertTriangle size={16}/>:<Info size={16}/>}<div><strong>{f.message}</strong><p>{f.detail}</p></div><span>{f.severity==="error"?"Fix":"Review"}</span></div>)}</section>;
}
function ProductSource({product:p}:{product:ModuleSpec|InverterSpec}){
  return p.source?<div className="product-source"><span className="tiny-tag">MANUFACTURER DATASHEET</span><p>{p.source.model} · {p.source.documentRevision} · checked {p.source.checkedOn}</p><a href={p.source.url} target="_blank" rel="noopener noreferrer">Read {p.source.manufacturer} datasheet<ExternalLink size={12}/></a><p>{p.source.notes}</p></div>:<p className="field-note">Unverified legacy reference, not a real manufacturer product. Preserved for older designs and testing.</p>;
}
function Catalogue(){
  const [filter,setFilter]=useState("manufacturer"),[query,setQuery]=useState("");
  const matches=(p:ModuleSpec|InverterSpec)=>(filter==="all"||Boolean(p.source)===(filter==="manufacturer"))&&`${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase());
  return <div className="standalone-page"><div className="eyebrow">WORKSPACE RESOURCES</div><h1>Equipment library</h1><p className="page-lede">Five exact manufacturer-backed variants to start with. Source revisions and unknowns stay with saved equipment snapshots; legacy reference entries remain separate.</p>
    <div className="catalogue-controls"><label className="field"><span>Catalogue entries</span><select aria-label="Catalogue entries" value={filter} onChange={e=>setFilter(e.target.value)}><option value="manufacturer">Manufacturer-backed</option><option value="reference">Legacy references only</option><option value="all">All entries</option></select></label><label className="field"><span>Find model</span><input aria-label="Find model" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Manufacturer or exact model"/></label></div>
    <section className="content-panel"><div className="panel-heading"><h2>PV modules</h2><span className="tiny-tag">{modules.filter(matches).length} ENTRIES</span></div><div className="table-wrap"><table><thead><tr><th>Model & provenance</th><th>STC power</th><th>Dimensions</th><th>Mass</th><th>Voc / Isc</th></tr></thead><tbody>{modules.filter(matches).map(m=><tr key={m.id}><td><strong>{m.name}</strong><ProductSource product={m}/></td><td>{m.watts} W</td><td>{m.width} × {m.height} m</td><td>{m.mass} kg</td><td>{m.voc} V / {m.isc} A</td></tr>)}</tbody></table>{!modules.some(matches)&&<p className="content-body">No matching modules.</p>}</div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Inverters</h2><span className="tiny-tag">{inverters.filter(matches).length} ENTRIES</span></div><div className="table-wrap"><table><thead><tr><th>Model & provenance</th><th>AC rating</th><th>Phase</th><th>DC / MPPT</th><th>Per MPPT limits</th></tr></thead><tbody>{inverters.filter(matches).map(i=><tr key={i.id}><td><strong>{i.name}</strong><ProductSource product={i}/></td><td>{i.kw} kW</td><td>{i.phase}</td><td>{i.maxDc} V max<br/>{i.mpptMin}–{i.mpptMax} V<br/>{i.mpptCount} MPPT × {i.inputsPerMppt} input</td><td>{i.maxMpptCurrent} A operating<br/>{i.maxMpptIsc} A short circuit</td></tr>)}</tbody></table>{!inverters.some(matches)&&<p className="content-body">No matching inverters.</p>}</div></section>
    <p className="field-note">Manufacturer data are transcribed, not independently certified. Prices, stock, UK approved-product listing, grid settings and system compatibility are not verified. No real three-phase inverter has been added yet. Missing Vmp temperature coefficients are unknown, not derived from Pmax or Voc; the affected MPPT checks remain incomplete.</p>
  </div>;
}
function DevelopmentNotes(){
  return <div className="standalone-page development-page"><div className="eyebrow">BUILD 0.7 · MAP-BASED DESIGN</div><h1>A working foundation</h1><p className="page-lede">Map-to-proposal workflows with roof tracing, sourced hardware, interval analysis, organisation accounts, survey evidence, independent review records and branded itemised preliminary proposals.</p>
    <section className="content-panel"><div className="panel-heading"><h2>Available in this build</h2></div><div className="content-body"><ul className="feature-list">{["Residential and commercial projects across all four UK nations","Multiple rectangular roof faces, module placement, dragging and obstructions","Clearance and overlap checks, auto-fill, orientation and undo/redo","Saved design revisions with conflict detection","Reference equipment, manual energy assumptions and quote totals","String/MPPT assignments, cold/hot voltage and input-current reference checks","Frozen equipment inputs and electrical reports on new proposal issues","Immutable preliminary proposal PDFs and SVG/JSON exports"].map(s=><li key={s}><Check size={16}/>{s}</li>)}</ul></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Consumption and storage in this build</h2></div><div className="content-body"><p>CSV import supports 15/30/60-minute gross demand, optional aligned AC PV, kWh or average kW, explicit timestamp offsets and interval start/end conventions. Coverage diagnostics, local-time daily/monthly/hourly summaries, a physically balanced AC battery simulation and capacity sensitivity are available in Consumption & battery.</p><p>The starter catalogue contains three Trina Vertex S+ variants and two Sungrow single-phase variants with manufacturer datasheets. No live pricing or stock is supplied. Unknown temperature coefficients remain unknown. New proposal issues freeze catalogue provenance and an interval report; older issues keep their original templates.</p></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Access, recovery & deployment</h2></div><div className="content-body"><p>Self-hosted account mode includes password login, organisation-scoped sessions, Admin/Designer/Estimator/Reviewer/Read-only roles, one-time invitations, revocation, password changes and audit events. This private preview deliberately remains visitor-scoped for synthetic data; Workspace access explains the difference.</p><p>Import project restores exported JSON into a new project. Documents includes saved revision history and explicit restore-as-new-revision confirmation. The self-hosting package includes persistent-volume deployment, integrity-checked operator backups and password recovery instructions.</p></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Survey, evidence & external review</h2></div><div className="content-body"><p>Survey & review records site observations, PDF/image evidence and imported manufacturer/engineer mounting geometry. Evidence files are private downloads with hashes and saved-input bindings, not a malware-scanning or accreditation service.</p><p>A different authenticated Admin/Reviewer can record an assessment of submitted external report PDFs. Engineering edits stale prior assessments; pricing alone does not. Documents freezes an A3 preliminary technical pack and offers roof-plane DXF geometry. External source files are referenced, not embedded, and installation release stays unavailable.</p></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Branded itemised proposals</h2></div><div className="content-body"><p>Quote can store declared installer identity/contact details, an accent colour, reference and inclusion/exclusion scope. Additional items support decimal quantities, penny prices and included/optional status; optional amounts never inflate the total.</p><p>New branded issues freeze a v4 PDF and itemised quote JSON. Legacy proposal templates remain available on their original data. Commercial scope text is not an engineering design change, product compatibility check, customer contract acceptance or authority to install.</p></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Map-based site design</h2></div><div className="content-body"><p>Map design adds opt-in street maps, manually submitted UK address/place searches, manual coordinates and saved site pins. Trace clockwise from a roof's upper/ridge edge using an explicitly assumed pitch; polygon-aware placement and clearances keep modules out of notches.</p><p>Place/select/move/rotate/remove modules, add obstructions or auto-fill the traced face. Save a revision before downloading GeoJSON, polygon SVG/DXF or a frozen v2 technical review pack. Streets are not aerial imagery or a measured survey. Satellite is optional and disabled until the operator provides an authorised MapTiler key; licensed imagery has not been verified in this preview.</p></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Remaining release gates</h2></div><div className="content-body"><p>This is not a certified engineering system. The private preview is not managed durable storage and must use synthetic data only. Account mode still requires configured HTTPS hosting, persistent storage, tested backups and operational security review; MFA, SSO and automated email are not available.</p><p>MCS generation, live weather data, a comprehensive UK-approved catalogue, real battery product compatibility, time-of-use optimisation, manufacturer-complete electrical checks, structural calculations, customer acceptance, verified licensed aerial imagery and engineering release remain outstanding.</p></div></section>
    <section className="content-panel"><div className="panel-heading"><h2>Next development milestone</h2></div><div className="content-body"><p>Configure the target HTTPS host and persistent storage, independently validate calculation scope, and expand the sourced commercial and battery catalogue. Customer acceptance and operational security controls remain separate work. Technical approval must remain disabled until the full calculation and review workflows are independently validated.</p></div></section>
  </div>;
}
