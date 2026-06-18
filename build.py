#!/usr/bin/env python3
"""Static site tools for joshuaopolko.com.

WordPress migration is complete. This script no longer calls the WP API or DB.
Source of truth is static/ — edit HTML files directly or use new_page.py for new pages.

Usage:
  python3 build.py sitemap          # regenerate sitemap.xml + robots.txt from static/
  python3 build.py syncnav          # push NAV_ITEMS into the <nav> of every page (surgical, nav-only)
  python3 build.py retemplate       # re-apply PAGE_TMPL to all static pages (preserves SEO head + body)

To add a page to the site-wide nav: edit NAV_ITEMS, run `syncnav`, then deploy changed pages.
"""
import re, os, sys, html, urllib.parse, datetime
from pathlib import Path
from bs4 import BeautifulSoup
import inline_css  # inlines site.css so fresh builds aren't render-blocking

SITE = "https://joshuaopolko.com"
OUT  = str(Path(__file__).resolve().parent / "static")
UA   = {"User-Agent": "Mozilla/5.0"}

# ---- navigation (hardcoded — edit here when adding pages to the menu) ----
NAV_ITEMS = [
    ("Local", "#", [
        ("NowServingTO",      "https://nowservingto.com"),
        ("Kids Events",       "/kidsevents/"),
        ("HomeTurf",          "/hometurf/"),
        ("Security Dashboard","/security/"),
    ]),
    ("AI & GEO", "#", [
        ("CrewAI",                  "/crewai-setup-production-guide/"),
        ("Ollama",                  "/ollama/"),
        ("n8n",                     "/n8n-self-hosted-guide/"),
        ("Dify",                    "/dify-self-hosted-guide/"),
        ("Vane",                    "/perplexica-self-hosted-guide/"),
        ("SearXNG",                 "/searxng-self-hosted-guide/"),
        ("Agent Zero",              "/agent-zero/"),
        ("Building JOSIE",          "/building-an-advanced-ai-workflow-josie-with-persistent-memory-and-live-data-access/"),
        ("Site as AI Infrastructure","/ai-infrastructure/"),
        ("LLM-as-ETL",              "/llm-etl-architecture/"),
        ("GEO Field Manual",        "/geo-field-manual/"),
        ("GEO: AI Citation",        "/geo-ai-citation/"),
        ("Lost in the Token",       "/jamaican-patois-ai/"),
        ("Claude SEO/GEO",          "/claude-seo/"),
        ("Claude Code Spec Workflow","/claude-code-specification-workflow-mcp/"),
    ]),
    ("XR", "#", [
        ("Driftlights",        "/driftlights/"),
        ("Architectural Viz",  "/architectural-visualization/"),
        ("cyubeVR",            "/cyubevr/"),
        ("NeosVR",             "/neosvr/"),
        ("Three.js WebXR",     "/three-js-pattern/"),
        ("A-Frame VR",         "/a-frame-vr-scene-with-custom-shaders/"),
        ("Babylon.js Clouds",  "/babylon-js-clouds/"),
        ("Babylon.js Grid",    "/babylon-js-grid-shader/"),
        ("Vision & the Brain", "/vision-dominates-half-your-brains-processing-power/"),
        ("XR in Military",     "/military-application/"),
    ]),
    ("About", "/about/", []),
]

def nav_html():
    out = ['<nav class="site-nav" aria-label="Primary"><ul>']
    for label, href, sub in NAV_ITEMS:
        if sub:
            out.append(f'<li class="has-sub"><a href="{html.escape(href)}">{html.escape(label)} <span aria-hidden="true">▾</span></a><ul>')
            for sl, sh in sub:
                out.append(f'<li><a href="{html.escape(sh)}">{html.escape(sl)}</a></li>')
            out.append('</ul></li>')
        else:
            out.append(f'<li><a href="{html.escape(href)}">{html.escape(label)}</a></li>')
    out.append('</ul></nav>')
    return "".join(out)

NAV = nav_html()

