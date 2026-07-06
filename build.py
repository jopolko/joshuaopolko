#!/usr/bin/env python3
"""Static site tools for joshuaopolko.com.

WordPress migration is complete. This script no longer calls the WP API or DB.
Source of truth is static/ — edit HTML files directly or use new_page.py for new pages.

Usage:
  python3 build.py sitemap          # regenerate sitemap.xml + robots.txt from static/
  python3 build.py syncnav          # push NAV_ITEMS into the <nav> of every page (surgical, nav-only)
  python3 build.py syncfooter       # push NAV_ITEMS link map into the <footer> of every page (surgical)
  python3 build.py retemplate       # re-apply PAGE_TMPL to all static pages (preserves SEO head + body)
  python3 build.py schema_fix       # inject Person description/sameAs, wordCount, og:image across all pages

To add a page to the site-wide nav: edit NAV_ITEMS, run `syncnav`, then deploy changed pages.
"""
import re, os, sys, html, urllib.parse, datetime, json
from pathlib import Path
from bs4 import BeautifulSoup
import inline_css  # inlines site.css so fresh builds aren't render-blocking

SITE = "https://joshuaopolko.com"
OUT  = str(Path(__file__).resolve().parent / "static")
UA   = {"User-Agent": "Mozilla/5.0"}

# Canonical Person entity fields added to every page that references #person.
PERSON_ID          = "https://joshuaopolko.com/#person"
PERSON_DESCRIPTION = ("Software developer and writer based in Toronto, specializing in "
                      "AI tools, self-hosting, and immersive technology. Founder of NowServingTO.")
PERSON_SAME_AS     = [
    "https://github.com/jopolko",
    "https://x.com/JoshuaOpolko",
    "https://www.linkedin.com/in/joshua-opolko/",
    "https://www.reddit.com/user/JoshuaOpolko/",
]

# ---- navigation (hardcoded — edit here when adding pages to the menu) ----
NAV_ITEMS = [
    ("Local", "#", [
        ("NowServingTO",      "https://nowservingto.com"),
        ("Kids Events",       "/kidsevents/"),
        ("HomeTurf",          "/hometurf/"),
    ]),
    ("Tools", "#", [
        ("Ollama",                  "/ollama/"),
        ("Open WebUI",              "/open-webui-self-hosted-guide/"),
        ("AnythingLLM",             "/anythingllm-self-hosted-guide/"),
        ("LibreChat",               "/librechat-self-hosted-guide/"),
        ("LiteLLM",                 "/litellm-proxy-guide/"),
        ("n8n",                     "/n8n-self-hosted-guide/"),
        ("n8n + LangChain",         "/n8n-langchain-self-hosting/"),
        ("Dify",                    "/dify-self-hosted-guide/"),
        ("Vane",                    "/perplexica-self-hosted-guide/"),
        ("SearXNG",                 "/searxng-self-hosted-guide/"),
        ("Agent Zero",              "/agent-zero/"),
    ]),
    ("AI & GEO", "#", [
        ("AI Readiness Scan",       "/aiscan/"),
        ("CrewAI",                  "/crewai-setup-production-guide/"),
        ("Building JOSIE",          "/building-an-advanced-ai-workflow-josie-with-persistent-memory-and-live-data-access/"),
        ("Site as AI Infrastructure","/ai-infrastructure/"),
        ("LLM-as-ETL",              "/llm-etl-architecture/"),
        ("GEO Field Manual",        "/geo-field-manual/"),
        ("GEO Observatory",         "/geo-observatory/"),
        ("GEO: AI Citation",        "/geo-ai-citation/"),
        ("GEO Answers",             "/geo-answers/"),
        ("Claude SEO/GEO",          "/claude-seo/"),
        ("Claude Code Spec Workflow","/claude-code-specification-workflow-mcp/"),
        ("Connector Creep",         "/connector-creep.html"),
        ("Reverse Terraforming",    "/reverse-terraforming/"),
    ]),
    ("XR", "#", [
        ("Architectural Viz",  "/architectural-visualization/"),
        ("VR for Growing Teams","/vr-visualization-growing-teams/"),
        ("VR Walkthroughs (AEC)","/vr-walkthrough-aec/"),
        ("VR Hardware Sizing",  "/vr-hardware-sizing-aec/"),
        ("cyubeVR",            "/cyubevr/"),
        ("NeosVR",             "/neosvr/"),
        ("VR Visual Effects",  "/psychedelic-vr-visual-effects-meta-quest/"),
        ("VR Therapy",         "/vr-healing/"),
        ("VR Elderly Care",    "/revolutionizing-elderly-care-with-virtual-reality/"),
        ("Vision & the Brain", "/vision-dominates-half-your-brains-processing-power/"),
        ("XR in Military",     "/military-application/"),
        ("Visual Tests",       "/xr-tests/"),
    ]),
    ("About", "/about/", []),
]

