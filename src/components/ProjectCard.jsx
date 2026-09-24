import { Link } from 'react-router-dom';
import LazyVideo from './LazyVideo';
import { projectState } from '../utils/projectState';

const MAX_TAGS = 4;

function GithubIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-3.795-.735-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.075-.735.075-.735 1.2.075 1.83 1.23 1.83 1.23 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.545 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function ProjectMedia({ project, className }) {
  const { preview } = project;
  if (preview.type === 'video') {
    return <LazyVideo src={preview.src} poster={preview.poster} className={className} label={preview.alt} hoverTarget=".pj-card" />;
  }
  return <img src={preview.src} alt={preview.alt} className={className} loading="lazy" decoding="async" />;
}

/** Project tile; `featured` renders the wide showcase layout with impact highlights. */
function ProjectCard({ project, index, featured = false }) {
  const state = projectState(project.status);
  const extraTags = project.tech.length - MAX_TAGS;

  return (
    <article className={`pj-card ${featured ? 'pj-card-featured' : ''}`}>
      <Link to={`/projects/${project.slug}`} className="pj-media" aria-label={`${project.title} — case study`}>
        <ProjectMedia project={project} className="pj-video" />
        <span className="pj-media-hint" aria-hidden="true">▶ hover to preview</span>
      </Link>

      <div className="pj-body">
        <div className="pj-meta">
          <span className="pj-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="pj-category">{project.category}</span>
          <span className={`pj-state pj-state-${state.tone}`}>
            <span className="pj-state-dot" aria-hidden="true" />
            {state.label}
          </span>
        </div>

        <h2 className="pj-title">
          <Link to={`/projects/${project.slug}`}>{project.title}</Link>
        </h2>
        <p className="pj-tagline">{project.tagline}</p>

        {featured && project.impact?.length > 0 && (
          <ul className="pj-impact">
            {project.impact.slice(0, 3).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <div className="pj-tags">
          {(featured ? project.tech : project.tech.slice(0, MAX_TAGS)).map(t => (
            <span key={t} className="pj-tag">{t}</span>
          ))}
          {!featured && extraTags > 0 && <span className="pj-tag pj-tag-more">+{extraTags}</span>}
        </div>

        <div className="pj-actions">
          <Link to={`/projects/${project.slug}`} className="pj-link pj-link-primary">
            case study <span aria-hidden="true">→</span>
          </Link>
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="pj-link">
              <GithubIcon /> code
            </a>
          )}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="pj-link">
              ↗ live
            </a>
          )}
          <span className="pj-duration">{project.duration}</span>
        </div>
      </div>
    </article>
  );
}

export default ProjectCard;
