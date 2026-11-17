// Local QA only. Certificates stay outside source; never deploy this test proxy.
import https from "node:https";
import http from "node:http";
import {readFileSync} from "node:fs";
const target=Number(process.env.QA_BACKEND_PORT||5003),port=Number(process.env.QA_TLS_PORT||5443);
if(!process.env.QA_TLS_KEY?.startsWith("/tmp/")||!process.env.QA_TLS_CERT?.startsWith("/tmp/"))throw Error("TLS QA requires temporary /tmp certificates.");
https.createServer({key:readFileSync(process.env.QA_TLS_KEY),cert:readFileSync(process.env.QA_TLS_CERT)},(req,res)=>{
  const upstream=http.request({hostname:"127.0.0.1",port:target,path:req.url,method:req.method,headers:req.headers},response=>{
    res.writeHead(response.statusCode||502,response.headers);response.pipe(res);
  });
  upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end("QA backend unavailable");});
  req.pipe(upstream);
}).listen(port,"127.0.0.1",()=>console.log(`Local-only TLS QA proxy ready on ${port}`));
