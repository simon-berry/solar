# Main flows and regression contract

## Map location and design increment

- Map design loads sourced street geography with visible attribution only after the user enables third-party maps. No invented satellite images or hidden public Nominatim dependency.
- Submit an explicit address/postcode/place search; show named UK results and precision, choose one, save a site pin and optionally apply its address. Queries are disclosed, cached, rate-limited and not auto-completed.
- Enter coordinates manually if search fails. Map location, georeferenced roof geometry and modules survive save/reload/import/restore and remain tenant-scoped.
- Trace a simple roof polygon with the first edge along its width/eave and an explicit assumed/user-entered pitch. Reject crossing/degenerate/oversize traces; preserve occupied/unlocated roofs rather than silently replacing them.
- Place, select, move, rotate/remove and auto-fill modules on the map within the actual traced boundary and clearance. Concave notches must not accept rectangles whose corners alone appear inside.
- Street building outlines and mapped distances are unverified estimates, not a survey or aerial imagery. Satellite is available only with a configured authorised provider; a missing key never displays fake imagery.
- Map-derived polygon geometry is respected by the roof-plane editor, SVG, electrical layout, DXF and new versioned technical packs. GeoJSON exports drawings, not provider imagery.
- Map/geometry changes stale engineering reviews; pricing-only changes do not. Old rectangular projects, old hashes/templates and all existing workflows remain supported.
- Test named search, manual location, pan/zoom, tracing and array editing, blocked placement, save/reload, provider failures, 375px layout and actual hosted map geography/attribution.
- When ten workflow steps exceed the available width, visible left/right buttons scroll them; verify Documents is reachable and controls update at both scroll ends and after mobile/desktop resize.

## Branded itemised proposal increment

- Quote explicitly enables installer branding, contact/identity details, reference, review-validity period and inclusion/exclusion scope. Save/reload, import and restore preserve those values.
- Add/remove commercial line items with three-decimal quantities, declared units, penny unit prices and included/optional status. Optional items never inflate the total; included lines round once to whole pennies.
- Reject duplicate IDs, invalid colours/email/URLs and excessive precision. Blank company name blocks branded proposal issue rather than silently inventing an installer.
- New branded issues use preliminary-v4 and frozen quote JSON; existing v1/v2/v3 issues retain original rows, template and output paths.
- Estimators may edit quote presentation/items but cannot change engineering inputs. Quote-only edits do not change the engineering hash or extend professional review scope.
- Browser-test branded PDF/JSON downloads, optional-item disclosure, long-text pagination, immutable issued totals after edits, role isolation and 375px layouts.
- Inject a synthetic failed lazy-module load into an isolated browser context: show the recovery screen rather than a blank app, then reload after removing the interception and recover the saved project.
- Rerun all existing project tabs, catalogue, account/import/recovery, battery, electrical and document workflows. No contract acceptance, payment or installation approval is introduced.

## Survey, evidence and technical review increment

- Survey & review edits structured assessor/date/basis, covering/condition, support spacing/unknown state, access, equipment locations and grid/permission references.
- Import solar-mounting-v1 geometry from an external schedule; inspect mapped rails/fixings/ballast, IDs, bounds and incomplete recorded-mass summary. No fixing or ballast pattern is represented as automatically engineered.
- Save before attaching files. Evidence requires author/date/source, proper PDF/PNG/JPEG signature and matching filename, bounded size and current saved revision; downloads retain exact bytes and remain tenant-scoped.
- Submit a saved engineering snapshot with its exact evidence IDs. A different authenticated Admin/Reviewer can record an evidence-backed external assessment; preview, same-author, wrong-role and cross-tenant review attempts fail.
- Matching report PDFs are required for accepted electrical/structural/mounting scopes. Known native errors cannot be converted into an accepted assessment by a generic override.
- Changing address, geometry, equipment, electrical settings, survey or mounting stales prior reviews; pricing-only edits preserve engineering currency. Added evidence is not automatically covered by an older submission/review.
- Documents creates an immutable technical review issue and downloads an A3 vector PDF with per-sheet control, roof/mounting geometry, stable module IDs, schedules, recorded loads, limitations and evidence/review register.
- A short single-roof fixture produces six A3 sheets, with no extra footer-overflow pages or PDF graphics-state errors. Long registers use labelled continuation sheets.
- DXF downloads parse as millimetre roof-plane geometry with named layers and stable module identifiers. Generated sheets remain preliminary and do not replace a specialist full SLD or external structural report.
- Installation/energisation release stays unavailable even after an external review is recorded. Native findings, missing coefficients, external qualifications and incomplete load cases remain explicit.
- Replay account/preview imports, revision restore, roof/electrical/energy/quote/proposal flows, source/download links and responsive/restricted-iframe behaviour after integration.

## Account and recovery increment

- Preview remains synthetic-data visitor mode and keeps all existing design/energy/export flows working; Workspace access explains the separate deployment mode.
- Account mode defaults in production; reject missing HTTPS origin/setup configuration rather than silently granting preview privileges.
- Initial administrator setup requires server setup token; subsequent setup attempts fail. Login/logout/password change preserve organisation scope and revoke applicable sessions.
- Invite a member, copy the shown token manually, accept in a separate browser context; wrong email, expired/revoked/used tokens fail.
- Roles are server-enforced: admins manage accounts; designers edit/create/import/restore; estimators only change pricing and issue preliminary proposals; reviewers record external assessments without design changes; read-only users view/download.
- Anonymous requests and forged visitor headers cannot access account-mode projects. A user's role/status change revokes their sessions; the final active admin cannot be disabled/demoted.
- Team & access shows only the current organisation's members and admin audit records, with no passwords, session proofs or invitation-token hashes in responses.
- Import project validates an exported JSON file and creates a new project. Malformed reports, unknown product IDs or invalid intervals are rejected; original projects and issues are unaffected.
- Documents shows saved revision history; restore requires explicit confirmation and no unsaved edits, creates a new revision and preserves old issued reports. Conflicting and cross-visitor restore attempts fail.
- Self-hosted HTML resolves same-origin API calls without private proxy placeholders; production cookies require HTTPS. Backup output is integrity-checked and private, never overwrites an existing destination, and restores cleanly to a separate database.
- Replay desktop/mobile layouts, account screens, all existing project tabs and actual hosted save/reload/download flows. Container commands are only marked verified if a container engine is actually available.

