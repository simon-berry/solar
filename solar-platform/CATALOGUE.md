# Starter catalogue provenance

The alpha contains five exact real-product variants, alongside six clearly separate synthetic legacy entries. Manufacturer-backed means specifications were transcribed from the identified document, not that the complete system is certified, currently stocked or approved for UK installation.

## Module data

- **Trina TSM-440NEG9R.28**: 440 W STC, Voc 52.2 V, Vmp 44.0 V, Isc 10.67 A and Imp 10.01 A ([Trina Solar, TSM_EN_2025_B](https://static.trinasolar.com/sites/default/files/DT-M-0043-G-EN%20K%20Datasheet_Vertex%20S+_NEG9R.28_2025_B_0.pdf)).
- **Trina TSM-450NEG9R.28**: 450 W STC, Voc 52.9 V, Vmp 44.6 V, Isc 10.74 A and Imp 10.09 A ([Trina Solar, TSM_EN_2025_B](https://static.trinasolar.com/sites/default/files/DT-M-0043-G-EN%20K%20Datasheet_Vertex%20S+_NEG9R.28_2025_B_0.pdf)).
- **Trina TSM-460NEG9R.28**: 460 W STC, Voc 53.8 V, Vmp 45.4 V, Isc 10.81 A and Imp 10.14 A ([Trina Solar, TSM_EN_2025_B](https://static.trinasolar.com/sites/default/files/DT-M-0043-G-EN%20K%20Datasheet_Vertex%20S+_NEG9R.28_2025_B_0.pdf)).

The selected revision specifies 1,762 × 1,134 × 30 mm dimensions, 21.0 kg mass and a Voc coefficient of −0.24%/°C; no Vmp temperature coefficient is explicitly provided ([Trina Solar datasheet](https://static.trinasolar.com/sites/default/files/DT-M-0043-G-EN%20K%20Datasheet_Vertex%20S+_NEG9R.28_2025_B_0.pdf)). The application stores the Voc coefficient as −0.0024 per °C and leaves `betaVmp` absent, so affected hot/cold MPPT voltage checks remain incomplete rather than guessing a coefficient.

## Inverter data

- **Sungrow SG5.0RS**: 5 kW rated AC, single phase, 600 V maximum PV voltage, 40–560 V MPPT range, two MPPTs with one PV string each, 16 A operating and 20 A short-circuit current per MPPT ([Sungrow Version 12 EN(GL)](https://info-support.sungrowpower.com/application/pdf/2023/07/22/DS_20220714_SG5.0_6.0RS_Datasheet_V12_EN(GL).pdf)).
- **Sungrow SG6.0RS**: 6 kW rated AC, single phase, 600 V maximum PV voltage, 40–560 V MPPT range, two MPPTs with one PV string each, 16 A operating and 20 A short-circuit current per MPPT ([Sungrow Version 12 EN(GL)](https://info-support.sungrowpower.com/application/pdf/2023/07/22/DS_20220714_SG5.0_6.0RS_Datasheet_V12_EN(GL).pdf)).

The source gives 50 V startup separately from the 40 V operating minimum and includes Australian output-rating footnotes; the implementation deliberately identifies the global RS document rather than substituting an RS-L or RS-ADA variant ([Sungrow datasheet](https://info-support.sungrowpower.com/application/pdf/2023/07/22/DS_20220714_SG5.0_6.0RS_Datasheet_V12_EN(GL).pdf)). Startup behaviour, the complete power/voltage envelope, grid settings, actual supplied variant and current regional approvals still require professional review.

## Scope and maintenance

- **Checked date**: 13 November 2026, stored with each entry. These are identified source revisions, not a promise that the document is the newest available.
- **Unknown commercial fields**: real-product `cost` is null, never a claim of zero supplier cost. The existing editable quote allowances are not replaced with invented prices.
- **Legacy compatibility**: all `ref-*` entries retain their original identity and values. Existing snapshots keep their inputs; changed selections receive authoritative server catalogue values.
- **Approvals**: no stock, lead time, warranty entitlement, MCS-listing or DNO approval is asserted. No real three-phase inverter or manufacturer battery catalogue has been added in this increment.
- **Extraction limits**: do not infer missing Vmp coefficients from Pmax or Voc, confuse total inverter current with per-MPPT limits, or transfer specifications between similarly named regional variants.
- **Change control**: re-check the exact regional datasheet, add/replace versioned catalogue records and preserve already-issued snapshots. Re-running calculations must not silently change an old proposal.
