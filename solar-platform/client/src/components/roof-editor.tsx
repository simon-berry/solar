import { useRef, useState, useEffect } from "react";
import { MousePointer2, Plus, SquareDashed, Undo2, Redo2, Scan, RotateCw, Trash2, Grid2X2, Tags, ChevronDown } from "lucide-react";
import type { Design, Roof, Panel } from "@shared/schema";
import { modules } from "@shared/schema";
import { dims, fillRoof, round, validPlacement, totals } from "@shared/solar";
import { NumericField } from "./solar-ui";
import { hardware } from "@shared/electrical";
import {rectangleInPolygon} from "@shared/geometry";
import {roofOutline} from "@shared/map-geometry";

type Props={design:Design; onChange:(d:Design)=>void; onNotice:(s:string)=>void};
export function RoofEditor({design:d,onChange,onNotice}:Props) {
  const [roofId,setRoofId]=useState(d.roofs[0].id);
  const roof=d.roofs.find(r=>r.id===roofId)||d.roofs[0];
  const [selected,setSelected]=useState<string|null>(null);
  const [tool,setTool]=useState<"select"|"panel"|"obstacle">("select");
  const [labels,setLabels]=useState(true);
  const [landscape,setLandscape]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [convert,setConvert]=useState(false);
  const [textUnit,setTextUnit]=useState(.34);
  const history=useRef<Design[]>([]), future=useRef<Design[]>([]);
  const svg=useRef<SVGSVGElement>(null);
  const drag=useRef<{id:string;startX:number;startY:number;oldX:number;oldY:number;original:Design;obstacle:boolean}|null>(null);
  const mod=hardware(d).module;
  const t=totals(d);
  function commit(next:Design,remember=true) {
    if(remember) {history.current=[...history.current.slice(-29),structuredClone(d)];future.current=[];}
    onChange(next);
  }
  function patchRoof(patch:Partial<Roof>,remember=true) {
    commit({...d,roofs:d.roofs.map(r=>r.id===roof.id?{...r,...patch}:r)},remember);
  }
  function undo() {const prev=history.current.pop();if(prev){future.current.push(structuredClone(d));onChange(prev);setSelected(null);}}
  function redo() {const next=future.current.pop();if(next){history.current.push(structuredClone(d));onChange(next);setSelected(null);}}
  function autoFill() {
    const others=d.roofs.filter(r=>r.id!==roof.id).reduce((n,r)=>n+r.panels.length,0);
    const max=Math.min(150-others,Math.floor(50000/mod.watts)-others);
    const panels=fillRoof(roof,mod,d.gap,landscape,Math.max(0,max));
    patchRoof({panels});setSelected(null);
    onNotice(`${panels.length} modules placed on ${roof.name}. Undo restores the previous layout.`);
  }
  const margin=1.5, vw=roof.width+margin*2, vh=roof.height+margin*2;
  useEffect(()=>{
    const node=svg.current;if(!node)return;
    const resize=()=>{const scale=Math.min(node.clientWidth/vw,node.clientHeight/vh);if(scale>0)setTextUnit(12/scale);};
    const observer=new ResizeObserver(resize);observer.observe(node);resize();return()=>observer.disconnect();
  },[vw,vh,zoom]);
  function point(e:{clientX:number;clientY:number}) {
    const p=svg.current!.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    const q=p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return {x:round(q.x-margin),y:round(q.y-margin)};
  }
  function addAt(x:number,y:number) {
    if(tool==="obstacle"){
      const ob={id:crypto.randomUUID(),label:"Roof obstruction",x:Math.max(0,x),y:Math.max(0,y),width:1,height:1};
      if(ob.x+ob.width>roof.width||ob.y+ob.height>roof.height||(roof.boundary&&!rectangleInPolygon(ob,roof.boundary)))return onNotice("Place the obstruction inside the roof.");
      patchRoof({obstacles:[...roof.obstacles,ob]});setSelected(ob.id);setTool("select");return;
    }
    if(t.count>=150||t.kwp+mod.watts/1000>50) return onNotice("The development limit is 150 modules and 50 kWp.");
    const p:Panel={id:`M-${crypto.randomUUID().slice(0,8)}`,x:Math.max(0,round(x)),y:Math.max(0,round(y)),landscape};
    if(!validPlacement(roof,p,mod,d.gap))return onNotice("That position conflicts with a module, obstacle or roof clearance.");
    patchRoof({panels:[...roof.panels,p]});setSelected(p.id);
  }
  function remove(){
    if(!selected)return;
    patchRoof({panels:roof.panels.filter(p=>p.id!==selected),obstacles:roof.obstacles.filter(o=>o.id!==selected)});
    setSelected(null);
  }
  function moveSelected(x:number,y:number){
    const p=roof.panels.find(p=>p.id===selected);
    if(p){const next={...p,x:round(x),y:round(y)};if(validPlacement(roof,next,mod,d.gap))patchRoof({panels:roof.panels.map(a=>a.id===p.id?next:a)});else onNotice("Move blocked by the roof clearance or another object.");}
    else if(obstacle && x>=0&&y>=0&&x+obstacle.width<=roof.width&&y+obstacle.height<=roof.height&&(!roof.boundary||rectangleInPolygon({...obstacle,x,y},roof.boundary)))
      patchRoof({obstacles:roof.obstacles.map(o=>o.id===selected?{...o,x:round(x),y:round(y)}:o)});
  }
  const panel=roof.panels.find(p=>p.id===selected);
  const obstacle=roof.obstacles.find(o=>o.id===selected);
  const obj=panel||obstacle;
  return <div className="design-layout">
    <section className="editor-column" aria-label="Roof layout editor">
      <div className="roof-switch">
        <div className="roof-pills">{d.roofs.map((r,i)=><button data-testid={`roof-${r.id}`} key={r.id} className={r.id===roof.id?"active":""} onClick={()=>{setRoofId(r.id);setSelected(null);}}><span className="roof-number">{String(i+1).padStart(2,"0")}</span>{r.name}<small>{r.panels.length}</small></button>)}</div>
        <button data-testid="add-roof" className="icon-button" title="Add roof face" aria-label="Add roof face" disabled={d.roofs.length>=10} onClick={()=>{
          const id=crypto.randomUUID();commit({...d,roofs:[...d.roofs,{...d.roofs[0],id,name:`Roof ${d.roofs.length+1}`,panels:[],obstacles:[],boundary:null,geo:null}]});setRoofId(id);setSelected(null);
        }}><Plus size={17}/></button>
      </div>
      <div className="editor-toolbar">
        <div className="tool-group">
          <button data-testid="tool-select" className={`icon-button ${tool==="select"?"selected":""}`} title="Select & move" aria-label="Select and move" aria-pressed={tool==="select"} onClick={()=>setTool("select")}><MousePointer2 size={17}/></button>
          <button data-testid="tool-panel" className={`icon-button ${tool==="panel"?"selected":""}`} title="Place module: click on roof" aria-label="Place module" aria-pressed={tool==="panel"} onClick={()=>{setTool("panel");onNotice("Click on the roof to place a module.");}}><Grid2X2 size={17}/></button>
          <button data-testid="tool-obstacle" className={`icon-button ${tool==="obstacle"?"selected":""}`} title="Add obstruction: click on roof" aria-label="Add obstruction" aria-pressed={tool==="obstacle"} onClick={()=>{setTool("obstacle");onNotice("Click on the roof to add a 1 m obstruction.");}}><SquareDashed size={18}/></button>
        </div>
        <div className="tool-group">
          <button data-testid="undo-layout" className="icon-button" disabled={!history.current.length} title="Undo layout change" aria-label="Undo" onClick={undo}><Undo2 size={17}/></button>
          <button data-testid="redo-layout" className="icon-button" disabled={!future.current.length} title="Redo layout change" aria-label="Redo" onClick={redo}><Redo2 size={17}/></button>
        </div>
        <button data-testid="toggle-labels" className={`icon-button ${labels?"selected":""}`} title="Module labels" aria-label="Toggle module labels" aria-pressed={labels} onClick={()=>setLabels(!labels)}><Tags size={17}/></button>
        <span className="toolbar-spacer"/>
        <button data-testid="fit-canvas" className="text-button" title="Fit roof to view" onClick={()=>setZoom(1)}><Scan size={15}/> Fit</button>
        <label className="zoom-control"><span className="sr-only">Zoom</span><select data-testid="canvas-zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>100%</option><option value={1.25}>125%</option><option value={1.5}>150%</option></select><ChevronDown size={12}/></label>
      </div>
      <div className={`drawing-surface mode-${tool}`}>
        <div className="canvas-label"><span className="live-dot"/> ROOF-PLANE VIEW <span>Not a surveyed site plan</span></div>
        <div className="drawing-scroll">
          <svg ref={svg} data-testid="roof-canvas" className="roof-canvas" viewBox={`0 0 ${vw} ${vh}`} style={{width:`${zoom*100}%`,minWidth:`${zoom*100}%`}} aria-label={`${roof.name} layout, ${roof.panels.length} modules`}
            onPointerDown={e=>{if(e.target===e.currentTarget){setSelected(null);if(tool!=="select"){const p=point(e);addAt(p.x,p.y);}}}}
            onPointerMove={e=>{
              const g=drag.current;if(!g)return;const pos=point(e);
              const x=Math.max(0,round(Math.round((g.oldX+pos.x-g.startX)*20)/20));
              const y=Math.max(0,round(Math.round((g.oldY+pos.y-g.startY)*20)/20));
              if(g.obstacle){const o=roof.obstacles.find(o=>o.id===g.id)!;if(x+o.width<=roof.width&&y+o.height<=roof.height&&(!roof.boundary||rectangleInPolygon({...o,x,y},roof.boundary)))patchRoof({obstacles:roof.obstacles.map(o=>o.id===g.id?{...o,x,y}:o)},false);}
              else {const p=roof.panels.find(p=>p.id===g.id)!;const n={...p,x,y};if(validPlacement(roof,n,mod,d.gap))patchRoof({panels:roof.panels.map(p=>p.id===g.id?n:p)},false);}
            }}
            onPointerUp={()=>{if(drag.current){history.current.push(drag.current.original);future.current=[];drag.current=null;}}}
            onPointerCancel={()=>{drag.current=null;}}>
            <defs>
              <clipPath id="roof-outline-clip"><polygon points={roofOutline(roof).map(p=>`${p.x},${p.y}`).join(" ")}/></clipPath>
              <pattern id="roof-grid" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M .5 0 L 0 0 0 .5" fill="none" stroke="#a5b4b9" strokeWidth=".012" opacity=".22"/></pattern>
              <pattern id="cells" width=".285" height=".23" patternUnits="userSpaceOnUse"><path d="M .285 0 L 0 0 0 .23" fill="none" stroke="#91a3b8" strokeWidth=".009" opacity=".55"/></pattern>
              <pattern id="obstacle-hatch" width=".14" height=".14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2=".14" stroke="#a7875d" strokeWidth=".025"/></pattern>
            </defs>
            <g transform={`translate(${margin},${margin})`}>
              <polygon points={roofOutline(roof).map(p=>`${p.x},${p.y}`).join(" ")} fill="#d7dee0" stroke="#81939b" strokeWidth=".035"
                onPointerDown={e=>{e.stopPropagation();setSelected(null);if(tool!=="select"){const p=point(e);addAt(p.x,p.y);}}}/>
              <rect width={roof.width} height={roof.height} fill="url(#roof-grid)" clipPath="url(#roof-outline-clip)" pointerEvents="none"/>
              {!roof.boundary&&<rect x={roof.setback} y={roof.setback} width={Math.max(0,roof.width-roof.setback*2)} height={Math.max(0,roof.height-roof.setback*2)} stroke="#7e9196" strokeWidth=".02" strokeDasharray=".10 .09" fill="none" pointerEvents="none"/>}
              {roof.obstacles.map(o=><g key={o.id} role="button" tabIndex={0} aria-label={`Select ${o.label}`} data-testid={`obstacle-${o.id}`}
                onKeyDown={e=>{if(e.key==="Enter"){setSelected(o.id);}if(e.key==="Delete"&&selected===o.id)remove();}}
                onPointerDown={e=>{e.stopPropagation();setSelected(o.id);if(tool!=="select")return;const p=point(e);drag.current={id:o.id,startX:p.x,startY:p.y,oldX:o.x,oldY:o.y,original:structuredClone(d),obstacle:true};svg.current?.setPointerCapture(e.pointerId);}}>
                <rect {...{x:o.x,y:o.y,width:o.width,height:o.height}} fill="#eee5d6" stroke={selected===o.id?"#0c7b58":"#9a805d"} strokeWidth={selected===o.id?".05":".025"}/>
                <rect {...{x:o.x,y:o.y,width:o.width,height:o.height}} fill="url(#obstacle-hatch)" pointerEvents="none"/>
                <text x={o.x+o.width/2} y={o.y+o.height/2+textUnit/3} fontSize={textUnit} textAnchor="middle" fill="#594b39" pointerEvents="none">OBS</text>
              </g>)}
              {roof.panels.map((p,i)=>{
                const wh=dims(p,mod),valid=validPlacement(roof,p,mod,d.gap);
                return <g key={p.id} role="button" tabIndex={0} aria-label={`Select module ${i+1}`} data-testid={`module-${i}`}
                  onKeyDown={e=>{if(e.key==="Enter")setSelected(p.id);if(selected===p.id){if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();remove();}const delta:Record<string,[number,number]>={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};if(delta[e.key]){e.preventDefault();moveSelected(p.x+delta[e.key][0],p.y+delta[e.key][1]);}}}}
                  onPointerDown={e=>{e.stopPropagation();setSelected(p.id);if(tool!=="select")return;const pos=point(e);drag.current={id:p.id,startX:pos.x,startY:pos.y,oldX:p.x,oldY:p.y,original:structuredClone(d),obstacle:false};svg.current?.setPointerCapture(e.pointerId);}}>
                  <rect x={p.x+.025} y={p.y+.04} {...wh} fill="#76868f" opacity=".25"/>
                  <rect x={p.x} y={p.y} {...wh} rx=".025" fill={valid?"#263c51":"#79433a"} stroke={selected===p.id?"#0b9e6b":"#a5b7c5"} strokeWidth={selected===p.id?".065":".025"}/>
                  <rect x={p.x+.035} y={p.y+.035} width={wh.width-.07} height={wh.height-.07} fill="url(#cells)" pointerEvents="none"/>
                  {labels&&<g pointerEvents="none"><rect x={p.x+wh.width/2-textUnit} y={p.y+wh.height/2-textUnit*.65} width={textUnit*2} height={textUnit*1.3} rx=".04" fill="#1e3040" opacity=".9"/><text x={p.x+wh.width/2} y={p.y+wh.height/2+textUnit/3} fontSize={textUnit} fill="#fff" textAnchor="middle">{String(i+1).padStart(2,"0")}</text></g>}
                </g>;
              })}
              <g stroke="#88999f" strokeWidth=".018" pointerEvents="none">
                <path d={`M0 -.3V-.7M${roof.width} -.3V-.7M0 -.55H${roof.width}`}/>
                <path d={`M-.3 0H-.7M-.3 ${roof.height}H-.7M-.55 0V${roof.height}`}/>
              </g>
              <text x={roof.width/2} y={-.7} fill="#52666c" fontSize={textUnit} textAnchor="middle">{roof.width.toFixed(2)} m</text>
              <text transform={`translate(-.8 ${roof.height/2}) rotate(-90)`} fill="#52666c" fontSize={textUnit} textAnchor="middle">{roof.height.toFixed(2)} m on slope</text>
              <text x={roof.width} y={roof.height+.65} fill="#52666c" fontSize={textUnit} textAnchor="end">{roof.setback.toFixed(2)} m clearance</text>
            </g>
          </svg>
        </div>
        <div className="canvas-footer"><span><span className="legend-module"/> PV module</span><span><span className="legend-obstacle"/> Obstruction</span><span className="canvas-hint">{tool==="panel"?"Click roof to place":tool==="obstacle"?"Click roof to add obstruction":"Select & drag · arrow keys move 0.1 m"}</span></div>
      </div>
      <div className="design-stats">
        <div><span>Array capacity</span><strong data-testid="capacity-value">{t.kwp.toFixed(2)} <small>kWp</small></strong></div>
        <div><span>Modules placed</span><strong data-testid="module-count">{t.count} <small>× {mod.watts} W</small></strong></div>
        <div><span>Roof-plane area</span><strong>{t.area.toFixed(1)} <small>m²</small></strong></div>
        <div><span>Module mass only</span><strong>{t.mass.toFixed(0)} <small>kg</small></strong></div>
      </div>
    </section>
    <aside className="properties">
      <div className="panel-heading"><h2>{obj?"Selection":"Roof properties"}</h2><span className="tiny-tag">{obj?panel?"MODULE":"OBSTRUCTION":roof.boundary?"POLYGON":"RECTANGULAR"}</span></div>
      {obj?<div className="property-body">
        <p className="muted">{panel?`Module ${roof.panels.findIndex(p=>p.id===selected)+1} · ${mod.watts} W`:obstacle?.label}</p>
        <div className="field-grid">
          <NumericField label="X position" suffix="m" value={obj.x} min={0} max={roof.width} step={.05} onChange={v=>moveSelected(v,obj.y)}/>
          <NumericField label="Y position" suffix="m" value={obj.y} min={0} max={roof.height} step={.05} onChange={v=>moveSelected(obj.x,v)}/>
        </div>
        {panel&&<button data-testid="rotate-module" className="button secondary full" onClick={()=>{const n={...panel,landscape:!panel.landscape};if(validPlacement(roof,n,mod,d.gap))patchRoof({panels:roof.panels.map(p=>p.id===selected?n:p)});else onNotice("Rotation needs more space. Move the module first.");}}><RotateCw size={15}/> Rotate module</button>}
        <button data-testid="delete-selection" className="button danger full" onClick={remove}><Trash2 size={15}/> Remove {panel?"module":"obstruction"}</button>
        <button data-testid="deselect-object" className="text-button full" onClick={()=>setSelected(null)}>Back to roof properties</button>
      </div>:<div className="property-body">
        <label className="field"><span>Roof name</span><input data-testid="roof-name" value={roof.name} maxLength={60} onChange={e=>patchRoof({name:e.target.value||"Roof"})}/></label>
        <fieldset className="field-grid" style={{border:0,padding:0,margin:0,minWidth:0}} disabled={!!roof.geo}>
          <NumericField label="Width" suffix="m" value={roof.width} min={2} max={80} onChange={v=>patchRoof({width:v})}/>
          <NumericField label="Slope length" suffix="m" value={roof.height} min={2} max={60} onChange={v=>patchRoof({height:v})}/>
          <NumericField label="Pitch" suffix="°" value={roof.pitch} min={0} max={75} step={1} onChange={v=>patchRoof({pitch:v})}/>
          <NumericField label="Azimuth" suffix="°" value={roof.azimuth} min={0} max={359} step={1} onChange={v=>patchRoof({azimuth:v})}/>
        </fieldset>
        {roof.geo&&<><p className="field-note">Mapped geometry is locked to its trace. Unlink before changing dimensions/pitch/azimuth; the polygon and modules remain intact.</p><button data-testid="unlink-map-roof" className="text-button full" onClick={()=>{patchRoof({geo:null});onNotice("Map reference removed; polygon and modules preserved. Undo restores the reference.");}}>Unlink map reference</button></>}
        {roof.boundary&&<button data-testid="convert-roof-rectangle" className="text-button full" onClick={()=>{if(!convert){setConvert(true);return;}patchRoof({boundary:null,geo:null});setConvert(false);onNotice("Roof converted to its rectangular bounds. This changes the usable roof shape. Undo restores the polygon.");}}>{convert?"Confirm remove polygon & map reference":"Convert to rectangular bounds"}</button>}
        <div className="field-grid">
          <NumericField label="Edge clearance" suffix="m" value={roof.setback} min={0} max={3} step={.05} onChange={v=>patchRoof({setback:v})}/>
          <NumericField label="Module gap" suffix="m" value={d.gap} min={.01} max={.5} step={.01} onChange={v=>commit({...d,gap:v})}/>
        </div>
        <div className="property-divider"/>
        <label className="field"><span>Module specification</span><select data-testid="design-module" value={d.moduleId} onChange={e=>commit({...d,moduleId:e.target.value as Design["moduleId"]})}>{modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <div className="orientation"><span>Placement orientation</span><div><button data-testid="orientation-portrait" aria-pressed={!landscape} className={!landscape?"active":""} onClick={()=>setLandscape(false)}>Portrait</button><button data-testid="orientation-landscape" aria-pressed={landscape} className={landscape?"active":""} onClick={()=>setLandscape(true)}>Landscape</button></div></div>
        <button data-testid="auto-fill" className="button primary full" onClick={autoFill}><Grid2X2 size={16}/> Auto-fill roof</button>
        <button data-testid="clear-roof" className="text-button full" disabled={!roof.panels.length} onClick={()=>{patchRoof({panels:[]});onNotice("Roof cleared. Undo restores the modules.");}}>Clear modules</button>
      </div>}
      <div className="properties-foot"><span className="small-dot"/> Dimensions are unverified inputs</div>
    </aside>
  </div>;
}
