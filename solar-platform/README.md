# Solar Workspace

Development alpha 0.7 for a UK rooftop PV design and proposal platform. This adds map-based address lookup, saved site locations, polygon roof tracing and map array editing, alongside branded preliminary proposals, survey/evidence/review workflows, technical packs, organisation accounts, self-hosting and energy analysis. It is not the completed production MVP; the baseline specification is in `../specifications/uk-solar-platform-mvp-product-specification.md`.

## Run locally

Requires Node.js 20.19+ or a supported newer version, npm and a platform capable of installing `better-sqlite3`. No third-party API credentials are needed.

```sh
npm ci
npm run dev
```

Open `http://localhost:5000`. The first request seeds three clearly labelled synthetic sample projects for the development visitor.

```sh
npm run check
npm test
npm run build
```

With a local server running, use `npm run test:http` for API smoke tests. It creates synthetic records under a dedicated random test visitor and verifies API validation, scoped access, immutable proposals and downloads.

`npm start` runs the production bundle in account mode by default, requiring configured HTTPS origin and initial bootstrap token. See `SELF_HOSTING.md` for account setup, role permissions, persistent storage, backups and operator recovery. `npm run preview` explicitly selects the private synthetic-data preview mode; never expose that mode publicly or treat its visitor header as production identity.

## Implemented

- Create residential/commercial projects across all four UK nations.
- Opt-in sourced street maps, explicit UK address/postcode/place search, manual coordinates and saved site pins.
- Clockwise roof-polygon tracing, assumed-pitch projection, map panel/obstruction editing and polygon-aware clearances/auto-fill, including concave notches. See `MAPS.md`.
- Polygon geometry in the roof/electrical/mounting editors, SVG/DXF/A3 exports and saved-coordinate GeoJSON without imagery.
- Optional server-proxied MapTiler satellite configuration, disabled without an authorised operator key; not live-imagery validated in this preview.
- Rectangular roof-plane editing, multiple faces, portrait/landscape placement, dragging, keyboard movement, obstructions, clearance/collision checks, auto-fill and undo/redo.
- Five exact manufacturer-backed module/inverter variants, preserved legacy reference entries, frozen source metadata and phase-mismatch detection.
- Per-module string assignment, inverter/MPPT destinations, balanced suggestions and an electrical undo action.
- Reference cold Voc, hot/cold Vmp, per-input current, aggregate MPPT current and parallel input-count checks.
- Explicit incomplete/error/reference-limit states for missing modules, empty strings, mixed orientations, duplicate assignments and missing coefficients.
- Manual illustrative generation/self-use/tariff assumptions.
- Editable quote allowances and explicit VAT assumptions with penny reconciliation.
- SQLite persistence, optimistic revision conflicts and historical design snapshots.
- Immutable, content-hashed preliminary proposal issues and real downloadable PDF files.
- Saved-revision roof SVG, equipment-concept SVG and portable project JSON downloads.
- Colour-coded string-layout SVG, DC-connectivity concept SVG and electrical JSON downloads.
- Server-authoritative equipment snapshots and frozen electrical appendices on new proposal issues.
- Private-preview visitor scoping, validation and output escaping.
- CSV interval import with explicit kWh/average-kW units, 15/30/60-minute duration, start/end convention, timestamp offsets and demand/PV provenance.
- Coverage, duplicate/gap diagnostics and UK-time daily/monthly/hourly gross-consumption summaries.
- Generic AC PV-surplus battery dispatch with usable capacity, reserve, power limits, directional efficiencies and explicit opening/closing SOC.
- Capacity sensitivity, SOC-adjusted observed-period values, saved JSON/dispatch CSV downloads and frozen v3 proposal appendices.
- Self-hosted organisation accounts, salted password hashes, hashed/expiring sessions, administrator setup and one-time invitations.
- Server-enforced Admin/Designer/Estimator/Reviewer/Read-only permissions, pricing-only estimator edits, revocation and scoped audit events.
- Project JSON import as a new project, revision history and explicitly confirmed restore-as-new-revision.
- Native/Compose persistent-storage configuration, integrity-checked no-overwrite backups and operator password recovery.
- Linux self-host helper with locally generated protected bootstrap configuration, existing-proxy/bundled-Caddy choices, stable Compose identity, guarded token removal and backup export. See `SELF_HOSTING.md`.
- Structured survey data, imported external mounting geometry, recorded mass subtotals and private PDF/PNG/JPEG evidence with content hashes.
- Immutable engineering submissions and external assessments by a different authenticated Admin/Reviewer, with input/evidence bindings and stale-review detection.
- Frozen, versioned A3 vector technical review packs and JSON reports; roof-plane millimetre DXF with named layers and stable module identifiers.
- Per-project installer presentation, contact/declared registration details, accent, quote reference, review period and explicit inclusions/exclusions.
- Additional quote lines with decimal quantities, penny prices, included/optional status and integer-based rounding; optional items never inflate VAT or the quoted total.
- Frozen `preliminary-v4` branded PDFs and quote JSON, while original v1/v2/v3 snapshots/templates remain on their original paths. See `QUOTATIONS.md`.
- A recoverable rendering-error screen and per-port development caches/React deduplication.

