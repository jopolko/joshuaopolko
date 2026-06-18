#!/usr/bin/env python3
"""Generate joshuaopolko.com/llms.txt from the articles already on disk.

A purely-mechanical AI-citation-readiness fix: every article already ships a
RankMath JSON-LD @graph, so we just harvest each BlogPosting's title,
description, URL and publish date and emit the llms.txt index that AI crawlers
(ChatGPT, Perplexity, Claude, Google AI) look for. No content is written or
rewritten. Output is a reviewable file — deploy is a separate, manual step.

Run:  python tools/gen_llms_txt.py            # writes static/llms.txt, prints summary
      python tools/gen_llms_txt.py --stdout   # print to stdout only, write nothing
"""
import argparse, html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
SITE = "https://joshuaopolko.com"
SITE_TAGLINE = ("Joshua Opolko's personal site: hands-on self-hosting guides "
                "(n8n, SearXNG, Dify, CrewAI), first-hand AI-tooling comparisons, "
                "and essays on technology, psychology, and society.")

LDJSON = re.compile(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', re.S | re.I)


def _graph_nodes(html):
    for m in LDJSON.finditer(html):
        try:
            data = json.loads(m.group(1))
        except Exception:
            continue
        if isinstance(data, dict) and "@graph" in data:
            yield from data["@graph"]
        elif isinstance(data, list):
            yield from data
        elif isinstance(data, dict):
            yield data


def _is_type(node, t):
    nt = node.get("@type")
    return nt == t or (isinstance(nt, list) and t in nt)


def extract(idx):
    """Pull (title, desc, url, date) from one article's BlogPosting node."""
    html_text = idx.read_text(errors="ignore")
    post = next((n for n in _graph_nodes(html_text) if _is_type(n, "BlogPosting")), None)
    slug = idx.parent.name
    url = f"{SITE}/{slug}/"
    if post:
        title = post.get("headline") or post.get("name") or slug
        return {"title": html.unescape(title.strip()),
                "desc": html.unescape((post.get("description") or "").strip()),
                "url": url,  # clean canonical, no #fragment
                "date": (post.get("datePublished") or "")[:10]}
    # Fallback: <title>/<meta description> for any non-BlogPosting page
    t = re.search(r"<title>(.*?)</title>", html_text, re.S | re.I)
    d = re.search(r'<meta[^>]+name="description"[^>]+content="(.*?)"', html_text, re.I)
    if not t:
        return None
    return {"title": html.unescape(t.group(1).strip()),
            "desc": html.unescape(d.group(1).strip() if d else ""),
            "url": url, "date": ""}


def collect():
    arts = []
    for idx in sorted(STATIC.glob("*/index.html")):
        if idx.parent.name in {"about", "models", "security"}:  # non-article pages
            continue
        a = extract(idx)
        if a and a["desc"]:  # only list articles that actually have a description
            arts.append(a)
    arts.sort(key=lambda a: a["date"], reverse=True)  # newest first
    return arts


def render(arts):
    out = [f"# Joshua Opolko", "", f"> {SITE_TAGLINE}", "",
           "## Articles", ""]
    for a in arts:
        date = f" ({a['date']})" if a["date"] else ""
        out.append(f"- [{a['title']}]({a['url']}){date}: {a['desc']}")
    out += ["", "## About", "",
            f"- [About Joshua Opolko]({SITE}/about/): background and contact.", ""]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stdout", action="store_true", help="print only, write nothing")
    args = ap.parse_args()
    arts = collect()
    text = render(arts)
    if args.stdout:
        print(text)
        return
    dest = STATIC / "llms.txt"
    dest.write_text(text)
    print(f"wrote {dest}  ({len(arts)} articles, {len(text)} bytes)", file=sys.stderr)
    print(f"review:  git diff -- static/llms.txt   (deploy is manual)", file=sys.stderr)


if __name__ == "__main__":
    main()
