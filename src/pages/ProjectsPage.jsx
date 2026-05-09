import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { projectsData } from '../data/projects.js';
import ProjectCard from '../components/ProjectCard.jsx';

const ALL_TECH = [...new Set(projectsData.flatMap(p => p.tech))].sort();

function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [activeTech, setActiveTech] = useState([]);

  const filtered = useMemo(() => {
    return projectsData.filter(p => {
      const matchesSearch = !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.tagline?.toLowerCase().includes(search.toLowerCase()) ||
        p.tech.some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchesTech = activeTech.length === 0 ||
        activeTech.every(t => p.tech.includes(t));
      return matchesSearch && matchesTech;
    });
  }, [search, activeTech]);

  const toggleTech = (tech) => {
    setActiveTech(prev =>
      prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
    );
  };

  return (
    <>
      <Helmet>
        <title>Projects — Akash Rengaraj</title>
        <meta name="description" content="4+ full-stack projects: Flutter app, jewellery e-commerce, ice cream frontend, terminal portfolio." />
        <meta property="og:title" content="Projects — Akash Rengaraj" />
        <meta property="og:image" content="https://www.akashr.dev/screenshots/projects-dark.png" />
      </Helmet>
      <div className="page active" id="projects">
        <div className="projects-filter-bar">
          <input
            className="projects-search"
            type="text"
            placeholder="search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search projects"
          />
          <div className="tech-filter-chips">
            {ALL_TECH.map(tech => (
              <button
                key={tech}
                className={`tech-chip ${activeTech.includes(tech) ? 'active' : ''}`}
                onClick={() => toggleTech(tech)}
                aria-pressed={activeTech.includes(tech)}
              >
                {tech}
              </button>
            ))}
            {activeTech.length > 0 && (
              <button className="tech-chip tech-chip-clear" onClick={() => setActiveTech([])}>
                × clear
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="projects-empty">
            <span className="output-error">bash: no projects matching '{search || activeTech.join(', ')}'</span>
          </div>
        ) : (
          <div className="projects-grid" id="project-list">
            {filtered.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default ProjectsPage;
