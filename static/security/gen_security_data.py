#!/usr/bin/env python3
"""Build /var/www/html/security/data.json from fail2ban + /var/log/auth.log.

Runs as root (cron). Emits ONLY safe aggregate threat data — banned attacker
IPs (public ranges only), failed-attempt counts, per-day attack volume, and
the most-targeted usernames. No successful-login or local-account detail is
exposed. Private/reserved IPs are filtered out so internal hosts never appear.
"""
import subprocess, re, json, ipaddress, datetime, collections, os
import urllib.request, urllib.error

OUT = "/var/www/html/security/data.json"
GEO_CACHE = "/var/tmp/secdash_geo_cache.json"  # not web-exposed; persists IP->geo lookups
AUTH_LOGS = ["/var/log/auth.log", "/var/log/auth.log.1"]
WINDOW_DAYS = 14
NOW = datetime.datetime.now()

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout

def is_public(ip):
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False

# ---- fail2ban sshd jail ----
st = sh("fail2ban-client status sshd 2>/dev/null")
def num(label, default=0):
    m = re.search(rf"{label}:\s*(\d+)", st)
    return int(m.group(1)) if m else default
m_ban = re.search(r"Banned IP list:\s*(.*)", st)
banned_all = (m_ban.group(1).split() if m_ban else [])
banned_public = [ip for ip in banned_all if is_public(ip)]

summary = {
    "currently_failed": num("Currently failed"),
    "total_failed":     num("Total failed"),
    "currently_banned": len(banned_public),
    "total_banned":     num("Total banned"),
}

# ---- auth.log: failed SSH attempts ----
text = ""
for p in AUTH_LOGS:
    try:
        with open(p, "r", errors="ignore") as f:
            text += f.read()
    except (PermissionError, FileNotFoundError):
        pass

MONTHS = {m: i for i, m in enumerate(
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], 1)}
# syslog line: "Jun 13 18:48:45 host sshd[..]: Failed password for [invalid user] X from 1.2.3.4 port .."
line_re = re.compile(
    r'^(\w{3})\s+(\d+)\s[\d:]+\s.*?sshd\[\d+\]:\s*'
    r'(.*?(?:Failed password|Invalid user|Connection closed by authenticating).*)$', re.M)
ip_re = re.compile(r'from (\d{1,3}(?:\.\d{1,3}){3})')
user_re = re.compile(r'(?:Invalid user (\S+)|Failed password for (?:invalid user )?(\S+))')

by_ip = collections.Counter()
by_day = collections.Counter()
by_user = collections.Counter()
cutoff = (NOW - datetime.timedelta(days=WINDOW_DAYS)).date()

for mon, day, rest in line_re.findall(text):
    if mon not in MONTHS:
        continue
    yr = NOW.year if MONTHS[mon] <= NOW.month else NOW.year - 1
    try:
        d = datetime.date(yr, MONTHS[mon], int(day))
    except ValueError:
        continue
    ipm = ip_re.search(rest)
    ip = ipm.group(1) if ipm else None
    if ip and is_public(ip):
        by_ip[ip] += 1
    um = user_re.search(rest)
    if um:
        u = um.group(1) or um.group(2)
        if u and u not in ("from",):
            by_user[u] += 1
    if d >= cutoff:
        by_day[d.isoformat()] += 1

# fill missing days in the window so the chart has a continuous axis
days = []
for i in range(WINDOW_DAYS, -1, -1):
    dd = (NOW.date() - datetime.timedelta(days=i)).isoformat()
    days.append({"date": dd, "count": by_day.get(dd, 0)})

# ---- geolocate attacker IPs (ip-api.com free batch endpoint, on-disk cached) ----
# Only IPs not already cached are queried, so steady-state runs make 0 calls and
# we stay far under the free 15 req/min limit. Failures degrade gracefully to no-geo.
try:
    with open(GEO_CACHE) as f:
        geo_cache = json.load(f)
except Exception:
    geo_cache = {}

want = list(dict.fromkeys([ip for ip, _ in by_ip.items()] + banned_public))  # unique, order-stable
# Re-query entries cached before ISP/ASN was added (one-time migration).
missing = [ip for ip in want if ip not in geo_cache or "as" not in geo_cache[ip]]

def geolocate(ips):
    found = {}
    for i in range(0, len(ips), 100):  # ip-api batch caps at 100 IPs/request
        batch = ips[i:i + 100]
        try:
            req = urllib.request.Request(
                "http://ip-api.com/batch?fields=status,country,countryCode,lat,lon,query,isp,org,as,asname",
                data=json.dumps(batch).encode(),
                headers={"Content-Type": "application/json"})
            for r in json.load(urllib.request.urlopen(req, timeout=12)):
                if r.get("status") == "success" and r.get("lat") is not None:
                    found[r["query"]] = {"country": r.get("country") or "Unknown",
                                         "cc": r.get("countryCode") or "",
                                         "lat": r["lat"], "lon": r["lon"],
                                         "isp": r.get("isp") or "",
                                         "org": r.get("org") or "",
                                         "as": r.get("as") or "",
                                         "asname": r.get("asname") or ""}
        except Exception:
            break  # network/rate issue — keep whatever we have, try again next run
    return found

if missing:
    geo_cache.update(geolocate(missing))
    try:
        with open(GEO_CACHE, "w") as f:
            json.dump(geo_cache, f)
    except Exception:
        pass

# Aggregate ALL located attacker IPs in the window by country and by network
# (ISP / ASN). No individual IPs are emitted — only origin geography + network.
country_counts = collections.Counter()
net_counts = collections.Counter()
net_meta = {}
points = []
for ip, c in by_ip.items():
    g = geo_cache.get(ip)
    if not g:
        continue
    country_counts[(g["cc"], g["country"])] += c
    label = g.get("asname") or g.get("isp") or g.get("org") or "Unknown network"
    asn = (g.get("as") or "").split(" ", 1)[0]   # leading "ASxxxx" token
    nkey = (asn, label)
    net_counts[nkey] += c
    net_meta[nkey] = (g.get("cc", ""), g.get("country", ""))
    points.append({"lat": g["lat"], "lon": g["lon"], "country": g["country"],
                   "cc": g["cc"], "net": label, "count": c})
points.sort(key=lambda p: p["count"], reverse=True)

data = {
    "updated": NOW.strftime("%Y-%m-%dT%H:%M:%S"),
    "window_days": WINDOW_DAYS,
    "summary": summary,
    "top_users": [{"user": u, "count": c} for u, c in by_user.most_common(10)],
    "by_day": days,
    "top_countries": [{"cc": cc, "country": name, "count": c}
                      for (cc, name), c in country_counts.most_common(12)],
    "top_networks": [{"asn": k[0], "network": k[1], "cc": net_meta[k][0],
                      "country": net_meta[k][1], "count": c}
                     for k, c in net_counts.most_common(12)],
    "attack_map": points[:80],
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(data, f, indent=2)
try:
    import shutil
    shutil.chown(OUT, user="www-data", group="www-data")
except Exception:
    pass
os.chmod(OUT, 0o644)
print(f"wrote {OUT}: {summary['total_banned']} banned, {summary['total_failed']} failed, "
      f"{len(by_ip)} unique attacker IPs ({len(points)} geolocated, "
      f"{len(data['top_countries'])} countries), {sum(by_day.values())} attempts in {WINDOW_DAYS}d")
