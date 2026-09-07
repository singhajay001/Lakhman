import pandas as pd, glob, os

UP = "/root/.claude/uploads/20648d30-a3d3-54d7-8f19-024a059acc25"

def orders():
    frames = []
    for f in sorted(glob.glob(os.path.join(UP, "*orders*.csv"))):
        d = pd.read_csv(f, dtype=str)
        d["src"] = os.path.basename(f)
        frames.append(d)
    o = pd.concat(frames, ignore_index=True)
    o["date"] = pd.to_datetime(o["Checkout Date"], format="%d/%m/%Y")
    for c in ["Total","Checkout Total","# lines ordered","Checkout Hour",
              "# of substitutions","# of not supplied","Discount Allowed"]:
        o[c] = pd.to_numeric(o[c], errors="coerce")
    return o

def sales():
    f = glob.glob(os.path.join(UP, "*sales*.csv"))[0]
    s = pd.read_csv(f, dtype=str)
    for c in ["Total","Tax","Product Total","Product Tax","Charge Total","Charge Tax"]:
        s[c] = pd.to_numeric(s[c].str.replace(r"[$,]", "", regex=True), errors="coerce")
    s["date"] = pd.to_datetime(s["Date"])
    s["Revision"] = pd.to_numeric(s["Revision"], errors="coerce")
    return s
