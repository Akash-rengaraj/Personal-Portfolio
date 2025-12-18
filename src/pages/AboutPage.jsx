import React, { useState } from 'react';

// Component for the "Personal" tab content
const PersonalInfo = () => (
    <>
        <div className="code-line"><span className="line-number">1</span><span className="code-text"><span className="keyword">const</span> NAME = <span className="string">'Akash'</span></span></div>
        <div className="code-line"><span className="line-number">2</span><span className="code-text"><span className="keyword">const</span> ALIAS = <span className="string">'Arjun'</span></span></div>
        <div className="code-line"><span className="line-number">3</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">4</span><span className="code-text"><span className="keyword">let</span> location = <span className="string">'Coimbatore, India'</span></span></div>
        <div className="code-line"><span className="line-number">5</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">6</span><span className="code-text"><span className="keyword">const</span> hobbies = [</span></div>
        <div className="code-line"><span className="line-number">7</span><span className="code-text">    <span className="string">'Poetry'</span>,</span></div>
        <div className="code-line"><span className="line-number">8</span><span className="code-text">    <span className="string">'Programming'</span>,</span></div>
        <div className="code-line"><span className="line-number">9</span><span className="code-text">    <span className="string">'Reading'</span>,</span></div>
        <div className="code-line"><span className="line-number">10</span><span className="code-text">    <span className="string">'Drawing'</span>,</span></div>
        <div className="code-line"><span className="line-number">11</span><span className="code-text">    <span className="string">'Music'</span>,</span></div>
        <div className="code-line"><span className="line-number">12</span><span className="code-text">    <span className="string">'Walking'</span></span></div>
        <div className="code-line"><span className="line-number">13</span><span className="code-text">]</span></div>
        <div className="code-line"><span className="line-number">14</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">15</span><span className="code-text"><span className="keyword">let</span> skills = [</span></div>
        <div className="code-line"><span className="line-number">16</span><span className="code-text">    <span className="string">'JavaScript'</span>,</span></div>
        <div className="code-line"><span className="line-number">17</span><span className="code-text">    <span className="string">'React'</span>,</span></div>
        <div className="code-line"><span className="line-number">18</span><span className="code-text">    <span className="string">'Node.js'</span>,</span></div>
        <div className="code-line"><span className="line-number">19</span><span className="code-text">    <span className="string">'Python'</span>,</span></div>
        <div className="code-line"><span className="line-number">20</span><span className="code-text">    <span className="string">'AWS'</span></span></div>
        <div className="code-line"><span className="line-number">21</span><span className="code-text">]</span></div>
        <div className="code-line"><span className="line-number">22</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">23</span><span className="code-text"><span className="keyword">const</span> questions = &#123;</span></div>
        <div className="code-line"><span className="line-number">24</span><span className="code-text">    philosophical: [</span></div>
        <div className="code-line"><span className="line-number">25</span><span className="code-text">        <span className="string">'Can AI truly be creative, or does it just remix existing patterns?'</span>,</span></div>
        <div className="code-line"><span className="line-number">26</span><span className="code-text">        <span className="string">'Is code more like art or engineering?'</span>,</span></div>
        <div className="code-line"><span className="line-number">27</span><span className="code-text">        <span className="string">'What happens when machines can write better code than humans?'</span></span></div>
        <div className="code-line"><span className="line-number">28</span><span className="code-text">    ],</span></div>
        <div className="code-line"><span className="line-number">29</span><span className="code-text">    technical: [</span></div>
        <div className="code-line"><span className="line-number">30</span><span className="code-text">        <span className="string">'Why do we still use JavaScript?'</span>,</span></div>
        <div className="code-line"><span className="line-number">31</span><span className="code-text">        <span className="string">'Is TypeScript the future or just a bandaid?'</span>,</span></div>
        <div className="code-line"><span className="line-number">32</span><span className="code-text">        <span className="string">'Will quantum computing make current encryption obsolete?'</span></span></div>
        <div className="code-line"><span className="line-number">33</span><span className="code-text">    ],</span></div>
        <div className="code-line"><span className="line-number">34</span><span className="code-text">    personal: [</span></div>
        <div className="code-line"><span className="line-number">35</span><span className="code-text">        <span className="string">'What if we could download skills like in The Matrix?'</span>,</span></div>
        <div className="code-line"><span className="line-number">36</span><span className="code-text">        <span className="string">'Is programming the closest thing to having superpowers?'</span>,</span></div>
        <div className="code-line"><span className="line-number">37</span><span className="code-text">        <span className="string">'Do developers dream in code?'</span></span></div>
        <div className="code-line"><span className="line-number">38</span><span className="code-text">    ]</span></div>
        <div className="code-line"><span className="line-number">39</span><span className="code-text">&#125;</span></div>
    </>
);

