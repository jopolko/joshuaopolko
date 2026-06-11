#!/usr/bin/env python3
"""WordPress -> static HTML migrator for joshuaopolko.com (clean re-template).
Preserves: URL/dir structure (/slug/index.html), Rank Math SEO head, content, images, menu.
"""
import json, base64, re, os, sys, html, urllib.request, urllib.parse
from bs4 import BeautifulSoup

SITE = "https://joshuaopolko.com"
OUT  = "/home/josh/nowservingto/_joshua_migration/static"
PW = next(l.split("=",1)[1].strip() for l in open("/var/secrets/nowservingto.env")
          if l.startswith("joshuaopolko.com_wordpress_claudec_app_password="))
AUTH = base64.b64encode(f"claudec:{PW}".encode()).decode()
UA = {"User-Agent":"Mozilla/5.0 (migration)"}

def api(path):
    req = urllib.request.Request(SITE+path, headers={"Authorization":"Basic "+AUTH, **UA})
    return json.load(urllib.request.urlopen(req, timeout=60))

def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8","replace")

# ---- SEO head: prefer Rank Math getHead, fallback to scraping live <head> ----
SEO_KEEP_NAMES = ("description","robots","keywords")
def seo_head(url):
    raw = None
    try:
        d = api("/wp-json/rankmath/v1/getHead?url="+urllib.parse.quote(url, safe=''))
        if isinstance(d, dict) and d.get("success") and d.get("head"):
            raw = d["head"]
    except Exception:
        pass
    if raw is None:
        raw = fetch(url)  # full page; we'll only pull head tags
    soup = BeautifulSoup(raw, "html.parser")
    head = soup.head or soup
    keep = []
    if head.title and head.title.string:
        keep.append("<title>"+html.escape(head.title.string.strip())+"</title>")
    for m in head.find_all("meta"):
        n = (m.get("name") or m.get("property") or "").lower()
        if n in SEO_KEEP_NAMES or n.startswith(("og:","twitter:","article:")):
            keep.append(str(m))
    for l in head.find_all("link"):
        rel = " ".join(l.get("rel") or []).lower()
        if rel in ("canonical","image_src"):
            keep.append(str(l))
    for s in head.find_all("script", attrs={"type":"application/ld+json"}):
        keep.append(str(s))
    return "\n  ".join(keep)

# ---- navigation: scrape the live primary menu, preserve structure ----
def get_nav():
    soup = BeautifulSoup(fetch(SITE+"/"), "html.parser")
    # find the menu UL most likely to be the primary nav
    cand = (soup.select_one("ul#primary-menu") or soup.select_one("nav ul.menu")
            or soup.select_one("header nav ul") or soup.select_one("nav ul"))
    items = []
    if cand:
        for li in cand.find_all("li", recursive=False):
            a = li.find("a", recursive=False) or li.find("a")
            if not a: continue
            sub = []
            subul = li.find("ul")
            if subul:
                for sli in subul.find_all("li", recursive=False):
                    sa = sli.find("a")
                    if sa: sub.append((sa.get_text(strip=True), sa.get("href","#")))
            items.append((a.get_text(strip=True), a.get("href","#"), sub))
    if not items:  # fallback
        items = [("Home","/",[]),
                 ("AI & GEO","#",[("GEO: AI Citation","/geo-ai-citation/"),
                                  ("Your Site as AI Infrastructure","/ai-infrastructure/"),
                                  ("LLM-as-ETL","/llm-etl-architecture/"),
                                  ("Claude SEO","/claude-seo/"),
                                  ("Fable 5 Issues & Fixes","/claude-fable-5-issues-fixes/")]),
                 ("About","/about/",[])]
    return items

def nav_html(items):
    out = ['<nav class="site-nav" aria-label="Primary"><ul>']
    for label, href, sub in items:
        if sub:
            out.append(f'<li class="has-sub"><a href="{html.escape(href)}">{html.escape(label)} <span aria-hidden="true">▾</span></a><ul>')
            for sl, sh in sub:
                out.append(f'<li><a href="{html.escape(sh)}">{html.escape(sl)}</a></li>')
            out.append('</ul></li>')
        else:
            out.append(f'<li><a href="{html.escape(href)}">{html.escape(label)}</a></li>')
    out.append('</ul></nav>')
    return "".join(out)

