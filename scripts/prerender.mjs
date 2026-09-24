/**
 * Post-build prerender for SEO and GEO (generative-engine optimisation).
 *
 * The app is a client-rendered SPA, so crawlers, link-preview bots and AI
 * assistants that don't run JavaScript would only ever see one empty
 * index.html. After `vite build` this script writes, for every public route:
 *   dist/<route>/index.html  — route-specific title, description, canonical,
 *                              Open Graph / Twitter tags, JSON-LD, and the
 *                              page's content as plain semantic HTML in #root
 * plus sitemap.xml, blog/rss.xml, llms.txt, llms-full.txt and 404.html.
 *
 * Content comes from the same data modules and markdown files the app uses,
 * so the static copy can never drift from what the SPA renders.
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profile, CGPA_TEXT } from '../src/data/profile.js';
import { projectsData } from '../src/data/projects.js';
import { skillsData, techStack } from '../src/data/skills.js';
import { hackathonsData } from '../src/data/hackathons.js';
import { loadPosts } from './blog-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE = profile.site;
const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OG = '/og/home.jpg';

/* ─── helpers ───────────────────────────────────────────── */

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stripHtml = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const absolute = (urlPath) => new URL(urlPath, SITE).href;
const canonicalFor = (route) => (route === '/' ? `${SITE}/` : `${SITE}${route}`);
const cleanRepo = (url) => url?.replace(/\.git$/, '');
const isShipped = (status) => /complete/i.test(status);

const exists = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

/** Pick a route's OG card if `npm run og` generated one, else the site default. */
async function ogImageFor(key) {
  const candidate = `/og/${key}.jpg`;
  return (await exists(path.join(ROOT, 'public', candidate))) ? candidate : DEFAULT_OG;
}

const ISSUERS = { meta: 'Meta', google: 'Google', atlassian: 'Atlassian', ibm: 'IBM', nptel: 'NPTEL' };
const issuerOf = (logo) => ISSUERS[Object.keys(ISSUERS).find(key => logo.includes(key))] ?? 'Coursera';

/* ─── content sources ───────────────────────────────────── */

/* ─── structured data (JSON-LD) ─────────────────────────── */

const PERSON_ID = `${SITE}/#person`;
const WEBSITE_ID = `${SITE}/#website`;

const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: profile.name,
  url: `${SITE}/`,
  image: absolute(DEFAULT_OG),
  email: `mailto:${profile.email}`,
  jobTitle: 'AI & Data Science student and full-stack developer',
  description: `${profile.year} ${profile.degree} student at ${profile.college} (CGPA ${CGPA_TEXT}), ${profile.clubRole} of the ${profile.club}. Builds full-stack web apps, multi-agent AI tools, AR and IoT projects.`,
  address: { '@type': 'PostalAddress', addressLocality: profile.city, addressRegion: profile.region, addressCountry: profile.country },
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: profile.college, address: { '@type': 'PostalAddress', addressLocality: profile.city, addressCountry: profile.country } },
    { '@type': 'HighSchool', name: profile.school },
  ],
  affiliation: { '@type': 'Organization', name: profile.club },
  hasOccupation: { '@type': 'Occupation', name: `${profile.clubRole}, ${profile.club}` },
  award: hackathonsData.map(h => `${h.title} — ${h.achievement.replace(/[^\p{L}\p{N}\s.,&-]/gu, '').trim()}`),
  hasCredential: skillsData.flatMap(group =>
    group.certifications.map(cert => ({
      '@type': 'EducationalOccupationalCredential',
      name: cert.name,
      credentialCategory: 'certificate',
      recognizedBy: { '@type': 'Organization', name: issuerOf(cert.logo) },
    }))
  ),
  knowsAbout: [...new Set(techStack.flatMap(group => group.items)), 'Artificial Intelligence', 'Data Science', 'Retrieval-Augmented Generation', 'Cybersecurity', 'IoT'],
  sameAs: [profile.github, profile.linkedin, profile.x],
};

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE}/`,
  name: 'akashr.dev',
  description: `Portfolio, projects and devlog of ${profile.name}.`,
  inLanguage: 'en',
  author: { '@id': PERSON_ID },
  publisher: { '@id': PERSON_ID },
};

const breadcrumbs = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'Home', route: '/' }, ...trail].map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    item: canonicalFor(crumb.route),
  })),
});

const projectLd = (project, route) => ({
  '@type': 'SoftwareSourceCode',
  '@id': `${canonicalFor(route)}#project`,
  name: project.title,
  description: project.tagline,
  abstract: stripHtml(project.description.join(' ')),
  url: canonicalFor(route),
  codeRepository: cleanRepo(project.githubUrl),
  programmingLanguage: project.tech,
  keywords: [project.category, ...project.tech].join(', '),
  creativeWorkStatus: isShipped(project.status) ? 'Published' : 'Incomplete',
  image: project.preview.poster ? absolute(project.preview.poster) : undefined,
  author: { '@id': PERSON_ID },
});

