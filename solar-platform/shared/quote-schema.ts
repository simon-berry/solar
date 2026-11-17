import {z} from "zod";
const precise=(digits:number)=>(v:number)=>Math.abs(v*10**digits-Math.round(v*10**digits))<1e-6;
export const quoteItemSchema=z.object({
  id:z.string().min(1).max(80),
  description:z.string().trim().min(1).max(240),
  quantity:z.number().finite().min(.001).max(10000).refine(precise(3),"Use at most three decimal places."),
  unit:z.enum(["item","m","m²","hour","day","kW","kWh"]),
  unitPrice:z.number().finite().min(0).max(100000).refine(precise(2),"Use whole pennies."),
  included:z.boolean(),
});
export const proposalDetailsSchema=z.object({
  companyName:z.string().max(120),companyAddress:z.string().max(800),
  email:z.union([z.literal(""),z.string().email().max(254)]),
  phone:z.string().max(60),
  website:z.union([z.literal(""),z.string().url().max(300).refine(v=>new URL(v).protocol==="https:","Use an HTTPS website URL.")]),
  companyNumber:z.string().max(60),vatNumber:z.string().max(60),
  accent:z.string().regex(/^#[0-9a-fA-F]{6}$/,"Use a six-digit hex colour."),
  reference:z.string().max(80),preparedBy:z.string().max(120),
  validDays:z.number().int().min(1).max(180),
  includedScope:z.string().max(4000),excludedScope:z.string().max(4000),
  items:z.array(quoteItemSchema).max(40).refine(items=>new Set(items.map(i=>i.id)).size===items.length,"Each quote item needs a unique ID."),
});
export type ProposalDetails=z.infer<typeof proposalDetailsSchema>;
export type QuoteItem=z.infer<typeof quoteItemSchema>;
export const proposalDefaults=():ProposalDetails=>({
  companyName:"",companyAddress:"",email:"",phone:"",website:"",companyNumber:"",vatNumber:"",
  accent:"#176944",reference:"",preparedBy:"",validDays:30,includedScope:"",excludedScope:"",items:[],
});
// Integer milliunits avoid binary-float half-penny errors (e.g. 1.005 × £1).
export const quoteLinePence=(quantity:number,unitPence:number)=>Math.floor((Math.round(quantity*1000)*unitPence+500)/1000);
export function proposalInk(colour:string){
  const channels=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const light=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  return Number.isFinite(light)&&1.05/(light+.05)>=4.5?colour:"#203a2c";
}
export type QuoteLine={id:string;name:string;quantity:number;unit:string;unitPence:number;amountPence:number};
export type QuoteReport={
  methodVersion:"itemised-quote-v1";currency:"GBP";lines:QuoteLine[];optionalLines:QuoteLine[];
  netPence:number;vatRate:"0"|"5"|"20";vatPence:number;totalPence:number;taxBasis:string;
  presentation:ProposalDetails|null;
};
