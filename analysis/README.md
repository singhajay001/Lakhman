# Uber Eats channel analysis

Analysis of the Uber Eats sales channel for Trafalgar Grocery & Liquor, covering
29 Jan – 7 Sep 2026 (735 orders, $24,651 revenue).

## Inputs

Both exports come from the MyFoodLink back office and are **order-level, not
line-item** — there is no SKU or product detail in them, and no in-store sales:

| File | Contents |
|---|---|
| `*ordersQ1..Q3 2026*.csv` | One row per order: date, hour, weekday, total, line count, fulfilment fields |
| `*sales*.csv` | One row per order revision: totals, GST, platform, marketplace |

The exports are not committed — they contain order-level customer fields. Point the
script at the directory holding them.

## Running

```
pip install pandas
python3 analysis/ubereats_analysis.py <export_dir> analysis/out
```

Writes `analysis/out/findings.json`, which backs the figures in
`report/ubereats-review.html`.

## Assumptions

- **Commission is assumed at 30%.** Confirm against the merchant agreement; every
  margin figure moves with it.
- **GST as a mix proxy.** Alcohol and packaged goods carry GST, basic food does not,
  so `Tax * 11 / Total` estimates the taxable share of each order. It is a proxy for
  product mix, not a measurement of it.
- The trend is split at **15 May 2026**, where the monthly series breaks.
- January (3 trading days) and September (7 days) are partial months and are excluded
  from peak and period comparisons.
