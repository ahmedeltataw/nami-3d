# Content inventory gaps

Fetched 144 route entries from the live sitemap and verified the listed /portfolio/165..170 routes directly. Every recorded route returned HTTP 200.

## Counts by locale

| Locale | Routes | Page | Service | Project | Blog | Legal | FAQ | Careers |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ar | 72 | 23 | 6 | 31 | 8 | 2 | 1 | 1 |
| en | 72 | 23 | 6 | 31 | 8 | 2 | 1 | 1 |

## Gaps and caveats

- Missing English route twins: 0. All inventoried English pages were present; English titles retain the site's Arabic brand suffix on some portfolio and marketing pages.
- Broken recorded route responses: 0. The unlisted /ar/portfolio/166 and /en/portfolio/166 pages exist (Al-Humairi for Hajj).
- The seven values have names in both locales, but the site publishes no individual descriptions; these are marked missing in company.json.
- No Egyptian office address was published in the inspected contact pages. The Egyptian number appears in homepage structured data; Saudi phone and address are shown in the contact page.
- Six social profile URLs were found (Facebook, LinkedIn, X, Instagram, Snapchat, TikTok).
- Careers exists as a homepage #careers section, not a separate route. The form lists PHP Developer and accepts .pdf, .doc, .docx CVs.
- Asset records: 374; downloaded: 366; skipped over 5 MB: 8; other download failures: 0. Skipped URLs: https://backend.nami-tec.com/storage/images/marketing_galleries/kwjpD8rJwQ1779616157.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/5YyC7FVp6a1779616737.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/qHxUgC2j8f1779617211.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/UeDyvbwQkQ1779615351.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/h0nYyM7Ws41779616728.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/ReMmiXExjb1779613715.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/bQ9PdjJVVX1779613714.mp4, https://backend.nami-tec.com/storage/images/marketing_galleries/EGeoMPb05p1779613714.mp4.
- JSON API endpoints were not exposed in the rendered page source; robots.txt disallows /api/. Page content was taken from server-rendered HTML.
- Internal links outside the discovered route set and third-party destinations were recorded but not exhaustively probed; no broken page response occurred in the sitemap or the explicitly listed project range.