## Existing project workflow

- Open Projects, select a sample residential or commercial project, and search by name/postcode.
- Expect the selected project heading, saved revision and matching roof/module totals. Clearing search restores the list.
- Create a project through New project. Required fields show errors, Cancel closes the dialog, and a completed form opens Site details.
- Edit customer/site/survey fields and save. Reload restores the saved revision.
- Unsaved changes remain in memory when navigating between projects and resource pages.

## Roof design

- Select Roof design, switch/add roof faces, edit dimensions/pitch/clearance, and auto-fill portrait/landscape modules.
- Place, select, drag, rotate and remove modules; add/remove obstructions. Undo/redo, labels, zoom and Fit remain functional.
- Invalid geometry shows layout findings and blocks preliminary proposal creation.

## Equipment, estimates and quotes

- Equipment selection updates capacity; an incompatible supply/inverter phase shows an error.
- Estimates use explicitly manual inputs and update displayed results.
- Quote inputs and VAT reconcile to displayed totals. Unsaved edits block issue creation.
- Save, create a preliminary proposal, then open Documents. The issued revision/total never changes after later edits.

## Downloads and resources

- Download proposal PDF, roof SVG, equipment-concept SVG and project JSON from Documents.
- Equipment library and Development notes open and show catalogue provenance, separate unverified legacy entries and production limitations.
- Mobile navigation opens/closes and the project form works at 375px.
- Short desktop windows preserve a usable editor with outer scrolling.

## Requested development increment: electrical stringing

- Add an Electrical workflow tab, without removing any existing tab.
- Enable/disable draft string modelling explicitly; old projects work without electrical fields.
- Add strings, select inverter and MPPT, assign/unassign actual placed modules, rename/remove strings, and suggest balanced assignments.
- Show unassigned, duplicate, missing and incompatible assignments; never silently discard stale IDs.
- Calculate cold Voc, hot/cold Vmp, per-string current and aggregated MPPT current against explicit reference limits.
- Show temperature/current-factor assumptions and distinguish incomplete input from a passing check.
- Mark reference results as unverified; no installation release or compliance certification becomes available.
- Save/reload retains electrical assignments, including changes in geometry/equipment.
- New drawings show string colours/identifiers and inverter/MPPT connectivity, with preliminary warnings.
- New proposal issues freeze the electrical report and equipment inputs. Legacy proposal output remains on its original template.
- Server checks, not client-supplied report values or equipment limits, control issued reports.
- Database migration is additive; project/revision/issue rows are not rewritten or removed.

## Negative cases

- Cold Voc over inverter maximum; hot Vmp below MPPT minimum; excessive current/parallel inputs.
- Duplicate module across strings, orphan module after roof edit, removed inverter/MPPT.
- Incomplete or empty enabled string configuration, invalid temperature ordering.
- Legacy client payload omits new fields: saved electrical configuration is preserved.
- Stale expected revision, tampered hardware snapshot, cross-visitor read/write/download.

## Manufacturer catalogue and interval storage increment

- Equipment library defaults to five manufacturer-backed variants. Switch to Legacy references only and All entries, search exact model, clear search and open a manufacturer datasheet.
- Select a Trina module and Sungrow inverter in Equipment, inspect provenance and unknown Vmp coefficient, save, reload and verify retained model and source.
- Existing reference IDs, snapshots, layouts and old issued reports remain unchanged. New issues use preliminary-v3 with frozen provenance and energy appendix.
- Consumption & battery initially explains the canonical CSV format. Without gross-demand confirmation the file input is disabled.
- Load synthetic example, inspect clearly synthetic provenance, coverage, daily/monthly/hourly summaries, capacities, selected dispatch and conservation residual.
- Change usable capacity, AC power, efficiencies, reserve, opening SOC and flat tariffs. Select a capacity from the table; restore it. Reserve clamps opening SOC upward.
- Save revision and reload. Visit other tabs/projects and return without losing unsaved interval edits. Clear imported data, then load another file.
- Import canonical CSV with kWh and average-kW units, 15/30/60-minute durations, start/end timestamps, explicit offsets and optional PV. Import settings do not reinterpret saved data.
- Reject malformed CSV, negative/blank readings, duplicate timestamps, invalid calendar dates, naive timestamps at DST, incomplete PV coverage and over-limit files. Failed imports leave the previous dataset intact.
- Gapped data show coverage and missing interval counts; demand summaries remain available but no battery simulation runs. No-PV imports behave similarly.
- Battery model does not invent PV from annual generation, annualise short periods, silently resize imported PV, include storage in quotes or claim manufacturer compatibility.
- Documents provide saved energy JSON and dispatch CSV. Gaps/no-PV dispatch is unavailable, with an explanation. Issue/download a v3 PDF and frozen energy JSON, edit the design and confirm the issued report stays frozen.
- Replay project search/create/site/roof/electrical/estimates/quote/documents/about flows, desktop to mobile to desktop, and short desktop height. Hosted preview must save/reload and download through the proxy.
