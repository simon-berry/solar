import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,statSync,symlinkSync,existsSync,chmodSync} from "node:fs";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";

const script=resolve("script/self-host.sh");
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),"solar-selfhost-")),bin=join(dir,"bin"),log=join(dir,"commands.log");
  mkdirSync(bin);
  writeFileSync(join(bin,"docker"),`#!/usr/bin/env bash
printf '%s ' "$@" >> "$MOCK_LOG"
printf 'env-token:%s\\n' "\${SOLAR_SETUP_TOKEN-UNSET}" >> "$MOCK_LOG"
if [[ " $* " == *" exec -T solar node "* ]]; then exit "\${MOCK_ADMIN_EXIT:-0}"; fi
`,{mode:0o700});
  const env={...process.env,SOLAR_CONFIG_DIRECTORY:dir,MOCK_LOG:log,PATH:`${bin}:${process.env.PATH}`,SOLAR_SETUP_TOKEN:"must-not-override-the-file"};
  const run=(args:string[],extra:Record<string,string>={})=>spawnSync("bash",[script,...args],{env:{...env,...extra},encoding:"utf8"});
  return {dir,env,log,run,file:join(dir,".env.selfhost")};
}
test("self-host configure creates a private local token without printing it or overwriting",()=>{
  const f=fixture(),r=f.run(["configure","--domain","SOLAR.example.test","--proxy","caddy"]);
  assert.equal(r.status,0,r.stderr);
  const content=readFileSync(f.file,"utf8"),token=content.match(/SOLAR_SETUP_TOKEN=([a-f0-9]{64})/)![1];
  assert.ok(content.includes("SOLAR_PUBLIC_ORIGIN=https://solar.example.test"));
  assert.equal(statSync(f.file).mode&0o777,0o600);
  assert.ok(!r.stdout.includes(token)&&!r.stderr.includes(token));
  assert.notEqual(f.run(["configure","--domain","different.example.test"]).status,0);
  assert.equal(readFileSync(f.file,"utf8"),content);
});
test("optional map settings remain private, validated and do not require new keys in old configs",()=>{
  const f=fixture();assert.equal(f.run(["configure","--domain","solar.example.test"]).status,0);
  const original=readFileSync(f.file,"utf8");
  writeFileSync(f.file,original+"SOLAR_MAPS_ENABLED=true\nSOLAR_ADDRESS_SEARCH_ENABLED=false\nSOLAR_PHOTON_URL=https://photon.example.test/api/\nSOLAR_MAP_STYLE_URL=https://maps.example.test/style.json\nSOLAR_MAPTILER_API_KEY=SYNTHETIC_ONLY_QA_KEY\n",{mode:0o600});
  const result=f.run(["check"]);assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes("SYNTHETIC_ONLY"));
  writeFileSync(f.file,original+"SOLAR_PHOTON_URL=https://user:password@example.test/api/\n",{mode:0o600});assert.notEqual(f.run(["check"]).status,0);
  writeFileSync(f.file,original+"SOLAR_MAPS_ENABLED=maybe\n",{mode:0o600});assert.notEqual(f.run(["check"]).status,0);
});
test("self-host configure rejects URLs, shell content, invalid ports, projects and proxy modes",()=>{
  const cases=[
    ["--domain","https://solar.example.test"],
    ["--domain","bad.example.test\nSOLAR_SETUP_TOKEN=bad"],
    ["--domain","solar.example.test","--port","80"],
    ["--domain","solar.example.test","--port","65536"],
    ["--domain","solar.example.test","--project","../../other"],
    ["--domain","solar.example.test","--proxy","unknown"],
  ];
  for(const args of cases){const f=fixture();assert.notEqual(f.run(["configure",...args]).status,0);assert.equal(existsSync(f.file),false);}
});
test("self-host rejects symlinked configuration and insecure file permissions",()=>{
  const f=fixture(),target=join(f.dir,"target");writeFileSync(target,"untouched",{mode:0o600});symlinkSync(target,f.file);
  assert.notEqual(f.run(["configure","--domain","solar.example.test"]).status,0);
  assert.notEqual(f.run(["check"]).status,0);assert.equal(readFileSync(target,"utf8"),"untouched");
  const g=fixture();assert.equal(g.run(["configure","--domain","solar.example.test"]).status,0);
  chmodSync(g.file,0o644);assert.notEqual(g.run(["check"]).status,0);assert.equal(existsSync(g.log),false);
});
test("self-host configuration is never evaluated as shell content",()=>{
  const f=fixture();assert.equal(f.run(["configure","--domain","solar.example.test"]).status,0);
  const proof=join(f.dir,"must-not-exist");
  writeFileSync(f.file,readFileSync(f.file,"utf8")+`$(touch ${proof})=bad\n`,{mode:0o600});
  assert.notEqual(f.run(["check"]).status,0);assert.equal(existsSync(proof),false);assert.equal(existsSync(f.log),false);
});
test("self-host uses explicit Compose identity/files and clears inherited bootstrap overrides",()=>{
  const f=fixture();assert.equal(f.run(["configure","--domain","solar.example.test","--proxy","caddy","--port","5055","--project","my-solar"]).status,0);
  assert.equal(f.run(["check"]).status,0);
  const commands=readFileSync(f.log,"utf8");
  assert.ok(commands.includes("--project-name my-solar"));assert.ok(commands.includes("compose.https.yaml"));assert.ok(commands.includes("config --quiet"));
  assert.ok(commands.includes("env-token:UNSET"));assert.ok(!commands.includes(f.env.SOLAR_SETUP_TOKEN));
  const g=fixture();assert.equal(g.run(["configure","--domain","solar.example.test"]).status,0);
  assert.equal(g.run(["check"]).status,0);assert.ok(!readFileSync(g.log,"utf8").includes("compose.https.yaml"));
});
test("self-host finish-setup requires a verified admin and then removes the local bootstrap secret",()=>{
  const f=fixture();assert.equal(f.run(["configure","--domain","solar.example.test"]).status,0);
  const before=readFileSync(f.file,"utf8"),token=before.match(/SOLAR_SETUP_TOKEN=([a-f0-9]{64})/)![1];
  assert.notEqual(f.run(["finish-setup"],{MOCK_ADMIN_EXIT:"2"}).status,0);
  assert.equal(readFileSync(f.file,"utf8"),before);
  const finished=f.run(["finish-setup"]);assert.equal(finished.status,0,finished.stderr);
  const after=readFileSync(f.file,"utf8");assert.ok(after.includes("SOLAR_SETUP_TOKEN=\n"));assert.ok(!after.includes(token));
  assert.equal(statSync(f.file).mode&0o777,0o600);
  assert.ok(readFileSync(f.log,"utf8").includes("up -d --no-build solar"));
  assert.ok(!finished.stdout.includes(token));assert.ok(!readFileSync(f.log,"utf8").includes(token));
});
