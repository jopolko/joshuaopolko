# Joshua Opolko

**Toronto builder. Data-driven web apps, WebXR experiments, and writing engineered to get cited by AI.**

Everything lives at **[joshuaopolko.com](https://joshuaopolko.com)**.

This repo is the source of that site: a static, fast, framework-free content hub, hand-tuned to rank in Google and get cited by ChatGPT, Claude, Perplexity, and Gemini. No build step, no JavaScript bloat. Just clean HTML, inline CSS, and a pile of Python tooling.

## Projects

Real apps, live in production, fed by real data pipelines, not demos.

| Project | What it does | Live | Code |
|---|---|---|---|
| **NowServingTO** | Toronto's newly licensed restaurants by cuisine, refreshed daily from City of Toronto Open Data, verified open, chains excluded | [nowservingto.com](https://nowservingto.com) | [repo](https://github.com/jopolko/nowservingto) |
| **Kids Events** | Free Toronto kids events for ages 0 to 12, aggregated from 20+ sources by a fleet of scrapers into a fast, responsive app | [live](https://joshuaopolko.com/kidsevents/) | [repo](https://github.com/jopolko/kidsevents) |
| **HomeTurf** | Find your Toronto neighbourhood by schools, childcare, and demographics, compared side by side | [live](https://joshuaopolko.com/hometurf/) | [repo](https://github.com/jopolko/hometurf) |
| **Security Dashboard** | Real-time SSH threat intelligence: fail2ban, geolocation, and an inline-SVG world map of everyone knocking on the door | [live](https://joshuaopolko.com/security/) | [repo](https://github.com/jopolko/security-dashboard) |

## Writing

Long-form, sourced, and built to be cited. A few worth your time:

- **[The GEO Field Manual](https://joshuaopolko.com/geo-field-manual/):** ten technical steps to get cited by ChatGPT, Claude, Perplexity, and Gemini, with the data behind each and copy-paste prompts.
- **[Lost at the Token](https://joshuaopolko.com/jamaican-patois-ai/):** why Jamaican Patois needs its own AI, and how tokenization quietly erases low-data languages before a model even reads them.
- **[GEO: 0 to 1,800 AI Citations in 120 Days](https://joshuaopolko.com/claude-seo/):** a live case study of engineering a site into AI answers, with the Bing data to prove it.
- **[Driftlights](https://joshuaopolko.com/driftlights/):** WebXR experiments and the craft of rendering real-time scenes in the browser.
- **[Hypersensitivity](https://joshuaopolko.com/hypersensitivity-a-unified-theory-of-adaptation-across-marginalized-communities/):** a unified theory of adaptation across marginalized communities.

## How it is built

- **Static-first.** Plain HTML and inline CSS, no front-end framework. Pages ship finished from the server, so they load fast and AI crawlers (which do not execute JavaScript) read them perfectly.
- **Engineered for citation.** Answer-first structure, real sources, JSON-LD schema, clean canonicals, and a four-index crawl strategy across Google, Bing, Brave, and the AI search bots.
- **Python tooling.** Scrapers, sitemap and `llms.txt` generators, an IndexNow pinger, and a robots.txt watchdog live in [`tools/`](tools/).
- **One VPS, version-controlled here.** Simple to deploy, simple to restore.

## Find me

- Site: **[joshuaopolko.com](https://joshuaopolko.com)**
- X: [@JoshuaOpolko](https://x.com/JoshuaOpolko)
