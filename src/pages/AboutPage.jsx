import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { skillsData, techStack } from '../data/skills';
import { projectsData } from '../data/projects';
import { profile, CGPA_TEXT } from '../data/profile';

const EYES = ['o_o', '^_^', '-_-', 'o_o', 'o_o', 'o_o', '>_<', 'o_o'];

const SECTIONS = [
  { id: 'bio', file: 'bio.md' },
  { id: 'now', file: 'now.log' },
  { id: 'looking-for', file: 'looking_for.txt' },
  { id: 'journey', file: 'journey.log' },
  { id: 'stack', file: 'stack/' },
  { id: 'certs', file: 'certs/' },
  { id: 'beyond', file: 'beyond_code.txt' },
];

const NEOFETCH = [
  ['user', 'akash@rengaraj'],
  ['role', 'AI & Data Science student · full-stack dev'],
  ['edu', 'B.Tech AI&DS — SKCET, Coimbatore'],
  ['uptime', '3rd year (2024 – 2028 batch)'],
  ['cgpa', `${CGPA_TEXT} (current)`],
  ['club', `${profile.clubRole} — ${profile.club}`],
  ['shipped', `${projectsData.length} projects, solo`],
  ['focus', 'full-stack · AI agents · IoT · security'],
  ['location', 'Coimbatore, IN · open to remote'],
  ['status', 'open to internships — available now'],
];

const NOW_LOG = [
  { tag: 'learning', text: 'Non-linear data structures — trees, graphs, heaps' },
  { tag: 'relearning', text: 'Machine learning from scratch — unlearning shortcuts, rebuilding fundamentals' },
  { tag: 'building', text: 'Agentic AI workflows & automations — hands-on with multi-agent systems' },
];

const LOOKING_FOR = [
  'A team shipping real products, where I own features end-to-end — not just fix bugs',
  'Full-stack, AI/ML, IoT or security work — I like crossing those borders',
  'Coimbatore-based or remote · available immediately · ₹7,500+ stipend',
];

const JOURNEY = [
  {
    hash: 'a7f3c21',
    head: true,
    when: 'now',
    title: `${profile.clubRole}, ${profile.club}`,
    body: 'Leading the technical side of the college Data Science club — sessions, events and hands-on builds for members.',
  },
  {
    hash: '5d0e9b4',
    when: '2025',
    title: 'HackIndia 2025 (Spark 2) — Top 10 Finalist',
    body: 'Led a four-person team building a real-time AI traffic management system: congestion monitoring, CCTV vehicle counting, accident detection and SOS alerts.',
  },
  {
    hash: '3c81f02',
    when: '2024 – 2028',
    title: 'B.Tech, Artificial Intelligence & Data Science',
    body: `${profile.college}, ${profile.city} · CGPA ${CGPA_TEXT}.`,
  },
  {
    hash: '0b4e7aa',
    when: '— 2024',
    title: 'Higher secondary education',
    body: `${profile.school} · Class 10: ${profile.class10} · Class 12: ${profile.class12}.`,
  },
];

const HOBBIES = ['🎸 guitar', '🎤 singing', '✈️ travelling', '✏️ drawing', '📝 poetry', '🧊 3D design', '📡 RC & IoT tinkering'];

/** Animated ASCII portrait used as the neofetch logo. */
function AsciiAvatar() {
  const [eyeIdx, setEyeIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setEyeIdx(i => (i + 1) % EYES.length), 1800);
    return () => clearInterval(t);
  }, []);

  const eyes = EYES[eyeIdx];
  return (
    <pre className="ab-avatar" aria-hidden="true">{`    .--.
   |${eyes} |
   |:_/ |
  //   \\ \\
 (|     | )
/'\\_   _/\`\\
\\___)=(___/`}</pre>
  );
}

function SectionTitle({ command }) {
  return (
    <h2 className="ab-title">
      <span className="ab-title-prompt">akash@about:~$</span> {command}
    </h2>
  );
}

