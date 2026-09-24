import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

const EMAIL = 'akashrengaraj2007@gmail.com';
const RESUME_URL = '/Akash_Rengaraj_Resume.pdf';

// Create a free form at formspree.io and paste its ID here; until then the form opens the visitor's mail app.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';
const FORMSPREE_READY = !FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID');

const LINKS = [
  { name: 'LinkedIn', icon: 'fab fa-linkedin-in', url: 'https://www.linkedin.com/in/akash-rengaraj-b45177355' },
  { name: 'GitHub', icon: 'fab fa-github', url: 'https://github.com/Akash-rengaraj' },
  { name: 'X', icon: 'fab fa-x-twitter', url: 'https://x.com/akash_020160' },
  { name: 'Discord', icon: 'fab fa-discord', url: 'https://discord.com/users/1281218820421320768' },
];

const EMPTY_FORM = { name: '', email: '', message: '', company: '' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns a map of field → error message for the contact form. */
function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'tell me who you are';
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'that email looks off';
  if (form.message.trim().length < 10) errors.message = 'a few more words (10+ chars)';
  return errors;
}

/** Current time in Coimbatore, refreshed every 30s. */
function useIstTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** The email as a terminal command — copy it, or open the mail app. */
function MailCommand() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  return (
    <div className={`ct2-mail ${copied ? 'is-copied' : ''}`}>
      <span className="ct2-mail-prompt" aria-hidden="true">$ mail</span>
      <span className="ct2-mail-addr">{EMAIL}</span>
      <div className="ct2-mail-actions">
        <button type="button" className="ct2-mail-btn" onClick={copy} aria-label="Copy email address">
          <i className={copied ? 'fas fa-check' : 'far fa-copy'} aria-hidden="true" />
          <span aria-live="polite">{copied ? 'copied' : 'copy'}</span>
        </button>
        <a className="ct2-mail-btn ct2-mail-open" href={`mailto:${EMAIL}`}>
          <i className="fas fa-paper-plane" aria-hidden="true" />
          <span>write</span>
        </a>
      </div>
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  const update = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.company) return; // honeypot: only bots fill the hidden field

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const subject = `Hello from ${form.name.trim()}`;

    if (!FORMSPREE_READY) {
      const body = `${form.message.trim()}\n\n— ${form.name.trim()} (${form.email.trim()})`;
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus('sent');
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), subject, message: form.message.trim() }),
      });
      if (!res.ok) throw new Error(`formspree ${res.status}`);
      setStatus('sent');
      setForm(EMPTY_FORM);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="ct2-sent" role="status">
        <i className="fas fa-circle-check" aria-hidden="true" />
        <div>
          <strong>{FORMSPREE_READY ? 'Message sent.' : 'Draft opened in your mail app.'}</strong>
          <p>{FORMSPREE_READY ? "Thanks — I'll reply within a day." : 'Hit send there and it lands in my inbox.'}</p>
        </div>
      </div>
    );
  }

  return (
    <form className="ct2-form" onSubmit={handleSubmit} noValidate>
      <div className="ct2-row">
        <Field name="name" label="Name" value={form.name} error={errors.name} onChange={update} autoComplete="name" placeholder="Your name" />
        <Field name="email" label="Email" type="email" value={form.email} error={errors.email} onChange={update} autoComplete="email" placeholder="you@company.com" />
      </div>
      <Field name="message" label="Message" multiline value={form.message} error={errors.message} onChange={update} placeholder="What are you building, and where do I fit in?" />
      <input className="ct-honeypot" name="company" value={form.company} onChange={update} tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {status === 'error' && <p className="ct2-error">Couldn't send — email me directly at {EMAIL}.</p>}
      <button type="submit" className="ct2-send" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'}
        <i className="fas fa-arrow-right" aria-hidden="true" />
      </button>
    </form>
  );
}

function Field({ name, label, error, multiline, ...props }) {
  const id = `ct2-${name}`;
  return (
    <label className={`ct2-field ${error ? 'has-error' : ''}`} htmlFor={id}>
      <span className="ct2-label">
        {label}
        {error && <span className="ct2-field-error">{error}</span>}
      </span>
      {multiline
        ? <textarea id={id} name={name} rows={4} aria-invalid={!!error} {...props} />
        : <input id={id} name={name} type={props.type || 'text'} aria-invalid={!!error} {...props} />}
    </label>
  );
}

function LinksPage() {
  const ist = useIstTime();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Contact — Akash Rengaraj</title>
        <meta name="description" content="Get in touch with Akash Rengaraj — available for internships immediately. Coimbatore or remote." />
        <meta property="og:title" content="Contact Akash Rengaraj" />
      </Helmet>

      <div className="page active ct-page" id="links">
        <div className="ct-scroll">
          <div className="ct2">
            <div className="ct2-beacon" aria-hidden="true">
              <span /><span /><span />
            </div>

            <p className="ct2-status">
              <span className="ct2-dot" aria-hidden="true" />
              available for internships
              <span className="ct2-time">
                <span className="ct2-sep" aria-hidden="true">·</span>
                {ist} in Coimbatore
              </span>
            </p>

            <h1 className="ct2-h1">Let's build something <span className="ct2-accent">real</span>.</h1>
            <p className="ct2-sub">
              Full-stack, AI/ML, IoT or security — if you're shipping it, I'd love to help. I reply within a day.
            </p>

            <MailCommand />

            <nav className="ct2-links" aria-label="Profiles">
              {LINKS.map(link => (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="ct2-tile" aria-label={link.name}>
                  <i className={link.icon} aria-hidden="true" />
                  <span className="ct2-tile-label">{link.name}</span>
                </a>
              ))}
              <a href={RESUME_URL} download className="ct2-tile ct2-tile-resume" aria-label="Download resume">
                <i className="fas fa-file-arrow-down" aria-hidden="true" />
                <span className="ct2-tile-label">Resume</span>
              </a>
            </nav>

            <div className={`ct2-compose ${formOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="ct2-toggle"
                onClick={() => setFormOpen(o => !o)}
                aria-expanded={formOpen}
                aria-controls="ct2-form-panel"
              >
                {formOpen ? 'hide the form' : 'or leave a message here'}
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              <div id="ct2-form-panel" className="ct2-panel" hidden={!formOpen}>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LinksPage;
