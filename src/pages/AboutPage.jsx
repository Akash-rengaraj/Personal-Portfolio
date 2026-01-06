import React, { useState } from 'react';
import { skillsData } from '../data/skills';

// --- Sub-components for Right Panel ---

const SystemStats = () => {
  return (
    <div className="system-stats animate-fade-in">
      <div className="stats-header">
        <span className="text-accent">root@akash-dev:~$</span> htop --skills
      </div>
      <div className="stats-grid">
        {skillsData.map((category, idx) => (
          <div key={idx} className="skill-category">
            <div className="category-title">[{category.skill}]</div>
            <div className="skill-bars">
              {category.certifications.map((cert, cIdx) => (
                <div key={cIdx} className="skill-bar-container">
                  <div className="skill-label">{cert.name}</div>
                  <div className="progress-track">
                    <div 
                      className="progress-fill" 
                      style={{width: `${Math.floor(Math.random() * 30 + 70)}%`, animationDelay: `${cIdx * 0.1}s`}}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProcessList = () => {
  const processes = [
    { pid: 2024, user: 'student', cpu: '85.0', mem: '4.2', command: 'B.Tech AI & Data Science' },
    { pid: 2023, user: 'dev', cpu: '12.5', mem: '2.1', command: 'Full Stack Development' },
    { pid: 2023, user: 'root', cpu: '5.0', mem: '1.5', command: 'Cybersecurity Learning' },
    { pid: 8080, user: 'server', cpu: '2.0', mem: '0.8', command: 'Backend Projects' },
  ];

  return (
    <div className="process-list animate-fade-in">
       <div className="stats-header">
        <span className="text-accent">root@akash-dev:~$</span> ps aux --sort=-%cpu
      </div>
      <table className="process-table">
        <thead>
          <tr>
            <th>PID</th>
            <th>USER</th>
            <th>%CPU</th>
            <th>%MEM</th>
            <th>COMMAND</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((proc, idx) => (
            <tr key={idx} style={{animationDelay: `${idx * 0.1}s`}}>
              <td className="text-accent">{proc.pid}</td>
              <td>{proc.user}</td>
              <td className="text-green">{proc.cpu}</td>
              <td>{proc.mem}</td>
              <td className="process-cmd">{proc.command}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ProfileCard = () => {
  return (
    <div className="profile-card animate-fade-in">
      <div className="ascii-portrait">
        <pre>
{`
    .--.
   |o_o |  < System Ready >
   |:_/ |
  //   \\ \\
 (|     | )
/'\\_   _/\`\\
\\___)=(___/
`}
        </pre>
      </div>
      <div className="system-info">
        <div className="info-row">
          <span className="label">OS:</span> <span className="value">AkashOS v2.0</span>
        </div>
        <div className="info-row">
          <span className="label">Kernel:</span> <span className="value">Creative Logic 5.15</span>
        </div>
        <div className="info-row">
          <span className="label">Uptime:</span> <span className="value">20 Years, 42 Days</span>
        </div>
        <div className="info-row">
          <span className="label">Shell:</span> <span className="value">/bin/zsh</span>
        </div>
        <div className="info-row">
          <span className="label">Location:</span> <span className="value">Coimbatore, IN</span>
        </div>
      </div>
    </div>
  );
};

// --- Main Layout ---

function AboutPage() {
  const [activeSection, setActiveSection] = useState('profile');

  // Interactive Code Component
  const InteractiveCode = () => (
    <div className="code-editor">
        <div className="code-header">~/about/me.js</div>
        <div className="code-content">
            <div className="code-line">
                <span className="keyword">const</span> <span className="variable">developer</span> = &#123;
            </div>
            
            <div 
                className={`code-line interactive ${activeSection === 'profile' ? 'active' : ''}`}
                onMouseEnter={() => setActiveSection('profile')}
            >
                &nbsp;&nbsp;<span className="property">name</span>: <span className="string">'Akash Rengaraj'</span>,
            </div>

             <div 
                className={`code-line interactive ${activeSection === 'profile' ? 'active' : ''}`}
                onMouseEnter={() => setActiveSection('profile')}
            >
                &nbsp;&nbsp;<span className="property">role</span>: <span className="string">'Student Developer'</span>,
            </div>

            <div className="code-line">
                &nbsp;&nbsp;<span className="property">skills</span>: [
            </div>
            
            {skillsData.map((s, i) => (
                <div 
                    key={i}
                    className={`code-line interactive ${activeSection === 'skills' ? 'active' : ''}`}
                    onMouseEnter={() => setActiveSection('skills')}
                >
                    &nbsp;&nbsp;&nbsp;&nbsp;<span className="string">'{s.skill}'</span>,
                </div>
            ))}
            
            <div className="code-line">
                &nbsp;&nbsp;],
            </div>

            <div 
                className={`code-line interactive ${activeSection === 'work' ? 'active' : ''}`}
                onMouseEnter={() => setActiveSection('work')}
            >
                &nbsp;&nbsp;<span className="function">getCurrentStatus</span>: () =&gt; <span className="string">'Pursuing B.Tech'</span>
            </div>

            <div className="code-line">
                &#125;;
            </div>
            <div className="code-line comment">
                // Hover over properties to inspect runtime
            </div>
        </div>
    </div>
  );

  return (
    <div className="page active about-grid" id="about">
      
      {/* Left Panel: Source Code */}
      <div className="left-panel">
         <InteractiveCode />
      </div>

      {/* Right Panel: Runtime Output */}
      <div className="right-panel">
        <div className="panel-header">
            <div className="panel-title">
                {activeSection === 'profile' && 'user_info.json'}
                {activeSection === 'skills' && 'task_manager.exe'}
                {activeSection === 'work' && 'process_monitor.sh'}
            </div>
            <div className="window-controls">
                <span></span><span></span><span></span>
            </div>
        </div>
        <div className="panel-content">
            {activeSection === 'profile' && <ProfileCard />}
            {activeSection === 'skills' && <SystemStats />}
            {activeSection === 'work' && <ProcessList />}
        </div>
      </div>

    </div>
  );
}

export default AboutPage;