// Component for the "Gear" tab content
const GearInfo = () => (
    <>
        <div className="code-line"><span className="line-number">1</span><span className="code-text"><span className="keyword">const</span> battleStation = &#123;</span></div>
        <div className="code-line"><span className="line-number">2</span><span className="code-text">    machine: &#123;</span></div>
        <div className="code-line"><span className="line-number">3</span><span className="code-text">        model: <span className="string">'Lenovo IdeaPad Gaming 3 16IAH7'</span>,</span></div>
        <div className="code-line"><span className="line-number">4</span><span className="code-text">        cpu: <span className="string">'12th Gen Intel Core i7'</span>,</span></div>
        <div className="code-line"><span className="line-number">5</span><span className="code-text">        gpu: <span className="string">'NVIDIA RTX 3050Ti'</span>,</span></div>
        <div className="code-line"><span className="line-number">6</span><span className="code-text">        display: <span className="string">'16" WQHD+ (2560x1600)'</span>,</span></div>
        <div className="code-line"><span className="line-number">7</span><span className="code-text">        memory: <span className="string">'16GB DDR4'</span></span></div>
        <div className="code-line"><span className="line-number">8</span><span className="code-text">    &#125;,</span></div>
        <div className="code-line"><span className="line-number">9</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">10</span><span className="code-text">    operatingSystems: [</span></div>
        <div className="code-line"><span className="line-number">11</span><span className="code-text">        &#123;</span></div>
        <div className="code-line"><span className="line-number">12</span><span className="code-text">            primary: <span className="string">'Windows 11'</span>,</span></div>
        <div className="code-line"><span className="line-number">13</span><span className="code-text">            purpose: <span className="string">'Development & Daily Driver'</span></span></div>
        <div className="code-line"><span className="line-number">14</span><span className="code-text">        &#125;,</span></div>
        <div className="code-line"><span className="line-number">15</span><span className="code-text">        &#123;</span></div>
        <div className="code-line"><span className="line-number">16</span><span className="code-text">            secondary: <span className="string">'Kali Linux'</span>,</span></div>
        <div className="code-line"><span className="line-number">17</span><span className="code-text">            purpose: <span className="string">'Cybersecurity & Pentesting'</span></span></div>
        <div className="code-line"><span className="line-number">18</span><span className="code-text">        &#125;</span></div>
        <div className="code-line"><span className="line-number">19</span><span className="code-text">    ],</span></div>
        <div className="code-line"><span className="line-number">20</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">21</span><span className="code-text">    devTools: &#123;</span></div>
        <div className="code-line"><span className="line-number">22</span><span className="code-text">        aiPowered: [</span></div>
        <div className="code-line"><span className="line-number">23</span><span className="code-text">            <span className="string">'Cursor AI'</span>,</span></div>
        <div className="code-line"><span className="line-number">24</span><span className="code-text">            <span className="string">'ChatGPT'</span>,</span></div>
        <div className="code-line"><span className="line-number">25</span><span className="code-text">            <span className="string">'Grok.ai'</span></span></div>
        <div className="code-line"><span className="line-number">26</span><span className="code-text">        ],</span></div>
        <div className="code-line"><span className="line-number">27</span><span className="code-text">        editors: [</span></div>
        <div className="code-line"><span className="line-number">28</span><span className="code-text">            <span className="string">'VS Code'</span>,</span></div>
        <div className="code-line"><span className="line-number">29</span><span className="code-text">            <span className="string">'PyCharm'</span></span></div>
        <div className="code-line"><span className="line-number">30</span><span className="code-text">        ],</span></div>
        <div className="code-line"><span className="line-number">31</span><span className="code-text">        browsers: [</span></div>
        <div className="code-line"><span className="line-number">32</span><span className="code-text">            <span className="string">'Brave'</span>,</span></div>
        <div className="code-line"><span className="line-number">33</span><span className="code-text">            <span className="string">'Chrome'</span></span></div>
        <div className="code-line"><span className="line-number">34</span><span className="code-text">        ],</span></div>
        <div className="code-line"><span className="line-number">35</span><span className="code-text">        development: [</span></div>
        <div className="code-line"><span className="line-number">36</span><span className="code-text">            <span className="string">'GitHub'</span>,</span></div>
        <div className="code-line"><span className="line-number">37</span><span className="code-text">            <span className="string">'XAMPP'</span></span></div>
        <div className="code-line"><span className="line-number">38</span><span className="code-text">        ]</span></div>
        <div className="code-line"><span className="line-number">39</span><span className="code-text">    &#125;</span></div>
        <div className="code-line"><span className="line-number">40</span><span className="code-text">&#125;</span></div>
    </>
);