const postLd = (post, route, image) => ({
  '@type': 'BlogPosting',
  '@id': `${canonicalFor(route)}#post`,
  headline: post.title,
  description: post.summary,
  datePublished: post.date,
  dateModified: post.date,
  keywords: post.tags.join(', '),
  wordCount: post.body.split(/\s+/).filter(Boolean).length,
  timeRequired: `PT${post.minutes}M`,
  mainEntityOfPage: canonicalFor(route),
  image: absolute(image),
  inLanguage: 'en',
  author: { '@id': PERSON_ID },
  publisher: { '@id': PERSON_ID },
  isPartOf: { '@id': `${SITE}/blog#blog` },
});

/* ─── static page bodies (what non-JS readers see) ──────── */

const NAV_LINKS = [
  ['/', 'Home'], ['/about', 'About'], ['/projects', 'Projects'], ['/achievements', 'Achievements'],
  ['/blog', 'Devlog'], ['/contact', 'Contact'], ['/resume-view', 'Resume'],
];

const staticNav = () =>
  `<nav aria-label="Main"><ul>${NAV_LINKS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul></nav>`;

const educationList = () => `
<ul>
  <li><strong>${escapeHtml(profile.degree)}</strong> — ${escapeHtml(profile.college)} (${escapeHtml(profile.collegeShort)}), ${escapeHtml(profile.city)}, ${escapeHtml(profile.batch)}. ${escapeHtml(profile.year)}, current CGPA ${CGPA_TEXT}.</li>
  <li><strong>Higher secondary</strong> — ${escapeHtml(profile.school)}. Class 10: ${profile.class10}, Class 12: ${profile.class12}.</li>
</ul>`;

const projectSummaryList = (projects) => `
<ul>${projects.map(p => `
  <li><a href="/projects/${p.slug}"><strong>${escapeHtml(p.title)}</strong></a> — ${escapeHtml(p.tagline)} <em>(${escapeHtml(p.category)} · ${escapeHtml(p.tech.join(', '))} · ${escapeHtml(p.status)})</em></li>`).join('')}
</ul>`;

const stackList = () =>
  `<ul>${techStack.map(g => `<li><strong>${escapeHtml(g.group)}:</strong> ${escapeHtml(g.items.join(', '))}</li>`).join('')}</ul>`;

const certList = () =>
  `<ul>${skillsData.map(g => `<li><strong>${escapeHtml(g.skill)}:</strong> ${escapeHtml(g.certifications.map(c => `${c.name} (${issuerOf(c.logo)})`).join('; '))}</li>`).join('')}</ul>`;

const hackathonList = () =>
  `<ul>${hackathonsData.map(h => `<li><strong>${escapeHtml(h.title)}</strong> — ${escapeHtml(h.achievement)}. ${escapeHtml(h.type)} at ${escapeHtml(h.venue)}; team of ${escapeHtml(h.team)}. Built “${escapeHtml(h.project)}”: ${escapeHtml(h.description.join('; '))}.</li>`).join('')}</ul>`;

const contactList = () => `
<ul>
  <li>Email: <a href="mailto:${profile.email}">${profile.email}</a></li>
  <li>GitHub: <a href="${profile.github}">${profile.github}</a></li>
  <li>LinkedIn: <a href="${profile.linkedin}">${profile.linkedin}</a></li>
  <li>X: <a href="${profile.x}">${profile.x}</a></li>
  <li>Résumé: <a href="${profile.resume}">${SITE}${profile.resume}</a></li>
</ul>`;

