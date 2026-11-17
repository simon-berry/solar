import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, type CreateProject } from "@shared/schema";

export const money=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:2}).format(pence/100);
export function NumericField({label,value,onChange,suffix,min=0,max=100000,step=.1,disabled=false}:{
  label:string;value:number;onChange:(v:number)=>void;suffix?:string;min?:number;max?:number;step?:number;disabled?:boolean;
}){
  const [text,setText]=useState(String(value));
  useEffect(()=>setText(String(value)),[value]);
  return <label className="field"><span>{label}</span><div className="number-input">
    <input disabled={disabled} data-testid={`input-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g,"-")}`} type="number" inputMode="decimal" min={min} max={max} step={step} value={text}
      onChange={e=>setText(e.target.value)} onBlur={()=>{const n=Number(text);if(text!==""&&Number.isFinite(n)&&n>=min&&n<=max)onChange(n);else setText(String(value));}}
      onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/>
    {suffix&&<span>{suffix}</span>}
  </div></label>;
}
export function Notice({message,close}:{message:string;close:()=>void}){
  return <div className="notice" role="status" data-testid="workspace-notice"><AlertCircle size={16}/><span>{message}</span><button data-testid="close-notice" className="icon-button" aria-label="Dismiss notice" onClick={close}><X size={15}/></button></div>;
}
export function NewProject({open,onClose,onCreate,pending,error}:{open:boolean;onClose:()=>void;onCreate:(d:CreateProject)=>void;pending:boolean;error:string}){
  const form=useForm<CreateProject>({resolver:zodResolver(createProjectSchema),defaultValues:{name:"",customer:"",address:"",postcode:"",type:"Residential",nation:"England"}});
  useEffect(()=>{if(open)form.reset();},[open]);
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="solar-dialog">
    <DialogTitle>Create a project</DialogTitle><DialogDescription>Start with the site. Build the design next.</DialogDescription>
    <Form {...form}><form onSubmit={form.handleSubmit(onCreate)} className="project-form">
      {(["name","customer","address","postcode"] as const).map(key=><FormField key={key} control={form.control} name={key} render={({field})=><FormItem>
        <FormLabel>{({name:"Project name",customer:"Customer name",address:"Site address",postcode:"Postcode"})[key]}</FormLabel>
        <FormControl><input data-testid={`new-${key}`} placeholder={key==="name"?"e.g. Meadow View":key==="customer"?"Full name or company":key==="address"?"Street address":"e.g. PR7 1AA"} {...field}/></FormControl><FormMessage/>
      </FormItem>}/>)}
      <div className="field-grid">
        <FormField control={form.control} name="type" render={({field})=><FormItem><FormLabel>Project type</FormLabel><FormControl><select data-testid="new-type" {...field}><option>Residential</option><option>Commercial</option></select></FormControl></FormItem>}/>
        <FormField control={form.control} name="nation" render={({field})=><FormItem><FormLabel>Nation</FormLabel><FormControl><select data-testid="new-nation" {...field}>{["England","Wales","Scotland","Northern Ireland"].map(n=><option key={n}>{n}</option>)}</select></FormControl></FormItem>}/>
      </div>
      {error&&<p className="inline-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button data-testid="cancel-project" type="button" className="button secondary" onClick={onClose}>Cancel</button><button data-testid="submit-project" disabled={pending} className="button primary">{pending?"Creating…":"Create project"}</button></div>
    </form></Form>
  </DialogContent></Dialog>;
}
