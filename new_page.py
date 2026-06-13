#!/usr/bin/env python3
"""
new_page.py — stamp a fully SEO-correct static page for joshuaopolko.com.

Replaces the one genuinely useful thing Rank Math did: emit a complete,
valid SEO head (meta + OG + Twitter + canonical + JSON-LD @graph) so you
never hand-assemble it. Author is baked as the real Person entity (no
"admin", no server-IP sameAs). Optionally deploys and updates the sitemap.

USAGE
  python3 new_page.py \
      --slug local-ai-tools \
      --title "Local AI Tools: A 2026 Field Guide" \
      --desc  "A practical tour of running models on your own hardware." \
      --body  article.md            # markdown OR html; '-' reads stdin
      [--date 2026-06-11]           # defaults to today
      [--deploy]                    # scp to prod, add to sitemap, ping IndexNow

Without --deploy it just writes static/<slug>/index.html and prints next steps.
"""
import argparse, datetime, html, json, re, subprocess, sys
from pathlib import Path

BASE   = "https://joshuaopolko.com"
ROOT   = Path(__file__).resolve().parent / "static"
SSH    = "nowservingto"                      # ssh host alias
PRODIR = "/var/www/html"

# --- exact site chrome (kept in sync with the migrated pages) --------------
HEADER = '''<header class="site-head">
  <a class="brand" href="/">Joshua&nbsp;Opolko</a>
  <nav class="site-nav" aria-label="Primary"><ul><li class="has-sub"><a href="https://joshuaopolko.com">Local <span aria-hidden="true">▾</span></a><ul><li><a href="https://nowservingto.com">NowServingTO</a></li><li><a href="https://joshuaopolko.com/kidsevents">Kids Events</a></li><li><a href="https://joshuaopolko.com/hometurf">HomeTurf</a></li><li><a href="https://joshuaopolko.com/security/">Security Dashboard</a></li></ul></li><li class="has-sub"><a href="https://joshuaopolko.com">AI &amp; GEO <span aria-hidden="true">▾</span></a><ul><li><a href="https://joshuaopolko.com/agent-zero/">Agent Zero</a></li><li><a href="https://joshuaopolko.com/claude-fable-5-issues-fixes/">Claude Fable 5</a></li><li><a href="https://joshuaopolko.com/ai-infrastructure/">Site as AI Infrastructure</a></li><li><a href="https://joshuaopolko.com/llm-etl-architecture/">LLM-as-ETL</a></li><li><a href="https://joshuaopolko.com/geo-ai-citation/">GEO: Optimizing for AI Citation</a></li><li><a href="https://joshuaopolko.com/claude-seo/">Claude SEO/GEO</a></li><li><a href="https://joshuaopolko.com/claude-code-specification-workflow-mcp/">claude-code-spec-workflow</a></li></ul></li><li class="has-sub"><a href="https://joshuaopolko.com">Research <span aria-hidden="true">▾</span></a><ul><li><a href="https://joshuaopolko.com/the-princess-and-the-pea-when-physical-restriction-mimics-psychological-disorders/">Princess &amp; the Pea</a></li><li><a href="https://joshuaopolko.com/hypersensitivity-a-unified-theory-of-adaptation-across-marginalized-communities/">Hypersensitivity</a></li><li><a href="https://joshuaopolko.com/how-intra-community-trauma-shapes-the-architecture-of-belonging/">Belonging</a></li><li><a href="https://joshuaopolko.com/terror-management-and-religious-control-how-death-anxiety-drives-authoritarian-belief/">Terror Management</a></li></ul></li><li class="has-sub"><a href="https://joshuaopolko.com/about/">About <span aria-hidden="true">▾</span></a><ul><li><a href="https://github.com/jopolko">GitHub</a></li><li><a href="https://joshuaopolko.com/manifesto-of-a-modern-solar-cultist/">Winter Manifesto</a></li></ul></li></ul></nav>
</header>'''
FOOTER = '<footer class="site-foot">\n  <p>&copy; Joshua Opolko</p>\n</footer>'

