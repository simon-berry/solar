# Consumption and battery analysis

The Consumption & battery tab analyses explicitly imported gross demand and optional AC PV data for the observed period. It is a preliminary energy model, separate from the existing manual annual estimate and from equipment pricing.

## CSV contract

```csv
timestamp,consumption,pv
2026-01-01T12:00:00Z,0,2
2026-01-01T12:30:00Z,2,0
```

This tiny example is synthetic and not weather or customer data. The in-app Load synthetic example button supplies a clearly labelled seven-day test profile.

- **Headers**: `timestamp,consumption`, optionally `pv`; column order may vary. Unknown/duplicate headers and incomplete rows are rejected.
- **Units**: choose kWh per interval or average kW for both value columns. Power converts using the explicitly selected 15, 30 or 60-minute duration; cumulative readings are unsupported.
- **Timestamps**: ISO date/time with Z or explicit UTC offset is required. For UK local readings, explicitly supply +01:00 in BST or +00:00 in GMT; naive ambiguous times are rejected rather than guessed.
- **Interval convention**: choose start or end. End-stamped records are shifted back exactly one declared interval before normalisation to UTC.
- **Reporting timezone**: Europe/London or UTC controls calendar grouping, not interpretation of offset-qualified input instants. Day totals sum actual intervals, including 23/25-hour UK days.
- **Provenance**: separately declare measured, modelled or synthetic demand and PV. Choose No PV series when that column is absent; the application never invents PV intervals from annual generation.
- **Gross demand**: acknowledge whole-site consumption, not grid-import-only readings. Existing PV makes net import an unsuitable proxy for gross demand.
- **Quality checks**: sort into UTC order, reject duplicates (including equivalent offset representations), invalid dates, negative/nonfinite/blank readings, overlaps and duration mismatch. Gaps remain visible and block dispatch; they are not filled.
- **Limits**: 20,000 rows, 4 MB input and 4 MB API bodies. A full half-hourly year fits; a full 15-minute year does not. Only canonical CSV is supported, not automatic supplier-specific header/meter reconstruction.

## AC model and conservation

For each interval, PV first supplies simultaneous demand. Surplus charges the battery subject to AC charge power, available usable-window capacity and charge efficiency; the battery discharges only into a remaining demand deficit subject to reserve, AC discharge power and discharge efficiency.

\[
\Delta SOC = E_{\mathrm{charge,AC}}\eta_c -
\frac{E_{\mathrm{discharge,AC}}}{\eta_d}
\]

\[
E_{\mathrm{PV}}+E_{\mathrm{grid,in}} =
E_{\mathrm{load}}+E_{\mathrm{grid,out}}+
E_{\mathrm{loss}}+\Delta SOC
\]

The usable-capacity input excludes the manufacturer's inaccessible buffer. Reserve further withholds a percentage of that usable window, and opening SOC must be at least reserve.

- **Boundary conditions**: opening/closing internal SOC are shown explicitly. A closing deficit relative to opening SOC incurs a terminal grid-charge restoration allowance at the flat import rate, adjusted for charge efficiency; this is a disclosed economic allowance outside the physical dispatch period, not invented within-period energy.
- **Value**: incremental observed-period avoided import cost, minus lost export revenue and the terminal allowance. Closing surplus SOC receives no credit, and no short-period result is annualised.
- **Capacity comparison**: test 0, 2.5, 5, 7.5, 10, 13.5, 20, 30, 50 and 100 kWh, plus the selected capacity, at identical power/efficiency/reserve/initial-percentage assumptions. Suggest the smallest tested capacity at 90% of the highest positive adjusted period value, or none.
- **Interpretation**: this heuristic is not a payback calculation, economic optimum, product recommendation or backup-load sizing. Purchase price, demand charges, standby, degradation, temperature, clipping, export limits, grid charging and time-of-use optimisation are excluded.
- **Hardware**: generic AC coupling assumes a separate battery inverter. There is no implied hybrid compatibility with the selected PV inverter; manufacturer battery products are not modelled.
- **PV profile**: remains exactly as imported when roof/module/inverter settings change. Optionally record the source profile's system size and re-import when the proposed system changes.

## Persistence and reports

Save revision persists the dataset and assumptions with the design. A failed import leaves the existing dataset intact; clearing uses an explicit null dataset and does not erase prior revisions or issued reports.

- **Current analysis**: Documents downloads `energy.json` for any valid saved dataset, including consumption-only/gapped data. `dispatch.csv` is enabled only for contiguous demand and PV, with UTC starts, AC flows, conversion losses and internal SOC.
- **Issued analysis**: new v3 proposals freeze the server-computed report and design, include provenance and an interval appendix, and expose `/api/issues/:id/energy.json`. Later edits do not change those outputs; v1/v2 issues retain their original templates.
- **Annual estimate**: still uses the separate manual annual assumptions. Interval battery benefits are not mixed into that annual headline.
- **Quote**: storage is not automatically priced or included. Record equipment/scope and an explicit allowance before presenting a preliminary quote that includes storage.
- **Privacy**: this alpha remains a synthetic-data-only private preview without production authentication or independently managed durable storage. Source archives intentionally exclude runtime databases.
