import React from 'react';
import { projectsData } from '../data/projects.js';
import ProjectCard from '../components/ProjectCard.jsx';

function ProjectsPage() {
  return (
    <div className="page active" id="projects">
      <div className="projects-grid" id="project-list">
        {projectsData.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
      </div>
    </div>
  );
}

export default ProjectsPage;