const intro = () =>
  `<p>${escapeHtml(profile.name)} is a ${escapeHtml(profile.year)} ${escapeHtml(profile.degree)} student at ${escapeHtml(profile.college)}, ${escapeHtml(profile.city)}, ${escapeHtml(profile.region)} (current CGPA ${CGPA_TEXT}), and the ${escapeHtml(profile.clubRole)} of the college ${escapeHtml(profile.club.replace(/, SKCET$/, ''))}. Akash builds complete products solo, end to end: full-stack web apps (React, Node.js, FastAPI), multi-agent AI and RAG tools, AR and Flutter mobile apps, and IoT systems. Open to internships — in Coimbatore or remote.</p>`;

/* ─── route table ───────────────────────────────────────── */

async function buildRoutes(posts) {
  const routes = [];
  const add = (route) => routes.push(route);

  add({
    route: '/',
    title: `${profile.name} | Terminal Portfolio`,
    description: `${profile.name} — ${profile.year} AI & Data Science student at SKCET (CGPA ${CGPA_TEXT}), Data Science club tech leader and full-stack developer. Projects in multi-agent AI, AR, Flutter, React and IoT.`,
    og: await ogImageFor('home'),
    priority: '1.0',
    changefreq: 'weekly',
    ld: [{ '@type': 'ProfilePage', '@id': `${SITE}/#profile`, url: `${SITE}/`, name: `${profile.name} — portfolio`, mainEntity: { '@id': PERSON_ID }, isPartOf: { '@id': WEBSITE_ID } }],
    body: `
<header><h1>${escapeHtml(profile.name)}</h1><p>${escapeHtml(profile.role)} · ${escapeHtml(profile.city)}, India</p></header>
${intro()}
<h2>Featured projects</h2>${projectSummaryList(projectsData)}
<h2>Education</h2>${educationList()}
<h2>Latest writing</h2><ul>${posts.map(p => `<li><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a> — ${escapeHtml(p.summary)}</li>`).join('')}</ul>
<h2>Contact</h2>${contactList()}`,
  });

  add({
    route: '/about',
    title: `About — ${profile.name}`,
    description: `${profile.year} B.Tech AI & Data Science student at ${profile.college} (CGPA ${CGPA_TEXT}), ${profile.clubRole} of the Data Science club. Full-stack developer, IoT tinkerer, HackIndia 2025 Top 10 Finalist.`,
    og: await ogImageFor('about'),
    priority: '0.9',
    changefreq: 'monthly',
    ld: [
      { '@type': 'AboutPage', url: canonicalFor('/about'), name: `About ${profile.name}`, mainEntity: { '@id': PERSON_ID }, isPartOf: { '@id': WEBSITE_ID } },
      breadcrumbs([{ name: 'About', route: '/about' }]),
    ],
    body: `
<h1>About ${escapeHtml(profile.name)}</h1>
${intro()}
<h2>Education</h2>${educationList()}
<h2>Leadership</h2><ul><li><strong>${escapeHtml(profile.clubRole)}, ${escapeHtml(profile.club)}</strong> — leading the technical side of the college Data Science club: sessions, events and hands-on builds for members.</li></ul>
<h2>Tech stack</h2>${stackList()}
<h2>Certifications</h2>${certList()}
<h2>Hackathons</h2>${hackathonList()}`,
  });

  add({
    route: '/projects',
    title: `Projects — ${profile.name}`,
    description: `${projectsData.length} projects built solo: multi-agent AI security auditor, AR room scanner, Flutter student app, full-stack e-commerce and more.`,
    og: await ogImageFor('projects'),
    priority: '0.9',
    changefreq: 'weekly',
    ld: [
      {
        '@type': 'CollectionPage',
        url: canonicalFor('/projects'),
        name: `Projects by ${profile.name}`,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: projectsData.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: canonicalFor(`/projects/${p.slug}`), name: p.title })),
        },
      },
      breadcrumbs([{ name: 'Projects', route: '/projects' }]),
    ],
    body: `<h1>Projects</h1><p>Everything below was designed and built solo by ${escapeHtml(profile.name)}.</p>${projectSummaryList(projectsData)}`,
  });

  for (const project of projectsData) {
    const route = `/projects/${project.slug}`;
    const related = posts.filter(post => post.project === project.slug);
    add({
      route,
      title: `${project.title} — ${profile.name}`,
      description: `${project.tagline} Built by ${profile.name} with ${project.tech.join(', ')}.`,
      og: await ogImageFor(`project-${project.slug}`),
      type: 'article',
      priority: '0.8',
      changefreq: 'monthly',
      ld: [projectLd(project, route), breadcrumbs([{ name: 'Projects', route: '/projects' }, { name: project.title, route }])],
      body: `
<article>
  <h1>${escapeHtml(project.title)}</h1>
  <p><strong>${escapeHtml(project.tagline)}</strong></p>
  <dl>
    <dt>Category</dt><dd>${escapeHtml(project.category)}</dd>
    <dt>Role</dt><dd>${escapeHtml(project.role)}</dd>
    <dt>Status</dt><dd>${escapeHtml(project.status)}</dd>
    <dt>Duration</dt><dd>${escapeHtml(project.duration)}</dd>
    <dt>Tech</dt><dd>${escapeHtml(project.tech.join(', '))}</dd>
    <dt>Source</dt><dd><a href="${cleanRepo(project.githubUrl)}">${cleanRepo(project.githubUrl)}</a></dd>
  </dl>
  <h2>Overview</h2>${project.description.map(part => (part.trim().startsWith('<') ? part : `<p>${part}</p>`)).join('\n')}
  <h2>Challenge</h2><p>${escapeHtml(project.challenge)}</p>
  <h2>Solution</h2><p>${escapeHtml(project.solution)}</p>
  <h2>Impact</h2><ul>${[project.impact].flat().map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  ${related.length ? `<h2>Related writing</h2><ul>${related.map(p => `<li><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a></li>`).join('')}</ul>` : ''}
  <p><a href="/projects">← All projects</a></p>
</article>`,
    });
  }

  add({
    route: '/achievements',
    title: `Achievements — ${profile.name}`,
    description: `HackIndia 2025 Top 10 Finalist, ${skillsData.reduce((n, g) => n + g.certifications.length, 0)} certifications (Meta, Google, IBM, Atlassian, NPTEL), CGPA ${CGPA_TEXT}, plus live LeetCode and GitHub activity.`,
    og: await ogImageFor('achievements'),
    priority: '0.7',
    changefreq: 'monthly',
    ld: [breadcrumbs([{ name: 'Achievements', route: '/achievements' }])],
    body: `
<h1>Achievements</h1>
<h2>Milestones</h2><ul>
  <li>Current CGPA ${CGPA_TEXT} — ${escapeHtml(profile.degree)}, ${escapeHtml(profile.college)}.</li>
  <li>${escapeHtml(profile.clubRole)}, ${escapeHtml(profile.club)}.</li>
  <li>${projectsData.length} projects shipped or in progress, built solo.</li>
</ul>
<h2>Hackathons</h2>${hackathonList()}
<h2>Certifications</h2>${certList()}`,
  });

  add({
    route: '/blog',
    title: `Devlog — ${profile.name}`,
    description: `Build notes and write-ups by ${profile.name}: multi-agent AI, AR capture, React performance and more.`,
    og: await ogImageFor('blog'),
    priority: '0.8',
    changefreq: 'weekly',
    ld: [
      {
        '@type': 'Blog',
        '@id': `${SITE}/blog#blog`,
        url: canonicalFor('/blog'),
        name: `${profile.name}'s devlog`,
        author: { '@id': PERSON_ID },
        isPartOf: { '@id': WEBSITE_ID },
        blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: canonicalFor(`/blog/${p.slug}`), datePublished: p.date })),
      },
      breadcrumbs([{ name: 'Devlog', route: '/blog' }]),
    ],
    body: `<h1>Devlog</h1><p>Build notes and write-ups.</p><ul>${posts.map(p => `<li><article><h2><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a></h2><p><time datetime="${p.date}">${p.date}</time> · ${p.minutes} min read · ${escapeHtml(p.tags.join(', '))}</p><p>${escapeHtml(p.summary)}</p></article></li>`).join('')}</ul>`,
  });

  for (const post of posts) {
    const route = `/blog/${post.slug}`;
    const og = await ogImageFor(`blog-${post.slug}`);
    add({
      route,
      title: `${post.title} — ${profile.name}`,
      description: post.summary,
      og,
      type: 'article',
      published: post.date,
      tags: post.tags,
      lastmod: post.date,
      priority: '0.7',
      changefreq: 'yearly',
      ld: [postLd(post, route, og), breadcrumbs([{ name: 'Devlog', route: '/blog' }, { name: post.title, route }])],
      body: `
<article>
  <h1>${escapeHtml(post.title)}</h1>
  <p><time datetime="${post.date}">${post.date}</time> · ${post.minutes} min read · by <a href="/about">${escapeHtml(profile.name)}</a></p>
  ${post.html}
  <p><a href="/blog">← All posts</a></p>
</article>`,
    });
  }

  add({
    route: '/contact',
    title: `Contact — ${profile.name}`,
    description: `Get in touch with ${profile.name} — open to internships in Coimbatore or remote. Email, LinkedIn, GitHub and résumé.`,
    og: await ogImageFor('contact'),
    priority: '0.6',
    changefreq: 'yearly',
    ld: [
      { '@type': 'ContactPage', url: canonicalFor('/contact'), name: `Contact ${profile.name}`, mainEntity: { '@id': PERSON_ID } },
      breadcrumbs([{ name: 'Contact', route: '/contact' }]),
    ],
    body: `<h1>Contact ${escapeHtml(profile.name)}</h1><p>Open to internships — Coimbatore or remote. The fastest way to reach me is email.</p>${contactList()}`,
  });

  add({
    route: '/resume-view',
    title: `Resume — ${profile.name}`,
    description: `${profile.name} résumé — AI & Data Science student at SKCET, full-stack developer.`,
    og: await ogImageFor('home'),
    priority: '0.6',
    changefreq: 'monthly',
    ld: [breadcrumbs([{ name: 'Resume', route: '/resume-view' }])],
    body: `<h1>Résumé — ${escapeHtml(profile.name)}</h1><p><a href="${profile.resume}">Download the PDF résumé</a>.</p>${educationList()}<h2>Skills</h2>${stackList()}`,
  });

  return routes;
}

