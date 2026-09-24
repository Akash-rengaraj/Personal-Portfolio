/**
 * Loads every markdown post in src/content/blog at build time: front matter,
 * reading time and pre-rendered HTML. Shared by the Vite `virtual:blog-posts`
 * module (so the browser never ships a markdown parser) and the prerender script.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { parseFrontmatter, readingMinutes } from '../src/utils/frontmatter.js';

export const BLOG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/content/blog');

/** All posts, newest first. The filename (minus .md) is the slug. */
export async function loadPosts() {
  const files = (await readdir(BLOG_DIR)).filter(file => file.endsWith('.md'));
  const posts = await Promise.all(
    files.map(async (file) => {
      const { data, body } = parseFrontmatter(await readFile(path.join(BLOG_DIR, file), 'utf8'));
      if (!data.title || !data.date) throw new Error(`${file}: front matter needs a title and a date`);
      return {
        slug: file.replace(/\.md$/, ''),
        title: data.title,
        date: data.date,
        summary: data.summary ?? '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        project: data.project,
        minutes: readingMinutes(body),
        body,
        html: marked.parse(body, { gfm: true }),
      };
    })
  );
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}
