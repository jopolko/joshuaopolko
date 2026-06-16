#!/usr/bin/env python3
"""Pull joshuaopolko.com performance from Google Search Console (+ Bing WMT, +
PageSpeed) and rank optimization opportunities — the "which winners can I push
up" report.

Run:  .venv-seo/bin/python tools/seo_pull.py            # full report
      .venv-seo/bin/python tools/seo_pull.py --days 90  # longer window
      .venv-seo/bin/python tools/seo_pull.py --json     # machine-readable

Credentials — all in /var/secrets/nowservingto.env:
  GSC   -> GOOGLE_SERVICE_ACCOUNT_JSON (service account; must be a user on the property)
  Bing  -> BING_WMT_API_KEY
  PSI   -> PAGESPEED_API_KEY
"""
import argparse, json, sys, datetime as dt
from pathlib import Path

SITE = "https://joshuaopolko.com/"
# ONE secrets file for everything — API keys AND the GSC service-account JSON
# (GOOGLE_SERVICE_ACCOUNT_JSON, minified one-liner). We deliberately do NOT
# read ~/.config/claude-seo/* anymore.
SECRETS = Path("/var/secrets/nowservingto.env")


def load_secrets():
    out = {}
    if SECRETS.exists():
        for line in SECRETS.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def daterange(days):
    end = dt.date.today() - dt.timedelta(days=2)  # GSC lags ~2d
    return (end - dt.timedelta(days=days)).isoformat(), end.isoformat()


def _gsc_creds():
    from google.oauth2 import service_account
    raw = load_secrets().get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        raise RuntimeError(f"GOOGLE_SERVICE_ACCOUNT_JSON missing from {SECRETS}")
    return service_account.Credentials.from_service_account_info(
        json.loads(raw), scopes=["https://www.googleapis.com/auth/webmasters.readonly"])


def gsc_client():
    from googleapiclient.discovery import build
    return build("searchconsole", "v1", credentials=_gsc_creds(), cache_discovery=False)


def gsc_query(sc, prop, start, end, dimensions, row_limit=500):
    body = {"startDate": start, "endDate": end, "dimensions": dimensions,
            "rowLimit": row_limit, "dataState": "all"}
    return sc.searchanalytics().query(siteUrl=prop, body=body).execute().get("rows", [])


def _match_property(props, site):
    """Find the GSC property string for this site, whether it was granted as a
    URL-prefix property (https://host/) or a Domain property (sc-domain:host)."""
    host = site.replace("https://", "").replace("http://", "").strip("/")
    wanted = {f"https://{host}/", f"https://{host}", f"http://{host}/",
              f"sc-domain:{host}"}
    for p in props:
        if p in wanted or p.rstrip("/") in {w.rstrip("/") for w in wanted}:
            return p
    return None


def opportunity_score(impr, pos, ctr):
    """High when a page gets real impressions but sits just off the top
    (striking distance, pos 4-20) and/or under-converts for its rank."""
    if pos < 3.5 or pos > 25 or impr < 15:
        return 0.0
    rank_gain = max(0.0, (20 - pos)) / 20      # closer to top = more upside left
    return round(impr * (0.4 + 0.6 * rank_gain), 1)


def report_gsc(days, as_json):
    start, end = daterange(days)
    sc = gsc_client()
    try:
        props = [s["siteUrl"] for s in sc.sites().list().execute().get("siteEntry", [])]
    except Exception as e:
        return {"error": f"GSC auth/list failed: {e}"}
    prop = _match_property(props, SITE)
    if not prop:
        host = SITE.replace("https://", "").rstrip("/")
        return {"error": f"service account has no access to {host} — "
                "add it as a user in Search Console", "visible": props}

    pages = gsc_query(sc, prop, start, end, ["page"])
    qp = gsc_query(sc, prop, start, end, ["query", "page"])

    winners = sorted(pages, key=lambda r: r["clicks"], reverse=True)[:15]
    opps = []
    for r in qp:
        q, page = r["keys"]
        s = opportunity_score(r["impressions"], r["position"], r["ctr"])
        if s > 0:
            opps.append({"query": q, "page": page.replace(SITE, "/"),
                         "impr": r["impressions"], "clicks": r["clicks"],
                         "ctr": round(r["ctr"] * 100, 2), "pos": round(r["position"], 1),
                         "score": s})
    opps.sort(key=lambda x: x["score"], reverse=True)
    return {"window": f"{start}..{end}",
            "winners": [{"page": r["keys"][0].replace(SITE, "/"), "clicks": r["clicks"],
                         "impr": r["impressions"], "ctr": round(r["ctr"]*100, 2),
                         "pos": round(r["position"], 1)} for r in winners],
            "opportunities": opps[:25]}


