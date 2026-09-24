import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { posts, formatDate } from '../data/blog';
import { profile } from '../data/profile';

function BlogPostPage() {
  const { slug } = useParams();
  const index = posts.findIndex(p => p.slug === slug);
  const post = posts[index];
  const scrollRef = useRef(null);

  // posts are local, trusted markdown files, so rendering their HTML is safe

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return (
      <div className="page active pj-page">
        <div className="pj-scroll bl-missing">
          <p className="output-error">cat: {slug}.md: No such file or directory</p>
          <Link to="/blog" className="pj-link pj-link-primary">← back to the devlog</Link>
        </div>
      </div>
    );
  }

  const newer = posts[index - 1];
  const older = posts[index + 1];

  return (
    <>
      <Helmet>
        <title>{`${post.title} — Akash Rengaraj`}</title>
        <meta name="description" content={post.summary} />
      </Helmet>

      <div className="page active pj-page bl-page" id="blog-post">
        <div className="pj-scroll" ref={scrollRef}>
          <article className="bl-article">
            <Link to="/blog" className="bl-back">← devlog</Link>
            <header className="bl-article-head">
              <div className="bl-meta">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span aria-hidden="true">·</span>
                <span>{post.minutes} min read</span>
                <span aria-hidden="true">·</span>
                <span>by {profile.name}</span>
              </div>
              <h1 className="bl-article-title">{post.title}</h1>
              <p className="bl-article-summary">{post.summary}</p>
              <div className="bl-tags-inline">
                {post.tags.map(t => <span key={t} className="pj-tag">#{t}</span>)}
              </div>
            </header>

            <div className="bl-prose" dangerouslySetInnerHTML={{ __html: post.html }} />

            {post.project && (
              <Link to={`/projects/${post.project}`} className="bl-project-link">
                <span className="bl-project-kicker">related project</span>
                <span>see the full case study →</span>
              </Link>
            )}

            <nav className="bl-pager" aria-label="More posts">
              {older ? (
                <Link to={`/blog/${older.slug}`} className="bl-pager-link">
                  <span className="bl-pager-dir">← older</span>
                  <span>{older.title}</span>
                </Link>
              ) : <span />}
              {newer ? (
                <Link to={`/blog/${newer.slug}`} className="bl-pager-link is-next">
                  <span className="bl-pager-dir">newer →</span>
                  <span>{newer.title}</span>
                </Link>
              ) : <span />}
            </nav>
          </article>
        </div>
      </div>
    </>
  );
}

export default BlogPostPage;
