# Survey, evidence and technical review

Alpha 0.5 connects saved designs to survey records, private attachments, external assessments and preliminary technical documents. It does not implement a full engineering calculation suite or grant installation/energisation release.

## Survey and mounting inputs

- **Survey**: record measurement basis, assessor/date, roof covering and condition, structure, support spacing or explicit unknown state, access, equipment locations, grid-route reference and permission responsibilities.
- **Mounting**: download the blank `solar-mounting-v1` JSON template in Survey & review, then populate it only from a specialist/manufacturer schedule. Rails, fixings and ballast use roof-plane metres and exact roof IDs; ballast uses recorded kilograms.
- **Geometry**: imported items are drawn over the roof plane. Duplicate identifiers, missing roofs, out-of-bounds coordinates and zero-length rails produce findings. This is not a manufacturer mounting designer.
- **Loads**: module mass, recorded ballast and optional additional racking mass are subtotals only. Unknown additional mass is not silently represented as known zero; wind, snow, uplift, load distribution, support capacity, fixing strength and ballast adequacy are not calculated.

Save the revision before uploading evidence or submitting an engineering snapshot. Unsaved edits are not included in downloads or submissions.

## Evidence files

- **Allowed files**: PDF, PNG and JPEG, with matching file signature and filename extension. These checks do not establish full format validity, benign content or professional suitability.
- **Limits**: 6 MiB per file, 50 files per project and 200 MiB per workspace. Files are stored as SQLite BLOBs and included in database backups.
- **Metadata**: author, document date, source/reference, category and optional notes accompany every file. The server records the exact bytes' SHA-256, saved revision and engineering-input hash.
- **Privacy**: authenticated downloads are organisation-scoped and use attachment disposition; the preview is visitor-scoped and synthetic-only. Signature checks and browser attachment headers are not malware scanning, encryption at rest or a secure document-management certification.
- **Retention**: this increment has no evidence replacement/deletion, antivirus quarantine, object-store lifecycle or public sharing service. Define retention, erasure, storage protection and scanning before processing real customer evidence.

## Submissions and external assessments

A designer/admin submits a saved engineering snapshot with the exact matching evidence identifiers. The engineering hash includes site address/postcode/nation, geometry, selected/frozen hardware, phase, electrical settings, survey and mounting inputs; quote pricing and tariffs are excluded.

A different authenticated Admin/Reviewer can record electrical, structural or mounting outcomes. Accepting a scope requires the corresponding submitted PDF category, an explicit competence/authority declaration and recorded limitations; the technical author cannot review their own submission. Known native errors cannot be accepted through a generic override.

Changes to engineering inputs make older assessments stale. Pricing-only edits preserve their engineering binding, but newly attached evidence is not automatically covered by an existing submission or decision. Submitting an expanded evidence set requires its own assessment.

The application authenticates the account, not the person's professional accreditation. Reviewer qualifications and report coverage are declared, not independently verified; a recorded acceptance is an assessment of cited external evidence, not a software-issued certificate, native calculation pass or authority to install.

## Technical output

- **Frozen issue**: Documents → Create frozen review pack captures the saved design, hardware, native electrical findings, survey/mounting data, evidence metadata and external-review state. Later edits or decisions do not rewrite that issue.
- **A3 PDF**: vector roof layouts, scale information, imported mounting geometry, stable module identifiers, string/equipment schedules, recorded-mass notes, findings and evidence/review register. Every sheet carries revision, issue identifier, purpose and content hash.
- **Template**: `technical-review-v1` is stored on the issue and included in its hash envelope. Future template versions must preserve the old renderer; legacy preliminary proposal templates remain separate and unchanged.
- **Hash scope**: the technical hash covers the template identifier, captured design and report, not a digital signature, externally timestamped certificate or independently verified PDF-byte signature. Immutability is an application/API guarantee, not a WORM storage or compromised-operator guarantee.
- **External documents**: source PDFs/images are referenced by metadata and content hash, not embedded in the generated pack. Download them separately when sharing a complete review bundle.
- **DXF**: a saved-revision R2000 2D drawing uses roof-plane millimetres, named roof/module/obstruction/rail/fixing/ballast layers and stable IDs in XDATA. Multiple roofs are placed side by side for drafting, not geographically positioned.

This is not a surveyed/georeferenced site plan, complete single-line diagram, protective-device wiring design or structural calculation pack. Cables, protection/isolation, earthing, metering, export/grid controls, battery installation design and all specialist approvals remain external responsibilities.

## Verification and release gates

Run `npm run check`, `npm test` and `npm run build`. With the documented local preview and disposable account-mode servers running, use `npm run test:http` and `npm run test:accounts`; the latter accepts only localhost and a `/tmp/solar-auth-*` fixture database.

Regression coverage includes engineering hash changes, immutable submissions/reports, evidence bytes and scope denial, independent reviewer permissions, stale decisions, native-error rejection, independent DXF parsing and A3 page-count regression. These are software checks using synthetic fixtures, not engineering validation or certification.

Installation/energisation release is always unavailable. A real deployment still needs validated calculation methods and professional scope, target-host HTTPS/security/backups, privacy/retention controls, suitable commercial/battery equipment coverage and customer-facing legal acceptance.
