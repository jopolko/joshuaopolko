#!/usr/bin/env python3
"""Inline /assets/site.css into every static page's <head>, removing the
render-blocking stylesheet request from the critical path (Lighthouse measured
~550 ms of FCP/LCP spent fetching a 2.6 KB gzipped file). The CSS has no url()
or @import refs, so inlining is loss-free; gzip on the HTML response absorbs
the per-page byte cost.

Idempotent: once a page is inlined the <link> is gone, so re-running is a no-op.
Importable: build.py calls inline() so fresh builds are inlined by default.

Pipeline order:  build.py --all  →  seo_complete.py  →  inline_css.py  →  deploy
"""
import pathlib

BASE = pathlib.Path(__file__).resolve().parent / "static"
LINK = '<link rel="stylesheet" href="/assets/site.css?v=11">'


def _style_block():
    css = (BASE / "assets" / "site.css").read_text()
    return "<style>\n" + css + "\n</style>"


def inline(html_str, style_block=None):
    """Return html_str with the site.css <link> swapped for an inline <style>.
    No-op if the link isn't present (already inlined or absent)."""
    if LINK not in html_str:
        return html_str
    return html_str.replace(LINK, style_block or _style_block())


def main():
    style = _style_block()
    n = 0
    for p in BASE.rglob("index.html"):
        if "/assets/" in str(p):
            continue
        s = p.read_text()
        new = inline(s, style)
        if new != s:
            p.write_text(new)
            n += 1
    print(f"inlined CSS into {n} page(s)")


if __name__ == "__main__":
    main()
