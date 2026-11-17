# UK Solar Design and Proposal Platform

## MVP product specification

Version: 1.0  
Prepared: 13 November 2026  
Status: Proposed implementation baseline; product-owner approval and specialist technical validation required  
Working product name: Solar Platform  
Audience: Product owner, software developers, QA, solar electrical designer, structural reviewer and pilot installers

This specification defines a web application for UK installers to design residential and small commercial rooftop PV systems, prepare customer proposals and quotes, and produce coordinated electrical and mounting/structural drawing packs. It assumes a new codebase and a small initial development team.

Requirements below are proposed product decisions, not a claim that the application or its outputs are certified. External requirements are cited inline; implementation choices and performance targets are recommendations. Applicable standards, document permissions and current network-operator procedures must be validated by appointed specialists before production use.

## Problem statement

An installer needs to turn site information into a roof design, equipment selection, energy estimate, customer offer and installation documentation. The product hypothesis is that entering this information once, then deriving the different outputs from a controlled project revision, will reduce re-entry, contradictory documents and the time needed to prepare a reviewable proposal.

The intended benchmark is an integrated workflow rather than a generic CAD tool or CRM. EasyPV publishes roof layouts, electrical checks, schematics, structural calculations, financial forecasting, quotations and DNO forms as features; OpenSolar's UK workflow includes design, energy profiles, commercial/shading tools, proposals and schematic diagrams ([EasyPV feature overview](https://midsummerwholesale.co.uk/easy-pv), [OpenSolar UK workflow](https://support.opensolar.com/hc/en-us/articles/7576156328207--Design)).

No installer interviews or baseline time measurements have yet been supplied. Treat the workflow, user roles and success targets as hypotheses to validate with pilot users, not established market findings.

## Goals

The MVP should deliver a useful, bounded workflow rather than feature parity with either benchmark. These goals establish the product's intended outcomes and the evidence required to evaluate them.

| Goal | Proposed measure | Evaluation |
|---|---|---|
| Reduce proposal preparation effort | At least 30% lower median active preparation time than each pilot installer's current workflow | Paired sample of at least 20 comparable projects after onboarding |
| Maintain cross-document consistency | No mismatched panel counts, equipment quantities or accepted totals across an issued revision | Automated checks on every generated pack and release test fixtures |
| Make technical uncertainty explicit | Every released technical pack has a complete input/provenance record and required reviewer decisions | Release gate and weekly pilot audit |
| Support both target segments | At least 5 residential and 5 small commercial pilot projects complete the end-to-end workflow | Pilot completion records, including reviewed drawing packs |
| Produce usable outputs | At least 80% of pilot packs require no software-caused document rework | Reviewer-coded feedback, with a minimum of 10 packs |

Measure existing preparation time before setting the pilot start date. Revisit the percentage targets after that baseline; do not present these targets as promised business outcomes.

## Non-goals

The following exclusions keep the first release credible and testable. They do not prevent users from attaching third-party evidence or completing a project through an explicitly manual review process.

- **Automatic structural certification:** No universal roof-capacity approval, proprietary ballast solver or structural engineer replacement.
- **Automatic electrical certification:** No claim that passing implemented checks establishes full BS 7671 compliance, and no automatic issuing of an Electrical Installation Certificate.
- **Large or specialist engineering:** No high-voltage connections, ground-mounted farms, off-grid systems, islanding/EPS design, complex protection coordination or buildings above the supported commercial envelope.
- **Full business operations suite:** No stock control, purchase orders, accounting ledger, installation scheduling, payments or subscription billing in the MVP.
- **Advanced automation:** No AI roof recognition, LiDAR reconstruction, photogrammetry, automatic 3D shading or direct DNO submission.

## Users and principal user stories

Roles are organisation-scoped capabilities, not evidence of a person's professional competence. The installer organisation remains responsible for choosing reviewers and checking their competence for the particular work.

| Priority | Persona | User story |
|---|---|---|
| P0 | Installer/designer | As a designer, I want to create a scaled roof layout and choose equipment so that I can produce a consistent system design. |
| P0 | Surveyor | As a surveyor, I want to record dimensions, photographs and unknowns so that the designer can distinguish verified information from assumptions. |
| P0 | Estimator/salesperson | As an estimator, I want a bill of materials and controlled pricing so that my quote matches the design and protects the intended margin. |
| P0 | Electrical reviewer | As a reviewer, I want visible inputs, implemented checks and unresolved items so that I can review a particular revision without assuming the software checked everything. |
| P0 | Structural/mounting reviewer | As a reviewer, I want roof and mounting drawings with attached evidence so that I can identify whether a specialist assessment is required. |
| P0 | Customer | As a customer, I want understandable options, assumptions and a fixed quote so that I know what I am accepting. |
| P0 | Organisation administrator | As an administrator, I want controlled permissions and audit history so that commercial and technical records are protected. |
| P0 | Designer handling incomplete data | As a designer, I want to prepare a clearly preliminary proposal so that I can progress a lead without misrepresenting missing survey data. |
| P1 | Installation team | As an installer, I want an as-built revision and handover checklist so that changes made on site are recorded. |

## Launch scope and support envelope

### Project classes

The following limits are deliberate product boundaries, not legal definitions of domestic or commercial installations. Store capacity in watts and present kWp separately from AC capacity and export limits.

| Dimension | P0 support | Outside P0 |
|---|---|---|
| Buildings | Residential rooftops and small commercial rooftops | Ground mounts, carports requiring bespoke structural design, specialist industrial processes |
| PV capacity | Up to 50 kWp DC per site and connection | Above 50 kWp: record/import only, no native technical release |
| Layout size | Up to 150 modules, 10 roof faces and 6 inverters | Larger layouts |
| Supply | Single-phase and three-phase low-voltage supplies | HV or multiple points of connection |
| Roof geometry | Planar pitched faces and planar flat roofs | Curved, irregular or structurally unusual roofs without external design |
| Mounting | One validated pitched-roof product family and one validated commercial/flat-roof family | Unvalidated systems cannot receive native automatic mounting checks |
| Generation | Grid-connected PV, with existing-generation records | Off-grid, islanding, EPS and complex hybrid operating modes |
| Battery | Priced option and externally specified equipment record; no claimed battery savings | Automatic battery sizing and dispatch modelling |
| Documents | English-language proposals and drawings, GBP and metric units | Multilingual output and multi-currency |

