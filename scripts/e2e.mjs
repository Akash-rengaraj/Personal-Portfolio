/**
 * End-to-end browser checks against the production build.
 *
 *   npm run build && npm run preview      # in one terminal
 *   npm run test:e2e                      # in another (BASE_URL overrides http://localhost:4173)
 *
 * Uses playwright-core with the locally installed Chrome (CHROME_PATH overrides).
 * Exits non-zero when any check fails.
 */
import { chromium, devices } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const ROUTES = [
  '/', '/about', '/projects', '/projects/neo', '/projects/arify', '/achievements',
  '/blog', '/blog/building-akashr-dev', '/contact', '/resume-view',
];

/* Third-party APIs (GitHub, LeetCode, Firebase) can rate-limit; that is not a site bug */
const IGNORED_ERRORS = /(api\.github|leetcode|contributions|firebase|googleapis|status of 4(03|29))/i;

const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - started, error: err.message.split('\n')[0] });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** New page that skips the boot screen and records console/page errors. */
async function openPage(context) {
  if (!context.skipsBoot) {
    await context.addInitScript(() => {
      try { window.sessionStorage.setItem('booted', '1'); } catch { /* opaque frames (PDF viewer) have no storage */ }
    });
    context.skipsBoot = true;
  }
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', err => page.errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && !IGNORED_ERRORS.test(msg.text() + (msg.location()?.url ?? ''))) page.errors.push(msg.text());
  });
  return page;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  /* ── static HTML: what crawlers and link previews see without JavaScript ── */
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>https:\/\/www\.akashr\.dev([^<]*)<\/loc>/g)].map(m => m[1] || '/');

  await check('sitemap lists every project and post', async () => {
    const { projectsData } = await import('../src/data/projects.js');
    for (const p of projectsData) assert(sitemapUrls.includes(`/projects/${p.slug}`), `missing /projects/${p.slug}`);
    assert(sitemapUrls.some(u => u.startsWith('/blog/')), 'no blog posts in sitemap');
  });

  for (const route of sitemapUrls) {
    await check(`raw HTML has route SEO: ${route}`, async () => {
      const html = await (await fetch(`${BASE}${route}`)).text();
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      const canonical = html.match(/rel="canonical" href="([^"]*)"/)?.[1] ?? '';
      assert(canonical === `https://www.akashr.dev${route === '/' ? '/' : route}`, `canonical is "${canonical}"`);
      assert(title && (route === '/' || !title.startsWith('Akash Rengaraj |')), `generic title "${title}"`);
      assert(/property="og:image" content="https:\/\/www\.akashr\.dev\/og\/[\w-]+\.jpg"/.test(html), 'og:image missing');
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert(ld['@graph'].some(node => node['@type'] === 'Person'), 'JSON-LD Person missing');
      const text = html.split('id="seo-static"')[1]?.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length ?? 0;
      assert(text > 30, `only ${text} words of static content`);
    });
  }

  await check('robots.txt, llms.txt and RSS are served', async () => {
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    assert(/GPTBot/.test(robots) && /ClaudeBot/.test(robots) && /Sitemap:/.test(robots), 'robots.txt incomplete');
    const llms = await (await fetch(`${BASE}/llms.txt`)).text();
    assert(llms.startsWith('# Akash Rengaraj') && llms.includes('8.22') && llms.includes('Sri Krishna College'), 'llms.txt incomplete');
    const rss = await (await fetch(`${BASE}/blog/rss.xml`)).text();
    assert((rss.match(/<item>/g) ?? []).length >= 3, 'RSS has too few items');
  });

  /* ── desktop ── */
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const route of ROUTES) {
    await check(`desktop renders without errors: ${route}`, async () => {
      const page = await openPage(desktop);
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      assert(await page.locator('#seo-static').count() === 0, 'static SEO copy was not replaced by the app');
      if (route !== '/resume-view') assert(await page.locator('.nav').isVisible(), 'nav not visible');
      const heads = await page.locator('head meta[name="description"]').count();
      assert(heads === 1, `${heads} meta descriptions in <head>`);
      assert(page.errors.length === 0, `console errors: ${page.errors.join(' | ')}`);
      await page.close();
    });
  }

  await check('home terminal runs commands', async () => {
    const page = await openPage(desktop);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const input = page.getByLabel('Terminal command input');
    await input.fill('whoami');
    await input.press('Enter');
    await page.getByText('Sri Krishna College', { exact: false }).first().waitFor({ timeout: 4000 });
    await input.fill('help');
    await input.press('Enter');
    await page.locator('.output-line').filter({ hasText: 'blog' }).first().waitFor({ timeout: 4000 });
    await page.close();
  });

  await check('client-side navigation to every nav link', async () => {
    const page = await openPage(desktop);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    for (const [label, path] of [['about', '/about'], ['projects', '/projects'], ['achievements', '/achievements'], ['blog', '/blog'], ['links & contacts', '/contact']]) {
      await page.locator('.nav a', { hasText: label }).first().click();
      await page.waitForURL(`**${path}`);
      await page.waitForFunction(p => document.querySelector('link[rel="canonical"]')?.href.endsWith(p), path);
    }
    assert(page.errors.length === 0, page.errors.join(' | '));
    await page.close();
  });

  await check('project search filters cards and videos are poster-only until played', async () => {
    const page = await openPage(desktop);
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
    const videos = page.locator('video.pj-video');
    assert(await videos.count() > 0, 'no preview videos');
    const preload = await videos.evaluateAll(list => list.map(v => [v.preload, !!v.poster, v.readyState]));
    assert(preload.every(([p, poster]) => p === 'none' && poster), `videos not lazy: ${JSON.stringify(preload)}`);
    const before = await page.locator('.pj-card').count();
    await page.locator('.pj-search input').fill('flutter');
    await page.waitForTimeout(200);
    const after = await page.locator('.pj-card').count();
    assert(after > 0 && after < before, `search did not filter (${before} → ${after})`);
    await page.close();
  });

  await check('achievements tabs switch panels', async () => {
    const page = await openPage(desktop);
    await page.goto(`${BASE}/achievements`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /hackathons/i }).click();
    await page.waitForURL(/tab=hackathons/);
    await page.getByText('HackIndia 2025', { exact: false }).first().waitFor();
    await page.close();
  });

  await check('contact form validates before sending', async () => {
    const page = await openPage(desktop);
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
    await page.locator('.ct2-toggle').click();
    await page.locator('.ct2-send').click();
    assert(await page.locator('.ct2-field-error').count() >= 2, 'no validation errors shown');
    await page.close();
  });

  await check('blog post renders markdown and code', async () => {
    const page = await openPage(desktop);
    await page.goto(`${BASE}/blog/arify-fibonacci-sphere-capture`, { waitUntil: 'networkidle' });
    assert(await page.locator('.bl-article h2').count() >= 3, 'headings missing');
    assert(await page.locator('.bl-article pre code').count() >= 1, 'code block missing');
    await page.close();
  });

  await check('unknown route shows the 404 page', async () => {
    const page = await openPage(desktop);
    await page.goto(`${BASE}/definitely-not-here`, { waitUntil: 'networkidle' });
    assert((await page.title()).startsWith('404'), `title was "${await page.title()}"`);
    await page.close();
  });

  /* ── Zen Drive ── */
  await check('home never downloads three.js until the drive CTA is wanted', async () => {
    const page = await openPage(desktop);
    const threeRequests = [];
    page.on('request', req => { if (/\/three-[\w-]+\.js$/.test(req.url())) threeRequests.push(req.url()); });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500); // past the idle prefetch
    assert(threeRequests.length === 0, 'three.js was fetched on the home page');
    await page.locator('.cta-drive').click();
    await page.waitForURL(/\/drive\?seed=\d+/);
    assert(await page.locator('canvas.zd-canvas').count() === 1, 'no game canvas');
    await page.close();
  });

  await check('zen drive: accelerate, pause, new road', async () => {
    const page = await openPage(desktop);
    const warnings = [];
    page.on('console', m => { if (/WebGL contexts|Context Lost/i.test(m.text())) warnings.push(m.text()); });
    await page.goto(`${BASE}/drive?seed=4242`, { waitUntil: 'networkidle' });
    await page.locator('.zd-start').click();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3500);
    await page.keyboard.up('KeyW');
    const speed = Number(await page.locator('.zd-speed-value').innerText());
    assert(speed > 20, `speed only ${speed} km/h after 3.5 s of throttle`);
    await page.keyboard.press('Escape');
    await page.locator('.zd-menu').waitFor();
    await page.getByRole('button', { name: /new random road/ }).click();
    await page.waitForFunction(() => !location.search.includes('seed=4242'));
    // leave and come back a few times: engines must be disposed, not stacked
    for (let i = 0; i < 4; i++) {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.goto(`${BASE}/drive?seed=${10 + i}`, { waitUntil: 'networkidle' });
    }
    assert(warnings.length === 0, warnings.join(' | '));
    assert(page.errors.length === 0, page.errors.join(' | '));
    await page.close();
  });

  await check('view counter never loads Firebase before the page is interactive', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    assert(!/firebase/.test(html.match(/<head>[\s\S]*<\/head>/)[0]), 'firebase chunk is preloaded in <head>');
  });

  await desktop.close();

  /* ── phone ── */
  const phone = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  for (const route of ROUTES) {
    await check(`mobile layout: ${route}`, async () => {
      const page = await openPage(phone);
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const m = await page.evaluate(() => {
        const nav = document.querySelector('.nav')?.getBoundingClientRect();
        const outlet = document.querySelector('.page-outlet')?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          navBottom: nav ? Math.round(window.innerHeight - nav.bottom) : null,
          overlap: nav && outlet ? Math.round(outlet.bottom - nav.top) : 0,
        };
      });
      assert(m.overflow <= 0, `horizontal overflow of ${m.overflow}px`);
      if (route !== '/resume-view') {
        assert(m.navBottom !== null && m.navBottom <= 2, `tab bar not docked (gap ${m.navBottom})`);
        assert(m.overlap <= 1, `content runs ${m.overlap}px under the tab bar`);
      }
      assert(page.errors.length === 0, `console errors: ${page.errors.join(' | ')}`);
      await page.close();
    });
  }

  await check('zen drive on a phone: touch pads, no overflow', async () => {
    const page = await openPage(phone);
    await page.goto(`${BASE}/drive?seed=77`, { waitUntil: 'networkidle' });
    await page.locator('.zd-start').tap();
    await page.locator('.zd-touch').waitFor();
    assert(await page.getByRole('button', { name: 'Steer left' }).isVisible(), 'steer pad missing');
    await page.waitForTimeout(2500);
    const speed = Number(await page.locator('.zd-speed-value').innerText());
    assert(speed > 10, `touch cruise didn't move the car (${speed} km/h)`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `horizontal overflow of ${overflow}px`);
    assert(page.errors.length === 0, page.errors.join(' | '));
    await page.close();
  });

  await phone.close();
  await browser.close();

  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name} ${r.ok ? `(${r.ms} ms)` : `— ${r.error}`}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