const AboutPage = () => {
  const [active, setActive] = useState(SECTIONS[0].id);
  const scrollRef = useRef(null);

  // Highlight the file-tree entry for the section currently in view
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: '0px 0px -60% 0px', threshold: 0 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = root.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jumpTo = (id) => {
    const root = scrollRef.current;
    const el = root?.querySelector(`#${id}`);
    if (!el) return;
    root.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
  };

  const certCount = skillsData.reduce((t, s) => t + s.certifications.length, 0);

  return (
    <>
      <Helmet>
        <title>About — Akash Rengaraj</title>
        <meta name="description" content="3rd-year B.Tech AI & Data Science student at SKCET, Coimbatore. Full-stack developer, IoT tinkerer, HackIndia 2025 Top 10 Finalist." />
        <meta property="og:title" content="About Akash Rengaraj" />
        <meta property="og:description" content="Full-stack developer & AI student. HackIndia 2025 Top 10 Finalist. Available for internship." />
        <meta property="og:image" content="https://www.akashr.dev/screenshots/about-dark.png" />
      </Helmet>

      <div className="page active ab-page" id="about">
        <div className="ab-layout">
          <nav className="ab-tree" aria-label="About sections">
            <div className="ab-tree-root">~/about</div>
            <ul>
              {SECTIONS.map(({ id, file }, i) => (
                <li key={id}>
                  <button
                    type="button"
                    className={`ab-tree-item ${active === id ? 'is-active' : ''}`}
                    onClick={() => jumpTo(id)}
                    aria-current={active === id ? 'true' : undefined}
                  >
                    <span className="ab-tree-branch" aria-hidden="true">{i === SECTIONS.length - 1 ? '└──' : '├──'}</span>
                    {file}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ab-scroll" ref={scrollRef}>
            {/* neofetch header */}
            <header className="ab-neofetch">
              <div className="ab-neofetch-cmd">
                <span className="ab-title-prompt">akash@about:~$</span> neofetch
              </div>
              <div className="ab-neofetch-body">
                <AsciiAvatar />
                <div className="ab-neofetch-info">
                  <h1 className="ab-name">Akash Rengaraj</h1>
                  <div className="ab-rule" aria-hidden="true" />
                  <dl className="ab-facts">
                    {NEOFETCH.map(([k, v]) => (
                      <div key={k} className="ab-fact">
                        <dt>{k}</dt>
                        <dd className={k === 'status' ? 'is-ok' : ''}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="ab-swatches" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, i) => <span key={i} className={`ab-swatch s${i}`} />)}
                  </div>
                </div>
              </div>
            </header>

            <section id="bio" className="ab-section reveal">
              <SectionTitle command="cat bio.md" />
              <div className="ab-prose">
                <p>
                  I'm a <strong>3rd-year B.Tech AI &amp; Data Science</strong> student at Sri Krishna College of
                  Engineering and Technology, Coimbatore, and a self-taught full-stack developer who builds products
                  end-to-end — from database schema to pixel-perfect UI.
                </p>
                <p>
                  I led a four-person team to the <strong>Top 10 at HackIndia 2025</strong> with a real-time AI traffic
                  management system, I'm the <strong>Tech Leader of the college Data Science club</strong>, and I've shipped{' '}
                  <strong>{projectsData.length} projects</strong> independently — from a multi-agent security auditor to an
                  AR room scanner.
                </p>
                <p>
                  My focus areas are full-stack web development, AI agents, IoT systems and cybersecurity — backed by a
                  Google Cybersecurity certificate and hands-on Arduino / Raspberry Pi builds. Curious by nature, driven
                  by real problems, always looking for the next thing to build.
                </p>
              </div>
            </section>

            <section id="now" className="ab-section reveal">
              <SectionTitle command="tail -f now.log" />
              <ul className="ab-log">
                {NOW_LOG.map(({ tag, text }) => (
                  <li key={tag} className="ab-log-row">
                    <span className={`ab-log-tag tag-${tag}`}>[{tag}]</span>
                    <span>{text}</span>
                  </li>
                ))}
                <li className="ab-log-row ab-log-live" aria-hidden="true">
                  <span className="ab-log-tag">[tail]</span>
                  <span>waiting for new entries<span className="ab-dots" /></span>
                </li>
              </ul>
            </section>

            <section id="looking-for" className="ab-section reveal">
              <SectionTitle command="cat looking_for.txt" />
              <ul className="ab-checklist">
                {LOOKING_FOR.map(item => (
                  <li key={item}>
                    <span className="ab-check" aria-hidden="true">[✓]</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section id="journey" className="ab-section reveal">
              <SectionTitle command="git log --graph journey" />
              <ol className="ab-gitlog">
                {JOURNEY.map(({ hash, head, when, title, body }) => (
                  <li key={hash} className="ab-commit">
                    <span className="ab-commit-node" aria-hidden="true" />
                    <div className="ab-commit-meta">
                      <span className="ab-hash">{hash}</span>
                      {head && <span className="ab-head">HEAD → main</span>}
                      <span className="ab-when">{when}</span>
                    </div>
                    <div className="ab-commit-title">{title}</div>
                    <p className="ab-commit-body">{body}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section id="stack" className="ab-section reveal">
              <SectionTitle command="ls ./stack" />
              <div className="ab-stack">
                {techStack.map(({ group, items }) => (
                  <div key={group} className="ab-stack-group">
                    <div className="ab-stack-dir">{group}/</div>
                    <div className="ab-chips">
                      {items.map(item => <span key={item} className="ab-chip">{item}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="certs" className="ab-section reveal">
              <SectionTitle command={`ls ./certs  # ${certCount} files`} />
              <div className="ab-certs">
                {skillsData.map(({ skill, certifications }) => (
                  <div key={skill} className="ab-cert-group">
                    <div className="ab-stack-dir">{skill.toLowerCase().replace(/ /g, '_')}/</div>
                    {certifications.map(cert => (
                      <a key={cert.name} className="ab-cert" href={cert.link} target="_blank" rel="noopener noreferrer">
                        <img src={cert.logo} alt="" className="ab-cert-logo" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                        <span className="ab-cert-name">{cert.name}</span>
                        <span className="ab-cert-open" aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section id="beyond" className="ab-section reveal">
              <SectionTitle command="cat beyond_code.txt" />
              <div className="ab-chips ab-hobbies">
                {HOBBIES.map(h => <span key={h} className="ab-chip">{h}</span>)}
              </div>
              <p className="ab-prose ab-signoff">
                The best developers are people first — curiosity doesn't stop at the terminal.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutPage;
