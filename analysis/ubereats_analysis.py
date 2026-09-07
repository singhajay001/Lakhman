"""
Uber Eats channel analysis - Trafalgar Grocery & Liquor.

Inputs : MyFoodLink order exports (Q1-Q3 2026) + MyFoodLink sales export.
Outputs: findings.json consumed by the report.

Run: python3 analysis/ubereats_analysis.py <upload_dir> <out_dir>
"""
import glob
import json
import os
import sys

import numpy as np
import pandas as pd

COMMISSION = 0.30  # assumed marketplace rate - confirm against merchant agreement
GST_DIVISOR = 11   # GST-inclusive prices: gst = taxable / 11


def load_orders(updir):
    frames = []
    for f in sorted(glob.glob(os.path.join(updir, "*orders*.csv"))):
        frames.append(pd.read_csv(f, dtype=str))
    o = pd.concat(frames, ignore_index=True)
    o["date"] = pd.to_datetime(o["Checkout Date"], format="%d/%m/%Y")
    for c in ["Total", "# lines ordered", "Checkout Hour",
              "# of substitutions", "# of not supplied", "Discount Allowed"]:
        o[c] = pd.to_numeric(o[c], errors="coerce")
    return o.sort_values("date")


def load_sales(updir):
    f = glob.glob(os.path.join(updir, "*sales*.csv"))[0]
    s = pd.read_csv(f, dtype=str)
    for c in ["Total", "Tax"]:
        s[c] = pd.to_numeric(s[c].str.replace(r"[$,]", "", regex=True), errors="coerce")
    s["date"] = pd.to_datetime(s["Date"])
    return s


def rate(df, label):
    """Orders/day, AOV and revenue/day over the span the slice covers."""
    days = (df["date"].max() - df["date"].min()).days + 1
    return {
        "label": label,
        "orders": int(len(df)),
        "days": int(days),
        "orders_per_day": round(len(df) / days, 2),
        "aov": round(df["Total"].mean(), 2),
        "revenue": round(df["Total"].sum(), 2),
        "revenue_per_day": round(df["Total"].sum() / days, 2),
        "avg_lines": round(df["# lines ordered"].mean(), 2),
    }


