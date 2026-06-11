#!/usr/bin/env python3
"""Completeness pass over joshuaopolko static pages: inject GA, ensure meta
description (generate from og:description or first paragraph if missing), and
meta keywords. Idempotent."""
import os, re, html
BASE = "/home/josh/joshuaopolko/static"
GA = ('<script async src="https://www.googletagmanager.com/gtag/js?id=G-1GZN9MX2P4"></script>'
      '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
      "gtag('js',new Date());gtag('config','G-1GZN9MX2P4');</script>")
STOP = {'with','from','that','this','your','their','what','when','toronto','about','into','how','the','and','for'}

ga=desc=kw=0
for root,_,files in os.walk(BASE):
    if 'index.html' not in files or '/assets' in root: continue
    p=os.path.join(root,'index.html'); s=open(p).read(); orig=s
    if 'G-1GZN9MX2P4' not in s:
        s=s.replace('</head>', GA+'</head>',1); ga+=1
    if not re.search(r'<meta\s+name="description"', s, re.I):
        m=re.search(r'<meta property="og:description" content="([^"]*)"', s)
        d=m.group(1) if m else None
        if not d:
            pm=re.search(r'<div class="post-body">(.*?)</div>', s, re.S) or re.search(r'<p class="lede">(.*?)</p>', s, re.S)
            if pm:
                t=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',pm.group(1)))).strip()
                d=(t[:152].rsplit(' ',1)[0]+'…') if len(t)>152 else t
        if d:
            s=s.replace('</head>', f'<meta name="description" content="{html.escape(d, quote=True)}">'+'</head>',1); desc+=1
    if not re.search(r'<meta\s+name="keywords"', s, re.I):
        tm=re.search(r'<title>([^<]*)</title>', s)
        title=html.unescape(tm.group(1)) if tm else ''
        words=[w for w in re.split(r'[^A-Za-z0-9]+', title) if len(w)>3 and w.lower() not in STOP]
        seen=[]; [seen.append(w) for w in words if w not in seen]
        k=', '.join(seen[:8])
        if k:
            s=s.replace('</head>', f'<meta name="keywords" content="{html.escape(k, quote=True)}">'+'</head>',1); kw+=1
    if s!=orig: open(p,'w').write(s)
print(f"GA added: {ga} | descriptions added: {desc} | keywords added: {kw}")
