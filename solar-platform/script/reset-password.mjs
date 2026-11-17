import "dotenv/config";
import Database from "better-sqlite3";
import {scrypt,randomBytes,randomUUID} from "node:crypto";
import {promisify} from "node:util";
const email=process.argv[2]?.trim().toLowerCase(),password=process.env.SOLAR_RECOVERY_PASSWORD;
if(!email||!password||password.length<14||password.length>128)throw Error("Supply account email as the argument and a 14–128 character SOLAR_RECOVERY_PASSWORD environment variable. Never pass a password in command arguments.");
const db=new Database(process.env.DATABASE_PATH||"data.db",{fileMustExist:true});
try{
  const user=db.prepare("SELECT id,org_id,active FROM solar_users WHERE email=?").get(email);
  if(!user||!user.active)throw Error("Active account not found.");
  const salt=randomBytes(16).toString("hex"),key=await promisify(scrypt)(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
  db.transaction(()=>{
    db.prepare("UPDATE solar_users SET password=? WHERE id=?").run(`scrypt$32768$8$3$${salt}$${key.toString("hex")}`,user.id);
    db.prepare("DELETE FROM solar_sessions WHERE user_id=?").run(user.id);
    db.prepare("INSERT INTO solar_audit VALUES(?,?,?,?,?,?)").run(randomUUID(),user.org_id,"server-operator","password.operator-reset",user.id,new Date().toISOString());
  })();
  console.log("Password changed and all account sessions revoked. No password was printed.");
}finally{db.close();}
