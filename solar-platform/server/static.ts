import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Self-hosted HTML uses the same-origin API. The private asset deployment keeps
  // its on-disk placeholder for deploy_website to rewrite independently.
  const html=fs.readFileSync(path.resolve(distPath,"index.html"),"utf8").replaceAll("__PORT_5000__","");
  const index=(_req:express.Request,res:express.Response)=>res.type("html").set("Cache-Control","no-store").send(html);
  app.get(["/","/index.html"],index);
  app.use(express.static(distPath,{index:false}));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", index);
}
