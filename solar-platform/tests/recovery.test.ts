import {test} from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {mkdtempSync,statSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {Accounts} from "../server/accounts";
process.env.DATABASE_PATH=":memory:";
const {storage,sqlite}=await import("../server/storage");
const {batteryDefaults}=await import("../shared/energy-schema");
test("authenticated organisation lists are empty until projects are created",()=>{
  assert.deepEqual(storage.list("org:empty"),[]);
});
test("JSON import creates a new project and ignores supplied hardware limits",()=>{
  const source=storage.list("import-source")[0],d=structuredClone(source.design);
  d.catalogueSnapshot={version:"reference-v2",provenance:"unverified-reference",module:{...(awaitlessModule()),voc:1},inverter:awaitlessInverter()};
  const imported=storage.importProject("org:import-target","Imported QA",d);
  assert.notEqual(imported.id,source.id);assert.equal(imported.revision,1);assert.equal(imported.sample,false);
  assert.equal(imported.design.catalogueSnapshot!.module.voc,39.7);
  assert.equal(storage.get("import-source",imported.id),undefined);
});
function awaitlessModule(){return {id:"ref-440" as const,name:"untrusted",watts:440,width:1.134,height:1.762,mass:21,voc:39.7,vmp:33.2,isc:13.9,imp:13.25,betaVoc:-.0025,cost:75};}
function awaitlessInverter(){return {id:"ref-inv-5" as const,name:"untrusted",kw:5,phase:"Single phase" as const,cost:650,maxDc:600,mpptCount:2,inputsPerMppt:2,mpptMin:90,mpptMax:550,maxInputCurrent:16,maxInputIsc:20,maxMpptCurrent:30,maxMpptIsc:40};}
test("restore creates a new revision and exactly removes fields absent in history",()=>{
  const p=storage.list("restore-owner")[0],d=structuredClone(p.design);
  d.notes="Changed after baseline";d.intervalAnalysis={dataset:null,battery:batteryDefaults()};
  const saved=storage.save("restore-owner",p.id,1,d);
  const restored=storage.restore("restore-owner",p.id,1,saved.revision);
  assert.equal(restored.revision,3);assert.equal(restored.design.notes,p.design.notes);assert.equal(restored.design.intervalAnalysis,undefined);
  assert.equal(storage.listRevisions("restore-owner",p.id).length,3);
  assert.throws(()=>storage.restore("restore-owner",p.id,1,2),/newer/);
  assert.throws(()=>storage.restore("other-owner",p.id,1,3),/not found/);
  assert.throws(()=>storage.restore("restore-owner",p.id,999,3),/not found/);
});
test("backup script creates an integrity-checked copy and refuses to overwrite",()=>{
  const dir=mkdtempSync(join(tmpdir(),"solar-backup-")),source=join(dir,"source.db"),out=join(dir,"backup.db");
  const db=new Database(source);db.exec("CREATE TABLE proof(value TEXT); INSERT INTO proof VALUES('synthetic');");db.close();
  const options={env:{...process.env,DATABASE_PATH:source},encoding:"utf8" as const};
  const result=spawnSync(process.execPath,["script/backup.mjs",out],options);
  assert.equal(result.status,0,result.stderr);assert.equal(statSync(out).mode&0o777,0o600);
  const copy=new Database(out,{readonly:true});assert.equal((copy.prepare("SELECT value FROM proof").get() as any).value,"synthetic");copy.close();
  assert.notEqual(spawnSync(process.execPath,["script/backup.mjs",out],options).status,0);
  assert.equal(new Database(out,{readonly:true}).pragma("integrity_check",{simple:true}),"ok");
});
test("operator password recovery changes the hash, revokes sessions and does not print the password",async()=>{
  const dir=mkdtempSync(join(tmpdir(),"solar-recovery-")),file=join(dir,"accounts.db"),db=new Database(file),accounts=new Accounts(db);
  const actor=await accounts.setup({email:"operator-qa@example.test",password:"Old synthetic password 2026!",name:"Operator QA",organisation:"QA only"});
  const session=accounts.session(actor),replacement="Replacement synthetic password 2026!";
  const result=spawnSync(process.execPath,["script/reset-password.mjs",actor.email],{encoding:"utf8",env:{...process.env,DATABASE_PATH:file,SOLAR_RECOVERY_PASSWORD:replacement}});
  assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes(replacement));
  assert.equal(accounts.authenticate(session.token),null);assert.equal((await accounts.login(actor.email,replacement)).id,actor.id);
  assert.ok(accounts.events(actor).some((e:any)=>e.action==="password.operator-reset"));db.close();
});
