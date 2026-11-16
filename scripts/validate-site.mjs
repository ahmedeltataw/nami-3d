import { createServer } from 'node:http';
import next from 'next';
import { redirects } from '../src/content/redirects.ts';

function extractAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

function parseHtml(html) {
  const canonicalMatches = Array.from(html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi));
  const canonical = canonicalMatches.length > 0 ? extractAttr(canonicalMatches[0][0], 'href') : null;

  const alternateMatches = Array.from(html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*>/gi));
  const alternates = {};
  for (const m of alternateMatches) {
    const tag = m[0];
    const hreflang = extractAttr(tag, 'hreflang');
    const href = extractAttr(tag, 'href');
    if (hreflang && href) {
      alternates[hreflang.toLowerCase()] = href;
    }
  }

  const metaMatches = Array.from(html.matchAll(/<meta\b[^>]*>/gi));
  const og = {};
  const twitter = {};
  for (const m of metaMatches) {
    const tag = m[0];
    const property = extractAttr(tag, 'property') || extractAttr(tag, 'name');
    const content = extractAttr(tag, 'content');
    if (!property || content === null) continue;
    const propLower = property.toLowerCase();
    if (propLower.startsWith('og:')) {
      og[propLower] = content;
    } else if (propLower.startsWith('twitter:')) {
      twitter[propLower] = content;
    }
  }

  const jsonLdMatches = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const jsonLdBlocks = [];
  const jsonLdErrors = [];
  for (const m of jsonLdMatches) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      jsonLdBlocks.push(parsed);
    } catch (err) {
      jsonLdErrors.push(`Failed to parse JSON-LD: ${err.message} in block: ${raw.slice(0, 80)}`);
    }
  }

  const anchorMatches = Array.from(html.matchAll(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>/gi));
  const anchors = [];
  for (const m of anchorMatches) {
    const href = m[1].trim();
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
      anchors.push(href);
    }
  }

  return {
    canonical,
    alternates,
    og,
    twitter,
    jsonLdBlocks,
    jsonLdErrors,
    anchors,
  };
}

