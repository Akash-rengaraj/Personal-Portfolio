import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { skillsData } from '../data/skills';

function ResumeViewPage() {
  return (
    <>
      <Helmet>
        <title>Resume — Akash Rengaraj</title>
        <meta name="description" content="Akash Rengaraj resume — AI & Data Science student, full-stack developer." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="resume-view-page">
        <div className="resume-toolbar no-print">
          <Link to="/" className="resume-back">← back to portfolio</Link>
          <button className="resume-print-btn" onClick={() => window.print()}>
            [ ⎙ print / save PDF ]
          </button>
        </div>

        <div className="resume-document">
          <header className="rv-header">
            <div>
              <h1 className="rv-name">Akash Rengaraj</h1>
              <p className="rv-title">AI & Data Science Student | Full-Stack + IoT + Security Developer</p>
            </div>
            <div className="rv-contact">
              <span>akashrengaraj2007@gmail.com</span>
              <span>+91 93453 86706</span>
              <span>Coimbatore, Tamil Nadu</span>
              <span>akashr.dev</span>
              <span>github.com/Akash-rengaraj</span>
            </div>
          </header>

          <hr className="rv-divider" />

          <section className="rv-section">
            <h2 className="rv-section-title">Summary</h2>
            <p className="rv-body">
              2nd-year B.Tech AI & Data Science student at Kathir College of Engineering.
              Full-stack developer who builds products end-to-end — from database schema to pixel-perfect UI.
              Led a four-person team to the Top 10 at HackIndia 2025 with a real-time AI traffic management system.
              Available for internship immediately. Open to full-stack, IoT, AI/ML, or security roles.
            </p>
          </section>

          <section className="rv-section">
            <h2 className="rv-section-title">Education</h2>
            <div className="rv-edu-item">
              <div className="rv-edu-main">
                <strong>B.Tech — Artificial Intelligence & Data Science</strong>
                <span className="rv-date">2024 – Present</span>
              </div>
              <div className="rv-edu-sub">Kathir College of Engineering, Coimbatore &nbsp;|&nbsp; CGPA: 8.2</div>
            </div>
          </section>

          <section className="rv-section">
            <h2 className="rv-section-title">Projects</h2>
            <div className="rv-project-item">
              <div className="rv-proj-header">
                <strong>Full-Stack Jewellery E-Commerce</strong>
                <span className="rv-proj-tech">React · TypeScript · Node.js · Express · MongoDB · JWT</span>
              </div>
              <p className="rv-body">Production-grade e-commerce platform with JWT auth, admin dashboard, and GSAP product showcase. Built solo end-to-end.</p>
            </div>
            <div className="rv-project-item">
              <div className="rv-proj-header">
                <strong>Get Up — Student Productivity App</strong>
                <span className="rv-proj-tech">Flutter · Hive · fl_chart</span>
              </div>
              <p className="rv-body">Offline-first Flutter app combining habit tracking, smart attendance (Bunk-o-Meter), and budget management. 6-week solo build.</p>
            </div>
            <div className="rv-project-item">
              <div className="rv-proj-header">
                <strong>Millora Ice Cream Brand Site</strong>
                <span className="rv-proj-tech">React 19 · TypeScript · Framer Motion · Lenis</span>
              </div>
              <p className="rv-body">Premium frontend with 60fps Lenis scroll, Framer Motion animations, and persistent cart context. Lighthouse 94+.</p>
            </div>
            <div className="rv-project-item">
              <div className="rv-proj-header">
                <strong>Terminal Portfolio — akashr.dev</strong>
                <span className="rv-proj-tech">React 19 · Vite · Firebase · react-router-dom</span>
              </div>
              <p className="rv-body">Interactive portfolio with terminal emulator (20+ commands), ASCII bot, live visitor counter, and 6+ easter eggs.</p>
            </div>
          </section>

          <section className="rv-section">
            <h2 className="rv-section-title">Achievements</h2>
            <div className="rv-achievement">
              <strong>HackIndia 2025 Spark 2 — Top 10 Finalist</strong>
              <span className="rv-date">2025</span>
              <p className="rv-body">Led 4-person team building a real-time AI traffic management system with CCTV congestion analysis, accident detection, and smart routing.</p>
            </div>
          </section>

          <section className="rv-section">
            <h2 className="rv-section-title">Skills</h2>
            <div className="rv-skills-grid">
              {skillsData.map(cat => (
                <div key={cat.skill} className="rv-skill-group">
                  <div className="rv-skill-cat">{cat.skill}</div>
                  <div className="rv-skill-tags">
                    {cat.certifications.map(c => (
                      <span key={c.name} className="rv-skill-tag">{c.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rv-section">
            <h2 className="rv-section-title">Certifications</h2>
            <ul className="rv-cert-list">
              <li>Google Cybersecurity Professional Certificate — Coursera</li>
              <li>IBM AI Fundamentals — IBM</li>
            </ul>
          </section>

          <section className="rv-section">
            <h2 className="rv-section-title">Leadership</h2>
            <p className="rv-body">President, AI & Data Science Department Club — Kathir College of Engineering (2024–present). Organizes workshops, hackathon prep sessions, and guest lecture series.</p>
          </section>
        </div>
      </div>
    </>
  );
}

export default ResumeViewPage;