def url_to_path(link):
    p = urllib.parse.urlparse(link).path.strip("/")
    return "" if p == "home" else p  # front page -> root

def featured(media_id):
    if not media_id: return ""
    try:
        m = api(f"/wp-json/wp/v2/media/{media_id}")
        src = m.get("source_url"); alt = (m.get("alt_text") or "").strip()
        if src:
            return f'<figure class="hero"><img src="{html.escape(src)}" alt="{html.escape(alt)}" loading="eager"></figure>'
    except Exception: pass
    return ""

PAGE_TMPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{seo}
<link rel="stylesheet" href="/assets/site.css?v=9">
<script src="/assets/nav.js?v=3" defer></script>
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

def build_one(item, nav):
    link = item["link"]; path = url_to_path(link)
    seo_url = (SITE + "/") if path == "" else link   # front page canonical is /
    seo = seo_head(seo_url)
    hero = featured(item.get("featured_media"))
    content = item["content"]["rendered"]
    page = PAGE_TMPL.format(seo=seo, nav=nav, title=item["title"]["rendered"],
                            hero=hero, content=content)
    d = os.path.join(OUT, path)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w") as f:
        f.write(page)
    return seo_url, path or "(home)", len(seo), bool(hero)

def get_by_slug(slug, kinds=("pages","posts")):
    for k in kinds:
        d = api(f"/wp-json/wp/v2/{k}?slug={slug}&context=edit&_fields=id,link,slug,type,title,content,featured_media,status")
        if d: return d[0]
    return None

def list_all():
    items = []
    for k in ("pages","posts"):
        page = 1
        while True:
            d = api(f"/wp-json/wp/v2/{k}?per_page=100&page={page}&status=publish&context=edit"
                    f"&_fields=id,link,slug,type,title,content,featured_media,status,modified")
            if not d: break
            items.extend(d)
            if len(d) < 100: break
            page += 1
    return items

def write_sitemap(links_mod):
    urls = "\n".join(
        f"  <url><loc>{html.escape(l)}</loc><lastmod>{m[:10]}</lastmod></url>"
        for l, m in links_mod)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           f"{urls}\n</urlset>\n")
    open(os.path.join(OUT, "sitemap.xml"), "w").write(xml)

def write_robots():
    open(os.path.join(OUT, "robots.txt"), "w").write(
        "User-agent: *\nAllow: /\n\nSitemap: https://joshuaopolko.com/sitemap.xml\n")

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    nav = nav_html(get_nav())
    print("NAV items detected:", nav.count("<li"))

    if sys.argv[1:] == ["--all"]:
        items = list_all()
        print(f"Fetched {len(items)} published items")
        built, root_ok, errors, links_mod = 0, False, [], []
        for it in items:
            try:
                link, path, seolen, hero = build_one(it, nav)
                links_mod.append((link, it.get("modified","")))
                if path == "(home)": root_ok = True
                built += 1
                tag = "ROOT" if path == "(home)" else path[:46]
                print(f"  [{built:2d}] {tag:48s} seo={seolen}b hero={hero}")
            except Exception as e:
                errors.append((it.get("slug"), str(e)))
                print(f"  ERROR {it.get('slug')}: {e}")
        write_sitemap(links_mod)
        write_robots()
        print(f"\nBUILT {built}/{len(items)} | root index.html: {root_ok} | errors: {len(errors)}")
        if errors:
            for s, e in errors: print("   FAIL:", s, "->", e)
    else:
        sample = sys.argv[1:] or ["claude-fable-5-issues-fixes"]
        for slug in sample:
            it = get_by_slug(slug)
            if not it: print("  MISSING:", slug); continue
            link, path, seolen, hero = build_one(it, nav)
            print(f"  built {path:50s} seo_head={seolen}b hero={hero}  <- {link}")
