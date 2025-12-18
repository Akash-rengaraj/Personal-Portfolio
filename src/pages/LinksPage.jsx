import React from 'react';

const socialLinks = [
    { platform: "GitHub", user: "@Akash-rengaraj", icon: "fab fa-github", url: "https://github.com/Akash-rengaraj", color: "github" },
    { platform: "LinkedIn", user: "Akash R", icon: "fab fa-linkedin", url: "https://www.linkedin.com/in/akash-rengaraj-b45177355", color: "linkedin" },
    { platform: "X (Twitter)", user: "@akash_rengaraj", icon: "fab fa-x-twitter", url: "https://x.com/akash_020160", color: "twitter" },
    { platform: "Facebook", user: "Akash R", icon: "fab fa-facebook", url: "https://www.facebook.com/share/19HkrngpYe/", color: "facebook" },
    { platform: "Reddit", user: "u/akash_020160", icon: "fab fa-reddit", url: "https://www.reddit.com/user/akash_020160/", color: "reddit" },
];

const contactLinks = [
    { type: "Email", value: "akashrengaraj2007@gmail.com", icon: "fas fa-envelope", url: "mailto:akashrengaraj2007@gmail.com", color: "email" },
    { type: "Discord", value: "akash_rengaraj", icon: "fab fa-discord", url: "https://discord.com/users/1281218820421320768", color: "discord" },
    { type: "Phone", value: "+91 93453 86706", icon: "fas fa-phone", url: "tel:+919345386706", color: "phone" },
];

function LinksPage() {
  return (
    <div className="page active" id="links">
      <div className="links-container">
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
      </div>
    </div>
  );
}

export default LinksPage;