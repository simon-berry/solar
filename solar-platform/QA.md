# Alpha QA inventory

## Executed checks: alpha 0.7

- **Automated**: TypeScript, all 116 tests and the production build passed on the final release source. Eighteen new tests cover map geometry/projection, concave containment and clearances, provider result/stream bounds, consent/rates/cache, mocked satellite guards, legacy preservation, map-aware review hashes, versioned A3 packs and optional helper configuration. Production dependency audit found zero known vulnerabilities at verification.
- **HTTP regression**: map-specific preview checks passed for pin/polygon persistence, scoped GeoJSON, SVG/import, v2 issue hashes/A3 PDFs, immutable reports, omitted-field preservation and exact historical map removal on restore. Existing preview smoke and account HTTP suites passed, including the compiled local HTTPS account runtime.
- **Role enforcement**: account HTTP tests reject mapped design changes by read-only users, reviewers and estimators; designers can save them. Read-only users can export their own organisation's GeoJSON, another organisation receives 404, and anonymous map settings requests in account mode receive 401.
- **Local browser**: found Chorley Town Hall through the real manual Photon search, selected its pin, traced a roof and placed 113 modules within the global capacity cap. Exercised map undo/redo, module placement/movement/rotation/removal, obstruction addition/removal, auto-fill replacement confirmation and blocked out-of-roof placement. A separately traced six-vertex concave face used an explicit 35° pitch; undo restored the previous roof list.
- **Persistence and editor compatibility**: saving and reloading retained pin, boundary/reference and modules. The roof-plane editor showed the polygon and locked mapped dimensions; a newly added cloned roof was rectangular/unmapped and editable, with undo restoring the original design. All ten project tabs opened without unexpected page errors.
- **Failure states**: invalid manual coordinates produced a readable error, valid coordinates set a manual pin and undo restored the prior saved state. A deliberately injected address-service 503 showed an error without blanking the app; real lookup was restored afterward. Satellite was visibly disabled without a configured key; upstream credentials and live licensed imagery were not invented.
- **Documents**: actual browser downloads of GeoJSON, DXF and preliminary technical PDFs succeeded. The local 113-module package was nine A3 sheets; the hosted 44-module concave fixture was seven A3 sheets. Rendered roof sheets were inspected: the polygon notch and modules matched, identifiers/scale/footer remained legible, and no Poppler graphics-state errors occurred. Short v1 and v2 unit fixtures both remain six A3 sheets.
- **Hosted restricted iframe**: updated the same private app asset to ALPHA 0.7, then used fresh browser contexts and a sandboxed frame with actual `self.origin === "null"`. Confirmed real Chorley street/building geography and visible OpenFreeMap/OpenMapTiles/OpenStreetMap attribution, not just a loaded style or pin.
- **Hosted end-to-end**: created a synthetic project through the UI, searched and optionally applied the address, traced a six-vertex 35° face, auto-filled 44 modules, saved and forced a genuine full-document reload. The final release retained all 44 modules and revision 3 with correctly separated address/postcode. GeoJSON download contained 46 user features and a closed seven-coordinate roof ring; an earlier saved v2 technical pack downloaded successfully. All ten final-release workflow tabs rendered without unexpected page errors.
- **Responsive/navigation**: inspected local and hosted 1440px and 375px layouts, including desktop → mobile → desktop transitions. The final hosted 375px frame had 375px document width, an above-fold map consent button, usable map Fit, a visible concave array and attribution. A deployment check exposed the expanded step bar's hidden overflow; visible left/right controls were added and tested at both ends and after resize.
- **Data preservation**: immediately after the backend upgrade, projects 52 → 52, revisions 93 → 93, proposal issues 20 → 20 and technical issues 1 → 1; all prior fields in all tables matched the verified backup. After scoped synthetic browser QA, counts were 56 projects, 99 revisions, 20 proposal issues and 2 technical issues; every original project/revision/proposal/technical row was still unchanged, and integrity remained `ok`.

No live licensed satellite key was available: only the disabled state and mocked adapter were verified. Main/map chunks still exceed Vite's advisory size threshold, though the map and worker are lazy-loaded. Docker image creation, a real target-host deployment, map/provider licensing approval and independent engineering validation remain unverified; no installation release is available.

## Executed checks: alpha 0.6, 13 November 2026