## Important limits

This is a single-developer preview, not a certified engineering system. Five hardware entries are transcribed from manufacturer datasheets; legacy reference entries remain synthetic and default prices remain illustrative allowances. The catalogue is not a comprehensive UK-approved list. It does not implement MCS generation/self-consumption, live weather, measured surveys, bundled/verified aerial imagery, manufacturer-complete electrical validation, electrical certification, structural calculations, customer contract acceptance, engineer sign-off or DNO submissions. Drawings and PDFs are clearly preliminary and not for installation.

Battery sizing is a generic AC-coupled model, not a selected battery/hybrid product or a compatibility assessment. It requires gross site demand and independently identified AC PV intervals; grid-import-only data can materially understate demand where PV already exists. No generation/weather data is invented from annual estimates, no short period is annualised, and imported PV is not resized when the array changes. Gaps block dispatch instead of being filled with zero. Flat tariffs, terminal SOC restoration and all exclusions are disclosed. Storage is not automatically included in quote pricing; explicitly enter a scope/allowance if needed. See `ENERGY.md` and `CATALOGUE.md`.

Electrical checks use designer-entered minimum/maximum cell temperatures and a manually chosen Isc multiplier. These are not validated weather values or prescribed regulatory factors. Passing the implemented reference limits is not a compliance or safety conclusion; start-up behaviour, connector detail, irradiance effects, cables, protective devices, isolation and earthing remain outside scope. A string suggestion groups roofs and balances series counts under a reference voltage ceiling; it is not an optimiser and may still produce an infeasible result that the checker flags.

The price model uses a manually selected tax rate and requires tax assumptions; it does not determine eligibility or tax points. No MCS, grid approval or safety conclusion is made from geometry checks.

The roof-plane editor uses metres; Map design projects approximate geographic traces into that plane using an explicit pitch. A small-site spherical approximation is used, not an engineering survey projection. Zero pitch is a plan-plane estimate, not a measured flat roof. Map georeferences lock dimensions/pitch/azimuth until unlinked; first-edge direction sets an assumed downslope azimuth that must be checked. Pitch/azimuth do not alter manual energy yield. Flat-roof row-pitch/ballast calculations remain future work.

Private-preview SQLite data remains local to the sandbox and is not guaranteed across sandbox replacement. Self-hosted account mode supports a configured persistent database path and a named container volume, but operators must arrange, monitor and test off-host backups, access controls and retention. PostgreSQL/high availability are not implemented; source Project Files do not back up runtime records.

Authentication and organisation membership are implemented for self-hosted account mode, not the visitor-scoped private preview. MFA, SSO, email verification/reset delivery, verified licensed aerial imagery and public customer acceptance remain outstanding. Evidence uploads and externally declared assessments do not certify the design or independently verify reviewer qualifications. Use synthetic data in the preview; obtain deployment-specific privacy/security and professional validation before live customer use. See `ENGINEERING.md`.

## Architecture

- `shared/schema.ts`: Zod input contracts, Drizzle tables and sourced/legacy equipment catalogue.
- `shared/map-schema.ts`, `geometry.ts`, `map-geometry.ts`: optional saved geometry, polygon containment/clearance and local pitched map projection.
- `server/maps.ts`, `client/src/components/map-designer.tsx`: bounded/cached explicit geocoder, configurable map workspace and optional authenticated satellite proxy.
- `shared/energy-schema.ts`, `shared/energy.ts`: interval contracts, CSV validation, load summaries, AC dispatch and capacity comparison.
- `client/src/components/energy-analysis.tsx`: lazy-loaded consumption and battery workflow.
- `server/energy-documents.ts`: v3 frozen provenance and interval PDF appendices.
- `server/accounts.ts`, `server/access-routes.ts`: account storage, sessions, invitations, role/scope enforcement and audit.
- `shared/review-schema.ts`, `server/reviews.ts`: survey/mounting contracts, private evidence, engineering hashes, submissions, external assessments and frozen technical issues.
- `shared/quote-schema.ts`, `client/src/components/proposal-details.tsx`, `server/branded-proposal.ts`: itemised quote contracts, presentation editor and frozen branded PDF.
- `server/technical-documents.ts`, `client/src/components/engineering-workspace.tsx`: A3 review packs, DXF geometry and the survey/review interface.
- `client/src/components/access.tsx`, `project-recovery.tsx`: account screens, import and revision recovery.
- `script/backup.mjs`, `script/reset-password.mjs`: operator-only backup and access-recovery tooling.
- `shared/solar.ts`: deterministic geometry, layout validation, quote/energy arithmetic.
- `shared/electrical.ts`: reference stringing assessment, suggestions and authoritative snapshot handling.
- `client/src/pages/workspace.tsx`: project workflow and proposal history.
- `client/src/components/roof-editor.tsx`: SVG editor and layout controls.
- `server/storage.ts`: visitor-scoped persistence, transactions and immutable snapshots.
- `server/routes.ts`: validated API routes and download handlers.
- `server/documents.ts`: escaped SVG and controlled preliminary PDF generation.
- `server/electrical-documents.ts`: string-layout/connectivity SVG and frozen report appendix.
- `tests/`: domain and storage regression tests.

