import React from 'react';
import { skillsData } from '../data/skills';

const AboutPage = () => {
    return (
        <div className="page active about-container" id="about">
            <div className="about-wrapper animate-fade-in">
                
                {/* Header Section */}
                <header className="about-header">
                    <div className="ascii-face">
                        <pre>{`    .--.
   |o_o |
   |:_/ |   < Akash Rengaraj >
  //   \\ \\  < Full Stack Developer >
 (|     | )
/'\\_   _/\`\\
\\___)=(___/`}</pre>
                    </div>
                    <div className="header-info">
                        <h1>Akash Rengaraj</h1>
                        <p className="subtitle">Student Developer & Tech Enthusiast</p>
                        <div className="meta-info">
                            <span><span className="location-icon">📍</span> Coimbatore, IN</span>
                            <span><span className="status-icon">🟢</span> Open to collaborating</span>
                        </div>
                    </div>
                </header>

                <hr className="divider" />

                {/* Bio Section */}
                <section className="about-section">
                    <h2 className="section-title">
                        <span className="prompt">root@akash:~$</span> cat bio.txt
                    </h2>
                    <div className="section-content">
                        <p>
                            I am a self-taught Full Stack Developer with a strong passion for building efficient, scalable, and user-friendly web applications. 
                            Currently pursuing my <strong>B.Tech in AI & Data Science</strong>, I love bridging the gap between innovative AI technologies and practical software solutions.
                        </p>
                        <p>
                            My journey is driven by curiosity—whether it's debugging a complex backend issue, crafting pixel-perfect UIs, or exploring the latest in cybersecurity.
                        </p>
                    </div>
                </section>

                {/* Education Section */}
                <section className="about-section">
                    <h2 className="section-title">
                        <span className="prompt">root@akash:~$</span> history | grep education
                    </h2>
                    <div className="timeline">
                        <div className="timeline-item">
                            <div className="timeline-marker"></div>
                            <div className="timeline-content">
                                <h3 className="timeline-title">B.Tech - Artificial Intelligence & Data Science</h3>
                                <p className="timeline-date">2024 - Present</p>
                                <p className="timeline-desc">
                                    Kathir College of Engineering, Coimbatore.
                                    <br/>Current CGPA: <strong>8.8</strong> (approx)
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Skills Section */}
                <section className="about-section">
                    <h2 className="section-title">
                        <span className="prompt">root@akash:~$</span> ls -R ./skills
                    </h2>
                    <div className="skills-layout-grid">
                        {skillsData.map((category, index) => (
                            <div key={index} className="skill-category-card">
                                <h3 className="category-header">./{category.skill.toLowerCase().replace(/ /g, '_')}</h3>
                                <div className="skill-tags">
                                    {category.certifications.map((cert, cIdx) => (
                                        <div key={cIdx} className="skill-badge" title={cert.name}>
                                            <img src={cert.logo} alt="" className="skill-icon" onError={(e) => e.target.style.display='none'} />
                                            <span>{cert.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Certifications (Just a succinct list since they are in skills) */}
                <section className="about-section">
                    <h2 className="section-title">
                        <span className="prompt">root@akash:~$</span> check_updates --security
                    </h2>
                    <div className="security-badges">
                        <div className="security-item">
                            <span className="sec-icon">🛡️</span>
                            <span>Google Cybersecurity Professional</span>
                        </div>
                        <div className="security-item">
                             <span className="sec-icon">☁️</span>
                             <span>IBM AI Fundamentals</span>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default AboutPage;