- **Automated**: TypeScript, all 98 tests and the production build passed. Ten new quotation tests cover integer rounding, optional amounts, validation, old-client preservation/explicit removal, historical restore/import, engineering-hash independence, frozen v4 reports, unchanged v3 hash envelope and short/long PDF pagination.
- **Account HTTP**: passed against development and compiled local HTTPS. An estimator edited branding/included/optional lines, issued v4 and downloaded frozen quote JSON/PDF; quoted values reconciled, restore did not alter the old quote, another tenant could not download it, and pricing-only changes preserved the external engineering review binding.
- **Legacy HTTP**: preview smoke passed against development and the compiled runtime, retaining v3 electrical/interval report and PDF/SVG/JSON/CSV workflows. Old proposals do not retroactively acquire branded quote reports.
- **Browser quotation flow**: created a synthetic residential project, enabled branding, edited contact/reference/scope, added a 1.005 × £1 included item and separate optional storage allowance. Optional exclusion restored the included-only total; save/reload retained all values. Downloaded actual v4 PDF and frozen quote JSON, changed current issuer/prices, and verified the earlier downloaded JSON remained byte-identical.
- **Negative states**: blank company name disabled issue creation after save; API/unit checks reject blank branded issuer, bad colour/email/URL, duplicate line IDs and excessive precision. Added/removed a third line and changed a declared unit through the UI.
- **PDF inspection**: the short fixture is four A4 sheets, independently loaded with frozen author/date; a maximum-item/long-scope fixture paginates. Rendered and inspected all four normal browser-generated pages. The hosted commercial example with interval appendix produced five A4 sheets and rendered without Poppler errors; checked its summary, optional-item disclosure and interval assumptions.
- **Development recovery**: a long-running shared-cache development session hit a React lazy-module hook error. Reload restored the screen; per-port optimiser caches and React deduplication were added. A clean development pass opened all nine tabs and resource pages; the compiled HTTPS pass also completed all nine tabs without unexpected page errors.
- **Failure injection**: in an isolated compiled HTTPS browser, intercepted the lazy energy chunk with a synthetic module failure. The new recovery screen appeared instead of a blank app; removing the interception and clicking Reload workspace reopened the saved project. This intentional failure is not counted as an unexpected production error.
- **Migration**: inspected actual live issue schema and took `/tmp/solar-immediately-before-v06-deploy.db`. Immediately after additive migration 006, projects 47 → 47, revisions 79 → 79 and proposals 16 → 16; every old field of every row matched exactly. Every old issue had null `quote_report`; integrity was `ok`.
- **Hosted verification**: updated the same private app asset to ALPHA 0.6. A fresh signed-preview context created a synthetic commercial design, saved/reloaded branded presentation and included/optional lines, loaded synthetic intervals, created a v4 issue and downloaded real PDF, quote JSON, energy JSON, dispatch CSV and DXF. Frozen quote arithmetic reconciled and the optional storage allowance was excluded.
- **Responsive/regression**: inspected local and hosted quote presentation/items at 1440 × 1000 and 375 × 812; hosted document width equalled 375px. All nine workflow tabs loaded on the compiled HTTPS and hosted builds with no unexpected page errors in the clean completed passes.

The initial owner-facing app wrapper remains private and requires owner sign-in; hosted functional QA uses its signed deployment route. Test data/prices are synthetic, runtime databases and downloaded examples are excluded from the source bundle, the main client bundle still exceeds Vite's advisory threshold, and Docker image/real target-host deployment remain unverified.

## Executed checks: alpha 0.5, 13 November 2026

