import React from 'react';

function ProjectCard({ project }) {
  return (
    <div className="project-card animate-card">
      <div className="project-title">{project.title}</div>

      <div className="project-tech">
        {project.tech.map(tech => (
          <span key={tech} className="tech-tag">{tech}</span>
        ))}
      </div>

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

      <div
        className="project-description"
        dangerouslySetInnerHTML={{ __html: project.description.join("") }}
      />

      <div className="project-status">{project.status}</div>
    </div>
  );
}

export default ProjectCard;