def main(updir, outdir):
    o, s = load_orders(updir), load_sales(updir)
    fin = s[s["Type"] == "Finalised"].copy()
    os.makedirs(outdir, exist_ok=True)

    o["ym"] = o["date"].dt.to_period("M")
    monthly = o.groupby("ym").agg(
        orders=("Order #", "count"), revenue=("Total", "sum"),
        aov=("Total", "mean"), lines=("# lines ordered", "mean"))
    span = o.groupby("ym")["date"].agg(["min", "max"])
    monthly["days"] = [(b - a).days + 1 for a, b in span.itertuples(index=False)]
    monthly["orders_per_day"] = monthly["orders"] / monthly["days"]

    # Split at the point the trend breaks (see report).
    cut = "2026-05-15"
    before, after = o[o["date"] < cut], o[o["date"] >= cut]

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dow = o.groupby("Checkout Day").agg(orders=("Order #", "count"),
                                        aov=("Total", "mean")).reindex(days)
    dow_shift = pd.DataFrame({
        "before_per_week": before.groupby("Checkout Day").size().reindex(days).fillna(0)
                           / (((before["date"].max() - before["date"].min()).days + 1) / 7),
        "after_per_week": after.groupby("Checkout Day").size().reindex(days).fillna(0)
                          / (((after["date"].max() - after["date"].min()).days + 1) / 7)})
    dow_shift["change_pct"] = (dow_shift["after_per_week"] / dow_shift["before_per_week"] - 1) * 100

    hourly = o.groupby("Checkout Hour").agg(orders=("Order #", "count"),
                                            aov=("Total", "mean"))

    bands = pd.cut(o["Total"], [0, 10, 20, 30, 50, 75, 100, 10**6],
                   labels=["<$10", "$10-20", "$20-30", "$30-50",
                           "$50-75", "$75-100", "$100+"])
    value_bands = o.groupby(bands, observed=True).agg(
        orders=("Order #", "count"), revenue=("Total", "sum"))

    # Sub-$10 orders: what the store actually keeps after commission.
    small = o[o["Total"] < 10]
    small_econ = {
        "orders": int(len(small)),
        "pct_of_orders": round(len(small) / len(o) * 100, 1),
        "revenue": round(small["Total"].sum(), 2),
        "pct_of_revenue": round(small["Total"].sum() / o["Total"].sum() * 100, 1),
        "avg_order": round(small["Total"].mean(), 2),
        "avg_net_after_commission": round(small["Total"].mean() * (1 - COMMISSION), 2),
    }

    # GST-taxable share proxies alcohol + packaged goods; GST-free proxies basic food.
    fin["taxable_share"] = (fin["Tax"] * GST_DIVISOR / fin["Total"]).clip(0, 1)

    # Jan and Sep are partial months in the export - exclude so the peak is real.
    full_months = monthly[monthly["days"] >= 28]
    peak = full_months["orders_per_day"].idxmax()
    recovery = {
        "current_orders_per_day": rate(after, "")["orders_per_day"],
        "peak_month": str(peak),
        "peak_month_orders_per_day": round(full_months.loc[peak, "orders_per_day"], 2),
        "current_aov": rate(after, "")["aov"],
    }
    gap = recovery["peak_month_orders_per_day"] - recovery["current_orders_per_day"]
    recovery["gap_orders_per_day"] = round(gap, 2)
    recovery["annual_revenue_at_risk"] = round(gap * recovery["current_aov"] * 365, 0)

    findings = {
        "window": {"start": str(o["date"].min().date()),
                   "end": str(o["date"].max().date()),
                   "orders": int(len(o)),
                   "revenue": round(o["Total"].sum(), 2)},
        "monthly": json.loads(monthly.reset_index().assign(
            ym=lambda d: d["ym"].astype(str)).round(2).to_json(orient="records")),
        "periods": [rate(before, "Launch: 29 Jan - 14 May"),
                    rate(after, "Since: 15 May - 7 Sep")],
        "dow": json.loads(dow.reset_index().round(2).to_json(orient="records")),
        "dow_shift": json.loads(dow_shift.reset_index(names="day").round(2)
                                .to_json(orient="records")),
        "hourly": json.loads(hourly.reset_index().round(2).to_json(orient="records")),
        "evening_share_pct": round((o["Checkout Hour"] >= 18).mean() * 100, 1),
        "value_bands": json.loads(value_bands.reset_index(names="band").round(2)
                                  .to_json(orient="records")),
        "basket": {"mean_lines": round(o["# lines ordered"].mean(), 2),
                   "median_lines": float(o["# lines ordered"].median()),
                   "two_line_orders": int((o["# lines ordered"] == 2).sum()),
                   "two_line_pct": round((o["# lines ordered"] == 2).mean() * 100, 1)},
        "small_orders": small_econ,
        "promotions": {"orders_with_offer": int(o["Offer"].notna().sum()),
                       "orders_with_campaign": int(o["Campaign Type"].notna().sum()),
                       "orders_with_coupon": int(o["Coupon"].notna().sum()),
                       "orders_with_discount": int((o["Discount Allowed"] > 0).sum()),
                       "total_discount_dollars": round(o["Discount Allowed"].sum(), 2)},
        "fulfilment": {"substitutions_recorded": int(o["# of substitutions"].sum()),
                       "not_supplied_recorded": int(o["# of not supplied"].sum())},
        "mix": {"taxable_share_of_revenue":
                round(fin["Tax"].sum() * GST_DIVISOR / fin["Total"].sum() * 100, 1),
                "orders_fully_taxable": int((fin["taxable_share"] > 0.95).sum()),
                "orders_fully_gst_free": int((fin["taxable_share"] < 0.05).sum()),
                "total_orders": int(len(fin))},
        "direct_channel": json.loads(
            s.groupby("Platform").agg(orders=("Order #", "nunique"),
                                      revenue=("Total", "sum"))
            .reset_index().round(2).to_json(orient="records")),
        "recovery": recovery,
        "assumptions": {"commission_rate": COMMISSION},
    }

    out = os.path.join(outdir, "findings.json")
    with open(out, "w") as fh:
        json.dump(findings, fh, indent=2)
    print(f"wrote {out}")
    return findings


if __name__ == "__main__":
    updir = sys.argv[1] if len(sys.argv) > 1 else "."
    outdir = sys.argv[2] if len(sys.argv) > 2 else "analysis/out"
    f = main(updir, outdir)
    print(json.dumps({k: f[k] for k in
                      ["window", "periods", "small_orders", "promotions",
                       "mix", "recovery", "basket"]}, indent=2))
