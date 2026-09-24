import posts from 'virtual:blog-posts';

/* Posts come from src/content/blog/*.md, parsed and rendered to HTML at build time (see vite.config.js). */
export { posts };

export const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();

export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
