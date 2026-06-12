import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

function ResumeViewPage() {
  return (
    <>
      <Helmet>
        <title>Resume — Akash Rengaraj</title>
        <meta name="description" content="Akash Rengaraj resume — AI & Data Science student, full-stack developer." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#323639', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: '#323639', borderBottom: '1px solid #202124' }}>
          <Link to="/" style={{ color: '#e8eaed', textDecoration: 'none', fontFamily: '"Fira Code", monospace', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#00ffff'} onMouseLeave={(e) => e.target.style.color = '#e8eaed'}>
            ← back to portfolio
          </Link>
          <a href="/Akash_Rengaraj_Resume.pdf" download="Akash_Rengaraj_Resume.pdf" style={{ color: '#e8eaed', textDecoration: 'none', fontFamily: '"Fira Code", monospace', fontSize: '0.9rem', backgroundColor: '#424649', padding: '8px 16px', borderRadius: '4px', border: '1px solid #5f6368', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.target.style.backgroundColor = '#525659'; e.target.style.borderColor = '#00ffff'; e.target.style.color = '#00ffff'; }} onMouseLeave={(e) => { e.target.style.backgroundColor = '#424649'; e.target.style.borderColor = '#5f6368'; e.target.style.color = '#e8eaed'; }}>
            [ ↓ download PDF ]
          </a>
        </div>

        <div style={{ flex: 1, width: '100%', height: '100%', padding: 0, margin: 0 }}>
          <iframe 
            className="resume-pdf-iframe"
            src="/Akash_Rengaraj_Resume.pdf#view=FitH" 
            style={{ height: '100%', border: 'none', display: 'block' }}
            title="Resume PDF"
          />
        </div>
      </div>
    </>
  );
}

export default ResumeViewPage;