GA = ('<script async src="https://www.googletagmanager.com/gtag/js?id=G-1GZN9MX2P4"></script>'
      '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
      "gtag('js',new Date());gtag('config','G-1GZN9MX2P4');</script>")


def md_to_html(text):
    """Minimal markdown -> HTML. Lines beginning with '<' pass through as raw HTML."""
    def inline(s):
        s = html.escape(s, quote=False)
        s = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',
                   r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', s)
        s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
        s = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', s)
        s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
        return s
    out, lines, i = [], text.replace('\r\n', '\n').split('\n'), 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1; continue
        if ln.lstrip().startswith('<'):                       # raw HTML block
            out.append(ln); i += 1; continue
        m = re.match(r'(#{2,4})\s+(.*)', ln)
        if m:
            lvl = len(m.group(1)); out.append(f'<h{lvl}>{inline(m.group(2).strip())}</h{lvl}>'); i += 1; continue
        if re.match(r'\s*[-*]\s+', ln):                       # unordered list
            items = []
            while i < len(lines) and re.match(r'\s*[-*]\s+', lines[i]):
                items.append(f'  <li>{inline(re.sub(r"^\s*[-*]\s+", "", lines[i]))}</li>'); i += 1
            out.append('<ul>\n' + '\n'.join(items) + '\n</ul>'); continue
        para = [ln]                                            # paragraph (until blank)
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(('<', '#', '-', '*')):
            para.append(lines[i]); i += 1
        out.append(f'<p>{inline(" ".join(p.strip() for p in para))}</p>')
    return '\n\n'.join(out)


def build_schema(slug, title, desc, date_iso, url):
    person = {"@type": ["Person", "Organization"], "@id": f"{BASE}/#person",
              "name": "Joshua Opolko", "url": f"{BASE}/"}
    website = {"@type": "WebSite", "@id": f"{BASE}/#website", "url": f"{BASE}/",
               "name": "Joshua Opolko", "publisher": {"@id": f"{BASE}/#person"},
               "inLanguage": "en-US"}
    crumbs = {"@type": "BreadcrumbList", "@id": f"{url}#breadcrumb", "itemListElement": [
        {"@type": "ListItem", "position": 1, "item": {"@id": f"{BASE}/", "name": "Home"}},
        {"@type": "ListItem", "position": 2, "item": {"@id": url, "name": title}}]}
    webpage = {"@type": "WebPage", "@id": f"{url}#webpage", "url": url, "name": title,
               "datePublished": date_iso, "dateModified": date_iso,
               "isPartOf": {"@id": f"{BASE}/#website"}, "inLanguage": "en-US",
               "breadcrumb": {"@id": f"{url}#breadcrumb"}}
    article = {"@type": "Article", "@id": f"{url}#article", "headline": title,
               "description": desc, "datePublished": date_iso, "dateModified": date_iso,
               "author": {"@id": f"{BASE}/#person"}, "publisher": {"@id": f"{BASE}/#person"},
               "isPartOf": {"@id": f"{url}#webpage"}, "mainEntityOfPage": {"@id": f"{url}#webpage"},
               "inLanguage": "en-US"}
    graph = {"@context": "https://schema.org", "@graph": [person, website, crumbs, webpage, article]}
    return json.dumps(graph, separators=(",", ":"), ensure_ascii=False)


def render(slug, title, desc, body_html, date):
    url = f"{BASE}/{slug}/"
    date_iso = f"{date}T00:00:00+00:00"
    a = lambda s: html.escape(s, quote=True)      # attribute-safe
    t = lambda s: html.escape(s, quote=False)     # text-safe
    schema = build_schema(slug, title, desc, date_iso, url)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32">