async function main() {
  process.env.NODE_ENV = 'production';
  const app = next({ dev: false, hostname: '127.0.0.1' });
  await app.prepare();
  const server = createServer(app.getRequestHandler());

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Could not allocate ephemeral port');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const summary = [];
    const failures = [];

    // 1. Robots.txt check
    let robotsPassed = false;
    try {
      const res = await fetch(`${baseUrl}/robots.txt`);
      if (res.status !== 200) {
        failures.push(`robots.txt returned status ${res.status}`);
      } else {
        const text = await res.text();
        if (!text.toLowerCase().includes('sitemap:')) {
          failures.push('robots.txt does not reference sitemap.xml');
        } else {
          robotsPassed = true;
        }
      }
    } catch (err) {
      failures.push(`Failed to fetch robots.txt: ${err.message}`);
    }
    summary.push({
      Category: 'robots.txt',
      Checked: 1,
      Passed: robotsPassed ? 1 : 0,
      Failed: robotsPassed ? 0 : 1,
      Notes: robotsPassed ? 'References sitemap.xml' : 'Missing or invalid reference',
    });

    // 2. Fetch sitemap.xml
    let sitemapUrls = [];
    try {
      const res = await fetch(`${baseUrl}/sitemap.xml`);
      if (res.status !== 200) {
        failures.push(`sitemap.xml returned status ${res.status}`);
      } else {
        const xml = await res.text();
        const locMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g));
        sitemapUrls = locMatches.map(m => m[1]);
      }
    } catch (err) {
      failures.push(`Failed to fetch sitemap.xml: ${err.message}`);
    }

    if (sitemapUrls.length === 0) {
      failures.push('No URLs found in sitemap.xml');
    }

    // 3. Crawl all sitemap URLs
    const sitemapResults = new Map();
    const internalAnchors = new Set();
    let sitemap200Count = 0;
    let canonicalValidCount = 0;
    let ogValidCount = 0;
    let twitterValidCount = 0;
    let jsonLdValidCount = 0;

    for (const fullUrl of sitemapUrls) {
      const pathname = new URL(fullUrl).pathname;
      const targetUrl = `${baseUrl}${pathname}`;
      try {
        const res = await fetch(targetUrl, { redirect: 'manual' });
        if (res.status !== 200) {
          failures.push(`Sitemap URL ${pathname} returned status ${res.status} (expected 200)`);
          continue;
        }
        sitemap200Count++;

        const html = await res.text();
        const parsed = parseHtml(html);
        sitemapResults.set(pathname, { parsed, fullUrl });

        // Collect internal anchors
        for (const a of parsed.anchors) {
          if (a.startsWith('/') || a.startsWith(fullUrl.replace(/(\/ar|\/en).*$/, '')) || a.startsWith('https://nami-tec.com')) {
            const cleanPath = a.startsWith('http') ? new URL(a).pathname : a.split('?')[0].split('#')[0];
            if (cleanPath) internalAnchors.add(cleanPath);
          }
        }

        // Canonical check
        if (!parsed.canonical) {
          failures.push(`Missing canonical tag on ${pathname}`);
        } else if (!/^https?:\/\//i.test(parsed.canonical)) {
          failures.push(`Non-absolute canonical "${parsed.canonical}" on ${pathname}`);
        } else {
          canonicalValidCount++;
        }

        // OG tags check
        const hasOg = parsed.og['og:title'] && parsed.og['og:description'] && parsed.og['og:url'];
        if (!hasOg) {
          failures.push(`Missing OpenGraph tags (title/description/url) on ${pathname}`);
        } else {
          ogValidCount++;
        }

        // Twitter tags check
        const hasTwitter = parsed.twitter['twitter:card'] && parsed.twitter['twitter:title'] && parsed.twitter['twitter:description'];
        if (!hasTwitter) {
          failures.push(`Missing Twitter meta tags (card/title/description) on ${pathname}`);
        } else {
          twitterValidCount++;
        }

        // JSON-LD check
        if (parsed.jsonLdErrors.length > 0) {
          for (const err of parsed.jsonLdErrors) {
            failures.push(`${pathname}: ${err}`);
          }
        } else {
          jsonLdValidCount++;
        }
      } catch (err) {
        failures.push(`Error fetching sitemap URL ${pathname}: ${err.message}`);
      }
    }

    summary.push({
      Category: 'Sitemap 200 Status',
      Checked: sitemapUrls.length,
      Passed: sitemap200Count,
      Failed: sitemapUrls.length - sitemap200Count,
      Notes: `All sitemap URLs return 200`,
    });

    summary.push({
      Category: 'Canonical Tags',
      Checked: sitemapUrls.length,
      Passed: canonicalValidCount,
      Failed: sitemapUrls.length - canonicalValidCount,
      Notes: 'Must be present and absolute',
    });

    summary.push({
      Category: 'OG Tags',
      Checked: sitemapUrls.length,
      Passed: ogValidCount,
      Failed: sitemapUrls.length - ogValidCount,
      Notes: 'og:title, og:description, og:url',
    });

    summary.push({
      Category: 'Twitter Tags',
      Checked: sitemapUrls.length,
      Passed: twitterValidCount,
      Failed: sitemapUrls.length - twitterValidCount,
      Notes: 'twitter:card, title, description',
    });

    summary.push({
      Category: 'JSON-LD Validity',
      Checked: sitemapUrls.length,
      Passed: jsonLdValidCount,
      Failed: sitemapUrls.length - jsonLdValidCount,
      Notes: 'Valid JSON-LD blocks',
    });

    // 4. Hreflang reciprocal check
    let reciprocalChecked = 0;
    let reciprocalPassed = 0;
    for (const [pathA, { parsed: parsedA }] of sitemapResults.entries()) {
      reciprocalChecked++;
      let isReciprocal = true;
      const locales = ['ar', 'en'];
      for (const loc of locales) {
        const targetUrl = parsedA.alternates[loc];
        if (!targetUrl) {
          failures.push(`Missing hreflang "${loc}" on ${pathA}`);
          isReciprocal = false;
          continue;
        }
        const targetPath = new URL(targetUrl).pathname;
        const pageB = sitemapResults.get(targetPath);
        if (!pageB) {
          failures.push(`Hreflang target ${targetPath} for ${loc} on ${pathA} not in crawled sitemap`);
          isReciprocal = false;
          continue;
        }
        // Verify reciprocal link back
        const currentLoc = pathA.startsWith('/ar') ? 'ar' : pathA.startsWith('/en') ? 'en' : null;
        if (currentLoc) {
          const backUrl = pageB.parsed.alternates[currentLoc];
          if (!backUrl) {
            failures.push(`Page ${targetPath} does not alternate back to ${currentLoc} for ${pathA}`);
            isReciprocal = false;
          } else {
            const backPath = new URL(backUrl).pathname;
            if (backPath !== pathA) {
              failures.push(`Non-reciprocal hreflang: ${pathA} -> ${targetPath} (${loc}), but ${targetPath} -> ${backPath} (${currentLoc})`);
              isReciprocal = false;
            }
          }
        }
      }
      if (isReciprocal) reciprocalPassed++;
    }

    summary.push({
      Category: 'Hreflang Reciprocal',
      Checked: reciprocalChecked,
      Passed: reciprocalPassed,
      Failed: reciprocalChecked - reciprocalPassed,
      Notes: 'ar <-> en reciprocal alternate links',
    });

    // 5. Redirects check (from src/content/redirects.ts)
    let redirectsChecked = 0;
    let redirectsPassed = 0;
    let chainErrors = 0;

    for (const r of redirects) {
      redirectsChecked++;
      const sourceUrl = `${baseUrl}${r.source}`;
      try {
        const res = await fetch(sourceUrl, { redirect: 'manual' });
        if (res.status !== 301 && res.status !== 307 && res.status !== 308) {
          failures.push(`Redirect ${r.source} returned status ${res.status} (expected 301/308)`);
          continue;
        }

        const locationHeader = res.headers.get('location');
        if (!locationHeader) {
          failures.push(`Redirect ${r.source} missing Location header`);
          continue;
        }

        const destUrl = locationHeader.startsWith('http') ? locationHeader : `${baseUrl}${locationHeader}`;
        const destRes = await fetch(destUrl, { redirect: 'manual' });

        if (destRes.status === 301 || destRes.status === 307 || destRes.status === 308) {
          chainErrors++;
          failures.push(`Redirect chain detected (>1 hop): ${r.source} -> ${locationHeader} -> ${destRes.headers.get('location')}`);
          continue;
        }

        if (destRes.status !== 200) {
          failures.push(`Redirect target ${locationHeader} for ${r.source} returned status ${destRes.status} (expected 200)`);
          continue;
        }

        redirectsPassed++;
      } catch (err) {
        failures.push(`Error checking redirect ${r.source}: ${err.message}`);
      }
    }

    summary.push({
      Category: 'Legacy Redirects',
      Checked: redirectsChecked,
      Passed: redirectsPassed,
      Failed: redirectsChecked - redirectsPassed,
      Notes: '301/308 status to existing 200 URL',
    });

    summary.push({
      Category: 'Redirect Chains',
      Checked: redirectsChecked,
      Passed: redirectsChecked - chainErrors,
      Failed: chainErrors,
      Notes: 'No chains longer than 1 hop',
    });

    // 6. Crawl internal anchor links for 404s
    let anchorsChecked = 0;
    let anchorsPassed = 0;
    const checkedAnchors = new Map();

    for (const anchorPath of internalAnchors) {
      if (checkedAnchors.has(anchorPath)) continue;
      anchorsChecked++;
      const testUrl = `${baseUrl}${anchorPath}`;
      try {
        const res = await fetch(testUrl, { redirect: 'follow' });
        checkedAnchors.set(anchorPath, res.status);
        if (res.status === 404) {
          failures.push(`Broken internal link (404): ${anchorPath}`);
        } else if (res.status >= 400) {
          failures.push(`Internal link returned error ${res.status}: ${anchorPath}`);
        } else {
          anchorsPassed++;
        }
      } catch (err) {
        failures.push(`Failed to fetch internal anchor link ${anchorPath}: ${err.message}`);
      }
    }

    summary.push({
      Category: 'Internal Links (no 404)',
      Checked: anchorsChecked,
      Passed: anchorsPassed,
      Failed: anchorsChecked - anchorsPassed,
      Notes: 'Anchors crawled across all pages',
    });

    // Print summary table
    console.log('\n================== SITE VALIDATION SUMMARY ==================');
    console.table(summary);

    if (failures.length > 0) {
      console.error(`\nValidation FAILED with ${failures.length} issue(s):`);
      for (const [i, f] of failures.slice(0, 50).entries()) {
        console.error(`  ${i + 1}. ${f}`);
      }
      if (failures.length > 50) {
        console.error(`  ... and ${failures.length - 50} more issues.`);
      }
      process.exitCode = 1;
    } else {
      console.log('\nAll validation checks PASSED successfully!');
      process.exitCode = 0;
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    await app.close();
  }
}

main().catch(err => {
  console.error('Fatal error in validate-site:', err);
  process.exitCode = 1;
});