# ---- SEO head: read from already-built static file, no live fetch ----
SEO_KEEP_NAMES = ("description", "robots", "keywords", "msvalidate.01")
def seo_head_from_file(path):
    """Extract SEO tags from existing static/path/index.html."""
    fpath = os.path.join(OUT, path, "index.html") if path else os.path.join(OUT, "index.html")
    if not os.path.exists(fpath):
        return ""
    soup = BeautifulSoup(open(fpath).read(), "html.parser")
    head = soup.head or soup
    keep = []
    if head.title and head.title.string:
        keep.append("<title>" + html.escape(head.title.string.strip()) + "</title>")
    for m in head.find_all("meta"):
        n = (m.get("name") or m.get("property") or "").lower()
        if n in SEO_KEEP_NAMES or n.startswith(("og:", "twitter:", "article:")):
            keep.append(str(m))
    for lnk in head.find_all("link"):
        rel = " ".join(lnk.get("rel") or []).lower()
        if rel in ("canonical", "image_src"):
            keep.append(str(lnk))
    for s in head.find_all("script", attrs={"type": "application/ld+json"}):
        keep.append(str(s))
    return "\n  ".join(keep)

PAGE_TMPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="msvalidate.01" content="031F717E86CB83B9DBDA9CE26F9D6824">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32">
<link rel="icon" type="image/png" href="/favicon-192x192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#fbfaf7">
{seo}
<link rel="stylesheet" href="/assets/site.css?v=9">
<script src="/assets/nav.js?v=3" defer></script>
<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","x5vfntq2ur");</script>
</head>
<body>
<header class="site-head">
  <a class="brand" href="/">Joshua&nbsp;Opolko</a>
  {nav}
</header>
<main class="article">
  <h1>{title}</h1>
  {hero}
  <div class="post-body">
{content}
  </div>
</main>
<footer class="site-foot">
  <p>&copy; Joshua Opolko</p>