Stack decision: the specification recommended Laravel/React/PostgreSQL. This runnable slice uses React/TypeScript/Express/SQLite because PHP/Composer were not installed in the development environment. The domain and API contracts are separated to support later migration. Treat Express as the current implementation, not a delivered Laravel backend.

## API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Runtime health |
| GET | `/api/maps/config` | Public provider settings for an authenticated/preview-scoped session; no keys |
| POST | `/api/maps/search` | Explicit consent + bounded query; UK Photon lookup |
| GET | `/api/maps/satellite`, `/api/maps/satellite/:z/:x/:y` | Optional scoped metadata/tile proxy, never exposes the operator key |
| GET | `/api/projects/:id/export/site.geojson` | Saved mapped user geometry, no provider imagery |
| GET / POST | `/api/projects` | List/create projects |
| GET / PUT | `/api/projects/:id` | Read/save with expected revision |
| GET / POST | `/api/projects/:id/issues` | History/create frozen preliminary issue |
| GET | `/api/issues/:id/proposal.pdf` | Download frozen PDF |
| GET | `/api/projects/:id/export/roof.svg` | Saved roof-plane drawing |
| GET | `/api/projects/:id/export/schematic.svg` | Saved equipment concept |
| GET | `/api/projects/:id/export/project.json` | Portable saved design |
| GET | `/api/projects/:id/electrical` | Saved-revision reference electrical assessment |
| GET | `/api/projects/:id/export/strings.svg` | Colour-coded string layout |
| GET | `/api/projects/:id/export/electrical.svg` | DC string/MPPT concept |
| GET | `/api/projects/:id/export/electrical.json` | Saved-revision reference report |
| GET | `/api/issues/:id/electrical.json` | Frozen electrical report from an issued v2/v3 proposal |
| GET | `/api/projects/:id/export/energy.json` | Saved interval summary, diagnostics and capacity comparison |
| GET | `/api/projects/:id/export/dispatch.csv` | Saved interval AC battery flows; complete demand/PV required |
| GET | `/api/issues/:id/energy.json` | Frozen interval report from a v3 issue, if present |
| GET | `/api/session` | Access mode and current public identity |
| POST | `/api/auth/setup`, `/login`, `/join`, `/logout` | Account setup and session lifecycle (under `/api/auth`) |
| GET | `/api/account` | Organisation members and admin-only invitation/audit summaries |
| POST / PUT | `/api/account/invitations`, `/members/:id`, `/password` | Scoped account administration |
| POST | `/api/projects/import` | Import validated portable design as a new project |
| GET | `/api/projects/:id/revisions` | Scoped saved revision metadata |
| POST | `/api/projects/:id/restore` | Restore trusted history as a new current revision |

## Compatibility and migration

Electrical data is optional in existing design JSON. Startup migration 002 only adds `template_version` (default `preliminary-v1`) and nullable `electrical_report` columns to `solar_issues`; it does not rewrite old snapshots. Existing proposals continue on the original template without an electrical appendix.

Alpha 0.2 issues used template v2 and store equipment inputs and a computed electrical report. Alpha 0.3 adds nullable `energy_report` through additive migration 003 and uses template v3 for new issues; v1/v2 issues remain on their original templates. No old rows or snapshots are rewritten. New reports are computed server-side and hashed with the frozen design/electrical inputs.

Client-supplied hardware limits and source metadata are not trusted: the server retains matching prior authoritative snapshots or selects its catalogue for changed products. Legacy saves that omit electrical or interval fields preserve that work. Explicitly clearing interval data uses `intervalAnalysis.dataset: null`. Removing modules or reducing inverter count does not silently delete assignments. Existing reference IDs/defaults remain stable; select real models explicitly to avoid silently changing old designs.

Interval rows are stored in versioned design JSON in this alpha, limited to 20,000 rows with a 4 MB HTTP body cap (sufficient for one year of half-hourly records). A full year of 15-minute records exceeds that cap and is intentionally unsupported; aggregate externally or use a shorter period. A future managed-storage release should move datasets to a dedicated resource instead of returning every interval in project listings.

Migration 004 only adds organisation/user/session/invitation/rate-limit/audit tables. Existing preview rows are not claimed by a new account; project export/import is the explicit transfer path. Authenticated projects use server-derived organisation scopes and do not auto-seed sample customer records. Restoring a revision removes newer optional fields absent in that historical snapshot while preserving trusted historical hardware, and commits a new revision instead of changing old records.

## Next milestone

Add production identity/organisation authorisation, managed durable storage, comprehensive UK-specific manufacturer/battery datasets and independently validated engineering rules. Keep installation release disabled until structural evidence, grid workflow, specialist review and document-control requirements are implemented and validated.