def nav_html():
    out = ['<nav class="site-nav" aria-label="Primary"><ul>']
    for label, href, sub in NAV_ITEMS:
        if sub:
            out.append(f'<li class="has-sub"><a href="{html.escape(href)}">{html.escape(label)} <span aria-hidden="true">▾</span></a><ul>')
            for sl, sh in sub:
                out.append(f'<li><a href="{html.escape(sh)}">{sl}</a></li>')
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
<link rel="stylesheet" href="/assets/site.css?v=11">
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
HAND_WRITTEN = {""}  # "" = root/home  (/security/ retired 2026-06-19, 301 -> /geo-observatory)

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
    ("https://joshuaopolko.com/geo-observatory/",         "daily"),
    ("https://joshuaopolko.com/aiscan/",                   "weekly"),
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

NAV_DROP_CSS = (
    '<style id="nav-drop">'
    '.site-nav .has-sub > ul{display:flex;opacity:0;pointer-events:none;'
    'transform:translateY(-4px);transition:opacity .15s,transform .15s}'
    '.site-nav .has-sub:hover > ul,'
    '.site-nav .has-sub:focus-within > ul{opacity:1;pointer-events:auto;transform:translateY(0)}'
    '@media(max-width:640px){'
    '.site-nav .has-sub:hover > ul,'
    '.site-nav .has-sub:focus-within > ul{opacity:0;pointer-events:none;transform:translateY(-4px)}'
    '.site-nav .has-sub.open > ul{opacity:1;pointer-events:auto;transform:translateY(0)}}'
    '</style>'
)

FOOTER_CSS = (
    '<style>'
    '.foot-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;margin-bottom:28px}'
    '.foot-col ul{list-style:none;margin:0;padding:0}'
    '.foot-col li{margin:6px 0}'
    '.foot-col a{color:var(--muted);text-decoration:none;font-size:13px;line-height:1.5}'
    '.foot-col a:hover{color:var(--accent-ink)}'
    '.foot-hed{font:600 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;'
    'color:var(--accent);margin:0 0 12px}'
    '.foot-copy{margin:28px 0 0;padding-top:20px;border-top:1px solid var(--line);font-size:13px}'
    '.foot-copy a{color:var(--muted);text-decoration:none}'
    '@media(max-width:700px){.foot-cols{grid-template-columns:repeat(2,1fr);gap:24px}}'
    '@media(max-width:400px){.foot-cols{grid-template-columns:1fr}}'
    '</style>'
)

def footer_html():
    return '<footer class="site-foot"><p>&copy; Joshua Opolko</p></footer>'

FOOTER = footer_html()

def sync_footer():
    """Replace <footer class="site-foot">...</footer> in every static page and
    inject footer CSS into <head> for pages that already have inlined CSS
    (so they don't need a full retemplate to pick up the new column styles).

    Idempotent: detects .foot-cols presence before injecting CSS.
    """
    foot_pat = re.compile(r'<footer class="site-foot">.*?</footer>', re.S)
    targets = []
    root = Path(OUT) / "index.html"
    if root.exists():
        targets.append(root)
    for entry in sorted(Path(OUT).iterdir()):
        if entry.is_dir() and (entry / "index.html").exists():
            targets.append(entry / "index.html")
        elif entry.is_file() and entry.suffix == ".html" and entry.name != "index.html":
            targets.append(entry)
    changed = []
    for f in targets:
        txt = f.read_text()
        new = foot_pat.sub(lambda m: FOOTER, txt)
        if ".foot-cols" not in new and "</head>" in new:
            new = new.replace("</head>", FOOTER_CSS + "</head>", 1)
        if new != txt:
            f.write_text(new)
            rel = str(f.relative_to(Path(OUT)))
            changed.append(rel)
    return changed

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
    nav_css_pat = re.compile(r'<style id="nav-drop">.*?</style>', re.S)
    changed = []
    for f in targets:
        txt = f.read_text()
        new = pat.sub(lambda m: NAV, txt)
        if nav_css_pat.search(new):
            new = nav_css_pat.sub(NAV_DROP_CSS, new)
        elif '</head>' in new:
            new = new.replace('</head>', NAV_DROP_CSS + '</head>', 1)
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

_SCHEMA_PAT = re.compile(
    r'(<script[^>]+type="application/ld\+json"[^>]*>)(.*?)(</script>)',
    re.DOTALL
)

def _body_word_count(txt):
    soup = BeautifulSoup(txt, "html.parser")
    region = soup.find(class_="post-body") or soup.find("main")
    if not region:
        return None
    return len(region.get_text(separator=" ").split())

