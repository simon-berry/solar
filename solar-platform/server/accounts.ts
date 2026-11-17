import type Database from "better-sqlite3";
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from "node:crypto";
import type {Identity,Role} from "@shared/access";

const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
const nonce=()=>randomBytes(32).toString("base64url");
export class AccessError extends Error{constructor(message:string,public status=400){super(message);}}
export async function passwordHash(password:string){
  const salt=randomBytes(16).toString("hex"),key=await derive(password,salt);
  return `scrypt$32768$8$3$${salt}$${key.toString("hex")}`;
}
export async function passwordMatches(password:string,stored:string){
  const [,n,r,p,salt,hex]=stored.split("$");
  if(n!=="32768"||r!=="8"||p!=="3"||!/^[a-f0-9]{32}$/.test(salt||""))return false;
  const key=await derive(password,salt);
  return hex.length===128&&timingSafeEqual(key,Buffer.from(hex,"hex"));
}
type UserRow=Identity&{password:string;active:number};
export class Accounts{
  constructor(public db:Database.Database,private clock=()=>Date.now()){
    // Migration 004 is additive. No existing project/revision/issue data is touched.
    db.exec(`
      CREATE TABLE IF NOT EXISTS solar_organisations(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS solar_users(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES solar_organisations(id),email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL,password TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS solar_sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES solar_users(id),expires INTEGER NOT NULL,created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user ON solar_sessions(user_id);
      CREATE TABLE IF NOT EXISTS solar_invitations(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES solar_organisations(id),email TEXT NOT NULL,role TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS solar_auth_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS solar_audit(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL);
    `);
  }
  private now(){return new Date(this.clock()).toISOString();}
  private find(email:string){return this.db.prepare("SELECT u.id,u.org_id orgId,u.email,u.name,u.role,u.password,u.active,o.name orgName FROM solar_users u JOIN solar_organisations o ON o.id=u.org_id WHERE u.email=?").get(email.toLowerCase()) as UserRow|undefined;}
  publicIdentity(u:UserRow):Identity{return{id:u.id,email:u.email,name:u.name,role:u.role,orgId:u.orgId,orgName:u.orgName};}
  hasUsers(){return !!this.db.prepare("SELECT 1 FROM solar_users LIMIT 1").get();}
  audit(actor:Identity,action:string,target:string){this.db.prepare("INSERT INTO solar_audit VALUES(?,?,?,?,?,?)").run(randomUUID(),actor.orgId,actor.id,action,target,this.now());}
  rateLimit(key:string,max=10){
    const hash=digest(key),now=this.clock();
    const row=this.db.prepare("SELECT count,expires FROM solar_auth_limits WHERE key=?").get(hash) as {count:number;expires:number}|undefined;
    if(row&&row.expires>now&&row.count>=max)throw new AccessError("Too many attempts. Try again in 15 minutes.",429);
    this.db.prepare("INSERT INTO solar_auth_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END").run(hash,now+900000,now,now);
    this.db.prepare("DELETE FROM solar_auth_limits WHERE expires<?").run(now-900000);
  }
  async setup(input:{email:string;password:string;name:string;organisation:string}){
    const password=await passwordHash(input.password);
    return this.db.transaction(()=>{
      if(this.hasUsers())throw new AccessError("Initial setup has already been completed.",409);
      const orgId=randomUUID(),id=randomUUID();
      this.db.prepare("INSERT INTO solar_organisations VALUES(?,?,?)").run(orgId,input.organisation,this.now());
      this.db.prepare("INSERT INTO solar_users(id,org_id,email,name,role,password,created_at) VALUES(?,?,?,?,?,?,?)").run(id,orgId,input.email.toLowerCase(),input.name,"admin",password,this.now());
      const actor=this.publicIdentity(this.find(input.email)!);this.audit(actor,"workspace.created",orgId);return actor;
    })();
  }
  async login(email:string,password:string){
    const user=this.find(email);
    // Unknown emails still incur the same KDF cost; no account-enumeration message.
    const stored=user?.password||"scrypt$32768$8$3$00000000000000000000000000000000$"+"0".repeat(128);
    const valid=await passwordMatches(password,stored);
    if(!user||!user.active||!valid)throw new AccessError("Email or password is incorrect.",401);
    const identity=this.publicIdentity(user);this.audit(identity,"session.login",identity.id);return identity;
  }
  session(identity:Identity){
    const token=nonce(),now=this.clock(),expires=now+12*3600000;
    this.db.prepare("DELETE FROM solar_sessions WHERE expires<=?").run(now);
    this.db.prepare("INSERT INTO solar_sessions VALUES(?,?,?,?)").run(digest(token),identity.id,expires,now);
    this.db.prepare("DELETE FROM solar_sessions WHERE user_id=? AND hash NOT IN (SELECT hash FROM solar_sessions WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 10)").run(identity.id,identity.id);
    return {token,expires};
  }
  authenticate(token:string):Identity|null{
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const user=this.db.prepare("SELECT u.id,u.org_id orgId,u.email,u.name,u.role,u.active,u.password,o.name orgName FROM solar_sessions s JOIN solar_users u ON u.id=s.user_id JOIN solar_organisations o ON o.id=u.org_id WHERE s.hash=? AND s.expires>? AND u.active=1").get(digest(token),this.clock()) as UserRow|undefined;
    return user?this.publicIdentity(user):null;
  }
  logout(token:string){this.db.prepare("DELETE FROM solar_sessions WHERE hash=?").run(digest(token));}
  members(actor:Identity){return this.db.prepare("SELECT id,email,name,role,active,created_at createdAt FROM solar_users WHERE org_id=? ORDER BY name").all(actor.orgId);}
  invitations(actor:Identity){this.admin(actor);return this.db.prepare("SELECT id,email,role,expires,used FROM solar_invitations WHERE org_id=? ORDER BY expires DESC").all(actor.orgId);}
  private admin(actor:Identity){if(actor.role!=="admin")throw new AccessError("Administrator permission required.",403);}
  invite(actor:Identity,email:string,role:Role){
    this.admin(actor);email=email.toLowerCase();
    if(this.find(email))throw new AccessError("That email already belongs to an account.",409);
    const id=randomUUID(),token=nonce(),expires=this.clock()+48*3600000;
    this.db.prepare("INSERT INTO solar_invitations VALUES(?,?,?,?,?,?,0,?)").run(id,actor.orgId,email,role,digest(token),expires,actor.id);
    this.audit(actor,"member.invited",id);return{id,token,expires,email,role};
  }
  revokeInvitation(actor:Identity,id:string){
    this.admin(actor);const changed=this.db.prepare("UPDATE solar_invitations SET used=1 WHERE id=? AND org_id=? AND used=0").run(id,actor.orgId);
    if(!changed.changes)throw new AccessError("Active invitation not found.",404);
    this.audit(actor,"invitation.revoked",id);
  }
  async join(input:{email:string;password:string;name:string;token:string}){
    const password=await passwordHash(input.password);
    return this.db.transaction(()=>{
      const row=this.db.prepare("SELECT id,org_id orgId,email,role FROM solar_invitations WHERE hash=? AND expires>? AND used=0").get(digest(input.token),this.clock()) as {id:string;orgId:string;email:string;role:Role}|undefined;
      if(!row||row.email!==input.email.toLowerCase())throw new AccessError("Invitation is invalid, expired, used or for a different email.",422);
      if(this.find(input.email))throw new AccessError("Invitation cannot be accepted by an existing account.",409);
      const id=randomUUID();
      this.db.prepare("INSERT INTO solar_users(id,org_id,email,name,role,password,created_at) VALUES(?,?,?,?,?,?,?)").run(id,row.orgId,row.email,input.name,row.role,password,this.now());
      this.db.prepare("UPDATE solar_invitations SET used=1 WHERE id=?").run(row.id);
      const actor=this.publicIdentity(this.find(input.email)!);this.audit(actor,"member.joined",id);return actor;
    })();
  }
  changeMember(actor:Identity,id:string,role:Role,active:boolean){
    this.admin(actor);
    this.db.transaction(()=>{
      const target=this.db.prepare("SELECT role,active FROM solar_users WHERE org_id=? AND id=?").get(actor.orgId,id) as {role:Role;active:number}|undefined;
      if(!target)throw new AccessError("Member not found.",404);
      if(target.role==="admin"&&target.active&&(!active||role!=="admin")){
        const count=this.db.prepare("SELECT count(*) n FROM solar_users WHERE org_id=? AND role='admin' AND active=1").get(actor.orgId) as {n:number};
        if(count.n<=1)throw new AccessError("Keep at least one active administrator.",422);
      }
      this.db.prepare("UPDATE solar_users SET role=?,active=? WHERE id=? AND org_id=?").run(role,active?1:0,id,actor.orgId);
      this.db.prepare("DELETE FROM solar_sessions WHERE user_id=?").run(id);
      this.audit(actor,"member.updated",id);
    })();
  }
  async changePassword(actor:Identity,current:string,next:string){
    const user=this.find(actor.email)!;
    if(!await passwordMatches(current,user.password))throw new AccessError("Current password is incorrect.",401);
    const hash=await passwordHash(next);
    this.db.transaction(()=>{
      const changed=this.db.prepare("UPDATE solar_users SET password=? WHERE id=? AND password=?").run(hash,actor.id,user.password);
      if(!changed.changes)throw new AccessError("Password changed elsewhere. Sign in again before retrying.",409);
      this.db.prepare("DELETE FROM solar_sessions WHERE user_id=?").run(actor.id);this.audit(actor,"password.changed",actor.id);
    })();
  }
  events(actor:Identity){this.admin(actor);return this.db.prepare("SELECT action,target,actor,created_at createdAt FROM solar_audit WHERE org_id=? ORDER BY created_at DESC LIMIT 100").all(actor.orgId);}
}
