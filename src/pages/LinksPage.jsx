import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

const socialLinks = [
    { platform: "GitHub", user: "@Akash-rengaraj", icon: "fab fa-github", url: "https://github.com/Akash-rengaraj", color: "github" },
    { platform: "LinkedIn", user: "Akash R", icon: "fab fa-linkedin", url: "https://www.linkedin.com/in/akash-rengaraj-b45177355", color: "linkedin" },
    { platform: "X (Twitter)", user: "@akash_020160", icon: "fab fa-x-twitter", url: "https://x.com/akash_020160", color: "twitter" },
    { platform: "Facebook", user: "Akash R", icon: "fab fa-facebook", url: "https://www.facebook.com/share/19HkrngpYe/", color: "facebook" },
    { platform: "Reddit", user: "u/akash_020160", icon: "fab fa-reddit", url: "https://www.reddit.com/user/akash_020160/", color: "reddit" },
];

const contactLinks = [
    { type: "Email", value: "akashrengaraj2007@gmail.com", icon: "fas fa-envelope", url: "mailto:akashrengaraj2007@gmail.com", color: "email" },
    { type: "Discord", value: "akash_rengaraj", icon: "fab fa-discord", url: "https://discord.com/users/1281218820421320768", color: "discord" },
    { type: "Phone", value: "+91 93453 86706", icon: "fas fa-phone", url: "tel:+919345386706", color: "phone" },
];

// Replace YOUR_FORM_ID after creating a free Formspree form at formspree.io
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('sent');
        setForm({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="contact-form-success">
        <span className="success-icon">✓</span>
        <span>Message received. I'll reply within 24 hours.</span>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <label className="form-label" htmlFor="cf-name">
          <span className="form-prompt">$</span> your name
        </label>
        <input
          id="cf-name"
          name="name"
          className="form-input"
          type="text"
          value={form.name}
          onChange={handleChange}
          placeholder="John Doe"
          required
          autoComplete="name"
        />
      </div>
      <div className="form-row">
        <label className="form-label" htmlFor="cf-email">
          <span className="form-prompt">$</span> your email
        </label>
        <input
          id="cf-email"
          name="email"
          className="form-input"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@company.com"
          required
          autoComplete="email"
        />
      </div>
      <div className="form-row">
        <label className="form-label" htmlFor="cf-message">
          <span className="form-prompt">$</span> message
        </label>
        <textarea
          id="cf-message"
          name="message"
          className="form-input form-textarea"
          value={form.message}
          onChange={handleChange}
          placeholder="Hi Akash, we're looking for a full-stack intern..."
          required
          rows={4}
        />
      </div>
      {status === 'error' && (
        <div className="form-error">send failed — try emailing directly instead.</div>
      )}
      <button
        type="submit"
        className="form-submit"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? '[ sending... ]' : '[ → send message ]'}
      </button>
    </form>
  );
}

function OpenToWorkBadge() {
  return (
    <div className="open-to-work-banner">
      <span className="otw-dot" />
      <span className="otw-text">
        <strong>Open to work</strong> — available for internship immediately.
        Coimbatore-based or remote. ₹7,500+ stipend.
      </span>
    </div>
  );
}

function LinksPage() {
  return (
    <>
      <Helmet>
        <title>Contact — Akash Rengaraj</title>
        <meta name="description" content="Get in touch with Akash Rengaraj. Available for internships immediately." />
        <meta property="og:title" content="Contact Akash Rengaraj" />
      </Helmet>
      <div className="page active" id="links">
        <div className="links-container">

          <OpenToWorkBadge />

          <div className="links-section">
            <div className="terminal-header-text">&gt; Connect_With_Me.exe</div>
            <div className="links-grid">
              {socialLinks.map(link => (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={`social-card ${link.color}`} key={link.platform}>
                  <div className="card-content">
                    <i className={link.icon}></i>
                    <span className="platform-name">{link.platform}</span>
                    <span className="username">{link.user}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="links-section">
            <div className="terminal-header-text">&gt; Contact_Information.sh</div>
            <div className="links-grid">
              {contactLinks.map(link => (
                <a
                  href={link.url}
                  target={link.type === 'Email' || link.type === 'Phone' ? '_self' : '_blank'}
                  rel={link.type === 'Email' || link.type === 'Phone' ? '' : 'noopener noreferrer'}
                  className={`social-card ${link.color}`}
                  key={link.type}
                >
                  <div className="card-content">
                    <i className={link.icon}></i>
                    <span className="platform-name">{link.type}</span>
                    <span className="username">{link.value}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="links-section">
            <div className="terminal-header-text">&gt; Send_Message.sh</div>
            <ContactForm />
          </div>

        </div>
      </div>
    </>
  );
}

export default LinksPage;
