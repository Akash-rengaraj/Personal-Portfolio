import React, { useState, useEffect } from 'react';
import { skillsData, hackerrankBadgesData } from '../data/skills';
import { hackathonsData } from '../data/hackathons';

// Milestones Component
const Milestones = ({ viewCount }) => {
  const [leetcodeStats, setLeetcodeStats] = useState({ solved: 0, total: 0 });
  const [githubContributions, setGithubContributions] = useState(0);

  useEffect(() => {
    // Fetch LeetCode Data
    fetch('https://leetcode-cors-proxy.vercel.app/api/leetcode?username=Akash_Rengaraj')
      .then(res => res.json())
      .then(data => {
        const all = data.totalSolved.find(d => d.difficulty === 'All');
        const total = data.totalQuestions.find(d => d.difficulty === 'All');
        setLeetcodeStats({ solved: all?.count || 0, total: total?.count || 0 });
      }).catch(err => console.error("LeetCode fetch error:", err));

    // Fetch GitHub Contributions
    fetch('https://github-contributions-api.jogruber.de/v4/Akash-rengaraj')
        .then(res => res.json())
        .then(data => {
            const total = Object.values(data.total).reduce((sum, val) => sum + val, 0);
            setGithubContributions(total);
        }).catch(err => console.error("GitHub fetch error:", err));

  }, []);

  const leetcodePercent = leetcodeStats.total > 0 ? (leetcodeStats.solved / leetcodeStats.total) * 100 : 0;
  
  // Calculate total certifications count
  const totalCertifications = skillsData.reduce((total, skill) => total + skill.certifications.length, 0);
  
  // Current CGPA (you can update this value as needed)
  const currentCGPA = "8.4";

  return (
    <div className="milestones-grid">
      <div className="milestone-box leetcode-box">
        <div className="milestone-title"><i className="fa-solid fa-code"></i> LeetCode Solved</div>
        <div className="big-number"><span>{leetcodeStats.solved}</span> / <span>{leetcodeStats.total}</span></div>
        <div className="progress-bar"><div id="leetcode-bar" style={{ width: `${leetcodePercent}%` }}></div></div>
        <div className="milestone-comment">Solving one problem at a time 🧠</div>
      </div>
       <div className="milestone-box github-box">
        <div className="milestone-title"><i className="fa-brands fa-github"></i> GitHub Contributions</div>
        <div className="big-number">{githubContributions}</div>
        <div className="milestone-comment">Open-source grind 💻</div>
      </div>
      <div className="milestone-box hacker-box">
        <div className="milestone-title"><i className="fa-brands fa-hackerrank"></i> HackerRank Badges</div>
        <div className="badge-list">{hackerrankBadgesData.map(b => <span key={b} className="badge">{b}</span>)}</div>
        <div className="milestone-comment">Badge collector 🏅</div>
      </div>
      <div className="milestone-box views-box">
        <div className="milestone-title"><i className="fa-solid fa-eye"></i> Portfolio Views</div>
        <div className="big-number">{viewCount}</div>
        <div className="milestone-comment">Growing far and wide! ⏳</div>
      </div>
      <div className="milestone-box cgpa-box">
        <div className="milestone-title"><i className="fa-solid fa-graduation-cap"></i> Current CGPA</div>
        <div className="big-number">{currentCGPA}</div>
        <div className="milestone-comment">Academic excellence 📚</div>
      </div>
      <div className="milestone-box certifications-box">
        <div className="milestone-title"><i className="fa-solid fa-certificate"></i> Certifications</div>
        <div className="big-number">{totalCertifications}</div>
        <div className="milestone-comment">Learning never stops! 🎓</div>
      </div>
    </div>
  );
};

// Skills Component
const Skills = () => (
  <div className="skills-grid">
    {skillsData.map(skill => (
      <div key={skill.skill} className="skill-cert-card">
        <div className="skill-cert-title">{skill.skill}</div>
        {skill.certifications.map(cert => (
          <div key={cert.name} className="certification-entry">
            <span><img src={cert.logo} alt="" className="cert-logo" /> {cert.name}</span>
            <a href={cert.link} target="_blank" rel="noopener noreferrer"><button>View</button></a>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// Hackathons Component
const Hackathons = () => {
  const [selectedImages, setSelectedImages] = useState({});

  const handleImageSelect = (hackathonIndex, imageIndex) => {
    setSelectedImages(prev => ({
      ...prev,
      [hackathonIndex]: imageIndex
    }));
  };

  return (
    <div className="events-grid">
      {hackathonsData.map((hackathon, index) => {
        const selectedImageIndex = selectedImages[index] ?? 0;
        const selectedImage = hackathon.photos[selectedImageIndex];

        return (
          <div key={index} className="event-card">
            <div className="event-image-container">
              <img 
                src={selectedImage} 
                alt={`${hackathon.title} - Image ${selectedImageIndex + 1}`}
                className="event-image"
              />
              {hackathon.photos.length > 1 && (
                <div className="image-gallery">
                  {hackathon.photos.map((photo, photoIndex) => (
                    <img
                      key={photoIndex}
                      src={photo}
                      alt={`${hackathon.title} thumbnail ${photoIndex + 1}`}
                      className={`gallery-thumb ${selectedImageIndex === photoIndex ? 'active' : ''}`}
                      onClick={() => handleImageSelect(index, photoIndex)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="event-content">
              <div className="event-title">{hackathon.title}</div>
              <div className="event-details">
                <div><strong>Type:</strong> {hackathon.type}</div>
                <div><strong>Venue:</strong> {hackathon.venue}</div>
                <div><strong>Team:</strong> {hackathon.team}</div>
                <div><strong>Project:</strong> {hackathon.project}</div>
              </div>
              <div className="event-achievement">{hackathon.achievement}</div>
              <div className="event-description">
                <strong>Features:</strong>
                <ul className="event-list">
                  {hackathon.description.map((feature, featureIndex) => (
                    <li key={featureIndex}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};


function EventsPage({ viewCount }) {
  const [activeTab, setActiveTab] = useState('milestones');

  return (
    <div className="page active" id="events">
      <div className="about-tabs">
        <button className={`about-tab ${activeTab === 'milestones' ? 'active' : ''}`} onClick={() => setActiveTab('milestones')}>milestones</button>
        <button className={`about-tab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>skills & certificates</button>
        <button className={`about-tab ${activeTab === 'hackathons' ? 'active' : ''}`} onClick={() => setActiveTab('hackathons')}>hackathons</button>
      </div>
      <div className="about-content">
        {activeTab === 'milestones' && <Milestones viewCount={viewCount} />}
        {activeTab === 'skills' && <Skills />}
        {activeTab === 'hackathons' && <Hackathons />}
      </div>
    </div>
  );
}

export default EventsPage;