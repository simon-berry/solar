# Branded, itemised preliminary proposals

Alpha 0.6 adds an explicitly enabled customer-facing presentation to Quote. It remains a preliminary estimate workflow, not a contract, customer acceptance mechanism, payment service or engineering release.

## Prepare the estimate

- **Base prices**: module/mounting quantities follow placed hardware, while inverter, labour, access and other allowances remain manually entered sell prices.
- **Branding**: choose Set up branded proposal, enter the installer/company name, declared contact/registration details, accent, reference and preparer's name. Details belong to this project and are frozen on issue, not independently verified or automatically applied to every organisation project.
- **Scope**: record what is expressly included, excluded and unresolved. Empty scope is disclosed as incomplete rather than assumed to cover everything.
- **Review period**: 1–180 days after issue calculates an estimate review date. It does not create a legally binding offer period.
- **Items**: add up to 40 commercial descriptions with quantities, units and unit prices. Use explicit included lines for storage allowances if intended; selecting a generic battery model never automatically adds a product or installation price.
- **Optional items**: clear Include in estimate total. Optional amounts remain visible as separate pre-VAT alternatives and never silently enter the subtotal or VAT.

The same manually selected VAT rate applies to all included lines. The software does not assess rate eligibility or support mixed-rate tax treatment within one proposal; obtain appropriate review before customer use.

## Penny arithmetic

Unit prices are whole pennies and quantities support at most three decimal places. Line amounts use integer milliunits and round once to the nearest penny, with half pennies rounded upward; the selected VAT rate is then rounded once on the combined included subtotal.

For example, 1.005 units at £1.00 produces a £1.01 pre-VAT line, not £1.00 from binary-float truncation. Optional lines use the same displayed line-rounding rule but contribute nothing to the quoted total.

## Save and issue

Save before creating a proposal. A branded issue requires a nonblank installer/company name; it captures the saved presentation, itemised included/optional amounts, scope, tax basis and report method version in addition to the frozen design and existing electrical/interval reports.

- **PDF**: branded issues use `preliminary-v4`, with a summary, itemised pricing, scope/limitations, source provenance and applicable native report appendices. Light accent colours use dark text for legibility.
- **Quote JSON**: Documents → Frozen itemised quote reports downloads the captured `itemised-quote-v1` monetary breakdown and presentation. This report is stored, not reconstructed from the current working design.
- **Legacy issues**: v1/v2/v3 proposals retain their original data and rendering paths. Unbranded issues continue on v3 and do not retroactively acquire itemised quote JSON; old issue rows gain only a nullable report column.
- **Immutability**: later prices, scope or company details do not rewrite issued documents. This is an application guarantee, not a digital signature, WORM store or protection against a compromised database operator.

Remove branding and additional items from this draft explicitly stores null; it does not delete old issued PDFs/reports. Older clients omitting the proposal field preserve it, while restoring an older revision makes a new saved revision using that historical design.

## Permissions and engineering boundary

Admins/designers and estimators can edit quote presentation and commercial prices/items. Estimators still cannot edit site, layout, hardware, electrical, energy, survey or mounting inputs; reviewers/read-only users can view/download but not edit or issue.

Quote-only changes do not change the engineering-input hash. A commercial description of a battery, mounting item or other allowance is not a technical design input, compatibility check or extension of an external review; an actual system change must separately update and review the relevant engineering scope.

No formal offer acceptance, payment schedule, warranty, consumer contract terms, certified electrical/structural calculation or installation authorisation is supplied. Confirm all release gates before real customer deployment.

## Self-host upgrades

Take and verify a database backup, keep the existing Compose project/volume identity, rebuild the updated source and validate the target host. Migration 006 only adds nullable `quote_report`; no old issue data is rewritten.

Use a runtime that understands v4 before creating or accessing new branded issues. Do not assume an older application binary understands new quote items/templates merely because its older SQL columns remain compatible; test any rollback against a backup without discarding newer records.