/* ─── HTML assembly ─────────────────────────────────────── */

const STATIC_SLOT = '<!-- static-content -->';
const SEO_BLOCK = /<!-- seo:start[\s\S]*?<!-- seo:end -->/;

function headFor(page) {
  const canonical = canonicalFor(page.route);
  const image = absolute(page.og);
  const graph = { '@context': 'https://schema.org', '@graph': [person, website, ...page.ld] };
  const articleTags = page.type === 'article' && page.published
    ? [`<meta property="article:published_time" content="${page.published}" />`, `<meta property="article:author" content="${SITE}/about" />`, ...(page.tags ?? []).map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}" />`)]
    : [];

  return [
    '<!-- seo:start -->',
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" data-prerender />`,
    ...(page.noindex ? [] : [`<link rel="canonical" href="${canonical}" data-prerender />`]),
    `<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`,
    '<meta property="og:site_name" content="akashr.dev" />',
    '<meta property="og:locale" content="en_IN" />',
    `<meta property="og:type" content="${page.type ?? (page.route === '/' ? 'profile' : 'website')}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escapeHtml(page.title)}" />`,
    ...articleTags,
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:site" content="@akash_020160" />',
    '<meta name="twitter:creator" content="@akash_020160" />',
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
    '<!-- seo:end -->',
  ].join('\n    ');
}