// Component for the "Work" tab content
const WorkInfo = () => (
    <>
        <div className="code-line"><span className="line-number">1</span><span className="code-text"><span className="keyword">const</span> currentStatus = &#123;</span></div>
        <div className="code-line"><span className="line-number">2</span><span className="code-text">    education: &#123;</span></div>
        <div className="code-line"><span className="line-number">3</span><span className="code-text">        degree: <span className="string">'B.Tech Artificial Intelligence and Data Science'</span>,</span></div>
        <div className="code-line"><span className="line-number">4</span><span className="code-text">        institution: <span className="string">'Sri Krishna College of Engineering and Technology'</span>,</span></div>
        <div className="code-line"><span className="line-number">5</span><span className="code-text">        period: <span className="string">'2024 - 2028'</span>,</span></div>
        <div className="code-line"><span className="line-number">6</span><span className="code-text">        status: <span className="string">'Pursuing'</span></span></div>
        <div className="code-line"><span className="line-number">7</span><span className="code-text">    &#125;,</span></div>
        <div className="code-line"><span className="line-number">8</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">9</span><span className="code-text">    interests: [</span></div>
        <div className="code-line"><span className="line-number">10</span><span className="code-text">        <span className="string">'Artificial Intelligence'</span>,</span></div>
        <div className="code-line"><span className="line-number">11</span><span className="code-text">        <span className="string">'Data Science'</span>,</span></div>
        <div className="code-line"><span className="line-number">12</span><span className="code-text">        <span className="string">'Full Stack Development'</span>,</span></div>
        <div className="code-line"><span className="line-number">13</span><span className="code-text">        <span className="string">'Cybersecurity'</span></span></div>
        <div className="code-line"><span className="line-number">14</span><span className="code-text">    ],</span></div>
        <div className="code-line"><span className="line-number">15</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">16</span><span className="code-text">    aspirations: &#123;</span></div>
        <div className="code-line"><span className="line-number">17</span><span className="code-text">        shortTerm: [</span></div>
        <div className="code-line"><span className="line-number">18</span><span className="code-text">            <span className="string">'Build innovative AI-powered applications'</span>,</span></div>
        <div className="code-line"><span className="line-number">19</span><span className="code-text">            <span className="string">'Contribute to open-source projects'</span>,</span></div>
        <div className="code-line"><span className="line-number">20</span><span className="code-text">            <span className="string">'Master full-stack development'</span></span></div>
        <div className="code-line"><span className="line-number">21</span><span className="code-text">        ],</span></div>
        <div className="code-line"><span className="line-number">22</span><span className="code-text">        longTerm: [</span></div>
        <div className="code-line"><span className="line-number">23</span><span className="code-text">            <span className="string">'Become an AI/ML expert'</span>,</span></div>
        <div className="code-line"><span className="line-number">24</span><span className="code-text">            <span className="string">'Create impactful tech solutions'</span>,</span></div>
        <div className="code-line"><span className="line-number">25</span><span className="code-text">            <span className="string">'Lead innovative tech projects'</span></span></div>
        <div className="code-line"><span className="line-number">26</span><span className="code-text">        ]</span></div>
        <div className="code-line"><span className="line-number">27</span><span className="code-text">    &#125;,</span></div>
        <div className="code-line"><span className="line-number">28</span><span className="code-text"></span></div>
        <div className="code-line"><span className="line-number">29</span><span className="code-text">    status: &#123;</span></div>
        <div className="code-line"><span className="line-number">30</span><span className="code-text">        current: <span className="string">'Student Developer'</span>,</span></div>
        <div className="code-line"><span className="line-number">31</span><span className="code-text">        openTo: [</span></div>
        <div className="code-line"><span className="line-number">32</span><span className="code-text">            <span className="string">'Internships'</span>,</span></div>
        <div className="code-line"><span className="line-number">33</span><span className="code-text">            <span className="string">'Collaborative Projects'</span>,</span></div>
        <div className="code-line"><span className="line-number">34</span><span className="code-text">            <span className="string">'Learning Opportunities'</span></span></div>
        <div className="code-line"><span className="line-number">35</span><span className="code-text">        ]</span></div>
        <div className="code-line"><span className="line-number">36</span><span className="code-text">    &#125;</span></div>
        <div className="code-line"><span className="line-number">37</span><span className="code-text">&#125;</span></div>
    </>
);


// The main component that manages the tabs
function AboutPage() {
  // This 'state' remembers which tab is currently active.
  const [activeTab, setActiveTab] = useState('personal');

  // This function decides which content to show based on the active tab.
  const renderContent = () => {
    switch (activeTab) {
      case 'gear':
        return <GearInfo />;
      case 'work':
        return <WorkInfo />;
      case 'personal':
      default:
        return <PersonalInfo />;
    }
  };

  return (
    <div className="page active" id="about">
      {/* These are the tab buttons. Clicking one changes the state. */}
      <div className="about-tabs">
        <button
          className={`about-tab ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          personal
        </button>
        <button
          className={`about-tab ${activeTab === 'gear' ? 'active' : ''}`}
          onClick={() => setActiveTab('gear')}
        >
          gear
        </button>
        <button
          className={`about-tab ${activeTab === 'work' ? 'active' : ''}`}
          onClick={() => setActiveTab('work')}
        >
          work
        </button>
      </div>

      {/* This is where the content for the active tab is rendered. */}
      <div className="about-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default AboutPage;