<link rel="icon" type="image/png" href="/favicon-192x192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#fbfaf7">
<title>{t(title)}</title>
<meta name="description" content="{a(desc)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large">
<link rel="canonical" href="{url}">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="article">
<meta property="og:title" content="{a(title)}">
<meta property="og:description" content="{a(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Joshua Opolko">
<meta property="article:published_time" content="{date_iso}">
<meta property="article:modified_time" content="{date_iso}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{a(title)}">
<meta name="twitter:description" content="{a(desc)}">
<script type="application/ld+json">{schema}</script>
<link rel="stylesheet" href="/assets/site.css?v=9">
<script src="/assets/nav.js?v=3" defer></script>
{GA}
</head>
<body>
{HEADER}
<main class="article">
  <h1>{t(title)}</h1>
  <div class="post-body">
{body_html}
  </div>
</main>
{FOOTER}
</body>
</html>
'''


def main():
    ap = argparse.ArgumentParser(description="Stamp an SEO-correct static page.")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--desc", required=True)
    ap.add_argument("--body", required=True, help="markdown/html file, or '-' for stdin")
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--deploy", action="store_true")
    args = ap.parse_args()

    slug = args.slug.strip("/")
    raw = sys.stdin.read() if args.body == "-" else Path(args.body).read_text()
    body_html = raw if raw.lstrip().startswith("<p") or "<h2" in raw[:200] else md_to_html(raw)

    page = render(slug, args.title, args.desc, body_html, args.date)
    # safety: the schema must be valid JSON
    blk = re.search(r'<script type="application/ld\+json">(.*?)</script>', page, re.S).group(1)
    json.loads(blk)  # raises if malformed

    out = ROOT / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    url = f"{BASE}/{slug}/"
    print(f"✓ wrote {out}  ({len(re.sub('<[^>]+>', ' ', body_html).split())} body words)")

    if not args.deploy:
        print("\nNext steps (or re-run with --deploy):")
        print(f"  • scp to {SSH}:{PRODIR}/{slug}/index.html")
        print(f"  • add <loc>{url}</loc> to {PRODIR}/sitemap.xml")
        print(f"  • submit {url} via IndexNow")
        return

    # --- deploy ---
    subprocess.run(["ssh", SSH, f"sudo mkdir -p {PRODIR}/{slug}"], check=True)
    subprocess.run(["scp", "-q", str(out), f"{SSH}:/tmp/_np.html"], check=True)
    remote = f'''set -e
sudo cp /tmp/_np.html {PRODIR}/{slug}/index.html
sudo chown www-data:www-data {PRODIR}/{slug}/index.html
python3 - <<'PY'
import re
p="{PRODIR}/sitemap.xml"; s=open(p).read()
loc="{url}"
if loc not in s:
    entry='  <url><loc>{url}</loc><lastmod>{args.date}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\\n'
    s=s.replace("</urlset>", entry+"</urlset>")
    open(p,"w").write(s); print("  sitemap += "+loc)
else: print("  already in sitemap")
PY
KEYFILE=$(ls {PRODIR}/ | grep -E '^[a-f0-9]{{32}}\\.txt$' | head -1); KEY=$(cat {PRODIR}/$KEYFILE)
curl -s -o /dev/null -w "  IndexNow -> HTTP %{{http_code}}\\n" -X POST https://www.bing.com/indexnow \\
  -H 'Content-Type: application/json' \\
  -d "{{\\"host\\":\\"joshuaopolko.com\\",\\"key\\":\\"$KEY\\",\\"keyLocation\\":\\"https://joshuaopolko.com/$KEYFILE\\",\\"urlList\\":[\\"{url}\\"]}}"
echo "  live: $(curl -s -o /dev/null -w '%{{http_code}}' {url})"'''
    subprocess.run(["ssh", SSH, "sudo bash -s"], input=remote, text=True, check=True)
    print(f"✓ deployed + sitemap + IndexNow. Now Request-Index {url} in GSC.")


if __name__ == "__main__":
    main()