const bodyFor = (page) =>
  `<div id="seo-static">${staticNav()}<main>${page.body}</main><footer><p>© ${new Date().getFullYear()} ${escapeHtml(profile.name)} · <a href="${SITE}/">akashr.dev</a></p></footer></div>`;

function render(template, page) {
  if (!SEO_BLOCK.test(template)) throw new Error('index.html is missing the <!-- seo:start --> … <!-- seo:end --> block');
  if (!template.includes(STATIC_SLOT)) throw new Error(`index.html #root is missing ${STATIC_SLOT}`);
  return template.replace(SEO_BLOCK, headFor(page)).replace(STATIC_SLOT, bodyFor(page));
}

/** Writes both `<route>/index.html` and `<route>.html` so any static host's clean-URL lookup finds it. */
async function writePage(route, html) {
  if (route === '/') {
    await writeFile(path.join(DIST, 'index.html'), html);
    return;
  }
  const dir = path.join(DIST, route.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
  await writeFile(`${dir}.html`, html);
}

/* ─── feeds & machine-readable files ────────────────────── */

const sitemapXml = (routes) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url>
    <loc>${canonicalFor(r.route)}</loc>
    <lastmod>${r.lastmod ?? TODAY}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const rssXml = (posts) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(profile.name)} — devlog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Build notes and write-ups by ${escapeHtml(profile.name)}.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map(p => `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.date}T09:00:00+05:30`).toUTCString()}</pubDate>
      <description>${escapeHtml(p.summary)}</description>