MIS 3002 Issue 6.0 describes a scope up to 50 kWp DC for the installations covered by that standard ([MCS Solar PV Standard, Section 1](https://mcscertified.com/wp-content/uploads/2026/03/MIS-3002_Solar-PV-Systems-V6.0-Final.pdf)). The matching product cap simplifies initial validation but does not imply that every installation below it is automatically suitable for an MCS workflow.

### UK geography

All four UK nations must be selectable and retained in the project. Planning and regulatory checks must be recorded separately by nation because planning policy is devolved, with separate policy information for Scotland, Wales and Northern Ireland ([UK Government solar roadmap](https://www.gov.uk/government/publications/solar-roadmap/solar-roadmap-united-kingdom-powered-by-solar-accessible-webpage)).

- **England, Wales and Scotland:** Native commercial/design workflow, a reviewed GB grid-route assistant, and manual recording of nation-specific permissions and Building Regulations evidence.
- **Northern Ireland:** Native design, pricing and proposal workflow; grid route and technical release require manual specialist review using NI-specific evidence, not reused GB forms.
- **All nations:** No automatic planning-permission determination, permitted-development approval or Building Regulations approval.

NIE Networks publishes distinct G98/NI, G99/NI Fast Track and G99/NI routes, and notes changes to its Fast Track application parameters from 1 May 2026 ([NIE Networks generation connections](https://www.nienetworks.co.uk/connections/application-types/connect-generation)). For that reason, the MVP must not represent a generic GB threshold decision as a verified NI application route.

### Meaning of “technical drawings”

P0 must generate useful electrical and mounting/structural drawings, not simply customer illustrations. However, the supported output is a reviewable drawing pack linked to calculations and external evidence; universal structural calculation and approval are not included.

The pack can be released for installation only after the required review workflow is complete. A preliminary commercial offer may be issued before technical release, provided it carries the relevant survey, engineering and connection conditions.

## Prioritisation and functional requirements

P0 means required for the first supported production release. P1 means a defined follow-up that is not a dependency of that release; P2 is a longer-term opportunity.

Each requirement has a stable identifier. Dependencies referenced in the final column must be satisfied before the corresponding release capability is enabled.

### Organisation, access and project setup

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| ORG-01 | P0 | Support separate installer organisations, invitations and roles. Every project, file, job and API query is tenant-scoped. | Authentication |
| ORG-02 | P0 | Provide Admin, Designer, Estimator, Reviewer and Read-only roles, with separate electrical and structural review capabilities. | ORG-01 |
| ORG-03 | P0 | Require MFA for privileged staff; provide secure password reset, session revocation and disabled-user handling. | Identity provider |
| PRJ-01 | P0 | Create customer, site, nation, postcode, coordinates, project type, supply phase and assigned staff. Confirm mapped location manually. | ORG-01 |
| PRJ-02 | P0 | Support multiple alternative designs under one project, each with independent revisions and quote options. | Revision model |
| PRJ-03 | P0 | Track lead, survey, design, review, proposal, acceptance, installation and closure milestones without conflating them with drawing approval. | PRJ-01 |
| PRJ-04 | P0 | Record existing generation, batteries, export controls, MPAN if provided, network operator, supply details and unknowns. | Survey model |
| PRJ-05 | P0 | Search/filter projects by customer, address, owner, stage and project class. Archive rather than silently delete issued projects. | Audit model |

### Survey and evidence

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| SUR-01 | P0 | Capture roof type, covering, pitch, dimensions, structure notes, access restrictions, electrical supply and proposed equipment locations. | PRJ-01 |
| SUR-02 | P0 | Upload annotated site photos, plans, bills, equipment datasheets and third-party reports. Record source, date and author. | Secure storage |
| SUR-03 | P0 | Mark key values as measured, customer-supplied, estimated remotely, manufacturer-supplied or engineer-supplied. Unknown is distinct from zero. | Provenance model |
| SUR-04 | P0 | Show missing-information checklist and distinguish a blocker for technical release from a warning on a preliminary proposal. | Rule engine |

### Roof and panel editor

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| DES-01 | P0 | Load licensed aerial imagery when configured, or upload a plan/image and calibrate it against a known dimension. An upload-only workflow must work. | Imagery licensing |
| DES-02 | P0 | Draw/edit roof polygons in metres; record pitch, true-north azimuth, elevation assumption and source dimensions per face. | Geometry engine |
| DES-03 | P0 | Add chimneys, rooflights, vents, access routes, setbacks and user-defined exclusion polygons. Separate physical obstacles from planning constraints. | DES-02 |
| DES-04 | P0 | Place, move, rotate, duplicate and delete modules; support portrait/landscape, snapping, undo/redo and explicit inter-module gaps. | Product snapshots |
| DES-05 | P0 | Auto-fill a selected face within validated boundaries and exclusion zones. Present it as a feasible layout, not an optimal or approved design. | Collision engine |
| DES-06 | P0 | Support fixed-tilt flat-roof rows and east/west groups with user-defined tilt, row spacing and manufacturer footprint. | Validated mounting data |
| DES-07 | P0 | Validate roof containment, module/obstacle overlap and spacing. Show individual errors and affected module IDs. | DES-03/04 |
| DES-08 | P0 | Display total modules, roof allocation, area and DC capacity; generate stable module identifiers. | DES-04 |
| DES-09 | P1 | Add interactive 3D viewing, basic obstruction shadows and detailed manual 3D editing. | Validated geometry |

Geometry policy: the project stores horizontal plan coordinates and roof-plane geometry separately. On a pitched face, map module dimensions to the actual roof plane before projecting them into the plan view; do not fit unprojected module rectangles directly onto a satellite image. Roof azimuth and pitch need explicit confirmation where they cannot be derived reliably.

Default roof-edge clearances must be editable, source-labelled rules rather than universal assumptions. MIS 3002 includes a domestic roof-edge provision with exceptions and additional measures; it is not a justification for applying one unconditional clearance to every roof type ([MCS Solar PV Standard, Section 5.9.7](https://mcscertified.com/wp-content/uploads/2026/03/MIS-3002_Solar-PV-Systems-V6.0-Final.pdf)).

### Product catalogue and electrical design

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| CAT-01 | P0 | Admin-managed CSV/manual catalogue for modules, inverters, mounting and other priced components. Store datasheets, source, version and verification status. | File storage |
| CAT-02 | P0 | Record dimensions, mass, STC power, Voc, Vmp, Isc, Imp and temperature coefficients for modules; explicit units are mandatory. | Catalogue schema |
| CAT-03 | P0 | Record inverter phase, maximum DC voltage, MPPT voltage/current limits, input allocation, AC kW/kVA and operating constraints. Distinguish per-input and per-MPPT limits. | Catalogue schema |
| CAT-04 | P0 | Snapshot selected product specifications and prices into the design revision. Catalogue edits never rewrite issued records. | Revision model |
| ELE-01 | P0 | Assign modules to strings and strings to MPPTs/inverters. Track unassigned, duplicate and incompatible assignments. | DES-08/CAT-03 |
| ELE-02 | P0 | Evaluate supported temperature-corrected voltage, MPPT range and parallel-current checks using recorded assumptions and product limits. | Specialist-validated formulas |
| ELE-03 | P0 | Capture cable lengths, conductor details, installation assumptions, protection, isolation, earthing and equipment positions. | Structured electrical model |
| ELE-04 | P0 | Calculate supported DC voltage-drop and AC voltage-rise estimates; record limitations. Cable current capacity/protection approval remains a reviewer decision. | Validated calculation scope |
| ELE-05 | P0 | Produce a configurable single-line diagram from the electrical model with device identifiers and schedules. | Approved symbol/template set |
| ELE-06 | P0 | Provide single-/three-phase GB grid-route guidance using aggregate generation, per-phase allocation, storage configuration and type-test evidence. Unknowns force review. | GB ruleset approval |
| ELE-07 | P0 | Record requested/agreed export limit, export-control method, DNO application status and evidence. Export limitation must not be treated as equivalent to reduced installed generation. | PRJ-04 |
| ELE-08 | P0 | Permit externally designed battery equipment and schematics to be attached, priced and reviewed. Do not claim native validation of its operating modes. | External review path |
| ELE-09 | P1 | Add validated battery electrical templates, expanded cable/protection checks and string auto-suggestion. | Specialist validation |

The GB grid-route assistant must account for total aggregated AC generation: MIS 3002 references G98 up to and including 16 A per phase, G99 above that threshold and G100 where export is limited ([MCS Solar PV Standard, Sections 5.1.8–5.1.9](https://mcscertified.com/wp-content/uploads/2026/03/MIS-3002_Solar-PV-Systems-V6.0-Final.pdf)). These are inputs to a reviewed decision tree, not the entire decision tree; type testing, existing equipment, phase allocation and applicable operator procedures must also be considered.

### Mounting and structural support

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| STR-01 | P0 | Record roof construction, support spacing, condition, alterations and known uncertainties. Unknown structure cannot pass the release gate. | SUR-01 |
| STR-02 | P0 | Generate module/rail/fixing layouts for validated product families and allow manual placement with recorded source. | Mounting datasets |
| STR-03 | P0 | Summarise known equipment masses, specified ballast and load locations. Label incomplete load cases explicitly. | Verified mass data |
| STR-04 | P0 | Import manufacturer/engineer fixing and ballast schedules, reference their revision, and map them to the actual array. | Secure uploads |
| STR-05 | P0 | Record assessment outcome, limitations, reviewer, date and supporting report. Flat-roof/ballasted commercial projects require external structural evidence. | Review workflow |
| STR-06 | P0 | Block release if the current layout differs materially from the layout covered by the structural/mounting evidence. | Revision dependencies |
| STR-07 | P1 | Add a narrowly validated pitched-roof assessment workflow and licensed manufacturer calculation integrations. | Dataset rights and engineering validation |

The MVP load summary must say what it includes; it must not present panel weight divided by area as a complete structural assessment. MIS 3002 requires assessment by competent persons, escalation for unusual or doubtful roof structures, and a qualified structural engineer's involvement for roof capacity under PV and proposed ballast on flat roofs ([MCS Solar PV Standard, Sections 5.1.4 and 5.9](https://mcscertified.com/wp-content/uploads/2026/03/MIS-3002_Solar-PV-Systems-V6.0-Final.pdf)).

### Generation, consumption and financial estimates

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| ENG-01 | P0 | Produce versioned annual and monthly PV estimates per array and aggregate them without hiding different orientations. | Validated yield method |
| ENG-02 | P0 | Provide the applicable standard MCS estimate/disclosures separately from supplementary simulation results. Label method, shading source, assumptions and limitations. | Approved MCS implementation and data rights |
| ENG-03 | P0 | Support residential annual consumption plus a labelled profile, and commercial interval CSV imports. Commercial proxy profiles are allowed only as preliminary assumptions. | Time-series engine |
| ENG-04 | P0 | Calculate PV-only self-consumption, grid import and export using the selected supported method. Do not derive self-consumption by subtracting annual totals alone. | Validated method |
| ENG-05 | P0 | Produce customer-editable import/export tariff assumptions and a transparent PV-only cash-flow forecast with replacements, degradation and optional discounting. | Pricing and energy results |
| ENG-06 | P0 | Record shading as a sourced assessment input; support attached external shade reports. Do not infer “no shade” from the absence of an obstacle drawing. | SUR-03 |
| ENG-07 | P1 | Add battery dispatch, usable capacity, charge/discharge limits, efficiency, reserve, grid charging and tariff schedules. | Validated dispatch model |
| ENG-08 | P1 | Add automated shading and smart-meter/data-provider integrations. | Licensing and validation |

MIS 3002 specifies its annual-generation estimate, self-consumption methodology references, customer presentation and warning text, including remote-assessment disclosure and the relative prominence of alternative estimates ([MCS Solar PV Standard, Section 4 and Appendix B](https://mcscertified.com/wp-content/uploads/2026/03/MIS-3002_Solar-PV-Systems-V6.0-Final.pdf)). ENG-02 is therefore a release dependency for an MCS-labelled proposal; supplementary PVGIS output alone must not be labelled the standard MCS calculation.

If a qualifying MCS implementation is not ready, the internal alpha may generate explicitly non-MCS preliminary estimates, but it cannot pass the P0 production release gate. Similarly, a battery option may be priced without modelled battery benefits, but must not inherit the PV-only savings and label them “solar and battery savings.”

### Quotes and customer proposals

| ID | Priority | Requirement and minimum behaviour | Dependency |
|---|---|---|---|
| QTE-01 | P0 | Derive a materials list from panels, inverters and supported mounting schedules; expose manual items and quantity overrides with reasons. | Design/BOM engine |
| QTE-02 | P0 | Add labour, access equipment, scaffolding, survey, engineering, travel and contingency as explicit priced lines. | Pricing model |
| QTE-03 | P0 | Store purchase cost, sell price, discount, gross margin and markup separately. Customer output never includes internal cost or margin. | Permission policy |
| QTE-04 | P0 | Apply effective-dated, approved VAT treatments with eligibility evidence and manual authorised override. Preserve the issued tax basis. | Tax-policy validation |
| QTE-05 | P0 | Generate branded PDF and responsive customer proposal with selected system options, performance, scope, exclusions, terms and validity date. | Document templates |
| QTE-06 | P0 | Create a revocable, high-entropy, expiring proposal link to a frozen issue, not the live working project. | Secure portal |
| QTE-07 | P0 | Capture customer acceptance of exactly one option, identity/contact details, declaration, timestamp, document hash and terms version. | Frozen proposal issue |
| QTE-08 | P0 | Support expiry, withdrawal, rejection, supersession and change-order versions. An accepted offer cannot be silently amended. | State machine |
| QTE-09 | P1 | Add specialist e-signature provider, payment collection and accounting integrations. | Provider selection |

Customer acceptance in P0 is an auditable acceptance record, not a claim of a particular signature assurance level. Terms, consumer cancellation information and deposit language require legal review before live customer use.

HMRC's current guidance provides temporary zero-rating for qualifying installed energy-saving materials, distinguishes installation from supply-only sales, and states that the temporary zero rate ends on 31 March 2027 with the reduced rate applying from 1 April 2027 ([HMRC VAT Notice 708/6](https://www.gov.uk/guidance/vat-on-energy-saving-materials-and-heating-equipment-notice-7086)). The software must not apply a permanent “UK solar = 0% VAT” rule or use residential relief indiscriminately for commercial work.

## Acceptance criteria

These criteria supplement the detailed requirements and form the minimum test contract. A developer marking a requirement complete must link the relevant automated test or recorded manual test.

### Access, survey and project management

- **AC-01, tenant isolation:** Given users in organisations A and B, when a user in B requests any A project, attachment, queue output or export by identifier, then access is denied and no A data or existence-sensitive detail is returned.
- **AC-02, role restrictions:** Given a designer without technical-review permission, when they attempt to release a pack or grant themselves reviewer capability, then the server rejects the operation.
- **AC-03, uncertain survey:** Given a roof pitch marked estimated and roof structure marked unknown, when a preliminary proposal is issued, then it shows applicable assumptions; when installation release is requested, then the unresolved structural requirement blocks release.
- **AC-04, alternatives:** Given two options under one project, when one option's panel count or price changes, then the other option's issued records remain unchanged.

### Geometry and catalogue

- **AC-05, calibrated import:** Given a synthetic plan with a 10 m reference line, when calibrated and reloaded, then the model retains 10 m within 1 mm numerical tolerance; the UI makes no claim that the source image itself has this accuracy.
- **AC-06, pitched projection:** Given a rectangular roof plane with known pitch and module dimensions, when modules are placed, then an independently checked fixture confirms roof-plane dimensions and plan projection without treating the plan view as the sloped length.
- **AC-07, exclusions:** Given a roof with an obstacle, setback and access corridor, when auto-fill runs, then no module footprint breaches those constraints; infeasible areas return no modules and an explanation.
- **AC-08, invalid geometry:** Given a self-intersecting roof, zero-area face or module outside the roof, when saved or exported, then a specific error is shown and the affected release operation is blocked.
- **AC-09, catalogue change:** Given an issued design using module specification version A, when an admin changes the catalogue to B, then the issued design still displays A; importing B creates a new working revision.

### Electrical and mounting

- **AC-10, unsafe string:** Given a test string whose cold Voc exceeds the selected inverter limit, when checks run, then the failed limit, calculated value, temperature and affected string are visible and native installation release is blocked.
- **AC-11, incomplete electrical data:** Given missing module coefficients or an ambiguous shared-MPPT current rating, when validation runs, then the outcome is “Not evaluated” or “Review required,” never “Pass.”
- **AC-12, parallel inputs:** Given two strings sharing an MPPT, when current checks run, then the engine evaluates aggregate MPPT limits and separate connector limits according to the product model.
- **AC-13, grid aggregation:** Given existing generation plus new PV or externally specified storage, when grid-route guidance runs, then all relevant equipment is included and unknown operating relationships force manual review.
- **AC-14, NI route:** Given a Northern Ireland site, when grid guidance is requested, then no GB form or automatic GB route approval is generated.
- **AC-15, changed mounting:** Given structural evidence covering layout A, when a new row, mounting family, fixing pattern or ballast value is introduced, then the relevant approval becomes stale until revalidated.
- **AC-16, external evidence:** Given a flat-roof commercial array without its required structural report, when release is requested, then it is blocked even if all geometric checks pass.

### Energy, quotes and revisions

- **AC-17, energy balance:** Given a PV-only interval fixture, when simulated, then generation equals self-consumed generation plus export plus any explicitly modelled curtailment; load equals PV self-consumption plus imports, within the defined rounding tolerance.
- **AC-18, time handling:** Given Europe/London interval data spanning clock changes, when imported, then ambiguous or absent timestamps require explicit resolution and no intervals are silently duplicated or dropped.
- **AC-19, missing data:** Given incomplete commercial consumption data, when savings are requested, then the gap report and any profile substitution are visible; final commercial savings cannot be issued without reviewer confirmation of the chosen treatment.
- **AC-20, estimate presentation:** Given an MCS-labelled proposal with supplementary modelling, when generated, then the approved standard estimate and warning blocks are present and the alternative result is not given greater prominence.
- **AC-21, tax transition:** Given a quote crossing an effective-dated VAT policy boundary, when a new issue is created, then tax treatment is re-evaluated against the recorded tax-point assumptions; accepted historic issues are not rewritten.
- **AC-22, customer confidentiality:** Given a proposal with internal purchase costs and notes, when accessed through the customer portal or PDF, then those fields are absent from both visible content and returned payloads.
- **AC-23, exact acceptance:** Given an issued proposal, when its selected option is accepted, then the acceptance references the immutable issue, total, terms and hash; a concurrent design edit cannot alter them.
- **AC-24, replay protection:** Given an expired, revoked or already processed acceptance token, when submitted again, then the operation is rejected or safely returns the prior outcome without creating a second acceptance.
- **AC-25, stale outputs:** Given any input change affecting a calculation or drawing, when the editor saves, then affected outputs are marked stale; an old queued job completing later cannot overwrite the new revision.

## Workflow and information architecture

### Primary workflow

The main navigation should follow the work rather than expose database entities. Each step displays completion, assumptions, blocking items and the revision being edited.

1. Create project and confirm site/nation.
2. Complete or attach survey information.
3. Calibrate source plan and draw roof faces.
4. Place panels and define mounting constraints.
5. Select equipment, configure strings and complete electrical details.
6. Review generation, consumption and financial assumptions.
7. Generate materials and quote options.
8. Run quality checks and issue a preliminary or fully reviewed proposal.
9. Record customer acceptance against the issued version.
10. Complete engineering review and release installation drawings.
11. Record installation changes, generate as-built records and close the project.

Steps 8–10 need not happen in one order. Customer acceptance does not itself approve engineering, and technical approval does not itself create a customer contract.

### Screens

| Screen | Required content |
|---|---|
| Project list | Search, stage, owner, nation, next action and last change |
| Project overview | Customer/site, options, status, activity, blockers and latest issued documents |
| Survey | Structured sections, photo upload and provenance badges |
| Design workspace | Canvas, layers, roof/module properties, totals, constraints and undo/redo |
| Equipment and strings | Equipment tree, MPPT allocations, circuits and check results |
| Mounting and structure | Fixing/rail layout, external schedules, load summary and review evidence |
| Energy | Method selector, assumption inputs, generation/load charts and import diagnostics |
| Quote builder | BOM, manual lines, cost/sell view, VAT basis and margin summary |
| Review centre | Rule outcomes, missing evidence, reviewer decisions and revision comparison |
| Documents | Preview, issue history, supersession and export jobs |
| Customer proposal | Selected options, scope, assumptions, terms and acceptance |
| Organisation settings | Branding, users, templates, catalogue, tax policies and review policies |

### Desktop and mobile behaviour

Desktop is the primary design environment, targeting a minimum 1280 × 800 viewport. The survey interface and customer proposal must work on mobile; full mobile roof editing is P1.

Use metres and millimetres where appropriate, with explicit units beside numeric inputs. Show kW, kWp, kVA, kWh, A and V distinctly rather than using a generic “power” field.

## State machines and review policy

### Independent statuses

Avoid one overloaded project status that implies more than has been approved. The following state machines are authoritative and their transitions must be enforced server-side.

| Object | States |
|---|---|
| Working design revision | Draft → Ready for review → Under review → Reviewed; edits create a new Draft |
| Technical package | Preliminary → For review → Approved for installation → Superseded; separate As-built reviewed issue |
| Proposal issue | Draft → Issued → Accepted / Rejected / Expired / Withdrawn / Superseded |
| DNO record | Not assessed → Route review → Prepared → Submitted → Information requested → Approved/conditions recorded → Commissioning/notification recorded |
| External evidence | Uploaded → Linked → Reviewed → Stale / Superseded |

Review outcomes must include reviewer identity, capability, scope, revision hash, timestamp, evidence and limitations. For multi-user organisations, the default is that the technical author cannot approve their own package; any explicitly permitted sole-practitioner policy must be documented and visible in the audit record.

### Finding severity

- **Error:** A known invalid condition within the native supported calculation scope; blocks release until corrected.
- **Review required:** A missing input, unsupported condition or specialist judgement; blocks relevant release until addressed by a permitted process.
- **Warning:** A disclosed limitation or non-blocking issue requiring acknowledgement.
- **Information:** A contextual note, input provenance or method limitation.

A generic “override” button is prohibited. Where the native scope is insufficient, the designer may switch to an external engineered-design route, attach the full supporting evidence and obtain approval; the failed native result remains visible and is labelled superseded by the external design, not converted into a pass.

Technical release requires current layout, supported electrical outputs or reviewed external equivalents, structural/mounting evidence, connection requirements recorded, permission responsibilities recorded and all applicable blocking findings resolved. The application must distinguish permission to install from permission to energise or export.

### Revision and dependency rules

Create immutable snapshots at proposal issue, review submission, technical release and as-built issue. Each snapshot includes selected products, geometry, inputs, rule results, method versions, price/tax basis, terms and template versions.

Changing geometry invalidates affected layout, mounting, shading, electrical allocation, generation, BOM, quote and drawing results. Changing tariffs invalidates finances and proposal projections but not the roof geometry; changing a customer telephone number need not invalidate an electrical review.

Each calculation/document job receives a revision ID and input hash. Persist results against that revision only, use idempotent completion, and never serve an output as current if its hash differs from the current inputs.

## Calculation specification

### Units, coordinates and precision

Use explicit unit-bearing application types. Store geometry in metres, electrical values in documented SI units, energy in Wh or a fixed-precision kWh representation, and money in integer pence or exact decimal values with an explicit rounding policy.

Coordinates for the drawing engine use a local projected Cartesian frame. Store geographic coordinates separately, record the source CRS, and retain each roof's local plane transform.

Azimuth must use one internal convention, recommended degrees clockwise from true north. Convert explicitly at each external interface; no adapter may assume its provider uses the same convention.

### Electrical calculation boundaries

The initial engine should be deterministic and independently testable. A solar electrical specialist must approve the formulas, permitted inputs and boundary cases before enabling release.

- **Temperature correction:** When the manufacturer provides a relative temperature coefficient, calculate corrected voltage as \(V(T) = V_{\mathrm{STC}}[1+\beta(T_{\mathrm{cell}}-25)]\), using the coefficient's documented fractional units. Do not confuse a percentage-per-degree coefficient with an absolute-voltage coefficient.
- **String voltage:** Evaluate series voltage at documented low/high cell-temperature assumptions and compare against applicable absolute DC limits and MPPT/start-up behaviour.
- **Current limits:** Aggregate parallel strings using the inverter's actual input/MPPT topology. Any required design factors must be part of the approved method, not an unexplained hard-coded multiplier.
- **Cable estimates:** Record conductor material, length convention, resistance source, temperature and circuit assumptions; compare against specialist-approved limits.
- **Unimplemented checks:** Explicitly list current-capacity derating, detailed fault protection, prospective fault levels, selectivity, harmonics, structural fire performance or any other unimplemented assessment as outside native scope.

Passing a limited check must be labelled with the check's name, not “electrical compliant.” Where the product data cannot represent the manufacturer's restrictions, require review instead of simplifying away the restriction.

### Energy modelling

Provide separate adapters for the approved MCS estimate and supplementary interval generation. Preserve methodology, software version, weather/source dataset, location, orientation, losses and any shading adjustment.

PVGIS offers versioned API tools and hourly PV production through its non-interactive service; its documentation disallows AJAX access and defines request limits ([European Commission JRC PVGIS API documentation](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en)). Use a backend adapter, caching, retry/backoff and recorded source responses rather than direct browser requests or an unversioned dependency.

For PV-only interval modelling, define \(G_t\) as usable generation and \(L_t\) as demand in the same interval:

\[
S_t=\min(G_t,L_t), \qquad I_t=L_t-S_t, \qquad X_t=G_t-S_t
\]

If an export cap is modelled, cap \(X_t\) at the permitted interval energy and record the remainder as curtailment; do not quietly add curtailed energy to self-consumption. The model is a simplified energy balance and must disclose that interval resolution can affect self-consumption accuracy.

For CSV imports:

- **Required mapping:** Timestamp, energy/power column, units, interval duration and timezone.
- **Validation:** Duplicate rows, ordering, missing intervals, negative values, nonnumeric values, cumulative versus interval readings and import/export channel ambiguity.
- **Clock changes:** Store UTC timestamps and retain source timezone/offset; require disambiguation of repeated local times.
- **Resolution:** Do not invent independent half-hour generation detail from hourly PV data. Use a documented aggregation or interpolation policy and disclose its limitation.
- **Coverage:** Report date coverage, annual total, gaps and any filled data; partial-year annualisation must be explicit and preliminary unless reviewed.
- **Performance:** Import at least 20,000 interval rows per project without blocking the browser.

Residential MCS self-consumption and supplementary interval modelling remain separate methods. Commercial proxies or atypical demand must not be forced into a domestic occupancy archetype simply because it is the easiest available input.

### Financial calculations

Financial outputs are estimates, not guaranteed savings. The P0 model should calculate the counterfactual bill and the with-PV bill under the same tariff assumptions and present their difference.

- **Annual benefit:** Avoided import charges plus export revenue, less additional operating costs and any explicitly modelled demand-related charges.
- **Cash flow:** Initial installed cost, disclosed grants if entered, annual net benefits, replacements and end-of-horizon assumptions.
- **Payback:** First point cumulative undiscounted cash flow becomes non-negative; show “Not reached within forecast” where appropriate.
- **NPV:** Optional \(NPV=-C_0+\sum_{t=1}^{n}CF_t/(1+r)^t\), with the discount rate stated.
- **Commercial VAT:** Record whether forecasts are gross or net of recoverable VAT. Never assume recovery solely from the word “commercial.”
- **Tariffs and uncertainty:** Record import/export prices, annual escalation and degradation assumptions; provide a zero-escalation sensitivity scenario.
- **Demand charges:** If the commercial tariff includes a material component the model cannot represent, show the exclusion and require review before issuing final savings.

Prevent double counting: self-consumed PV is valued as avoided import, exported PV as export revenue, and neither may simultaneously be credited with both. Battery benefits remain unavailable in P0 unless supplied as separately labelled, reviewed third-party modelling.

### Pricing calculations

Store unit cost and unit sell price independently. Calculate gross margin as \((sell-cost)/sell\) and markup as \((sell-cost)/cost\), treating zero denominators explicitly.

Apply discounts, tax rounding and allocation in a documented order. Reconcile quote line totals, VAT summary, option totals, PDF totals and acceptance totals to the penny.

Do not infer the VAT tax point solely from the proposal date. Record the assumption used and require confirmation where timing, deposits, supply classification or eligibility affects treatment.

## Document output specification

### Customer proposal

The proposal is a sales document with transparent technical and financial assumptions. It must identify whether the design is preliminary or technically released.

- **Identity and scope:** Installer details, customer/site, project and quote references, issue/expiry dates and selected option.
- **System summary:** Module/inverter quantities, DC/AC capacity, roof illustration and product summaries.
- **Performance:** Required method-specific estimates and warnings, monthly generation, consumption assumptions and shaded/remote assessment disclosures.
- **Commercial offer:** Scope, exclusions, access/scaffolding, price, VAT treatment, payment milestones if configured and variation policy.
- **Financial estimate:** Inputs, savings, cash flow, replacements and uncertainty, with no guaranteed-performance wording.
- **Terms and acceptance:** Reviewed terms version, cancellation information where applicable, exact option selection and recorded acceptance.

Customer-accessible payloads must use a dedicated allowlisted DTO, not a filtered copy of a full internal project response. Proposal graphics must not reveal private survey notes, security-sensitive site annotations or imagery that cannot legally be redistributed.

### Technical drawing pack

| Sheet | P0 content | Release condition |
|---|---|---|
| General/site plan | Address, north, roof references, equipment positions, access notes and scope | Confirmed site and survey basis |
| Roof layout | Dimensioned modules, stable IDs, obstructions, setbacks and array totals | Geometry reviewed |
| String layout | String colours/labels, module assignments, MPPT allocation and cable route intent | Electrical allocation complete |
| Single-line diagram | PV strings, inverter, protection/isolation, metering, connection and applicable export control | Specialist-reviewed diagram model |
| Mounting layout | Rail/fixing positions or externally supplied schedule mapped to array | Validated family/evidence |
| Structural information | Roof assumptions, included loads, report references, ballast/fixing schedule where applicable | Required external assessment approved |
| Schedules and notes | Equipment, cables, implemented checks, exclusions and evidence register | Current revision and reviews |

Every sheet needs a drawing number, title, revision, project reference, issue purpose, author, checker and date. Scaled views need scale bars and intended paper size; schematic or uncalibrated views must say “Not to scale.”

P0 exports are PDF for complete packs, SVG for generated vector drawings and DXF for supported 2D roof/module/mounting geometry. DXF must declare millimetres or metres, include named layers and retain stable IDs; electrical CAD symbol interchange, DWG and BIM/IFC are P1/P2.

The structural-information sheet must not be titled “Structural certificate” unless it is an actual externally issued certificate reproduced with permission. Author, engineer and source organisation must remain attributable.

### Handover support

P0 includes an evidence checklist and exportable document bundle containing reviewed/as-built plans, product datasheets, warranties, externally completed commissioning records and connection records. It does not automatically generate test results, impersonate an engineer or issue an MCS certificate.

## Data model

Use a relational source of truth with immutable snapshots and object storage for uploaded/generated files. Tenant-owned tables must include `organisation_id`, server-enforced authorisation and audit timestamps.

| Entity | Essential fields and relationships |
|---|---|
| Organisation | Legal/display name, branding, contact, locale, retention and review policies |
| User / Membership | Identity-provider subject, organisation, role/capabilities, invitation/disabled status |
| Customer | Organisation, type, contact details, communication preferences |
| Site | Customer, structured address, nation, postcode, coordinates, network operator, supply characteristics |
| Project | Site, owner, project class, milestones, scope limits, archive status |
| Survey / Observation | Project, field/value/unit, source, confidence/provenance, author, observed date, attachment |
| DesignOption | Project, option name, current revision pointer |
| DesignRevision | Immutable input snapshot/hash, parent, author, timestamp, scope/method versions |
| RoofFace | Revision, plan polygon, roof-plane transform, pitch, azimuth, type and provenance |
| Obstruction / Constraint | Revision/roof, polygon, height if known, kind, source and rule |
| ModulePlacement | Revision, stable ID, product snapshot, roof-plane coordinates and orientation |
| EquipmentInstance | Revision, product snapshot, quantity/identifier, position and phase allocation |
| String / MPPTAssignment | Revision, module membership, inverter/MPPT input, topology |
| Circuit | Equipment endpoints, length, conductor, installation assumptions and protection |
| MountingDesign | Revision, family snapshot, rails/fixings/ballast schedule, external evidence |
| ConsumptionDataset | Site, period, resolution, timezone, units, validation summary, source object |
| TariffAssumption | Rates, schedule if supported, effective period, VAT basis, source |
| CalculationRun | Revision/input hash, method/version, inputs, results, warnings, source response and status |
| RuleFinding | Revision, rule/version, severity, affected entities, values, resolution and evidence |
| Quote / QuoteLine | Revision, cost/sell snapshots, quantities, discounts, taxes and manual override reasons |
| ProposalIssue / Option | Frozen option/revision/quote refs, terms/template versions, issue/expiry, customer payload hash |
| TechnicalReview | Revision, discipline/scope, reviewer, decision, limitations, evidence and input hash |
| DocumentIssue / DrawingSheet | Revision, drawing numbers, purpose, template version, hashes and storage references |
| Acceptance | Proposal issue/option, accepted totals/hash, declaration, identity evidence and timestamp |
| GridConnectionRecord | Route, operator, capacities, export conditions, evidence and manual decision |
| Attachment | Tenant/project ownership, MIME, size, hash, source, scanning state, retention class |
| AuditEvent | Actor, organisation, action, object, timestamp and safe structured change summary |

Store large interval series in partitionable rows or immutable compressed objects with queryable metadata; do not put thousands of readings into normal project-list responses. Snapshot geometry and product specifications as structured JSON where useful, while keeping identifiers, ownership, relationships and searchable fields relational.

Audit events must not contain plaintext proposal tokens, credentials, full uploaded bills or unrestricted copies of personal information. Keep enough information to explain a change without creating a second uncontrolled data store.

## Recommended technical architecture

### Stack decision

Recommended baseline: Laravel API/backend, React with TypeScript frontend, PostgreSQL, Redis-backed queues and S3-compatible private object storage. This is a proposed stack for a small team; it is not a product requirement and can be changed before implementation without changing the workflows or acceptance criteria.

Use a modular monolith initially. Avoid microservices until there is demonstrated scaling or organisational need.

- **Frontend:** React/TypeScript, accessible component system, SVG-based 2D editor and a shared geometry library; add WebGL/3D only in P1.
- **Backend modules:** Identity/tenancy, projects/surveys, catalogue, design, calculations, pricing, documents, reviews and customer access.
- **Geometry:** Explicit roof-plane transforms and robust polygon operations; share fixtures between client and server and revalidate submitted geometry server-side.
- **Calculation boundary:** Pure deterministic functions with versioned schemas; server outputs are authoritative. Client previews cannot approve a system.
- **Jobs:** Yield retrieval, CSV processing, report generation and exports run in idempotent background jobs.
- **Documents:** Controlled HTML-to-PDF proposal templates and vector-first drawing generation; pinned fonts and render versions.
- **Storage:** Private buckets, short-lived authorised download URLs, content hashes and separate upload/generated namespaces.
- **Infrastructure:** Managed database where practical, separate development/staging/production, automated backups and infrastructure-as-code.

### Conceptual data flow

`Survey + catalogue snapshots → design revision → calculations/findings → energy + BOM/pricing → proposal issue and technical review → immutable documents → acceptance/as-built records`

The customer portal reads only the frozen proposal projection. It must not query or mutate working design entities.

### API surface

The following REST-style endpoints establish resource boundaries; exact route naming is an implementation detail. Every mutating operation requires validation, authorisation and appropriate concurrency/idempotency controls.

| Route family | Operations |
|---|---|
| `/projects`, `/customers`, `/sites` | Create, read, update, list and archive |
| `/projects/{id}/surveys` | Observations, evidence links and completion checks |
| `/projects/{id}/design-options` | Options and working revisions |
| `/design-revisions/{id}/geometry` | Roofs, placements, exclusions and mounting geometry |
| `/design-revisions/{id}/electrical` | Equipment, strings, circuits and topology |
| `/design-revisions/{id}/validate` | Queue/retrieve versioned findings |
| `/design-revisions/{id}/calculations` | Yield, energy and financial runs |
| `/consumption-imports` | Upload, map, validate, confirm and inspect |
| `/design-revisions/{id}/quotes` | BOM, manual lines, pricing and tax review |
| `/proposal-issues` | Preview, issue, withdraw, supersede and retrieve |
| `/technical-reviews`, `/document-issues` | Review decisions, controlled release and exports |
| `/public/proposals/{token}` | Restricted frozen customer view and exact-option acceptance |
| `/jobs/{id}` | Tenant-authorised job status, failure details and output references |

Use optimistic concurrency with revision/ETag conflicts rather than silent last-write-wins. The MVP can warn that another user is editing a design; real-time collaborative geometry editing is P1.

### External integrations

P0 must work without a wholesale supplier account or paid CRM integration. All providers sit behind adapters, and unavailable providers must not become fabricated values.

- **Yield:** Server-side PVGIS adapter plus versioned supported MCS datasets/method.
- **Maps/address lookup:** Optional licensed provider; manual address and calibrated plan upload remain supported.
- **Equipment/prices:** CSV and admin entry first; supplier APIs are P1.
- **Email:** Transactional provider for invitations and explicitly initiated proposal notifications; do not send proposals automatically on generation.
- **Mounting/engineering:** Document and structured schedule import; manufacturer calculation APIs are P1.
- **DNO:** Reviewable export/checklist and attachments only; no direct submission in P0.

Validate commercial rights and required attribution for imagery, weather datasets, standards tables, symbols, manufacturer content and customer document redistribution before activation. Do not scrape competitors' catalogues or reproduce proprietary calculation logic.

## Security, privacy and operational requirements

Privacy requirements need to be designed into customer/site records, consumption data and uploaded documents. ICO guidance describes data protection by design/default and requires controllers to apply appropriate technical and organisational measures, with data minimisation and privacy across the processing lifecycle ([ICO data protection by design guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-by-design-and-by-default)).

The following are proposed implementation controls, not claims that any one control alone establishes legal compliance:

- **Access:** Server-side tenant filtering, least-privilege roles, privileged MFA, secure session lifecycle and rate limiting.
- **Customer links:** At least 128 bits of random entropy, hashed token storage, expiry, revocation, `noindex`, restrictive referrer policy and no third-party analytics on sensitive proposal pages.
- **Uploads:** MIME/content validation, malware scanning, size limits, quarantine before processing and sanitised SVG/image handling.
- **Rendering:** No executable user HTML; restrict PDF renderer network/file access to prevent SSRF and local-file disclosure.
- **Encryption:** TLS in transit, encrypted managed storage/backups and managed secrets outside source control.
- **Retention:** Configurable retention classes, access/export/deletion workflows and documented legal-hold handling. Preserve necessary contract records under an approved policy, not indefinite blanket retention.
- **Privacy governance:** Document controller/processor responsibilities, subprocessors, processing agreements and international transfer decisions; assess whether a DPIA is required.
- **Hosting:** Prefer a documented UK-region deployment initially, without claiming that UK GDPR universally mandates UK hosting.
- **Monitoring:** Structured logs with redaction, error tracking, security events and alerting on queue failures and abnormal access.
- **Support access:** Time-limited audited access approved by the installer; no routine impersonation or unrestricted production database browsing.

### Non-functional targets

These are initial release targets to verify in a named staging environment with representative data. External-provider waiting time must be measured separately from the application's processing time.

| Area | P0 target |
|---|---|
| Ordinary API reads | p95 under 500 ms server time under 20 concurrent active users |
| Roof editing | Common drag/select operations under 100 ms at the supported 150-module limit on reference hardware |
| Save acknowledgement | p95 under 2 seconds excluding network disruption; visible unsaved/saved/failed states |
| PDF proposal generation | p95 under 60 seconds on reference fixtures, excluding third-party yield retrieval |
| Drawing pack generation | p95 under 120 seconds for supported layouts |
| Availability | Initial operational objective of 99.5% monthly, not a customer SLA until measured |
| Recovery | Proposed RPO 24 hours and RTO 8 hours, verified by restore drill before production |
| Browser support | Current stable Chrome/Edge/Firefox and Safari, verified at release |
| Accessibility | Aim for WCAG 2.2 AA for forms/portal; keyboard alternatives and accessible property controls for canvas tasks |
| Integrity | No accepted-quote mutation, no cross-tenant access and no unsupported calculation silently marked passed |

Warn users before closing with unsaved changes, retain a recoverable working draft where safe, and show generation failures with retry options. Never replace a failed calculation with zero generation or a previously cached result without labelling its age and revision.

## Validation and QA strategy

### Automated test layers

- **Unit:** Geometry transforms, collision checks, temperature correction, topology/current logic, units, cash flows, margin/markup, VAT rounding and revision invalidation.
- **Property-based:** Non-negative capacities, geometry containment, unique module assignments, energy conservation and monetary reconciliation.
- **Integration:** Tenant scoping, provider adapters, CSV imports, immutable snapshot creation, queued job idempotency and permission transitions.
- **End-to-end:** Survey-to-proposal, exact acceptance, technical release, supersession and as-built flow.
- **Output regression:** PDF text/visual comparison, SVG/DXF scale, label placement, missing fonts, multipage drawings and paper-size handling.
- **Security:** Object-level authorisation, token replay, unsafe uploads, SSRF, XSS, CSV injection and restricted support access.

### Minimum golden project set

Create independently reviewed fixtures before enabling customer-facing production output. Expected values must come from approved calculations and evidence, not from accepting whatever the new engine produces.

| Fixture | Purpose |
|---|---|
| Single pitched residential roof | Basic geometry, one inverter, one/two strings and ordinary proposal |
| East/west residential roofs | Multiple orientations, separate generation and MPPT mapping |
| Obstructed roof with remote survey | Shading assumptions, exclusions and warning presentation |
| Three-phase commercial pitched roof | Multiple inverters, aggregate grid information and interval demand |
| Commercial flat-roof array | Row spacing, imported ballast/fixing schedule and external structural gate |
| Existing PV with added equipment | Aggregate generation and uncertain legacy specification |
| Northern Ireland project | NI-specific manual route, no reused GB automatic output |
| Deliberately invalid electrical layout | Voltage/current limits, incomplete topology and release blocking |
| VAT-policy-boundary quote | Effective dates, tax-point review and historic issue preservation |
| Clock-change/missing-data import | Timezone resolution, duplicate/gap reporting and energy totals |
| Concurrent edit/slow job | Revision conflicts and prevention of stale result overwrite |
| Cross-tenant attack fixture | Project, files, job outputs and customer views remain isolated |

### Specialist validation

An appointed electrical designer must approve the native calculation scope, SLD templates, limits and unknown-state behaviour. A mounting/structural specialist must approve the supported mounting families, output wording and evidence gates.

A reviewer familiar with current MCS requirements must validate generation/self-consumption outputs, disclosures and permitted presentation. Tax and consumer terms must be reviewed by appropriate advisers; software developers should not infer compliance from a template's professional appearance.

## Success metrics and instrumentation

The pilot should measure whether users finish useful work, not merely whether they open the roof editor. Track events without placing customer personal information into analytics payloads.

| Metric | Definition | Review window |
|---|---|---|
| Activation | Organisation creates a surveyed project, valid layout and first proposal issue | First 14 days |
| Time to first proposal | Active task time from first project creation to first issue, excluding known waiting periods | Weekly during pilot |
| Workflow completion | Projects reaching reviewed technical pack divided by projects designated pilot-complete | Monthly |
| Proposal consistency | Issued packs with zero reconciliation mismatches | Every issue |
| Engineering rework | Reviewer changes categorised as survey issue, unsupported scope, installer change or software defect | Every reviewed pack |
| Draft recovery | Save/conflict incidents with successful recovery | Weekly |
| Blocker resolution | Time to resolve a meaningful technical finding, without incentivising overrides | Monthly |
| Retention | Pilot organisations completing another real project after first completion | 30/60 days |

Track proposed targets from the Goals section alongside sample sizes. Quote acceptance rate is a useful later business metric, but it is affected by installer pricing, lead quality and other factors outside the product.

## Delivery sequence and release gates

Implement vertical slices with testable exits. Do not spend the initial release building advanced 3D while project revisioning, calculations and document consistency remain unresolved.

### Foundation and validated design decisions

Deliver tenant authentication, project skeleton, data dictionary, unit/coordinate conventions, revision model and CI/staging. Obtain sample installer documents and define the independent electrical/structural/MCS validation process.

Exit gate: approved support envelope, reviewed data model, automated tenant-isolation tests and at least three agreed golden-project inputs. Confirm rights to the minimum datasets before depending on them.

### Roof-to-materials internal alpha

Deliver calibrated plan upload, planar roof editor, manual module layout, constraints, catalogue snapshots and an initial BOM. Use synthetic/test data only for preliminary outputs.

Exit gate: pitched-projection, containment and persistence tests pass; a designer can reproduce a reference residential and commercial layout without a CAD workaround.

### Electrical and reviewed drawing workflow

Deliver string/MPPT mapping, limited validated checks, cable/protection records, mounting evidence, SLD/roof drawings and technical review states.

Exit gate: independent specialists verify supported fixtures; unknowns and invalid conditions block release correctly. No automatic certification claims appear in UI or documents.

### Estimates, pricing and proposals

Deliver approved estimate methods, consumption import, PV-only financials, price/tax model, frozen PDF/web proposals and audited acceptance.

Exit gate: standard disclosures and tax logic approved; totals reconcile; accepted records are immutable; external yield outages and partial data are handled honestly.

### Commercial and operational pilot

Deliver supported flat-roof workflows, external structural schedule mapping, three-phase fixtures, all four nation paths and customer/support controls. Conduct supervised residential and commercial pilots.

Exit gate: the minimum real-project sample is complete, no unresolved critical defects exist, reviewer feedback is addressed and restore/security tests pass.

### Production readiness

Complete onboarding, terms/privacy documents, support runbooks, monitoring, dataset update responsibilities and incident procedures. Publish a clear feature/support matrix to users.

Exit gate: all P0 requirements and acceptance criteria are met, specialist approvals are recorded, production backup restore is demonstrated and unsupported workflows cannot accidentally receive native approval.

No calendar estimate is asserted in this specification because team capacity, dataset access and validation effort are unknown. Estimates should follow a technical spike on geometry, document generation and the calculation datasets.

## Backlog after MVP

### P1: deepen the existing workflow

- **Design:** 3D visualisation, validated shading, string suggestions and richer roof types.
- **Battery:** Electrical templates and time-series dispatch with clearly separated PV/storage energy origins and tariff assumptions.
- **Engineering:** Additional mounting families, supported structural assessment methods and richer electrical cable/protection checks.
- **Commercial:** Expanded capacities only after independent engineering validation, more tariff structures and approved large-project workflows.
- **Operations:** Supplier pricing, branded e-signatures, payments, accounting/CRM integration and more automated handover.
- **Geography:** Fully validated NI route/form support and deeper nation-specific permission assistance.

### P2: broader platform capabilities

- **Advanced modelling:** LiDAR/photogrammetry, automated roof detection and optimisation with explainable constraints.
- **Engineering interchange:** BIM/IFC, richer CAD interchange and specialist design-tool connectors.
- **Business management:** Scheduling, purchasing, inventory and field-service workflows where justified by user research.
- **Enterprise:** Public API, webhooks, SSO, complex permission groups and multi-branch reporting.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope expands to full competitor parity | Delayed or unusable first release | Enforce P0 support matrix and explicit unsupported states |
| Attractive drawings imply unearned engineering assurance | Unsafe reliance and liability | Prominent issue purpose, named review, limited-check wording and evidence gates |
| Image geometry is mistaken for a survey | Bad panel fit or fixing design | Calibration/provenance, roof-plane projection and pre-install verification |
| Product specifications are incomplete or ambiguous | Incorrect electrical conclusions | Verified datasets, typed units, topology model and “Not evaluated” outcomes |
| Structural evidence no longer matches layout | Unreviewed installation changes | Evidence-to-revision mapping and dependency invalidation |
| Third-party generation service is unavailable | Broken estimates and proposals | Cached revisioned results, retry/backoff and explicit unavailable state |
| Commercial loads are estimated poorly | Misleading savings | Interval data, proxy disclosures, sensitivity and reviewer confirmation |
| Tax/standards/network rules change | Incorrect current output | Effective-dated rules, named owners and periodic/source-triggered review |
| Supplier imagery/data rights are unresolved | Rework or legal exposure | Upload-first workflow, provider adapters and rights review |
| Accepted proposal and installation diverge | Dispute and inconsistent documents | Frozen acceptance, supersession/change orders and as-built review |
| Cross-tenant data exposure | Privacy/security incident | Server-enforced ownership, least privilege and adversarial tests |
| Single maintainer or specialist bottleneck | Unsupported releases and slow corrections | Documented methods, golden fixtures, runbooks and controlled rollbacks |

## Open questions and decision register

The defaults below allow development planning to proceed. Items marked blocking must be resolved before the indicated release capability, not necessarily before the first line of code.

| Decision | Proposed default | Owner | Blocking point |
|---|---|---|---|
| Initial business model | Multi-tenant installer SaaS; internal admin provisioning, no billing | Product owner | Non-blocking for alpha |
| Technology stack | Laravel + React/TypeScript + PostgreSQL | Technical lead/product owner | Before foundation implementation |
| Native commercial capacity | 50 kWp DC cap and 150-module limit | Product owner + engineering reviewers | Scope approval |
| Mounting families | One pitched and one commercial/flat family | Product owner + mounting specialist | Native mounting release |
| Electrical reviewer | Named competent specialist, defined scope | Product owner | Technical production release |
| Structural review route | External report/schedule with named reviewer | Product owner + structural specialist | Structural production release |
| MCS datasets/method rights | Approved licensed/permitted implementation | Product owner + MCS reviewer | MCS-labelled proposal release |
| Imagery provider | Optional; calibrated upload available by default | Product owner | Only blocks provider activation |
| Batteries | Price and external-design records; native benefits deferred | Product owner | Non-blocking if clearly disclosed |
| NI workflow | Design/quote with manual specialist grid review | Product owner + NI specialist | Native NI automation deferred |
| Acceptance assurance | Audited click acceptance and reviewed terms | Product owner + legal adviser | Customer acceptance release |
| Commercial VAT policies | Effective-dated reviewed policies and override evidence | Tax adviser/product owner | Customer quote release |
| Retention/recovery policy | Configurable classes; proposed RPO/RTO verified in drill | Product owner/security lead | Production |
| Pilot baseline and cohort | At least 5 residential and 5 commercial completed packs | Product owner | Pilot evaluation |

## MVP definition of done

The MVP is complete when an authorised installer can create a real supported UK residential or small commercial project, capture its survey basis, design its roof layout, specify equipment and strings, produce method-labelled energy estimates, generate a reconciled quote, issue a frozen customer proposal, record exact-option acceptance, and release a coordinated technical drawing pack after the required reviews.

Completion additionally requires that unsupported or uncertain cases remain visible, engineering evidence is linked to the actual revision, issued records cannot silently change, privacy boundaries are tested, and the named production release gates are satisfied. The standard is a useful and defensible end-to-end product, not a convincing-looking editor with unverified outputs.
