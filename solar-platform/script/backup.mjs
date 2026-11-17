import "dotenv/config";
import Database from "better-sqlite3";
import {mkdir,open,link,unlink,chmod} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";
const source=resolve(process.env.DATABASE_PATH||"data.db");
const output=resolve(process.argv[2]||`backups/solar-${new Date().toISOString().replaceAll(":","-")}.db`);
if(source===output)throw Error("Backup destination must differ from the live database.");
await mkdir(dirname(output),{recursive:true,mode:0o700});
const temporary=`${output}.${randomUUID()}.partial`;
const file=await open(temporary,"wx",0o600);await file.close();
try{
  const db=new Database(source,{readonly:true,fileMustExist:true});
  try{await db.backup(temporary);}finally{db.close();}
  const check=new Database(temporary,{readonly:true});let integrity;
  try{integrity=check.pragma("integrity_check",{simple:true});}finally{check.close();}
  if(integrity!=="ok")throw Error("Backup integrity check failed.");
  await chmod(temporary,0o600);
  await link(temporary,output); // Atomic no-overwrite publication.
  console.log(`Verified SQLite backup: ${output}`);
}finally{await unlink(temporary).catch(()=>{});}
