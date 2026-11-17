# Changelog

## Alpha 0.7.0

- Added Map design: opt-in OpenFreeMap/MapLibre streets, explicit Photon UK address/place search, manual coordinate entry, named results and saved site pins.
- Added bounded provider responses, timeout/redirect guards, manual consent, per-actor throttling, one uncached lookup per 1.2 seconds and a bounded 15-minute cache. Provider exceptions/keys and query texts are not logged by these routes.
- Added optional boundary/georeference/site fields without database rewrites or defaults in old JSON. Old-client saves preserve omitted geometry; explicit null clears it, and historical restore remains exact.
- Added clockwise polygon tracing with assumed-pitch projection, module/obstruction map editing, select/move/rotate/remove, auto-fill replacement confirmation and tab-local undo/redo.
- Added polygon area, concave containment and all-edge clearances; out-of-polygon mounting rails/points are flagged. Legacy rectangular behaviour remains supported.
- Propagated outlines to native roof/electrical/mounting views, SVG, DXF and new frozen `technical-review-v2` packs. Added saved-revision GeoJSON without imagery; v1 technical packs keep their original rendering path.
- Added optional server-side MapTiler satellite metadata/tile proxy and self-hosted configuration. No live licensed imagery is bundled or claimed verified; the layer remains disabled without an operator key.
- MapLibre 6.18 is lazy-loaded with its supported Vite worker. Pin the compatible JSON-linter dependency to retain Node 20.19 support; dependency audit is checked separately.

## Alpha 0.6.0

- Added explicit per-project proposal branding, declared installer details, reference, review period and customer-facing inclusion/exclusion scope.
- Added up to 40 itemised included/optional commercial lines, three-decimal quantities, declared units, whole-penny unit prices and integer milliunit rounding.
- Added frozen `preliminary-v4` branded PDF and quote JSON. Legacy v3 hash envelopes and v1/v2/v3 PDF paths are preserved rather than silently upgrading existing issues.
- Added nullable `solar_issues.quote_report` through additive migration 006; old payloads preserve quote details, explicit null clears a draft and historical restore can remove fields absent in history.
- Extended estimator quote permissions without allowing engineering changes. Commercial descriptions/allowances are not technical product selection or expanded engineering approval.
- Added light-accent PDF text fallback, multi-page long-item/scope checks and render-error recovery UI.
- Isolated parallel development caches and deduplicated React after a long-lived development session hit a lazy-module hook reload error; clean compiled verification is required before signoff.

## Alpha 0.5.0

- Added the self-hosted Linux deployment kit: existing HTTPS proxy or bundled Caddy, protected locally generated secrets, stable Compose project identity, guarded bootstrap removal and operator backup export.
- Added structured survey records with explicit unknown states and imported external mounting rails, fixings and ballast geometry.
- Added private evidence attachments with signature/extension/size checks, source metadata, exact-byte hashes and engineering-input bindings.
- Added immutable engineering submissions and assessments by a different authenticated Admin/Reviewer, with cited supporting PDFs and declared scope.
- Added stale-review detection for changed engineering inputs, preserved currency for pricing-only changes, and blocked self-review, tenant crossover and native-error acceptance.
- Added frozen `technical-review-v1` issues, A3 vector review PDFs, frozen JSON and independently parsed millimetre DXF exports with named layers/stable IDs.
- Added additive migration 005 and preserved every original live project/revision/proposal field through deployment.
- Fixed technical-PDF footer auto-pagination and added an independently loaded six-sheet A3 regression fixture.
- Expanded verification to 88 automated tests, preview/account HTTP suites, compiled HTTPS account checks and actual hosted save/upload/import/PDF/DXF/proposal downloads.
- Installation release remains unavailable; external assessments are not native engineering certification or independently accredited qualifications.

## Alpha 0.4.0

- Added optional private-preview mode and default production account mode with explicit HTTPS origin/bootstrap configuration.
- Added organisation-scoped accounts, salted scrypt password hashes, hashed expiring sessions, strict cookies, revocation and bounded concurrent sessions.
- Added role-enforced routes, pricing-only estimator writes, one-time email-bound invitations, last-admin protection and scoped account/project audit events.
- Added account screens, team administration, password changes, invitation acceptance and session-expiry handling; no email delivery or MFA is claimed.
- Added portable project import and immutable revision recovery, with server-authoritative hardware and cross-tenant access tests.
- Added same-origin self-hosted HTML, persistent-volume deployment examples, integrity-checked no-overwrite backup tooling and operator password recovery.
- Added additive migration 004 without rewriting existing project/revision/issue rows.
- Verified the compiled account-mode application behind a local HTTPS QA proxy, including Secure/HttpOnly/SameSite cookies and actual save/reload/PDF/import/restore flows.

## Alpha 0.3.0

- Manufacturer-backed starter catalogue: three Trina Vertex S+ variants and two Sungrow RS variants with exact source URLs, document revisions, checked dates and unknown fields.
- Retained all legacy hardware IDs and immutable server-authoritative snapshots; no silent substitutions or supplier price claims.
- Added Consumption & battery with canonical CSV import, offset-aware timestamps, kWh/average-kW conversion, start/end convention and 15/30/60-minute intervals.
- Added observed-period demand summaries, coverage/gap/duplicate diagnostics, gross-consumption acknowledgement and separate consumption/PV provenance.
- Added generic AC self-consumption dispatch, SOC/reserve/power/efficiency constraints, conversion losses, terminal restoration allowance and capacity sensitivity.
- Added saved energy JSON, dispatch CSV and frozen v3 PDF/JSON reports; manual annual estimates and quote allowances remain separate.
- Added nullable issue energy report through additive migration 003; legacy rows, hashes and template versions are preserved.
- Added domain, catalogue, DST, conservation, persistence, compatibility, transport and HTTP tests. Consumption/chart code loads on demand; production identity and managed storage remain outstanding.

## Alpha 0.2.0

This increment adds a reference electrical-design workflow, without enabling installation approval or claiming manufacturer-verified engineering.

- Electrical workflow tab with explicit enable/disable state.
- Assign placed modules to named strings, inverter instances and MPPT inputs.
- Suggest balanced series groups by roof under a reference voltage ceiling.
- Detect duplicate, missing, unassigned and incompatible module/input assignments.
- Evaluate cold Voc, hot/cold Vmp, per-input currents, aggregate MPPT currents and input counts.
- Treat missing coefficients, empty strings, unequal parallel lengths and mixed roof orientations as incomplete/review cases.
- Preserve unconfigured legacy projects and expose an undo action for electrical edits.
- Freeze server-authoritative reference equipment and new-issue electrical reports.
- Export colour-coded string layouts, DC-connectivity concepts and electrical JSON.
- Append the frozen electrical report to new proposal PDFs; keep existing proposal templates unchanged.
- Add an idempotent, additive migration for two issue columns, with no legacy snapshot rewrites.
- Preserve electrical work when an older client omits the new field.
- Enable backend hot reload in local development.
- Expand regression coverage to 33 automated domain/storage tests and electrical API smoke tests.

Production authentication, organisation membership, independently durable storage, verified manufacturer data, MCS estimates and full engineering review remain outstanding. Existing preliminary warnings remain in place.

## Alpha 0.1.0

Initial project management, rectangular roof editor, geometry checks, manual estimates, reference equipment, quotes, immutable preliminary proposals, SVG/JSON exports and private development storage.
