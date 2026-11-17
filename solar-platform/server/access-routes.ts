import type {Express,Request,Response,NextFunction} from "express";
import {createHash,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {credentialsSchema,setupSchema,joinSchema,roleSchema,type Identity} from "@shared/access";
import {Accounts,AccessError} from "./accounts";
import {sqlite} from "./storage";

declare global{namespace Express{interface Request{solarVisitor:string;identity?:Identity;accessMode:"preview"|"accounts"}}}
export const accounts=new Accounts(sqlite);
export function registerAccess(app:Express){
  const mode=process.env.AUTH_MODE||(process.env.NODE_ENV==="production"?"accounts":"preview");
  if(!["accounts","preview"].includes(mode))throw Error("AUTH_MODE must be accounts or preview.");
  const production=process.env.NODE_ENV==="production";
  const originUrl=new URL(process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${process.env.PORT||5000}`);
  if(originUrl.pathname!=="/"||originUrl.search||originUrl.hash||originUrl.username||originUrl.password)throw Error("PUBLIC_ORIGIN must be a bare application origin, with no path or credentials.");
  const origin=originUrl.origin;
  if(mode==="accounts"){
    const url=new URL(origin);
    if(production&&(!process.env.PUBLIC_ORIGIN||url.protocol!=="https:"))throw Error("Account mode requires PUBLIC_ORIGIN=https://your-domain. Keep TLS at your reverse proxy.");
    if(!accounts.hasUsers()&&(process.env.SETUP_TOKEN?.length||0)<32)throw Error("Set a random SETUP_TOKEN of at least 32 characters before first account setup.");
  }
  const cookieName=production?"__Host-solar_session":"solar_session";
  const token=(req:Request)=>req.headers.cookie?.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1)||"";
  const cookie=(res:Response,value:string,maxAge=43200)=>res.setHeader("Set-Cookie",`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production?"; Secure":""}`);
  const establish=(res:Response,identity:Identity)=>{cookie(res,accounts.session(identity).token);res.json({identity});};
  const wrap=(fn:(req:Request,res:Response)=>unknown)=>(req:Request,res:Response,next:NextFunction)=>{
    Promise.resolve().then(()=>fn(req,res)).catch(e=>{
      if(e instanceof z.ZodError)return res.status(422).json({message:e.issues.map(i=>`${i.path.join(".")}: ${i.message}`).slice(0,3).join("; ")});
      if(e instanceof AccessError)return res.status(e.status).json({message:e.message});next(e);
    });
  };
  app.use("/api",(req,res,next)=>{
    req.accessMode=mode as "preview"|"accounts";
    res.setHeader("Cache-Control","private, no-store");res.setHeader("X-Content-Type-Options","nosniff");
    if(mode==="accounts"&&!["GET","HEAD","OPTIONS"].includes(req.method)){
      const supplied=req.get("origin");
      if((supplied&&supplied!==origin)||(!supplied&&token(req)))return res.status(403).json({message:"Request origin does not match the configured application origin."});
    }next();
  });
  app.get("/api/session",wrap((req,res)=>res.json({mode,identity:mode==="accounts"?accounts.authenticate(token(req)):null,setupAvailable:mode==="accounts"&&!accounts.hasUsers()&&!!process.env.SETUP_TOKEN})));
  app.use("/api/auth",(req,res,next)=>mode==="accounts"?next():res.status(404).json({message:"Account endpoints are disabled in the synthetic-data preview."}));
  app.post("/api/auth/setup",wrap(async(req,res)=>{
    accounts.rateLimit(`setup:${req.ip}`,5);const input=setupSchema.parse(req.body);
    const expected=createHash("sha256").update(process.env.SETUP_TOKEN||"").digest(),actual=createHash("sha256").update(input.setupToken).digest();
    if(!process.env.SETUP_TOKEN||!timingSafeEqual(expected,actual))throw new AccessError("Setup token is incorrect.",403);
    establish(res,await accounts.setup(input));
  }));
  app.post("/api/auth/login",wrap(async(req,res)=>{
    accounts.rateLimit(`login-ip:${req.ip}`,100);
    const input=credentialsSchema.parse(req.body);accounts.rateLimit(`login-email:${input.email}`,10);
    establish(res,await accounts.login(input.email,input.password));
  }));
  app.post("/api/auth/join",wrap(async(req,res)=>{
    accounts.rateLimit(`join:${req.ip}`,50);establish(res,await accounts.join(joinSchema.parse(req.body)));
  }));
  app.post("/api/auth/logout",wrap((req,res)=>{accounts.logout(token(req));cookie(res,"",0);res.json({ok:true});}));
  app.use("/api",(req,res,next)=>{
    if(mode==="accounts"){
      const identity=accounts.authenticate(token(req));
      if(!identity)return res.status(401).json({message:"Sign in to your organisation to continue."});
      req.identity=identity;req.solarVisitor=`org:${identity.orgId}`;
    }else{
      const visitor=req.get("x-visitor-id");
      if(visitor?.startsWith("org:"))return res.status(403).json({message:"Preview visitor scope cannot access organisation records."});
      if(visitor&&visitor.length<=256)req.solarVisitor=visitor;
      else if(!production&&["127.0.0.1","localhost"].includes(req.hostname))req.solarVisitor="local-development";
      else return res.status(401).json({message:"Open the private preview through its app viewer."});
    }next();
  });
  const actor=(req:Request)=>{if(!req.identity)throw new AccessError("Account management is unavailable in preview mode.",403);return req.identity;};
  app.get("/api/account",wrap((req,res)=>{const a=actor(req);res.json({identity:a,members:accounts.members(a),invitations:a.role==="admin"?accounts.invitations(a):[],events:a.role==="admin"?accounts.events(a):[]});}));
  app.post("/api/account/invitations",wrap((req,res)=>{const input=z.object({email:z.string().trim().email().max(254),role:roleSchema}).parse(req.body);res.status(201).json(accounts.invite(actor(req),input.email,input.role));}));
  app.post("/api/account/invitations/:id/revoke",wrap((req,res)=>{accounts.revokeInvitation(actor(req),String(req.params.id));res.json({ok:true});}));
  app.put("/api/account/members/:id",wrap((req,res)=>{const b=z.object({role:roleSchema,active:z.boolean()}).parse(req.body);accounts.changeMember(actor(req),String(req.params.id),b.role,b.active);res.json({ok:true});}));
  app.post("/api/account/password",wrap(async(req,res)=>{const b=z.object({current:z.string().max(128),password:credentialsSchema.shape.password}).parse(req.body);await accounts.changePassword(actor(req),b.current,b.password);cookie(res,"",0);res.json({ok:true});}));
  return mode;
}