- **Self-hosting follow-up**: six additional tests cover local-secret generation/no-overwrite, invalid configuration, symlinks/permissions, shell-injection refusal, stable Compose routing and guarded bootstrap-token removal. These use a mock Docker command; separately, real upstream Compose parsed the combined manifests and Caddy adapted the proxy configuration. No engine/image build or certificate issuance was tested.
- **Automated**: TypeScript, all 88 tests (including six self-host helper tests) and the production build passed. Preview HTTP smoke passed against both the development server and compiled preview; account HTTP smoke passed against development and the compiled same-origin HTTPS deployment.
- **Permissions**: HTTP checks exercised designer evidence/submission/issue rights, reviewer-only assessment recording, admin self-review rejection, estimator/read-only denials, last-admin protection, session revocation, invitation replay and cross-organisation project/evidence/PDF/JSON/DXF denial.
- **Evidence and review state**: exact downloaded bytes and attachment/sandbox headers were checked; all three external report scopes were recorded using synthetic fixtures. Pricing-only edits preserved their engineering binding; restoring different engineering inputs made reviews stale and rejected later decisions on the stale submission. Frozen technical JSON remained unchanged.
- **Technical documents**: independent PDF loading checks a short fixture has six A3 landscape sheets. Rendered all six pages of the browser QA pack and inspected them; corrected a footer-overflow bug that previously added blank pages and unbalanced PDF graphics state. The final hosted PDF also rendered without Poppler errors. Independently parsed the hosted DXF: millimetres, 14 module entities and the imported rail.
- **Compiled HTTPS browser**: verified ALPHA 0.5, Secure/HttpOnly/SameSite=Strict `__Host-solar_session`, survey save/reload, evidence upload and actual technical PDF download. The local proxy uses a self-signed QA certificate; the fixture process bypasses certificate trust only for this localhost test, not as deployment guidance.
- **Browser regression**: opened all nine project workflow tabs plus catalogue, account, import and development notes. Reran actual hosted sourced-equipment selection, string suggestions, survey save/reload, evidence upload, submission, mounting JSON import, stale-state display, synthetic battery analysis, proposal creation and downloaded technical PDF, DXF, proposal and exact-byte evidence.
- **Responsive**: inspected the hosted survey/evidence workflow at 1440 × 1000 and 375 × 812. Mobile document width equalled 375px; internal tables remain scrollable. No captured page errors occurred in these completed hosted or compiled HTTPS flows.
- **Migration**: inspected live definitions and took `/tmp/solar-before-v05-deployment.db` using the integrity-checked backup utility. Immediately after deployment, projects 39 → 39, revisions 60 → 60 and proposals 12 → 12; every original column of every row matched exactly. The earlier pre-accounts backup's 35 projects, 49 revisions and nine proposals also remained unchanged before deployment.
- **Delivery**: updated the existing private app asset, not a new/public app. The unauthenticated owner-facing wrapper correctly requested sign-in; functional hosted tests used its signed deployment preview route. Runtime databases, synthetic downloads and QA certificates are excluded from the source archive.
- **Known limits**: the main client bundle still exceeds Vite's 500 kB advisory and dependency annotation warnings remain. No Docker engine was available, so no container build is claimed. This is synthetic software QA, not a complete security/accessibility/load audit or professional engineering validation.

Later synthetic smoke/browser writes legitimately add new projects, revisions, evidence and issues. The migration comparisons above were performed immediately after startup, before those additional QA writes.

## Executed checks: alpha 0.3, 13 November 2026

