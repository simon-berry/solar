# Google Maps and Solar API migration

This replaces the Photon/OpenFreeMap/MapTiler instructions in older release documents. Google Maps JavaScript API renders streets/satellite; Geocoding API handles submitted UK searches; Solar API Building Insights provides explicit assessments. Solar API is not a general map renderer. Data Layers/GeoTIFF overlays and automatic Google layout import are not implemented.

## Credentials and deployment

Enable billing and Maps JavaScript API, Geocoding API and Solar API in Google Cloud. Create separate credentials:

- GOOGLE_MAPS_BROWSER_API_KEY: restrict to authorised website referrers and Maps JavaScript API. This key is intentionally public in configuration/browser requests.
- GOOGLE_GEOCODING_API_KEY: private server key, restricted to server egress IP and Geocoding API.
- GOOGLE_SOLAR_API_KEY: private server key, restricted to server egress IP and Solar API.

Set Cloud quotas and billing alerts. Per-process application limits are not a distributed billing ceiling; budget alerts are not spending caps. Verify Google coverage, attribution, privacy and content-storage/derivation/export rights for your use case. Manual confirmation is not a licence exemption.

Compose requires version 2.24.0+. From solar-platform:

```sh
umask 077
cp google.env.example .env.google
chmod 600 .env.google
# Edit .env.google privately and insert restricted keys.
bash script/self-host.sh check
bash script/self-host.sh up
```

Keep existing domain/bootstrap settings in .env.selfhost. Its strict parser intentionally does not accept Google keys: Compose reads .env.google separately, relative to compose.yaml, not SOLAR_CONFIG_DIRECTORY. Existing .gitignore/.dockerignore exclude .env.*. Protect host/Docker administrator access; container environment is inspectable. Never commit or paste credentials into chat, tickets or logs.

Native Node uses the supervisor environment or protected .env in its working directory. Native flags MAPS_ENABLED=false and ADDRESS_SEARCH_ENABLED=false disable maps/all lookups and geocoding respectively; Compose/helper flags are SOLAR_MAPS_ENABLED and SOLAR_ADDRESS_SEARCH_ENABLED. Missing keys disable the respective control without preventing server startup. Old provider URL/MapTiler settings are no longer used by Compose/application mapping. Rebuild/restart for code changes and recreate containers for credential changes. Back up the database before rollout. This commit does not deploy a server or configure Cloud credentials.

## Workspace behaviour

Maps load only after explicit enablement; Google receives client IP and viewed areas. Submitted address search requires separate consent and is not autocomplete. Search results remain transient and do not replace project addresses. A user can explicitly confirm a site pin only after checking storage rights. Changing a pin never translates existing roofs.

Roof tracing uses 3-32 vertices: upper/ridge edge first, clockwise with downslope to the right; do not repeat the first point. Pitch/direction are assumptions. Existing module placement/move/rotate/remove, obstructions, polygon auto-fill, clearance and undo/redo remain available. Replacing modules requires confirmation; verify string assignments afterward. Saved schema and shared geometry algorithms are unchanged, including legacy photon records, revisions, exports and stale-reference detection. View-only roles cannot mutate designs. Limits remain ten roofs, 150 modules/50 kWp and 30 obstructions/roof within the UK working extent, not a jurisdiction check.

Solar lookup is an explicit, separately consented, billable buildingInsights:findClosest request. HIGH is the default minimum imagery quality; MEDIUM/LOW must be chosen manually. Verify the returned centre is the intended roof: the closest known building can differ from your pin. No coverage is a normal outcome. Imagery quality/date, model panel rating, maximum panel count/area, sunshine-equivalent hours and segment pitch/azimuth/area are estimates. Sunshine hours are not kWh and model panels are not your selected catalogue modules. Responses are transient, cleared on coordinate/quality changes, never imported into geometry or energy forecasts, and not saved/exported. Satellite display is Google Maps imagery, not Solar RGB data. No imagery is included in exports. Verify dimensions, rights and installation engineering externally.

## Operations and verification

Routes inherit existing account/tenant/origin middleware. Consent/input checks precede upstream calls. Fixed hosts, no redirects, nine-second timeouts, 2 MB streamed limits, validated responses, no provider/query cache and private/no-store responses are used. Raw upstream errors/credential-bearing URLs are not returned or logged. Limits per actor/minute: geocoding 20, Solar 10; per process: 120 and 60. Old satellite proxy endpoints return HTTP 410; reload cached clients.

HTTP 503 means disabled/missing credentials; 404 from Solar means no coverage; 429 means local/provider quota; 502 means network, invalid response or Cloud billing/API/key restriction errors. Use manual design where coverage is absent. Do not add automatic paid retries.

```sh
npm ci
npm run check
npm test
npm run build
```

CI runs these commands after a push to main; it is not a deployment workflow. Full checks/build and live Google authorisation have not been verified in the assistant sandbox. The test suite retains eleven geometry/compatibility scenarios and mocks provider requests. Before production, verify CI, authorised browser load, UK search, satellite switching, trace/object selection, read-only roles, legacy save/reload/export and explicit Solar/no-coverage handling using licensed keys. Do not call this a verified release until those checks pass.

Official documentation: https://developers.google.com/maps/documentation/solar/building-insights ; https://developers.google.com/maps/documentation/javascript/get-api-key ; https://developers.google.com/maps/documentation/geocoding/policies ; https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/
