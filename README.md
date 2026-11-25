# SJ Webdev Services — Website (v2 redesign)

Hand-coded static site. No frameworks, no build step, no dependencies.
Stack: HTML5 · CSS3 · vanilla JavaScript · Space Grotesk + JetBrains Mono (Google Fonts).

## Files

```
index.html            Home                    -> /
about/index.html      About                   -> /about/
services/index.html   Services (8 services, process, FAQ)   -> /services/
portfolio/index.html  Portfolio (38 projects, live filters) -> /portfolio/
contact/index.html    Contact (cards + enquiry form)        -> /contact/
404.html              Custom not-found page
css/style.css     Full design system (dark + light themes)
js/main.js        Theme toggle, mobile nav, reveals, counters, filters, form
robots.txt        Allows crawling, points to sitemap
sitemap.xml       All 5 pages, canonical domain
.htaccess         301 redirects (old about-services.html, *.html -> clean
                  URLs), 404 handler, caching, gzip — Apache/Bluehost only
```

Each page lives in its own folder as `index.html`, so clean URLs such as
`/about/` work on any static host (GitHub Pages, Bluehost, Netlify, ...)
without server rewrite rules. All internal links and asset paths are
relative, so the site also works when served from a sub-path.

## Deploying with GitHub Pages (current setup)

Pushes to `main` run `.github/workflows/deploy-pages.yml`, which publishes
the repo root to GitHub Pages. `CNAME` sets the custom domain
`sjwebdevservices.com`; the domain's DNS must point at GitHub Pages
(A/AAAA records for the apex, or a CNAME for `www`).

## Deploying to Bluehost (alternative)

1. Open cPanel → File Manager → `public_html`.
2. Upload the contents of this folder (not the folder itself) into `public_html`.
   Make sure "Show hidden files" is on so `.htaccess` uploads too.
3. Keep your existing `/assets/og-image.png` on the server — the social
   preview tags point to it. (If it's missing, upload any 1200×630 PNG there.)
4. Done. No database, no PHP, nothing to configure.

## Theme toggle

- Sun/moon button in the header switches dark ↔ light.
- The visitor's choice is saved in `localStorage` (`sj-theme`).
- First visit follows the device's `prefers-color-scheme`.
- An inline script in `<head>` applies the theme before paint (no flash).

## Contact form

Submissions go to FormSubmit's AJAX endpoint from `js/main.js`; the HTML form
has no usable `action`, so a bot that only parses the page finds nothing to
post to. Before a message is sent the script runs a bot check and silently
discards anything that trips it (the sender still sees the normal "message
sent" text, so bots learn nothing):

- honeypot fields (`_honey`, `website`) that real visitors never see
- the form was submitted less than 6 seconds after the page loaded
- fewer than 5 keystrokes/clicks happened inside the form
- the message has under 4 words, or is just a link
- the message matches a known spam template, e.g. "I would like more
  information. Please contact me by email"

To add a new template, append a regex to `SPAM_PATTERNS` in `js/main.js`.
If spam still gets through, it is being posted directly to FormSubmit,
bypassing the site; the fix for that is a form backend that verifies a
challenge (e.g. Cloudflare Turnstile + a Worker, or Formspree with reCAPTCHA).

## Portfolio thumbnails

Thumbnails are self-hosted WebP files in `images/portfolio/` (400, 800 and
1200 px wide, 8:5), served with `srcset` so each visitor downloads only the
size they need. They load from the same host as the page, so there is no
third-party request and no on-demand rendering delay.

To refresh them after a client site changes, run the "Capture portfolio
thumbnails" workflow from the Actions tab (leave the slugs input empty for
all sites, or list specific slugs from `.github/scripts/portfolio-sites.json`).
It screenshots each site, falls back to the mShots service for sites that
show a bot-check page, and commits the new files to the branch it ran on.
To add a project, add its URL to that JSON file and run the workflow.
First-ever load of a thumbnail can take a few seconds while mShots renders it.

## SEO checklist (already done)

- Unique title + meta description per page
- Canonical URLs on sjwebdevservices.com
- Open Graph + Twitter cards on every page
- JSON-LD: ProfessionalService, WebSite, AboutPage, FAQPage,
  ItemList (services), CollectionPage, ContactPage, BreadcrumbList
- Semantic landmarks, one h1 per page, alt text on all images
- sitemap.xml + robots.txt (submit the sitemap in Google Search Console)
- 301 redirect preserves link equity from the old about-services.html URL

## Search visibility checklist (SEO / AEO / GEO)

Everything in the repo is in place: per-page titles and descriptions, canonical
URLs, Open Graph and Twitter cards, Schema.org data (Organization/LocalBusiness,
Person, Service, FAQPage, ItemList of portfolio sites, breadcrumbs), an XML
sitemap with image entries, `robots.txt` that welcomes AI crawlers, and
`llms.txt` for answer engines. The remaining levers live outside the repo:

1. **Google Search Console** — add `sjwebdevservices.com` (Domain property),
   verify via DNS TXT at Bluehost, submit `https://sjwebdevservices.com/sitemap.xml`.
2. **Bing Webmaster Tools** — import the Search Console property (one click),
   which also covers DuckDuckGo, Yahoo and Copilot.
3. **Google Business Profile** — create or claim the profile as a
   service-area business (web designer) covering Bucks County / Philadelphia.
   Use the exact name, email and site URL from the footer, and link back.
4. **Client footer credits** — a small "Website by SJ Webdev Services" link in
   the footer of each client site is the strongest backlink source available:
   39 relevant, local, real-business domains.
5. **Reviews** — ask clients for Google reviews on the Business Profile; add
   genuine ones to the site later with `Review` markup.
6. **Directories** — Clutch, DesignRush, Yelp (web design category), Bucks
   County Chamber of Commerce, with identical name/URL/email everywhere.
7. **Keep `lastmod` honest** — update `sitemap.xml` and `dateModified` in the
   page JSON-LD whenever content changes.
