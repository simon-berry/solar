import {Plus,Trash2,FileText} from "lucide-react";
import type {Design} from "@shared/schema";
import {proposalDefaults,type ProposalDetails,type QuoteItem,quoteLinePence} from "@shared/quote-schema";
import {NumericField,money} from "./solar-ui";

export function ProposalDetailsEditor({d,change}:{d:Design;change:(d:Design)=>void}){
  const p=d.pricing.proposal;
  const update=(value:ProposalDetails|null)=>change({...d,pricing:{...d.pricing,proposal:value}});
  if(!p)return <section className="content-panel"><div className="panel-heading"><h2>Customer-facing proposal</h2><FileText size={17}/></div><div className="content-body form-stack"><p className="field-note">Add installer branding, explicit scope and itemised commercial extras or optional items. Existing proposals remain unchanged; no contract acceptance or installation approval is created.</p><button data-testid="enable-proposal-details" className="button secondary" onClick={()=>update(proposalDefaults())}>Set up branded proposal</button></div></section>;
  const patch=(x:Partial<ProposalDetails>)=>update({...p,...x});
  const item=(index:number,x:Partial<QuoteItem>)=>patch({items:p.items.map((v,i)=>i===index?{...v,...x}:v)});
  const text=(key:"companyName"|"companyAddress"|"email"|"phone"|"website"|"companyNumber"|"vatNumber"|"reference"|"preparedBy"|"includedScope"|"excludedScope",label:string,max:number,area=false)=><label className="field" key={key}><span>{label}</span>{area?<textarea data-testid={`proposal-${key}`} rows={key.endsWith("Scope")?4:3} maxLength={max} value={p[key]} onChange={e=>patch({[key]:e.target.value})}/>:<input data-testid={`proposal-${key}`} type={key==="email"?"email":key==="website"?"url":"text"} maxLength={max} value={p[key]} onChange={e=>patch({[key]:e.target.value})}/>}</label>;
  return <section className="content-panel proposal-editor"><div className="panel-heading"><h2>Customer-facing proposal</h2><span className="tiny-tag">FROZEN ON ISSUE</span></div><div className="content-body form-stack">
    <div className="proposal-brand-preview" style={{borderTopColor:p.accent}}><strong>{p.companyName||"Your company"}</strong><span>Preliminary solar proposal</span><small>{p.reference||"Reference assigned on issue"} · No contract acceptance</small></div>
    <div className="field-grid">{text("companyName","Installer / company name (required for branded PDF)",120)}{text("preparedBy","Prepared by",120)}{text("reference","Your quote reference",80)}<NumericField label="Estimate review period" suffix="days" value={p.validDays} min={1} max={180} step={1} onChange={v=>patch({validDays:Math.round(v)})}/></div>
    {!p.companyName.trim()&&<p className="inline-error" role="alert">Enter the installer/company name before issuing a branded proposal.</p>}
    {text("companyAddress","Installer postal address",800,true)}
    <div className="field-grid">{text("email","Installer contact email",254)}{text("phone","Installer contact phone",60)}{text("website","Installer website (HTTPS)",300)}<label className="field"><span>Proposal accent colour</span><input data-testid="proposal-accent" type="color" value={p.accent} onChange={e=>patch({accent:e.target.value})}/></label>{text("companyNumber","Company registration number (declared)",60)}{text("vatNumber","VAT registration number (declared)",60)}</div>
    <p className="field-note">These are declared installer details, not independently verified company or accreditation records. Light accent colours use dark PDF text for legibility. The review period is a reminder to revisit an estimate, not a contractual offer period.</p>
    <div className="property-divider"/>
    {text("includedScope","Expressly included scope",4000,true)}
    {text("excludedScope","Exclusions, assumptions and unresolved scope",4000,true)}
    <div className="panel-heading quote-items-heading"><h3>Additional and optional items</h3><button data-testid="add-quote-item" className="button secondary" disabled={p.items.length>=40} onClick={()=>patch({items:[...p.items,{id:crypto.randomUUID(),description:"Additional item",quantity:1,unit:"item",unitPrice:0,included:true}]})}><Plus size={15}/>Add item</button></div>
    <p className="field-note">Up to 40 items. Unit prices use whole pennies; quantities support three decimal places. Each included line rounds once, with the same manually selected VAT rate as the base quote. Optional amounts are pre-VAT and excluded from the total.</p>
    {p.items.map((row,index)=><div className="quote-item-editor" data-testid={`quote-item-${index}`} key={row.id}>
      <div className="quote-item-heading"><strong>Item {index+1}</strong><button data-testid={`remove-quote-item-${index}`} className="icon-button" aria-label={`Remove quote item ${index+1}`} onClick={()=>patch({items:p.items.filter(v=>v.id!==row.id)})}><Trash2 size={16}/></button></div>
      <label className="field"><span>Description / declared equipment and scope</span><input data-testid={`quote-item-description-${index}`} maxLength={240} value={row.description} onChange={e=>item(index,{description:e.target.value})}/></label>
      <div className="field-grid"><NumericField label={`Item ${index+1} quantity`} value={row.quantity} min={.001} max={10000} step={.001} onChange={v=>item(index,{quantity:Math.round(v*1000)/1000})}/><label className="field"><span>Unit</span><select aria-label={`Item ${index+1} unit`} value={row.unit} onChange={e=>item(index,{unit:e.target.value as QuoteItem["unit"]})}>{["item","m","m²","hour","day","kW","kWh"].map(u=><option key={u}>{u}</option>)}</select></label><NumericField label={`Item ${index+1} unit price`} suffix="£" value={row.unitPrice} min={0} max={100000} step={.01} onChange={v=>item(index,{unitPrice:Math.round(v*100)/100})}/><div className="quote-item-amount"><span>Pre-VAT line amount</span><strong>{money(quoteLinePence(row.quantity,Math.round(row.unitPrice*100)))}</strong></div></div>
      <label className="energy-confirm"><input data-testid={`quote-item-included-${index}`} type="checkbox" checked={row.included} onChange={e=>item(index,{included:e.target.checked})}/>Include in estimate total {row.included?"":"(optional, excluded)"}</label>
    </div>)}
    {!p.items.length&&<p className="field-note">No additional items. Base hardware and installation allowances are still shown above.</p>}
    <div className="info-box"><FileText size={17}/><p>Commercial lines do not define or extend the engineering design. Explicit storage pricing does not verify battery compatibility or installation scope, and optional items are not silently added. Obtain a revised engineering assessment for any actual system change.</p></div>
    <button data-testid="clear-proposal-details" className="text-button" onClick={()=>update(null)}>Remove branding and additional items from this draft</button>
  </div></section>;
}
