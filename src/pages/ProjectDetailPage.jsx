import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { projectsData } from '../data/projects.js';

function ProjectDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const idx = projectsData.findIndex(p => p.slug === slug);
  const project = projectsData[idx];

  if (!project) {
    return (
      <div className="not-found-page">
        <div className="not-found-content">
          <div className="output-line output-error">bash: project '{slug}': not found</div>
          <Link to="/projects" className="not-found-home-btn">[ ← back to projects ]</Link>
        </div>
      </div>
    );
  }

  const prev = idx > 0 ? projectsData[idx - 1] : null;
  const next = idx < projectsData.length - 1 ? projectsData[idx + 1] : null;

  return (
    <>
      <Helmet>
        <title>{project.title} — Akash Rengaraj</title>
        <meta name="description" content={project.tagline} />
        <meta property="og:title" content={`${project.title} — Akash Rengaraj`} />
      </Helmet>
      <div className="page active project-detail-page">
        <div className="project-detail-inner">

          {/* Back nav */}
          <button className="project-detail-back" onClick={() => navigate('/projects')}>
            <span>←</span> all projects
          </button>

          {/* Hero */}
          <div className="project-detail-hero">
            <div className="project-detail-media">
              {project.preview.type === 'video' ? (
                <video autoPlay muted loop playsInline className="detail-video" key={project.preview.src}>
                  <source src={project.preview.src} type={project.preview.src.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
                </video>
              ) : (
                <img src={project.preview.src} alt={project.preview.alt} className="detail-video" />
              )}
            </div>
            <div className="project-detail-hero-info">
              <div className="project-detail-status">{project.status}</div>
              <h1 className="project-detail-title">{project.title}</h1>
              <p className="project-detail-tagline">{project.tagline}</p>
              <div className="project-detail-tech">
                {project.tech.map(t => <span key={t} className="tech-tag">{t}</span>)}
              </div>
              <div className="project-detail-meta">
                <span><span className="meta-label">role:</span> {project.role}</span>
                <span><span className="meta-label">duration:</span> {project.duration}</span>
              </div>
              <div className="project-detail-links">
                {project.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="detail-link github-btn">
                    <GithubIcon /> View Code
                  </a>
                )}
                {project.liveUrl && (
                  <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="detail-link detail-link-live">
                    ↗ Live Site
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Case Study Sections */}
          <div className="case-study-grid">
            <CaseSection label="01 / challenge" title="The Problem" content={project.challenge} />
            <CaseSection label="02 / solution" title="How I Solved It" content={project.solution} />
            <div className="case-section case-impact">
              <div className="case-label">03 / impact</div>
              <h2 className="case-title">Outcomes</h2>
              <ul className="impact-list">
                {project.impact.map((item, i) => (
                  <li key={i} className="impact-item">
                    <span className="impact-dot">▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Prev / Next navigation */}
          <div className="project-nav-footer">
            {prev ? (
              <Link to={`/projects/${prev.slug}`} className="project-nav-btn project-nav-prev">
                <span className="nav-dir">← previous</span>
                <span className="nav-title">{prev.title}</span>
              </Link>
            ) : <div />}
            {next ? (
              <Link to={`/projects/${next.slug}`} className="project-nav-btn project-nav-next">
                <span className="nav-dir">next →</span>
                <span className="nav-title">{next.title}</span>
              </Link>
            ) : <div />}
          </div>

        </div>
      </div>
    </>
  );
}

function CaseSection({ label, title, content }) {
  return (
    <div className="case-section">
      <div className="case-label">{label}</div>
      <h2 className="case-title">{title}</h2>
      <p className="case-body">{content}</p>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginRight: '6px' }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-3.795-.735-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.075-.735.075-.735 1.2.075 1.83 1.23 1.83 1.23 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.545 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

export default ProjectDetailPage;
