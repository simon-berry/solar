# Google credentials: required APIs, restrictions and incident response

## Exposed credential

An API key was committed to google.env.example. Treat that credential as compromised. Replace it with appropriately restricted credentials, update any legitimate consumers, and revoke/delete the exposed key promptly in Google Cloud. If abuse is suspected, disable the exposed key immediately rather than waiting for a migration. Review API usage, billing, quota and any build artifacts/images produced since its publication. This cleanup does not rotate or revoke Cloud credentials and does not remove the key from Git history, forks or previously copied files. History cleanup, if required, is a separately coordinated operation; this change does not force-push or rewrite main.

Never put replacement credentials into this repository, chat, tickets, screenshots or example files. The regression test requires all three values in google.env.example to stay blank. It is a template guard, not a repository-wide secret scanner or proof that history is clean.

## What the current implementation actually calls

| Runtime setting | Used by | Google API required |
| --- | --- | --- |
| GOOGLE_MAPS_BROWSER_API_KEY | Browser SDK, intentionally visible to the client | Maps JavaScript API |
| GOOGLE_GEOCODING_API_KEY | Server-side address search | Geocoding API |
| GOOGLE_SOLAR_API_KEY | Server-side buildingInsights:findClosest | Solar API |

A key's selected API list is an allow-list, not proof that the services are enabled in the project or that billing, application restrictions, coverage and quota permit a request. API restrictions and application restrictions both apply. Selecting other APIs does not require implementing or calling them and does not change licensing or attribution rights. The current code needs only the three APIs above.

## Supported secure configurations

Use a browser key restricted to your authorised website referrers and Maps JavaScript API. This key is returned by /api/maps/config and placed in the SDK request; never assign a private server key to GOOGLE_MAPS_BROWSER_API_KEY.

For server requests, use keys restricted to the server's public egress IP and the required server API. Separate Geocoding/Solar keys give finer separation. Alternatively, one server key may allow both Geocoding API and Solar API: assign that same value privately to BOTH GOOGLE_GEOCODING_API_KEY and GOOGLE_SOLAR_API_KEY. This still requires a separate browser key. There is intentionally no automatic fallback from a server key to the browser setting.

A website/referrer-restricted key is not a substitute for a server IP-restricted credential. Do not remove all application restrictions merely to reuse one broadly authorised key across browser and server. Restrict each key to the APIs it actually needs, and set appropriate quotas and billing alerts. The remaining APIs in a broad allow-list are unnecessary for this integration.

## Apply privately on the host

Compose reads .env.google, not google.env.example. Copy the now-blank template only if .env.google does not already exist; do not overwrite an existing configured file. Use umask 077, set mode 0600 and edit the real values privately. Keep existing .env.selfhost domain/bootstrap settings unchanged. After replacing credentials, recreate the application container using the existing operator procedure in MAPS.md. Native Node deployments should use their supervisor environment or protected .env.

The example file is tracked and may enter a Docker build context; it must never contain real credentials. Existing ignore rules exclude the private .env.google file. Protect Docker/host administrator access because container environment variables can be inspected by administrators.

Missing browser credentials leave the map disabled even if a Solar key exists; missing geocoding credentials disable address search; missing Solar credentials disable building insights. The app does not discover API permissions from a key or enable services automatically.

Verification must include CI/type checks/build, browser authorisation on the actual hostname, server requests with the intended egress IP, Google billing/quota and licensed coverage. No live request using the exposed key was made during this review. This commit changes source/template documentation only; it does not configure Google Cloud, deploy a server or claim a successful full application build.

Security guidance: https://developers.google.com/maps/api-security-best-practices
Key restrictions: https://developers.google.com/maps/documentation/javascript/get-api-key
