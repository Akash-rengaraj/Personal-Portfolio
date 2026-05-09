import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TerminalBot from '../components/TerminalBot';

function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>404 — akashr.dev</title>
      </Helmet>
      <div className="page active not-found-page" id="404">
        <div className="not-found-content">
          <div className="not-found-terminal">
            <p className="not-found-line">
              <span className="prompt">root@akash:~$</span> cd /that-page
            </p>
            <p className="not-found-error">
              bash: cd: that-page: No such file or directory
            </p>
            <p className="not-found-line not-found-paths-header">[ AVAILABLE PATHS ]</p>
            <div className="not-found-paths">
              <Link to="/">  /&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;home</Link>
              <Link to="/about">  /about&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;about</Link>
              <Link to="/projects">  /projects&nbsp;&nbsp;work</Link>
              <Link to="/contact">  /contact&nbsp;&nbsp;&nbsp;reach out</Link>
            </div>
            <Link to="/" className="not-found-home-btn">[ → take me home ]</Link>
          </div>
        </div>
        <TerminalBot initialMood="DIZZY" />
      </div>
    </>
  );
}

export default NotFoundPage;
