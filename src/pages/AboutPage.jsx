import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { skillsData } from '../data/skills';

const EYES = ['o_o', '^_^', '-_-', 'o_o', 'o_o', 'o_o', '>_<', 'o_o'];

function AsciiAvatar() {
  const [eyeIdx, setEyeIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setEyeIdx(i => (i + 1) % EYES.length);
    }, 1800);
    return () => clearInterval(t);
  }, []);
  const eyes = EYES[eyeIdx];
  return (
    <div className="ascii-face">
      <pre>{`    .--.
   |${eyes} |
   |:_/ |   < Akash Rengaraj >
  //   \\ \\  < AI & Full-Stack Dev >
 (|     | )
/'\\_   _/\`\\
\\___)=(___/`}</pre>
    </div>
  );
}

const AboutPage = () => {
    return (
        <>
            <Helmet>
                <title>About — Akash Rengaraj</title>
                <meta name="description" content="2nd-year B.Tech AI & Data Science student at Kathir College. Full-stack developer, IoT enthusiast, HackIndia 2025 Top 10 Finalist." />
                <meta property="og:title" content="About Akash Rengaraj" />
                <meta property="og:description" content="Full-stack developer & AI student. HackIndia 2025 Top 10 Finalist. Available for internship." />
                <meta property="og:image" content="https://www.akashr.dev/screenshots/about-dark.png" />
            </Helmet>
            <div className="page active about-container" id="about">
                <div className="about-wrapper animate-fade-in">

                    {/* Header */}
                    <header className="about-header">
                        <AsciiAvatar />
                        <div className="header-info">
                            <h1>Akash Rengaraj</h1>
                            <p className="subtitle">AI & Data Science Student | Full-Stack + IoT + Security Developer</p>
                            <div className="meta-info">
                                <span><span className="location-icon">📍</span> Coimbatore, IN</span>
                                <span><span className="status-icon">🟢</span> Open to internship — available immediately</span>
                            </div>
                        </div>
                    </header>

                    <hr className="divider" />

                    {/* Bio */}
                    <section className="about-section reveal">
                        <h2 className="section-title">
                            <span className="prompt">root@akash:~$</span> cat bio.txt
                        </h2>
                        <div className="section-content">
                            <p>
                                I'm a 3rd-year (2024 - 2028 Batch) <strong>B.Tech AI & Data Science</strong> student at Sri Krishna College of Engineering and Technology, Coimbatore,
                                and a self-taught full-stack developer who builds products end-to-end — from database schema to pixel-perfect UI.
                                I led a four-person team to the <strong>Top 10 at HackIndia 2025</strong> with a real-time AI traffic management system.
                                I run the AI & Data Science department club and have shipped 4 complete projects independently.
                            </p>
                            <p>
                                My focus areas are full-stack web development, IoT systems, and cybersecurity — backed by a
                                Google Cybersecurity Professional certificate and hands-on Arduino/Raspberry Pi projects.
                                I'm curious by nature, driven by real problems, and always looking for the next thing to build.
                            </p>
                        </div>
                    </section>

                    {/* Currently Learning */}
                    <section className="about-section reveal">
                        <h2 className="section-title">
                            <span className="prompt">root@akash:~$</span> cat currently_learning.txt
                        </h2>
                        <div className="section-content currently-learning">
                            <div className="learning-item">
                                <span className="learning-icon">⚡</span>
                                <span>Non Linear Data Structures</span>
                            </div>
                            <div className="learning-item">
                                <span className="learning-icon">🤖</span>
                                <span>ML from Stratch again - Forgetting everything and learning ML from stratch 
                                </span>
                            </div>
                            <div className="learning-item">
                                <span className="learning-icon">🔌</span>
                                <span>Agentic AI & Automations - gaining hands on experience on agentic AI worflow
                                     and AI automations</span>
                            </div>
                        </div>
                    </section>

                    {/* What I'm Looking For */}
                    <section className="about-section reveal">
                        <h2 className="section-title">
                            <span className="prompt">root@akash:~$</span> cat ideal_internship.txt
                        </h2>
                        <div className="section-content currently-learning">
                            <div className="learning-item">
                                <span className="learning-icon">✅</span>
                                <span>A team building real products where I own features, not just fix bugs</span>
                            </div>
                            <div className="learning-item">
                                <span className="learning-icon">✅</span>
                                <span>Full-stack, IoT, AI/ML, or security role — I cross borders</span>
                            </div>
                            <div className="learning-item">
                                <span className="learning-icon">✅</span>
                                <span>Coimbatore-based or remote — available immediately, open to ₹7,500+ stipend</span>
                            </div>
                        </div>
                    </section>

                    {/* Education */}
                    <section className="about-section reveal">
                        <h2 className="section-title">
                            <span className="prompt">root@akash:~$</span> history | grep education
                        </h2>
                        <div className="timeline">
                            <div className="timeline-item">
                                <div className="timeline-marker"></div>
                                <div className="timeline-content">
                                    <h3 className="timeline-title">Higher Secondary Education</h3>
                                    <p className="timeline-date">2009 – 2024</p>
                                    <p className="timeline-desc">
                                        Sri Krishna College of Engineering and Technology, Coimbatore.<br />
                                        10th grade percentage: <strong>89.8%</strong><br />
                                        12th grade percentage: <strong>90.5%</strong><br />
                                    </p>
                                </div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-marker"></div>
                                <div className="timeline-content">
                                    <h3 className="timeline-title">B.Tech — Artificial Intelligence & Data Science</h3>
                                    <p className="timeline-date">2024 – 2028</p>
                                    <p className="timeline-desc">
                                        Sri Krishna College of Engineering and Technology, Coimbatore.<br />
                                        Current CGPA(1st to 4th semester): <strong>8.32</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Skills */}
                    <section className="about-section reveal">
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
                                                <img src={cert.logo} alt="" className="skill-icon" onError={e => e.target.style.display='none'} />
                                                <span>{cert.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Security & Certs */}
                    <section className="about-section reveal">
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

                    {/* Beyond Code */}
                    <section className="about-section reveal">
                        <h2 className="section-title">
                            <span className="prompt">root@akash:~$</span> cat hobbies.txt
                        </h2>
                        <div className="section-content">
                            <p>
                                Beyond code: Guitar, Singing, Travelling, Drawing, Poetry, 3d designing, RC IOT stuffs whenever possible.
                                I believe the best developers are people first — curiosity doesn't stop at the terminal.
                            </p>
                        </div>
                    </section>

                </div>
            </div>
        </>
    );
};

export default AboutPage;