def schema_fix():
    """Surgical pass over every static page:
    - Person nodes missing description or sameAs get them injected.
    - Article/BlogPosting nodes missing wordCount get a word count from the page body.
    - Pages missing og:image get it derived from any schema ImageObject on the same page.
    Pages with no image at all (no schema ImageObject) are reported for manual follow-up.
    """
    targets = []
    root = Path(OUT) / "index.html"
    if root.exists():
        targets.append(root)
    for entry in sorted(Path(OUT).iterdir()):
        if entry.is_dir() and (entry / "index.html").exists():
            targets.append(entry / "index.html")

    changed = []
    needs_og_image = []
    person_fixed = wc_fixed = og_fixed = 0

    for f in targets:
        txt = f.read_text()
        wc = _body_word_count(txt)

        p_delta = [0]
        w_delta = [0]

        def fix_block(m, _wc=wc, _pd=p_delta, _wd=w_delta):
            open_tag, content, close_tag = m.group(1), m.group(2), m.group(3)
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                return m.group(0)

            block_changed = False
            if isinstance(data, dict) and "@graph" in data:
                for node in data["@graph"]:
                    if node.get("@type") == "Person" and node.get("@id") == PERSON_ID:
                        if "description" not in node:
                            node["description"] = PERSON_DESCRIPTION
                            block_changed = True
                            _pd[0] += 1
                        if "sameAs" not in node:
                            node["sameAs"] = PERSON_SAME_AS
                            block_changed = True
                    if node.get("@type") in ("Article", "BlogPosting") and "wordCount" not in node and _wc:
                        node["wordCount"] = _wc
                        block_changed = True
                        _wd[0] += 1

            if block_changed:
                return open_tag + "\n" + json.dumps(data, indent=2, ensure_ascii=False) + "\n" + close_tag
            return m.group(0)

        new_txt = _SCHEMA_PAT.sub(fix_block, txt)
        person_fixed += p_delta[0]
        wc_fixed += w_delta[0]

        # og:image: add from schema ImageObject if the page has no og:image yet.
        if not re.search(r"og:image", new_txt, re.IGNORECASE):
            img_url = img_w = img_h = None
            for m in _SCHEMA_PAT.finditer(new_txt):
                try:
                    data = json.loads(m.group(2))
                    if isinstance(data, dict) and "@graph" in data:
                        for node in data["@graph"]:
                            if node.get("@type") == "ImageObject":
                                img_url = node.get("url")
                                img_w = node.get("width")
                                img_h = node.get("height")
                                break
                except json.JSONDecodeError:
                    pass
                if img_url:
                    break

            if img_url:
                tags = [
                    f'<meta content="{img_url}" property="og:image"/>',
                    f'<meta content="{img_url}" property="og:image:secure_url"/>',
                ]
                if img_w:
                    tags.append(f'<meta content="{img_w}" property="og:image:width"/>')
                if img_h:
                    tags.append(f'<meta content="{img_h}" property="og:image:height"/>')
                tags.append(f'<meta content="{img_url}" name="twitter:image"/>')
                insert = "\n".join(tags) + "\n"

                # Place after the last og:/twitter: meta in <head>, else before </head>.
                last_og = None
                for m in re.finditer(r'<meta[^>]+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*>', new_txt):
                    last_og = m
                if last_og:
                    pos = last_og.end()
                    new_txt = new_txt[:pos] + "\n" + insert + new_txt[pos:]
                else:
                    new_txt = new_txt.replace("</head>", insert + "</head>", 1)

                og_fixed += 1
            else:
                slug = f.parent.name if f.parent != Path(OUT) else "index"
                needs_og_image.append(slug)

        if new_txt != txt:
            f.write_text(new_txt)
            slug = f.parent.name if f.parent != Path(OUT) else "index"
            changed.append(slug)

    return changed, needs_og_image, {
        "person_fixed": person_fixed,
        "wc_fixed": wc_fixed,
        "og_fixed": og_fixed,
    }


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

    elif cmd == "syncfooter":
        changed = sync_footer()
        for rel in changed:
            print(f"  footer synced: {rel}")
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

    elif cmd == "schema_fix":
        changed, needs_og, stats = schema_fix()
        for slug in changed:
            print(f"  fixed: {slug}")
        if needs_og:
            print(f"\nNeeds manual og:image ({len(needs_og)} pages — no image asset found):")
            for slug in needs_og:
                print(f"  {slug}")
        print(f"\nDone: {len(changed)} files updated")
        print(f"  Person description/sameAs: {stats['person_fixed']} nodes")
        print(f"  wordCount: {stats['wc_fixed']} articles")
        print(f"  og:image from schema ImageObject: {stats['og_fixed']} pages")

    else:
        print(__doc__)