${p.tags.map(tag => `      <category>${escapeHtml(tag)}</category>`).join('\n')}
    </item>`).join('\n')}
  </channel>
</rss>
`;

/** llms.txt (https://llmstxt.org): a concise, link-rich brief for AI assistants. */
const llmsTxt = (posts) => `# ${profile.name}

> ${profile.name} is a ${profile.year} ${profile.degree} student at ${profile.college} (${profile.collegeShort}), ${profile.city}, ${profile.region}, India, with a current CGPA of ${CGPA_TEXT}. Akash is the ${profile.clubRole} of the ${profile.club} and a full-stack developer who builds complete products solo — multi-agent AI and RAG tools, AR and Flutter apps, React/Node/FastAPI web apps and IoT systems. Open to internships (Coimbatore or remote).

Key facts:
- Education: ${profile.degree}, ${profile.college}, ${profile.batch} (CGPA ${CGPA_TEXT}); schooling at ${profile.school} (Class 10: ${profile.class10}, Class 12: ${profile.class12}).
- Leadership: ${profile.clubRole}, ${profile.club}.
- Hackathons: ${hackathonsData.map(h => `${h.title} — ${h.achievement.replace(/[^\p{L}\p{N}\s.,&-]/gu, '').trim()} (${h.project})`).join('; ')}.
- Stack: ${techStack.map(g => `${g.group}: ${g.items.join(', ')}`).join(' | ')}.
- Contact: ${profile.email} · GitHub ${profile.github} · LinkedIn ${profile.linkedin}

## Projects
${projectsData.map(p => `- [${p.title}](${SITE}/projects/${p.slug}): ${p.tagline} (${p.tech.join(', ')}; ${p.status})`).join('\n')}

## Devlog
${posts.map(p => `- [${p.title}](${SITE}/blog/${p.slug}) (${p.date}): ${p.summary}`).join('\n')}

## Pages
- [About](${SITE}/about): background, education, leadership, stack and certifications
- [Achievements](${SITE}/achievements): hackathons, certifications, milestones
- [Contact](${SITE}/contact): email and social links
- [Résumé (PDF)](${SITE}${profile.resume})

## Optional
- [Full text of every page and post](${SITE}/llms-full.txt)
`;

const llmsFullTxt = (routes) =>
  `# ${profile.name} — full site text\n\nSource: ${SITE}/ · generated ${TODAY}\n\n` +
  routes
    .map(r => `---\n\nURL: ${canonicalFor(r.route)}\nTitle: ${r.title}\n\n${stripHtml(r.body.replace(/<\/(p|li|h[1-6]|dd|pre)>/g, '\n')).replace(/ ?\n ?/g, '\n')}`)
    .join('\n\n') + '\n';

/* ─── main ──────────────────────────────────────────────── */

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const posts = await loadPosts();
  const routes = await buildRoutes(posts);

  for (const page of routes) await writePage(page.route, render(template, page));

  const notFound = {
    route: '/404',
    title: `404 — page not found · akashr.dev`,
    description: 'This page does not exist.',
    og: DEFAULT_OG,
    noindex: true,
    ld: [],
    body: '<h1>404 — page not found</h1><p><a href="/">Back to the home page</a></p>',
  };
  await writeFile(path.join(DIST, '404.html'), render(template, notFound));

  await writeFile(path.join(DIST, 'sitemap.xml'), sitemapXml(routes));
  await mkdir(path.join(DIST, 'blog'), { recursive: true });
  await writeFile(path.join(DIST, 'blog/rss.xml'), rssXml(posts));
  await writeFile(path.join(DIST, 'llms.txt'), llmsTxt(posts));
  await writeFile(path.join(DIST, 'llms-full.txt'), llmsFullTxt(routes));

  console.log(`prerender: ${routes.length} routes + 404, sitemap.xml, blog/rss.xml, llms.txt, llms-full.txt`);
}

main().catch((err) => {
  console.error('prerender failed:', err);
  process.exit(1);
});
