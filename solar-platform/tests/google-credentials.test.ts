import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Google credential example contains only the expected blank variables",()=>{
  const text=readFileSync(new URL("../google.env.example",import.meta.url),"utf8");
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"));
  assert.deepEqual(lines.map(s=>s.split("=")[0]).sort(),[
    "GOOGLE_GEOCODING_API_KEY","GOOGLE_MAPS_BROWSER_API_KEY","GOOGLE_SOLAR_API_KEY"
  ]);
  for(const line of lines)assert.match(line,/^[A-Z_]+=$/,"Credential examples must contain blank values only.");
  assert.doesNotMatch(text,/AIza[0-9A-Za-z_-]{35}/,"Never include a Google API key in tracked credential examples.");
});
