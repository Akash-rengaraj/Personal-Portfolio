import React from 'react';

function ProjectCard({ project }) {
  return (
    <div className="project-card animate-card">
      <div className="project-media">
        <div className="project-preview">
          {project.preview.type === 'video' ? (
            <video
              className="preview-video"
              autoPlay
              muted
              loop
              playsInline
              key={project.preview.src}
            >
              <source src={project.preview.src} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <img
              src={project.preview.src}
              alt={project.preview.alt}
              className="preview-image"
            />
          )}
        </div>
      </div>

      <div className="project-content-col">
        <div className="project-title">{project.title}</div>

        <div className="project-tech">
          {project.tech.map(tech => (
            <span key={tech} className="tech-tag">{tech}</span>
          ))}
        </div>

        <div
          className="project-description"
          dangerouslySetInnerHTML={{ __html: project.description.join("") }}
        />

        <div className="project-footer">
            <div className="project-status">{project.status}</div>
            {project.githubUrl && (
              <a 
                href={project.githubUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="github-btn"
                aria-label="View Source Code"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  width="18" 
                  height="18" 
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-3.795-.735-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.075-.735.075-.735 1.2.075 1.83 1.23 1.83 1.23 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.545 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.92 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <span>View Code</span>
              </a>
            )}
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;