def _bing_agg(rows):
    """Bing returns one row per (item, date). Aggregate by item: sum impr/clicks,
    impression-weighted avg position."""
    agg = {}
    for x in rows:
        k = x.get("Query", "")
        impr = x.get("Impressions", 0) or 0
        a = agg.setdefault(k, {"impr": 0, "clicks": 0, "pos_w": 0.0})
        a["impr"] += impr
        a["clicks"] += x.get("Clicks", 0) or 0
        a["pos_w"] += (x.get("AvgImpressionPosition", 0) or 0) * impr
    out = []
    for k, a in agg.items():
        if a["impr"] <= 0:
            continue
        out.append({"key": k, "impr": a["impr"], "clicks": a["clicks"],
                    "ctr": round(a["clicks"] / a["impr"] * 100, 2),
                    "pos": round(a["pos_w"] / a["impr"], 1)})
    return out


def report_bing(key, days):
    import requests
    base = "https://ssl.bing.com/webmaster/api.svc/json"
    try:
        pages = _bing_agg(requests.get(f"{base}/GetPageStats",
                          params={"apikey": key, "siteUrl": SITE}, timeout=30).json().get("d", []))
        queries = _bing_agg(requests.get(f"{base}/GetQueryStats",
                            params={"apikey": key, "siteUrl": SITE}, timeout=30).json().get("d", []))
    except Exception as e:
        return {"error": f"Bing pull failed: {e}"}
    winners = sorted(pages, key=lambda x: x["clicks"], reverse=True)[:12]
    opps = sorted((dict(o, score=opportunity_score(o["impr"], o["pos"], o["ctr"]))
                   for o in queries),
                  key=lambda x: x["score"], reverse=True)
    return {"winners": [{"page": w["key"].replace(SITE, "/"), "impr": w["impr"],
                         "clicks": w["clicks"], "ctr": w["ctr"], "pos": w["pos"]} for w in winners],
            "opportunities": [{"query": o["key"], "impr": o["impr"], "clicks": o["clicks"],
                               "ctr": o["ctr"], "pos": o["pos"], "score": o["score"]}
                              for o in opps if o["score"] > 0][:20]}


def report_psi(key, urls):
    import requests
    out = []
    for u in urls:
        try:
            p = {"url": u, "strategy": "mobile", "category": "performance"}
            if key:
                p["key"] = key
            r = requests.get("https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
                             params=p, timeout=60).json()
            lh = r["lighthouseResult"]
            cwv = lh["audits"]
            out.append({"url": u,
                        "perf": round(lh["categories"]["performance"]["score"] * 100),
                        "LCP": cwv["largest-contentful-paint"]["displayValue"],
                        "CLS": cwv["cumulative-layout-shift"]["displayValue"],
                        "TBT": cwv["total-blocking-time"]["displayValue"]})
        except Exception as e:
            out.append({"url": u, "error": str(e)[:120]})
    return out


SITES_ALL = ["joshuaopolko.com", "nowservingto.com"]


def _norm(site):
    return "https://" + site.replace("https://", "").replace("http://", "").strip("/") + "/"


def run_one(args, secrets):
    result = {"gsc": report_gsc(args.days, args.json)}
    if secrets.get("BING_WMT_API_KEY"):
        result["bing"] = report_bing(secrets["BING_WMT_API_KEY"], args.days)
    if args.psi:
        g = result.get("gsc", {})
        wins = g.get("winners") if isinstance(g, dict) else None
        if not wins and isinstance(result.get("bing"), dict):
            wins = result["bing"].get("winners")  # fall back to Bing pages pre-GSC-grant
        top = [SITE.rstrip("/") + w["page"] for w in (wins or [])[:5]]
        result["psi"] = report_psi(secrets.get("PAGESPEED_API_KEY"), top)
    return result


def print_human(result):
    host = SITE.replace("https://", "").rstrip("/")
    print(f"\n################  {host}  ################")
    g = result["gsc"]
    if "error" in g:
        print("GSC:", g["error"])
        if g.get("visible") is not None:
            print("  SA can currently see:", g["visible"] or "(no properties)")
    else:
        print(f"\n=== GSC · {g['window']} ===")
        print("TOP PAGES (clicks):")
        for w in g["winners"]:
            print(f"  {w['clicks']:4d} clk  {w['impr']:6d} imp  {w['ctr']:5.2f}% ctr  pos {w['pos']:4.1f}  {w['page']}")
        print("STRIKING-DISTANCE OPPORTUNITIES (push these up):")
        for o in g["opportunities"]:
            print(f"  score {o['score']:7.1f}  pos {o['pos']:4.1f}  {o['impr']:5d}imp {o['ctr']:5.2f}%ctr  "
                  f"\"{o['query']}\"  -> {o['page']}")
    b = result.get("bing")
    if isinstance(b, dict) and "error" not in b:
        print("\n=== BING ===")
        print("TOP PAGES (clicks):")
        for w in b["winners"]:
            print(f"  {w['clicks']:4d} clk  {w['impr']:6d} imp  {w['ctr']:5.2f}% ctr  pos {w['pos']:4.1f}  {w['page']}")
        print("STRIKING-DISTANCE OPPORTUNITIES:")
        for o in b["opportunities"]:
            print(f"  score {o['score']:7.1f}  pos {o['pos']:4.1f}  {o['impr']:5d}imp {o['ctr']:5.2f}%ctr  \"{o['query']}\"")
    elif isinstance(b, dict):
        print("\nBING:", b["error"])
    if "psi" in result:
        print("\n=== PAGESPEED (mobile perf) ===")
        for p in result["psi"]:
            if "error" in p:
                print(f"  {p['url']}: {p['error']}")
            else:
                print(f"  perf {p['perf']:3d}  LCP {p['LCP']:>7}  CLS {p['CLS']:>6}  TBT {p['TBT']:>8}  {p['url'].replace(SITE,'/')}")