</footer>
</body>
</html>
"""

# Pages with hand-written <main> that must not be overwritten by retemplate.
HAND_WRITTEN = {"", "security"}  # "" = root/home

# Slugs to force-exclude from the sitemap (empty stubs, drafts, junk).
SITEMAP_EXCLUDE = set()  # manual override for technically-eligible-but-shouldn't-list pages

def _sitemap_eligible(idx_path, url):
    """A page belongs in the sitemap only if it is indexable and self-canonical.
    Skips noindex pages and pages whose canonical points at a different URL
    (canonicalized duplicates must not be listed)."""
    try:
        soup = BeautifulSoup(idx_path.read_text(), "html.parser")
    except Exception:
        return True
    robots = soup.find("meta", attrs={"name": "robots"})
    if robots and "noindex" in (robots.get("content", "").lower()):
        return False
    canon = soup.find("link", attrs={"rel": "canonical"})
    if canon and canon.get("href"):
        href = canon["href"].rstrip("/")
        if href and href != url.rstrip("/"):
            return False  # canonical points elsewhere -> duplicate, don't list
    return True

# Pages that live outside static/ but must appear in the sitemap.
STATIC_URLS = [
    ("https://joshuaopolko.com/kidsevents/",              "daily"),
    ("https://joshuaopolko.com/kidsevents/free-museum-days/","daily"),
    ("https://joshuaopolko.com/kidsevents/neighbourhoods/","daily"),
    ("https://joshuaopolko.com/kidsevents/methodology/",  "daily"),
    ("https://joshuaopolko.com/hometurf/",                "weekly"),
]

def write_sitemap():
    today = datetime.date.today().isoformat()
    # Discover all slug directories in static/ that have an index.html.
    links_mod = []
    skipped = []
    for entry in sorted(Path(OUT).iterdir()):
        if not entry.is_dir(): continue
        idx = entry / "index.html"
        if not idx.exists(): continue
        slug = entry.name
        url = f"{SITE}/{slug}/"
        if slug in SITEMAP_EXCLUDE or not _sitemap_eligible(idx, url):
            skipped.append(slug); continue
        mtime = datetime.date.fromtimestamp(idx.stat().st_mtime).isoformat()
        links_mod.append((url, mtime))
    if skipped:
        print(f"  sitemap: skipped {len(skipped)} (noindex/canonical/excluded): {', '.join(sorted(skipped))}")
    # Root
    root_idx = Path(OUT) / "index.html"
    if root_idx.exists():
        links_mod.insert(0, (SITE + "/", datetime.date.fromtimestamp(root_idx.stat().st_mtime).isoformat()))

    urls = "\n".join(
        f"  <url><loc>{html.escape(l)}</loc><lastmod>{m}</lastmod></url>"
        for l, m in links_mod)
    statics = "\n".join(
        f"  <url><loc>{html.escape(l)}</loc><lastmod>{today}</lastmod><changefreq>{cf}</changefreq></url>"
        for l, cf in STATIC_URLS)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           f"{urls}\n{statics}\n</urlset>\n")
    open(os.path.join(OUT, "sitemap.xml"), "w").write(xml)
    print(f"  wrote sitemap.xml ({len(links_mod)} static pages + {len(STATIC_URLS)} external tool pages)")

def write_robots():
    open(os.path.join(OUT, "robots.txt"), "w").write(
        "# joshuaopolko.com\n"
        "User-agent: *\nAllow: /\n"
        "Disallow: /*?s=\nDisallow: /*/feed/\n\n"
        "# AI search crawlers — explicitly welcome\n"
        "User-agent: GPTBot\nAllow: /\n"
        "User-agent: OAI-SearchBot\nAllow: /\n"
        "User-agent: ChatGPT-User\nAllow: /\n"
        "User-agent: ClaudeBot\nAllow: /\n"
        "User-agent: PerplexityBot\nAllow: /\n"
        "User-agent: Google-Extended\nAllow: /\n\n"
        "Sitemap: https://joshuaopolko.com/sitemap.xml\n")
    print("  wrote robots.txt")

def sync_nav():
    """Replace the <nav class="site-nav"> block in EVERY static page with NAV from NAV_ITEMS.

    Surgical: touches only the nav block, leaving each page's head, CSS, and body
    untouched. This is how you add a page to the site-wide nav: edit NAV_ITEMS above,
    then run `python3 build.py syncnav`. Idempotent.
    """
    pat = re.compile(r'<nav class="site-nav".*?</nav>', re.S)
    targets = []
    root = Path(OUT) / "index.html"
    if root.exists():
        targets.append(root)
    for entry in sorted(Path(OUT).iterdir()):
        if entry.is_dir() and (entry / "index.html").exists():
            targets.append(entry / "index.html")
    changed = []
    for f in targets:
        txt = f.read_text()
        new = pat.sub(lambda m: NAV, txt)  # lambda avoids regex backref expansion in NAV
        if new != txt:
            f.write_text(new)
            rel = "index.html" if f.parent == Path(OUT) else f"{f.parent.name}/index.html"
            changed.append(rel)
    return changed

def retemplate_one(path):
    """Re-apply PAGE_TMPL to static/path/index.html — preserves SEO head and body content."""
    fpath = os.path.join(OUT, path, "index.html") if path else os.path.join(OUT, "index.html")
    if not os.path.exists(fpath):
        return False
    soup = BeautifulSoup(open(fpath).read(), "html.parser")
    # Extract existing body content (h1 + post-body)
    h1 = soup.find("h1")
    title_text = h1.get_text(strip=True) if h1 else path
    post_body = soup.find(class_="post-body")
    content = post_body.decode_contents() if post_body else ""
    hero_el = soup.find(class_="hero")
    hero = str(hero_el) if hero_el else ""
    seo = seo_head_from_file(path)
    page = PAGE_TMPL.format(seo=seo, nav=NAV, title=html.escape(title_text), hero=hero, content=content)
    page = inline_css.inline(page)
    open(fpath, "w").write(page)
    return True

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    cmd = sys.argv[1] if sys.argv[1:] else "help"

    if cmd == "sitemap":
        write_sitemap()
        write_robots()

    elif cmd == "syncnav":
        changed = sync_nav()
        for rel in changed:
            print(f"  nav synced: {rel}")
        print(f"\nDone: {len(changed)} pages updated. (Edit NAV_ITEMS, rerun to propagate.)")

    elif cmd == "retemplate":
        slugs = sys.argv[2:] or [
            e.name for e in sorted(Path(OUT).iterdir())
            if e.is_dir() and (e / "index.html").exists() and e.name not in HAND_WRITTEN
        ]
        done = 0
        for slug in slugs:
            if slug in HAND_WRITTEN:
                print(f"  SKIP {slug} — hand-written page")
                continue
            ok = retemplate_one(slug)
            if ok:
                done += 1
                print(f"  retemplated {slug}")
        write_sitemap()
        write_robots()
        print(f"\nDone: {done} pages retemplated")

    else:
        print(__doc__)