- **Automated**: TypeScript passed; 55 tests passed with no failures. HTTP smoke passed, including authoritative catalogue metadata, immutable v3 reports, gap/duplicate rejection, scoped downloads and a full 17,520-row half-hourly year through the API. Production dependency audit reported zero vulnerabilities at check time.
- **Catalogue**: default manufacturer-only view showed five variants; legacy-only showed six. Model search/filter reset, real product selection, source metadata, save/reload and a real manufacturer-datasheet popup were exercised. Missing Vmp coefficients remain incomplete in domain tests rather than being inferred.
- **CSV**: browser-tested synthetic example, gross-demand acknowledgement, gapped import, rejected naive DST timestamp with prior dataset retained, consumption-only import and average-kW/end-stamp conversion. Unit tests additionally cover BOM/CRLF/quoting, equivalent-offset duplicates, bad dates, overlaps, blanks/negatives, caps and 23/25-hour UK days.
- **Battery**: changed/select/restored capacity, reserve and initial SOC, verified reserve clamps opening SOC, inspected daily/monthly/hourly summaries, capacity sensitivity and boundary conditions. Tests verify reserve/power/efficiency constraints, no simultaneous charge/discharge, opening-SOC economic adjustment and interval/period conservation on a 1,000-interval stress profile.
- **Persistence**: saved/reloaded imported data, retained real model selection, created a v3 proposal, downloaded actual energy/dispatch/frozen JSON and PDF files, and checked issued reports remain frozen after edits. Legacy omission preserves newer data; explicit dataset null clears only the working design.
- **Existing workflow**: project search/no-result/reset, create/site/nation/notes/save, portrait/landscape auto-fill, clear/undo/redo, zoom/fit/labels, add/switch roof, manual placement, keyboard move, rotate, drag/remove and obstruction add/remove were exercised. Electrical enable/suggestion/add/undo, orphan status, estimate editing, dirty-quote blocking, issue creation and existing SVG/JSON downloads were exercised.
- **Responsive**: desktop 1440 × 1000, short desktop 1440 × 540, mobile 375 × 812 and 390 × 844 inspected. No unintended document horizontal overflow was found. Capacity tables scroll inside their container; the active workflow tab remains visible after desktop/mobile resize. No observed page errors in local or hosted checks.
- **PDF**: downloaded and rendered the v3 provenance and interval appendix pages; inspected them for clipping and readable assumptions/source URLs. Manual annual values remain separate, and storage is explicitly not automatically quoted.
- **Migration**: backed up the live SQLite database before migration 003, read the actual live table definitions and added only nullable `solar_issues.energy_report`. Immediately after startup, counts remained projects 35 → 35, revisions 48 → 48 and issues 8 → 8. Every pre-existing row, across all old columns, compared exactly equal to the backup, including old snapshots, hashes, totals and template versions.
- **Hosted verification**: updated the same private app asset `6a0c15bf-81b9-44ea-845e-5803a7d8d5a0`. A fresh browser context loaded ALPHA 0.3, selected sourced hardware, loaded synthetic intervals, changed capacity, saved and reloaded through the proxy, created a proposal and downloaded actual PDF, energy JSON, dispatch CSV and frozen issue JSON. Catalogue filtering and an actual Sungrow popup worked. A restricted iframe without `allow-same-origin` loaded the app and produced the synthetic interval result.
- **Build**: production build passed; consumption/chart code is lazy-loaded. The main bundle still exceeds Vite's 500 kB advisory threshold, and dependency annotation warnings remain; no warning is presented as a failed build.

These checks do not certify engineering accuracy, MCS compliance, battery compatibility, security isolation for production tenants, comprehensive supplier data, storage durability or performance under production-scale concurrent load. Synthetic QA writes after the migration check legitimately add records; runtime databases and downloaded test outputs are excluded from source archives.

## Claims and controls

| Flow | Functional verification | Visual states |
|---|---|---|
| Open workspace and switch sample projects | Each project loads its saved roof and totals | Desktop design, commercial design, mobile |
| Create project | Required fields, type/nation, site screen, reload persistence | Dialog, empty new design |
| Project search | Matching and no-result states; clear restores | Sidebar |
| Roof editor | Auto-fill, clear, undo/redo, portrait/landscape, roof switching/add, module selection/move/rotate/delete, obstruction add, zoom/fit/labels | Populated editor, selected module, mobile properties |
| Saved revisions | Dirty indicator, save, reload retained values | Saved/unsaved status |
| Site and equipment | Edit customer, nation and supply; module/inverter changes and phase mismatch | Site/equipment screens |
| Estimates | Edit yield, demand, rates and self-use; derived totals update | Estimate screen |
| Quote | Edit allowances/VAT; penny totals; dirty and invalid design block issue | Quote summary |
| Proposal creation | Save, create issue, download PDF, change live price, issue remains unchanged | Document history |
| Exports | Roof SVG, concept SVG and project JSON download | Saved revision label, dirty warning |
| Reference catalogue/development notes | Navigation and scope disclosures | Both pages |
| Narrow/short screen | No horizontal document overflow; controls remain reachable | 375px and short desktop |

## Negative tests

- Shrink roof beneath existing modules and confirm errors block proposal creation.
- Submit an out-of-scope or malformed design and confirm server validation.
- Save a stale expected revision and confirm 409 conflict.
- Request another visitor's project/document and confirm denial.
- Check unsafe text is escaped in SVG and not executed in the portal.
- Check immutable proposal snapshot after subsequent quote edits.

## Evidence

Automated domain/storage tests and TypeScript/build checks are part of the release process. Browser results and actual hosted-preview checks are recorded after execution in the completion notes.

## Executed checks: alpha 0.1, 13 November 2026

