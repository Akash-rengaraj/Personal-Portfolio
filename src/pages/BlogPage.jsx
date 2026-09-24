import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { posts, allTags, formatDate } from '../data/blog';

const ALL = 'all';

function BlogPage() {
  const [tag, setTag] = useState(ALL);
  const visible = tag === ALL ? posts : posts.filter(p => p.tags.includes(tag));

  return (
    <>
      <Helmet>
        <title>Devlog — Akash Rengaraj</title>
        <meta name="description" content="Build notes and write-ups by Akash Rengaraj: multi-agent AI, AR capture, React performance and more." />
        <link rel="canonical" href="https://www.akashr.dev/blog" />
        <meta property="og:title" content="Devlog — Akash Rengaraj" />
        <meta property="og:url" content="https://www.akashr.dev/blog" />
      </Helmet>

      <div className="page active pj-page bl-page" id="blog">
        <div className="pj-scroll">
          <header className="bl-header">
            <div className="pj-cmd"><span className="pj-prompt">akash@blog:~$</span> ls -t ./devlog</div>
            <h1 className="pj-h1">Devlog</h1>
            <p className="bl-lede">Notes from the things I build — what worked, what didn't, and the small tricks in between.</p>
            <div className="pj-tabs bl-tags" role="tablist" aria-label="Filter posts by tag">
              {[ALL, ...allTags].map(t => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tag === t}
                  className={`pj-tab ${tag === t ? 'is-active' : ''}`}
                  onClick={() => setTag(t)}
                >
                  {t === ALL ? 'all' : `#${t}`}
                </button>
              ))}
            </div>
          </header>

          <ol className="bl-list">
            {visible.map((post, i) => (
              <li key={post.slug}>
                <Link to={`/blog/${post.slug}`} className={`bl-card ${i === 0 && tag === ALL ? 'is-latest' : ''}`}>
                  <div className="bl-meta">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span aria-hidden="true">·</span>
                    <span>{post.minutes} min read</span>
                    {i === 0 && tag === ALL && <span className="bl-new">latest</span>}
                  </div>
                  <h2 className="bl-title">{post.title}</h2>
                  <p className="bl-summary">{post.summary}</p>
                  <div className="bl-foot">
                    <div className="bl-tags-inline">
                      {post.tags.map(t => <span key={t} className="pj-tag">#{t}</span>)}
                    </div>
                    <span className="bl-read">read <span aria-hidden="true">→</span></span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

export default BlogPage;
