/**
 * Generates 1200×630 Open Graph cards into public/og/*.jpg (run `npm run og`
 * after changing profile, project or blog data, then rebuild).
 *
 * Each card is an HTML template screenshotted by headless Chrome and
 * converted to JPEG with ImageMagick. Needs locally: google-chrome (or
 * chromium; override with CHROME_PATH) and `magick`. Not part of `npm run build`
 * so the hosting build never needs a browser.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { profile, CGPA_TEXT } from '../src/data/profile.js';
import { projectsData } from '../src/data/projects.js';
import { loadPosts } from './blog-source.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'og');
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Card markup: terminal prompt, big title, subtitle, tags, optional media on the right. */
function cardHtml({ command, title, subtitle, tags = [], image }) {
  const media = image
    ? `<div class="media"><img src="${pathToFileURL(path.join(PUBLIC, image)).href}" alt="" /></div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative; display: flex; gap: 48px; padding: 64px 72px 56px;
    background:
      radial-gradient(ellipse 70% 80% at 18% 0%, rgba(61,255,184,.16), transparent 60%),
      radial-gradient(ellipse 60% 70% at 100% 100%, rgba(64,217,255,.12), transparent 60%),
      #050708;
    color: #e8f1ed; font-family: 'IBM Plex Sans', system-ui, sans-serif;
  }
  body::before {
    content: ''; position: absolute; inset: 0; opacity: .5;
    background-image: linear-gradient(rgba(61,255,184,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(61,255,184,.07) 1px, transparent 1px);
    background-size: 48px 48px;
    -webkit-mask-image: linear-gradient(to bottom, #000, transparent 85%);
  }
  .text { position: relative; flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .dots { display: flex; gap: 10px; margin-bottom: 28px; }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #ff5f57; }
  .dots i:nth-child(2) { background: #febc2e; } .dots i:nth-child(3) { background: #28c840; }
  .cmd { font: 500 24px 'Fira Code', monospace; color: #3dffb8; margin-bottom: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cmd span { color: #7b8a84; }
  h1 { font: 700 ${image ? 46 : 66}px/1.08 'IBM Plex Sans', sans-serif; letter-spacing: -.02em; margin-bottom: 20px;
       display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  p { font-size: 27px; line-height: 1.4; color: #aebbb5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
  .tags span { font: 500 18px 'Fira Code', monospace; color: #3dffb8; border: 1px solid rgba(61,255,184,.35); background: rgba(61,255,184,.08); padding: 6px 14px; border-radius: 999px; }
  footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; font: 500 21px 'Fira Code', monospace; color: #7b8a84; }
  footer b { color: #e8f1ed; font-weight: 600; }
  footer em { font-style: normal; color: #3dffb8; }
  .media { position: relative; flex: 0 0 380px; align-self: center; height: 470px; border-radius: 18px; overflow: hidden;
           border: 1px solid rgba(61,255,184,.35); box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(61,255,184,.15); }
  .media img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
</style></head><body>
  <div class="text">
    <div class="dots"><i></i><i></i><i></i></div>
    <div class="cmd"><span>akash@akashr.dev:~$</span> ${escapeHtml(command)}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
    ${tags.length ? `<div class="tags">${tags.slice(0, 4).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <footer><span><b>${escapeHtml(profile.name)}</b> · AI &amp; DS @ ${profile.collegeShort}</span><em>akashr.dev</em></footer>
  </div>
  ${media}
</body></html>`;
}

async function cards() {
  const posts = await loadPosts();
  const posterOf = (slug) => projectsData.find(p => p.slug === slug)?.preview.poster;

  return [
    { key: 'home', command: 'whoami', title: profile.name, subtitle: `AI & Data Science student (CGPA ${CGPA_TEXT}) · ${profile.clubRole}, Data Science club · full-stack developer`, tags: ['AI / ML', 'full-stack', 'AR', 'IoT'] },
    { key: 'about', command: 'cat about.md', title: `About ${profile.name}`, subtitle: `${profile.year} B.Tech AI & DS at ${profile.college}.`, tags: ['SKCET', `CGPA ${CGPA_TEXT}`, profile.clubRole] },
    { key: 'projects', command: 'ls ~/projects', title: `${projectsData.length} projects, built solo`, subtitle: 'Multi-agent AI security auditor, AR room scanner, Flutter student app, full-stack e-commerce and more.', tags: [...new Set(projectsData.map(p => p.category))] },
    { key: 'achievements', command: 'cat achievements.log', title: 'Achievements', subtitle: 'HackIndia 2025 Top 10 Finalist · certifications from Meta, Google, IBM · live GitHub & LeetCode stats.', tags: ['hackathons', 'certs', 'github'] },
    { key: 'blog', command: 'ls ~/devlog', title: 'Devlog', subtitle: 'Build notes: multi-agent AI, AR capture, React performance and more.', tags: [...new Set(posts.flatMap(p => p.tags))] },
    { key: 'drive', command: './zen-drive', title: 'Zen Drive', subtitle: 'A GT car with real tyre physics and a 6-speed box, endless procedural roads, six terrains and starry nights — in your browser.', tags: ['three.js', 'physics', 'procedural'], image: '/og/drive-shot.jpg' },
    { key: 'contact', command: 'mail akash', title: "Let's build something", subtitle: `Open to internships — ${profile.city} or remote. ${profile.email}`, tags: ['email', 'linkedin', 'github'] },
    ...projectsData.map(p => ({ key: `project-${p.slug}`, command: `cat projects/${p.slug}.md`, title: p.title.split(' — ')[0], subtitle: p.tagline, tags: p.tech, image: p.preview.poster })),
    ...posts.map(p => ({ key: `blog-${p.slug}`, command: `cat devlog/${p.slug}.md`, title: p.title, subtitle: p.summary, tags: p.tags, image: posterOf(p.project) })),
  ];
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), 'og-'));
  try {
    for (const card of await cards()) {
      const html = path.join(work, `${card.key}.html`);
      const png = path.join(work, `${card.key}.png`);
      await writeFile(html, cardHtml(card));
      await run(CHROME, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
        '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=3000',
        `--screenshot=${png}`, pathToFileURL(html).href,
      ]);
      await run('magick', [png, '-strip', '-quality', '86', '-sampling-factor', '4:2:0', path.join(OUT, `${card.key}.jpg`)]);
      console.log(`og/${card.key}.jpg`);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('og image generation failed:', err);
  process.exit(1);
});