def _domain(url):
    from urllib.parse import urlparse
    try:
        d = urlparse(url).netloc.lower()
        return d[4:] if d.startswith("www.") else d
    except Exception:
        return ""


def report_aeo(secrets, n_prompts=15, top_results=10, days=90):
    """AEO citation map: take the top GSC queries (real demand), search each via
    SearXNG, and aggregate which domains surface — a keyless proxy for which
    sources AI answer engines ground/cite for that demand. Flags where SITE is
    absent (the roadmap: pages to create or sources to get referenced by)."""
    import requests
    from collections import Counter
    sx = (secrets.get("SEARXNG_URL") or "").rstrip("/")
    if not sx:
        return {"error": "SEARXNG_URL not set in secrets"}
    host = SITE.replace("https://", "").replace("http://", "").strip("/")
    host = host[4:] if host.startswith("www.") else host
    try:
        sc = gsc_client()
        props = [s["siteUrl"] for s in sc.sites().list().execute().get("siteEntry", [])]
    except Exception as e:
        return {"error": f"GSC auth failed: {e}"}
    prop = _match_property(props, SITE)
    if not prop:
        return {"error": f"no GSC access to {host}"}
    start, end = daterange(days)
    rows = gsc_query(sc, prop, start, end, ["query"], row_limit=300)
    queries = [r["keys"][0] for r in sorted(rows, key=lambda r: -r["impressions"])[:n_prompts]]
    if not queries:
        return {"error": "no GSC queries in window"}
    doms = Counter(); you_in = 0; per = []
    for q in queries:
        try:
            res = requests.get(f"{sx}/search", params={"q": q, "format": "json"},
                               timeout=25).json().get("results", [])[:top_results]
        except Exception as e:
            per.append({"q": q, "error": str(e)[:60]}); continue
        seen = []
        for r in res:
            d = _domain(r.get("url", ""))
            if d and d not in seen:
                seen.append(d)
        for d in seen:
            doms[d] += 1
        present = host in seen
        you_in += present
        per.append({"q": q, "domains": seen[:6], "you": present,
                    "rank": (seen.index(host) + 1) if present else None})
    return {"host": host, "prompts": len(queries), "you_in": you_in,
            "top_domains": doms.most_common(15), "per": per}


def print_aeo(a):
    print(f"\n################  AEO citation map · {a.get('host','')}  ################")
    if "error" in a:
        print("  " + a["error"]); return
    print(f"  {a['prompts']} prompts (top GSC queries) · YOU surface in {a['you_in']}/{a['prompts']}")
    print("\n  TOP DOMAINS across your demand (who AI grounds on — your targets):")
    for d, n in a["top_domains"]:
        print(f"    {n:2d}/{a['prompts']}  {d}{'   <- you' if d==a['host'] else ''}")
    gaps = [p for p in a["per"] if not p.get("error") and not p["you"]]
    print(f"\n  GAPS — {len(gaps)} prompts where you're absent from the top {len(a['per'][0]['domains']) if a['per'] else ''} results:")
    for p in gaps:
        print(f"    \"{p['q']}\"  ->  {', '.join(p['domains'][:5])}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="joshuaopolko.com", help="property domain (e.g. nowservingto.com)")
    ap.add_argument("--all", action="store_true", help="run every property in SITES_ALL")
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--psi", action="store_true", help="also run PageSpeed on top pages")
    ap.add_argument("--aeo", action="store_true", help="AEO citation map: domains that surface for your top GSC queries (via SearXNG)")
    args = ap.parse_args()
    secrets = load_secrets()
    sites = SITES_ALL if args.all else [args.site]
    out = {}
    global SITE
    for s in sites:
        SITE = _norm(s)
        if args.aeo:
            a = report_aeo(secrets)
            out[s] = {"aeo": a} if args.json else None
            if not args.json:
                print_aeo(a)
            continue
        res = run_one(args, secrets)
        if args.json:
            out[s] = res
        else:
            print_human(res)
    if args.json:
        print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
