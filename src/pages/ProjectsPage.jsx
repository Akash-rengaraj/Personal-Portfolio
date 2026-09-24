import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { projectsData } from '../data/projects.js';
import ProjectCard from '../components/ProjectCard.jsx';
import { projectState } from '../utils/projectState';

const ALL = 'all';
const CATEGORIES = [ALL, ...new Set(projectsData.map(p => p.category))];
const SHIPPED = projectsData.filter(p => projectState(p.status).tone === 'done').length;
const TECH_COUNT = new Set(projectsData.flatMap(p => p.tech)).size;

/** Case-insensitive match on title, tagline, category or any tech tag. */
const matches = (project, query) => {
  if (!query) return true;
  const q = query.toLowerCase();
  return [project.title, project.tagline, project.category, ...project.tech]
    .some(field => field?.toLowerCase().includes(q));
};

function ProjectsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);

  const filtered = useMemo(
    () => projectsData.filter(p => (category === ALL || p.category === category) && matches(p, query)),
    [query, category]
  );

  const isDefaultView = category === ALL && !query;
  const featured = isDefaultView ? filtered.find(p => p.featured) : null;
  const rest = featured ? filtered.filter(p => p !== featured) : filtered;

  return (
    <>
      <Helmet>
        <title>Projects — Akash Rengaraj</title>
        <meta name="description" content={`${projectsData.length} projects built solo: multi-agent AI security auditor, AR room scanner, Flutter student app, full-stack e-commerce and more.`} />
        <meta property="og:title" content="Projects — Akash Rengaraj" />
        <meta property="og:image" content="https://www.akashr.dev/screenshots/projects-dark.png" />
      </Helmet>

      <div className="page active pj-page" id="projects">
        <div className="pj-scroll">
          <header className="pj-header">
            <div className="pj-heading">
              <div className="pj-cmd"><span className="pj-prompt">akash@projects:~$</span> ls -la ./projects</div>
              <h1 className="pj-h1">Things I've built</h1>
              <div className="pj-summary">
                <span><strong>{projectsData.length}</strong> projects</span>
                <span className="pj-dot" aria-hidden="true">·</span>
                <span><strong>{SHIPPED}</strong> shipped</span>
                <span className="pj-dot" aria-hidden="true">·</span>
                <span><strong>{TECH_COUNT}</strong> technologies</span>
                <span className="pj-dot" aria-hidden="true">·</span>
                <span>all solo</span>
              </div>
            </div>

            <div className="pj-controls">
              <label className="pj-search">
                <span className="pj-search-prefix" aria-hidden="true">grep -i</span>
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="react, rag, flutter…"
                  aria-label="Search projects"
                  spellCheck={false}
                />
              </label>
              <div className="pj-tabs" role="tablist" aria-label="Filter by category">
                {CATEGORIES.map(cat => {
                  const count = cat === ALL ? projectsData.length : projectsData.filter(p => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={category === cat}
                      className={`pj-tab ${category === cat ? 'is-active' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat} <span className="pj-tab-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          {filtered.length === 0 ? (
            <div className="pj-empty">
              <span className="output-error">grep: no projects match '{query}'{category !== ALL ? ` in ${category}` : ''}</span>
              <button type="button" className="pj-link" onClick={() => { setQuery(''); setCategory(ALL); }}>
                reset filters
              </button>
            </div>
          ) : (
            <>
              {featured && (
                <ProjectCard project={featured} index={projectsData.indexOf(featured)} featured />
              )}
              <div className="pj-grid">
                {rest.map(project => (
                  <ProjectCard key={project.slug} project={project} index={projectsData.indexOf(project)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default ProjectsPage;