- `npm run check`: passed.
- `npm test`: 13 domain/storage tests passed.
- `npm run test:http`: passed create/read/write, input validation, revision conflict, visitor isolation, PDF/SVG/JSON downloads, escaping and frozen-price checks.
- `npm run build`: passed. Vite reports a large initial JavaScript chunk; code splitting is a follow-up performance task, not a failed build.
- `npm audit`: no reported vulnerabilities at the time of the check.
- Desktop browser flow: created a synthetic residential project, edited survey notes, auto-filled modules, saved, reloaded, issued a proposal and downloaded actual files.
- Editor controls: exercised portrait/landscape, clear, undo/redo, module placement, selection, drag, keyboard movement, position inputs, rotation, removal, roof addition/switching, obstacle addition/removal, label toggle, zoom and fit.
- Negative layout test: shrunk a populated roof and confirmed findings and blocked proposal creation.
- Equipment test: changed inverter phase and confirmed a visible mismatch finding.
- Revision test: changed and saved quote prices; the earlier issued proposal retained its original total.
- Draft test: navigated between projects and global pages, then returned to the unsaved working edit; refreshing restored the last saved revision as documented.
- Mobile checks: 375px layouts, project dialog, drawer open/close and document-table overflow; short 1280 × 640 desktop retains a usable canvas with outer scrolling.
- Hosted preview: confirmed actual backend reads/writes, saved-value reload, PDF/SVG downloads and no captured page errors during the main flow.
- Restricted iframe: confirmed actual reads, saved writes and PDF downloads with `allow-same-origin` omitted.
- PDF inspection: confirmed a two-page A4 file with the expected total, revision, assumptions and preliminary warnings.
- Exploratory pass: switched projects rapidly, searched for nonexistent projects, changed dimensions around occupied modules, and navigated away from unsaved work.

No captured JavaScript page errors occurred in the completed main-flow checks. Initial routing, JSON-order save-state, mobile drawer behaviour and offscreen screen-reader table-label overflow defects found during development were fixed and the affected paths rerun.

This is not a complete security, accessibility, electrical, structural or MCS audit. Cross-browser coverage beyond Chromium and production identity/storage remain outstanding.

## Executed checks: alpha 0.2, 13 November 2026

- `npm run check`, `npm test` and `npm run build` passed; 33 automated tests now cover domain/storage behaviour.
- Electrical cases cover formula units, temperature correction, balanced suggestions, cold overvoltage, hot undervoltage, per-input and aggregate MPPT current, excessive inputs, duplicate/orphan assignments, missing coefficients, unequal parallel lengths, mixed orientations and inclusive thresholds.
- API smoke tests passed on the test runtime and production bundle, including electrical exports, frozen report retrieval, reference-error issue blocking and visitor isolation.
- Before the active-database migration: 24 projects, 30 revisions and 4 issues. Immediately after the additive migration: the same counts. Every pre-migration issue's snapshot, total and hash was compared with the backup and remained unchanged.
- Development testing used a separate copied SQLite database before switching the active runtime. Later new rows are attributable to explicit synthetic QA creation/saves/issues, not migration rewrites.
- Browser-tested enable/disable, suggestion, manual module reassignment, rename, MPPT destination change, empty-string creation/removal, undo, assumptions, saved revision reload and orphan detection after deleting a placed module.
- Browser-tested an overvoltage string: visible “Needs attention” findings and blocked proposal creation.
- Reran project search/creation, resource navigation, site/survey editing, roof auto-fill/clear/undo/redo/orientation/labels/zoom/fit, module deletion, phase mismatch, manual estimates, quote VAT, save and existing exports.
- Hosted preview in a fresh browser context showed ALPHA 0.2 and completed actual project creation, string configuration, save/reload, proposal issue and PDF/string-SVG/DC-SVG/report-JSON downloads.
- Hosted 375px checks reported document width 375px, with no page-level horizontal overflow. Existing mobile drawer open/close remained functional.
- Restricted iframe checks, with same-origin access omitted, loaded the saved electrical model and downloaded the actual electrical SVG successfully.
- Inspected both electrical SVG outputs and the three-page A4 proposal with frozen inputs, string schedule, reference limits, parallel MPPT results and preliminary warnings.
- No captured JavaScript page errors occurred in the completed main-flow checks.
- Production dependency audit reported no vulnerabilities when checked.

The build still reports a large initial JavaScript chunk; code splitting remains a performance follow-up. The electrical implementation has software regression coverage, not independent professional engineering validation.
