import {test} from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {Accounts,passwordHash,passwordMatches} from "../server/accounts";
const password="Synthetic QA password 4! only";
async function fixture(){
  let now=Date.now();const db=new Database(":memory:");db.pragma("foreign_keys=ON");
  const accounts=new Accounts(db,()=>now),admin=await accounts.setup({email:"admin@example.test",password,name:"QA Admin",organisation:"Synthetic Ltd"});
  return{accounts,db,admin,advance:(ms:number)=>{now+=ms;}};
}
test("passwords use salted hashes and compare without exposing raw credentials",async()=>{
  const a=await passwordHash(password),b=await passwordHash(password);
  assert.notEqual(a,b);assert.ok(!a.includes(password));assert.ok(await passwordMatches(password,a));assert.equal(await passwordMatches("different password",a),false);
});
test("initial setup is one-time and users expose only a public identity",async()=>{
  const {accounts,admin}=await fixture();assert.equal(admin.role,"admin");
  await assert.rejects(accounts.setup({email:"other@example.test",password,name:"Other",organisation:"Other"}),/already/);
  assert.equal((admin as any).password,undefined);assert.equal((await accounts.login(admin.email,password)).orgId,admin.orgId);
  await assert.rejects(accounts.login("missing@example.test",password),/Email or password/);
  await assert.rejects(accounts.login(admin.email,"incorrect password"),/Email or password/);
});
test("session proofs are stored hashed and logout/expiry revoke access",async()=>{
  const {accounts,admin,db,advance}=await fixture(),session=accounts.session(admin);
  assert.equal(accounts.authenticate(session.token)!.id,admin.id);
  assert.notEqual((db.prepare("SELECT hash FROM solar_sessions").get() as {hash:string}).hash,session.token);
  accounts.logout(session.token);assert.equal(accounts.authenticate(session.token),null);
  const next=accounts.session(admin);advance(12*3600000+1);assert.equal(accounts.authenticate(next.token),null);
});
test("session cap retains the ten newest proofs even with equal timestamps",async()=>{
  const {accounts,admin,db}=await fixture(),sessions=Array.from({length:12},()=>accounts.session(admin));
  assert.equal((db.prepare("SELECT count(*) n FROM solar_sessions").get() as {n:number}).n,10);
  assert.equal(accounts.authenticate(sessions[0].token),null);assert.equal(accounts.authenticate(sessions[1].token),null);
  assert.equal(accounts.authenticate(sessions[11].token)!.id,admin.id);
});
test("invitations bind role, email and organisation, and cannot be replayed",async()=>{
  const {accounts,admin,db}=await fixture(),invite=accounts.invite(admin,"designer@example.test","designer");
  assert.notEqual((db.prepare("SELECT hash FROM solar_invitations").get() as {hash:string}).hash,invite.token);
  await assert.rejects(accounts.join({token:invite.token,email:"wrong@example.test",password,name:"Wrong"}),/different email/);
  const member=await accounts.join({token:invite.token,email:invite.email,password,name:"Designer"});
  assert.equal(member.orgId,admin.orgId);assert.equal(member.role,"designer");
  await assert.rejects(accounts.join({token:invite.token,email:invite.email,password,name:"Replay"}),/invalid/);
  assert.throws(()=>accounts.invite(member,"another@example.test","admin"),/Administrator/);
  assert.throws(()=>accounts.events(member),/Administrator/);
});
test("expired and revoked invitations cannot create accounts",async()=>{
  const {accounts,admin,advance}=await fixture(),a=accounts.invite(admin,"expired@example.test","read-only");
  advance(48*3600000+1);await assert.rejects(accounts.join({token:a.token,email:a.email,password,name:"Expired"}),/expired/);
  const b=accounts.invite(admin,"revoked@example.test","reviewer");accounts.revokeInvitation(admin,b.id);
  await assert.rejects(accounts.join({token:b.token,email:b.email,password,name:"Revoked"}),/invalid/);
});
test("member role/status changes revoke sessions and final administrator is protected",async()=>{
  const {accounts,admin}=await fixture();
  assert.throws(()=>accounts.changeMember(admin,admin.id,"designer",true),/at least one/);
  assert.throws(()=>accounts.changeMember(admin,admin.id,"admin",false),/at least one/);
  const invite=accounts.invite(admin,"estimator@example.test","estimator"),member=await accounts.join({...invite,password,name:"Estimator"});
  const session=accounts.session(member);
  accounts.changeMember(admin,member.id,"read-only",true);assert.equal(accounts.authenticate(session.token),null);
  const latest=await accounts.login(member.email,password);assert.equal(latest.role,"read-only");
  accounts.changeMember(admin,member.id,"read-only",false);await assert.rejects(accounts.login(member.email,password),/incorrect/);
});
test("password change invalidates all sessions and old password",async()=>{
  const {accounts,admin}=await fixture(),session=accounts.session(admin);
  await assert.rejects(accounts.changePassword(admin,"wrong password",password),/incorrect/);
  await accounts.changePassword(admin,password,"Different synthetic password 5!");
  assert.equal(accounts.authenticate(session.token),null);await assert.rejects(accounts.login(admin.email,password),/incorrect/);
  assert.equal((await accounts.login(admin.email,"Different synthetic password 5!")).id,admin.id);
});
test("persistent rate limits reject excess attempts and expire",async()=>{
  const {accounts,advance}=await fixture();
  for(let i=0;i<3;i++)accounts.rateLimit("synthetic-ip",3);
  assert.throws(()=>accounts.rateLimit("synthetic-ip",3),e=>(e as any).status===429);
  advance(900001);assert.doesNotThrow(()=>accounts.rateLimit("synthetic-ip",3));
});
test("tenant membership and audit queries never include another organisation",async()=>{
  const {accounts,admin,db}=await fixture();
  db.prepare("INSERT INTO solar_organisations VALUES('other','Other','now')").run();
  db.prepare("INSERT INTO solar_users VALUES('other-user','other','other@example.test','Other','admin',?,1,'now')").run(await passwordHash(password));
  const other=await accounts.login("other@example.test",password);
  assert.equal(accounts.members(admin).length,1);assert.equal(accounts.members(other).length,1);
  assert.throws(()=>accounts.changeMember(admin,other.id,"designer",true),/not found/);
  assert.ok(accounts.events(admin).every((e:any)=>e.target!==other.id));
});
