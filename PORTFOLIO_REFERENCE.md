# Akash Rengaraj — Portfolio Website: Complete Reference

> This document is a pixel-accurate, interaction-accurate, content-accurate reference for the portfolio at **www.akashr.dev**. It exists because the site is a client-side React SPA with no server-side rendering, so web crawlers and AI assistants cannot see its content by fetching the URL. Every micro-detail is documented here so that any analysis, audit, or improvement can be done purely from this file.

---

## 1. Identity & Purpose

| Field | Value |
|---|---|
| Owner | Akash Rengaraj |
| Live URL | https://www.akashr.dev |
| Purpose | Personal portfolio — showcase projects, skills, education, certifications, hackathons, and contact info |
| Audience | Recruiters, collaborators, developers |
| Status phrase | "Open to collaborating" |
| Email | akashrengaraj2007@gmail.com |
| Phone | +91 93453 86706 |
| Location | Coimbatore, Tamil Nadu, India |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19.1.1 |
| Build tool | Vite 7.1.3 |
| Language | Plain JavaScript (JSX) — no TypeScript |
| Styling | Single 3,200+ line `src/index.css` — pure CSS with CSS variables, no Tailwind, no CSS modules |
| Font | Fira Code (Google Fonts CDN) + Courier New, monospace as fallback |
| Icons | Font Awesome 6.5.1 (CDN) |
| Database | Firebase Realtime Database v12.1.0 (page view counter only) |
| Routing | Custom state-based — `activePage` string in `App.jsx`, no URL changes, no react-router-dom |
| Deployment | Vercel |
| Package name | akashr.one-react (legacy; domain is now akashr.dev) |

---

## 3. Visual Design System

### 3.1 Color Palette

#### Dark Mode (default)
| Variable | Hex | Usage |
|---|---|---|
| `--bg-body` | `#040404` | Page background |
| `--bg-terminal` | `#050505` | Terminal body background |
| `--text-primary` | `#f5f5f5` | Main text, headings |
| `--text-accent` | `#a0a0a0` | Secondary text, borders, accents |
| `--text-dark` | `#f5f5f5` | Text on dark surfaces |
| Terminal bg | `#000000` | The `.terminal` window and `.terminal-content` |
| Terminal header | `#000000` | Top bar |
| Nav bg | `rgba(0,0,0,0.85)` | Bottom navigation bar |
| Accent cyan | `#00ffff` | Hover states, links, GitHub button hover, feature list markers |
| Accent green | `#00cc66` | Security badge border (left stripe) |
| Bot green | `#00ff00` | TerminalBot default color (IDLE mood) |

#### Light Mode (toggled via hanging bulb)
| Variable | Hex | Usage |
|---|---|---|
| Body background | `linear-gradient(rgba(136,136,136,0.95), rgba(128,128,128,0.97))` | Full-page grey gradient |
| `--bg-body` | `#888888` | Page background reference |
| `--bg-terminal` | `#aaaaaa` | Terminal body |
| `--text-primary` | `#1a1a1a` | Main text (near black) |
| `--text-accent` | `#3a3a3a` | Secondary text (dark grey) |
| `--text-dark` | `#2a2a2a` | Text on surfaces |
| Terminal bg | `#aaaaaa` | Terminal window |
| Terminal header | `#999999` | Top bar |
| Nav bg | `rgba(136,136,136,0.95)` | Navigation bar |
| GitHub btn hover | `#0055cc` | Blue (instead of cyan) |

### 3.2 Typography
- **Font family:** `"Fira Code", "Courier New", monospace` — applied globally via `* { font-family: ... }`
- **Character:** Monospace throughout — every element including body text, headings, navigation, code blocks
- **Weights loaded:** 400 (regular), 700 (bold) from Google Fonts
- **Line height:** `1.5` on `body`

### 3.3 Layout Dimensions
| Element | Size |
|---|---|
| Terminal window | `width: 95%`, `max-width: 1400px`, `height: 85vh`, `max-height: 900px` |
| Terminal border radius | `0` (sharp corners — intentional, not macOS-style) |
| Terminal header height | `28px` |
| Terminal shadow | `0 20px 50px rgba(0,0,0,0.5)` |
| Terminal border | `1px solid rgba(255,255,255,0.08)` |
| Terminal content bg | `#000000` |
| Page padding | `1.5rem 1rem` (base), overridden per page |
| About container padding | `2rem` |
| Nav height | ~`32px` (fixed to bottom of `.terminal-content`) |

### 3.4 Window Buttons (Traffic Lights)
- Three squares (`12×12px`, `border-radius: 0` — sharp, not circles)
- Dark mode: `background: #333`, `border: 1px solid #444`
- Light mode: `background: #888888`, `border: 1px solid #777777`
- Hover: slightly lighter background
- **These are purely decorative — they do nothing when clicked**

---

## 4. Overall Layout Architecture

```
<body>                              ← full-page gradient background
  <div id="root">                  ← React mount point, centered flex
    <div class="terminal">         ← the terminal window (95% wide, 85vh tall)
      <div class="terminal-header"> ← 28px top bar: [■ ■ ■]  akashr.one  [💡]
      <div class="terminal-content"> ← flex column, position:relative, grows to fill
        <div class="page active">  ← current page (position:absolute, fills content)
        <nav class="nav">          ← bottom navigation bar (position:absolute, bottom)
        <div class="stats">        ← eye-tracking face widget (bottom-right)
```

**Key architectural fact:** All pages share the same DOM mount point. Only one page is shown at a time via `opacity: 1 / visibility: visible`. The transition between pages uses `opacity + transform` CSS transitions (0.5s cubic-bezier).

**Page switching animation:**
- Hidden state: `opacity: 0; visibility: hidden; transform: translateY(30px) scale(0.95)`
- Active state: `opacity: 1; visibility: visible; transform: translateY(0) scale(1)`
- Transition: `0.5s cubic-bezier(0.4, 0, 0.2, 1)`

---

## 5. Terminal Header Bar

**Location:** Top of the terminal window, always visible, never scrolls.

**Left side:** Three square window buttons (decorative only)
- Square 1 | Square 2 | Square 3 (all dark grey, no close/minimize/maximize functionality)

**Center:** Text `akashr.one` — monospace, white, 0.85rem, `letter-spacing: 1px`, lowercase

**Right side:** Theme toggle (hanging light bulb component)

### Theme Toggle (Hanging Bulb)
- Rendered by `ThemeToggle.jsx`
- Visually: a small bulb (`.bulb`) + hanging chain (`.chain`) in the top-right of the header
- Has CSS animations: `hangingBulb`, `pullChain`, `swingBulb`
- **Clicking it:** Calls `toggleTheme()` in `App.jsx` → sets `document.body.className` to `"light-mode"` or `""` → CSS variables cascade to every element
- In light mode: the body gets class `light-mode` and all `body.light-mode .xxx` overrides apply globally

---

## 6. Navigation Bar

**Location:** Absolute-positioned at the bottom of `.terminal-content`. Always visible regardless of which page is active.

**Rendered by:** `Navigation.jsx`

**Links (left to right):**

| Label | Behavior | Target |
|---|---|---|
| `tmux` | External link | `https://github.com/Akash-rengaraj` (opens in new tab) |
| `home` | Internal nav | Sets `activePage = 'home'` |
| `about` | Internal nav | Sets `activePage = 'about'` |
| `resume` | External link | `/Akash_Resume.pdf` (opens in new tab) |
| `projects` | Internal nav | Sets `activePage = 'projects'` |
| `honor` | Internal nav | Sets `activePage = 'events'` (the Events page is labeled "honor" in nav) |
| `links & contacts` | Internal nav | Sets `activePage = 'links'` |

**Active state styling:**
- Active link gets class `active`
- All nav links: `color: var(--text-accent)`, monospace font, small size
- Active + hover: slightly highlighted background

**Internal nav click behavior:** `e.preventDefault()` + `onNavigate(page)` — no URL change, pure state update

---

## 7. StatsWidget (Eye-Tracking Face)

**Location:** Absolute-positioned in bottom-right corner of `.terminal-content`. Always visible on all pages.

**Visual anatomy:**
```
  ( O  O )     ← two eyes (`.eye` divs each containing `.pupil`)
  (  ___  )    ← smile arc (`.smile`)
 Welcome Devs! ← text label (`.stats-message`)
```

**Interaction behavior:**
- **Mouse/touch move:** Pupils track the cursor globally using `Math.atan2()`. Max pupil displacement: `4px` from center.
- **Mouse leave window / touch end:** Pupils reset to center `translate(-50%, -50%)`
- Touch events supported (uses `e.touches[0].clientX/Y`)

**Dark mode:** Eyes: dark background with subtle border. Pupils: slightly lighter.
**Light mode:** Eyes: `#bbbbbb` background, `rgba(0,0,0,0.2)` border. Pupils: `#2b2b2b` (dark). Smile: `#2b2b2b`.

---

## 8. Page: Home

**Route:** `activePage === 'home'` (default/landing page)

**Content layout:** Centered vertically and horizontally within the terminal content area.

### 8.1 ASCII Art Banner
Large block-letter name at the top:
```
 █████╗ ██╗  ██╗ █████╗ ███████╗██╗  ██╗    ██████╗ 
██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║  ██║    ██╔══██╗
███████║█████╔╝ ███████║███████╗███████║    ██████╔╝
██╔══██║██╔═██╗ ██╔══██║╚════██║██╔══██║    ██╔══██╗
██║  ██║██║  ██╗██║  ██║███████║██║  ██║    ██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝
```
This spells "AKASH R" in Unicode box-drawing block characters.
- Class: `.ascii-art` (rendered in `<pre>` tag)
- Dark mode: `color: var(--text-primary)` (#f5f5f5, near white)
- Light mode: `color: #2b2b2b`

### 8.2 Typewriter Component
Two lines of text below the ASCII art with a CSS-animated typewriter effect:

**Line 1:** `Self taught fullstack developer`
**Line 2:** `love to learn new things everyday and I'm always looking for new challenges to tackle :)`

- Class on wrapper: `.tagline`
- Each line: `.typewriter` + `.first-line` / `.second-line`
- Lines type out sequentially via CSS `@keyframes` (not JavaScript)
- Cursor blinks at end of each line briefly before line 2 starts
- `role="presentation"` (no screen reader semantics)
- Light mode: `color: #555555`

### 8.3 TerminalBot (Interactive ASCII Bot)
The star of the home page. A fully autonomous, interactive ASCII art robot.

**Visual representation (rendered as DOM text):**
```
        |          ← antenna (`.antenna`)
   [ o_o ]         ← eyes showing current mood (`.eyes`)
    /|\            ← body (`.bot-body`)
    / \            ← legs (`.bot-legs`, animated walk cycle)
```

**Position:** `position: absolute` inside `.page`. Starts near center-bottom of the page.

**Mood system — 6 moods (change eye display and color):**
| Mood | Eyes | Color |
|---|---|---|
| IDLE | `[ o_o ]` | `#00ff00` (green) |
| HAPPY | `[ ^_^ ]` | `#00ffff` (cyan) |
| ANNOYED | `[ >_< ]` | `#ff9900` (orange) |
| SURPRISED | `[ O_O ]` | `#ff00ff` (magenta) |
| DIZZY | `[ @_@ ]` | `#ff3333` (red) |
| DANCE | `[ ~_~ ]` | `#ffff00` (yellow) |

**Speech bubble (`.bot-bubble`):** Appears above the bot with the current phrase. Border and text color match the current mood color.

**Autonomous behaviors:**
- **Wandering:** Every 20ms interval, bot moves toward a randomly chosen target point at `MOVEMENT_SPEED = 2px` per tick. New target chosen with 3% probability each tick when bot is idle.
- **Walk animation:** 4-frame leg cycle (`/ \` → `| \` → `| |` → `/ |`) at 100ms per frame using `Date.now() % 4`
- **Talking:** Every 5000ms, 60% chance to say a random idle phrase. 20% of those chances trigger a dance instead.
- **Initial greeting:** 500ms after mount: `"Welcome to my terminal! Feel free to look around."` in HAPPY mood for 5000ms.

**Idle phrases:**
- "Compiling thoughts..."
- "Scanning for merge conflicts..."
- "Does this simpler code max memory?"
- "I dream of electronic sheep."
- "Pro tip: Refreshing fixes everything."
- "Waiting for input..."
- "System status: groovy."

**User interactions:**
| Interaction | Bot response | Mood | Phrase pool |
|---|---|---|---|
| **Hover** | Bot FLEES — picks a random target point far from current pos | SURPRISED | "Whoa! Personal space protocol initiated!", "I'm not a tooltip!", "You found the easter egg (me).", "Don't debug me, bro.", "My hitbox is sensitive." |
| **Click** | Stays in place, shows annoyed message | ANNOYED | "Ouch! That was a pointer event.", "Console.log('Ouch')", "Do I look like a button?", "Stop propagation!", "Event listener triggered." |
| **Mouse down (drag start)** | Bot says "Whoa!", goes SURPRISED | SURPRISED | — |
| **Drag** | Bot goes DIZZY, legs dangle as `/ \` | DIZZY | "Weeeee! I'm flying!", "Recalculating coordinates...", "Is this a drag-and-drop interface?", "Setting absolute position...", "Help! I'm being refactored!" |
| **Drop (mouse up)** | Bot returns to IDLE, says a drag phrase | IDLE | (drag phrases) |
| **Double-click** | Triggers 5-second dance mode | DANCE | "Look at me go!", "Raving in the DOM!", "CSS animations are fun.", "Boop beep boop!", "Party mode: ACTIVATED." |

**Dance mode:** `isDancing = true`, mood = DANCE, class `dancing` added to bot, autonomous wandering paused for 5 seconds.

**Direction:** Bot faces right by default. Faces left (`.facing-left` class via CSS `transform: scaleX(-1)`) when moving left.

**Boundary constraints:** Bot stays within `(0, 0)` to `(containerWidth - 40, containerHeight - 120)` — the bottom 120px is reserved to prevent overlap with nav bar.

**Cursor:** `grab` when idle, `grabbing` when dragging.

**z-index:** 50

---

## 9. Page: About

**Route:** `activePage === 'about'`

**Container class:** `.page.active.about-container` — overrides `.page`'s center-align with `justify-content: flex-start; align-items: stretch` so content starts from top.

**Scroll behavior:** `overflow-y: auto` with thin scrollbar in accent color. Max width `1000px`, centered.

**Enter animation:** `.animate-fade-in` — `opacity: 0; transform: translateY(10px)` → `opacity: 1; transform: translateY(0)` over `0.4s ease-out`.

### 9.1 Header Section (`.about-header`)
Flex row, wraps on mobile. Contains:

**Left: ASCII Face art**
```
    .--.
   |o_o |
   |:_/ |   < Akash Rengaraj >
  //   \ \  < Full Stack Developer >
 (|     | )
/'\_   _/`\
\___)=(___/
```
- Color: `var(--text-accent)` (grey in dark, dark-grey in light)
- Font size: `0.8rem`, bold, line-height `1.2`

**Right: Header info**
- **Name:** `Akash Rengaraj` — `h1`, 2.5rem (1.8rem on mobile), `color: var(--text-primary)`
- **Subtitle:** `Student Developer & Tech Enthusiast` — 1.2rem, `color: var(--text-accent)`, `opacity: 0.9`
- **Meta info row:**
  - 📍 `Coimbatore, IN`
  - 🟢 `Open to collaborating`
  - Font size: 0.9rem, opacity 0.8

### 9.2 Divider
`<hr class="divider">` — 1px horizontal line:
- Dark mode: `rgba(255,255,255,0.18)`
- Light mode: `rgba(0,0,0,0.18)`

### 9.3 Section Title Style (all sections)
Each section has an `<h2 class="section-title">`:
- **Format:** `<span class="prompt">root@akash:~$</span> [command]`
- Prompt color: `var(--text-accent)` (grey)
- Background: dark `rgba(255,255,255,0.05)` / light `rgba(0,0,0,0.06)`
- `display: block` (full-width background bar)
- `border-radius: 4px`, padding `0.5rem 1rem`
- Font: Fira Code, 1.3rem (1.1rem on mobile)

### 9.4 Bio Section
**Command:** `root@akash:~$ cat bio.txt`

**Content (2 paragraphs):**

> "I am a self-taught Full Stack Developer with a strong passion for building efficient, scalable, and user-friendly web applications. Currently pursuing my B.Tech in AI & Data Science, I love bridging the gap between innovative AI technologies and practical software solutions."

> "My journey is driven by curiosity—whether it's debugging a complex backend issue, crafting pixel-perfect UIs, or exploring the latest in cybersecurity."

- Text color: `rgba(255,255,255,0.9)` dark / `var(--text-dark)` light
- Line height: 1.7, font size 1.05rem
- "B.Tech in AI & Data Science" is `<strong>` (bold)

### 9.5 Education Section
**Command:** `root@akash:~$ history | grep education`

**Timeline layout:** Left border line + dot markers.
- Border: `2px solid rgba(255,255,255,0.25)` dark / `rgba(0,0,0,0.2)` light
- Marker: 12px green circle with glow (`box-shadow: 0 0 10px var(--text-accent)`)

**Single education entry:**
- **Degree:** B.Tech - Artificial Intelligence & Data Science
- **Institution:** Kathir College of Engineering, Coimbatore
- **Period:** 2024 - Present
- **CGPA:** 8.8 (approx) — displayed as bold

### 9.6 Skills Section
**Command:** `root@akash:~$ ls -R ./skills`

**Grid layout:** `repeat(auto-fill, minmax(280px, 1fr))` → single column on mobile.

**5 skill category cards** (`.skill-category-card`):

Each card has:
- Header (`.category-header`): `./category_name` in Fira Code, `color: var(--text-accent)`, with bottom border
- Tags (`.skill-tags`): flex-wrap of `.skill-badge` items
- Each badge: issuer logo (16×16px) + certification name

| Category | Header | Certifications |
|---|---|---|
| Front-end Development | `./front-end_development` | Intro to Front-End Dev (Meta), Programming with JavaScript (Meta), HTML and CSS in depth (Meta), React Basics (Meta) |
| Version Control | `./version_control` | Version Control with Git (Atlassian), Introduction to Git and GitHub (Google), Version Control (Meta) |
| Cybersecurity | `./cybersecurity` | Foundations of Cybersecurity (Google), Play It Safe: Manage Security Risks (Google), Connect and Protect: Networks and Network Security (Google) |
| AI/ML | `./ai/ml` | Introduction to Artificial Intelligence (AI) (IBM) |
| Python | `./python` | The Joy of Computing Using Python (NPTEL) |

**Card hover:** `translateY(-3px)` + border brightens
**Badge hover:** Background brightens
**Light mode:** Cards get `rgba(0,0,0,0.04)` background and `rgba(0,0,0,0.12)` border
**Issuer logos:**
- Meta: `/images/logos/meta_logo.png`
- Google: `/images/logos/goole_logo.png` (note: typo in filename — "goole" not "google")
- Atlassian: `/images/logos/atlassian_logo.webp`
- IBM: `/images/logos/ibm_logo.webp`
- NPTEL: `/images/logos/nptel_logo.png`

### 9.7 Security / Certifications Section
**Command:** `root@akash:~$ check_updates --security`

**Two security badge items** (`.security-item`):
- Left green stripe: `border-left: 3px solid #00cc66`
- Background: `linear-gradient(90deg, rgba(0,200,100,0.12), transparent)`
- Light mode: muted green `rgba(0,130,60,0.1)` background, `#007a38` border

| Icon | Label |
|---|---|
| 🛡️ | Google Cybersecurity Professional |
| ☁️ | IBM AI Fundamentals |

On mobile: badges stack vertically (`flex-direction: column`).

---

## 10. Page: Projects

**Route:** `activePage === 'projects'`

**Layout:** `div.projects-grid` — a vertical list/grid of `ProjectCard` components.

**4 projects total**, each rendered by `ProjectCard.jsx`.

### ProjectCard structure:
```
.project-card
  .project-media
    .project-preview
      <video autoPlay muted loop playsInline> OR <img>
  .project-content-col
    .project-title       ← name
    .project-tech        ← tech tag chips
    .project-description ← HTML content (dangerouslySetInnerHTML)
    .project-footer
      .project-status    ← status badge
      .github-btn        ← GitHub link (SVG icon + "View Code")
```

### 10.1 Project 1: Get Up
- **Title:** "Get Up - An All in one Student's App 🚀"
- **Tech:** Flutter, Hive, fl_chart, confetti, intl
- **Preview:** Video — `/videos/project_disp/get_up_preview.webm` (WebM format)
- **Status:** Completed
- **GitHub:** https://github.com/Akash-rengaraj/get_up.git
- **Description:** Flutter productivity app for students. Features: Daily Planner (habits, To-Do, Focus), Smart Attendance Tracker with "Bunk-o-Meter" algorithm, Finance Manager, Analytics charts. Local-first with Hive storage.

### 10.2 Project 2: Jewellery E-Commerce Website
- **Title:** "Full-Stack Jewellery E-Commerce Website 💎"
- **Tech:** React, TypeScript, Vite, Tailwind CSS, GSAP, Node.js, Express, MongoDB
- **Preview:** Video — `/videos/project_disp/jewellery-shop-website-preview.mp4` (MP4)
- **Status:** Active development
- **GitHub:** https://github.com/Akash-rengaraj/Full-Stack-E-Commerce-jewelery-website
- **Description:** E-commerce platform for handcrafted jewelry ("Sanjana Creations"). React+TS+Vite frontend with GSAP animations, parallax, circular scroll interactions. Node.js+Express+MongoDB backend. JWT+BCrypt auth. Admin dashboard for products/inventory/orders.

### 10.3 Project 3: Icecream Website
- **Title:** "Front-End Focused Icecream Website"
- **Tech:** React 19, TypeScript, Vite, Framer Motion, Lenis, CSS Modules
- **Preview:** Video — `/videos/project_disp/icecream-website-preview.mp4` (MP4)
- **Status:** Completed
- **GitHub:** https://github.com/Akash-rengaraj/Front-End-Icecream-shop-website
- **Description:** Premium ice cream brand website ("Millora"). Lenis smooth scrolling, Framer Motion animations, glassmorphism design, dynamic shopping cart with context + persistent state.

### 10.4 Project 4: Portfolio Website (this site)
- **Title:** "Portfolio Website"
- **Tech:** HTML, CSS, JavaScript (listed — actually React in reality)
- **Preview:** Video — `/videos/project_disp/portfolio-preview.mp4` (MP4)
- **Status:** Active Development
- **GitHub:** https://github.com/Akash-rengaraj/Personal-Portfolio.git
- **Description:** This portfolio itself. Terminal interface, dark/light theme, responsive design, dynamic content, eye-tracking animation.

### GitHub Button
- SVG GitHub octocat icon (18×18px) + "View Code" text
- Hover: border turns `#00ffff`, text turns `#00ffff`, slight lift (`translateY(-2px)`), cyan glow shadow
- Light mode hover: border `#0055cc`, text `#0055cc`, blue glow

---

## 11. Page: Events (Honor)

**Route:** `activePage === 'events'` (nav label: "honor")

**Layout:** Three-tab interface at the top, content below.

### Tabs (`.about-tabs`)
Three buttons:
1. `milestones`
2. `skills & certificates`
3. `hackathons`

**Tab styling:**
- Inactive: `opacity: 0.7`, transparent background, white/dark text
- Active / hover: `opacity: 1`, underline via `::before` pseudo-element that scales from `scaleX(0)` → `scaleX(1)` left-to-right
- Font: Fira Code, 0.85rem

### 11.1 Tab: Milestones

**6 milestone boxes** in a grid (`.milestones-grid`):

**Box 1: LeetCode Solved** (`.leetcode-box`)
- Icon: `fa-solid fa-code`
- Displays: `{solved} / {total}` fetched live from LeetCode API
- Progress bar below the number showing solved percentage
- Comment: "Solving one problem at a time 🧠"
- API: `https://leetcode-cors-proxy.vercel.app/api/leetcode?username=Akash_Rengaraj`

**Box 2: GitHub Contributions** (`.github-box`)
- Icon: `fa-brands fa-github`
- Displays: total contributions count (sum of all years)
- Comment: "Open-source grind 💻"
- API: `https://github-contributions-api.jogruber.de/v4/Akash-rengaraj`

**Box 3: HackerRank Badges** (`.hacker-box`)
- Icon: `fa-brands fa-hackerrank`
- Displays 4 badge chips:
  - Python(Basics)
  - Problem Solving(Basics)
  - CSS(Basics)
  - React(Basics)
- Comment: "Badge collector 🏅"

**Box 4: Portfolio Views** (`.views-box`)
- Icon: `fa-solid fa-eye`
- Displays: real-time view count from Firebase Realtime Database (passed as `viewCount` prop from `App.jsx`)
- Comment: "Growing far and wide! ⏳"

**Box 5: Current CGPA** (`.cgpa-box`)
- Icon: `fa-solid fa-graduation-cap`
- Displays: `8.2` (hardcoded, updated manually)
- Comment: "Academic excellence 📚"

**Box 6: Certifications** (`.certifications-box`)
- Icon: `fa-solid fa-certificate`
- Displays: total count of certifications (computed from `skillsData` — currently **12**)
- Comment: "Learning never stops! 🎓"

### 11.2 Tab: Skills & Certificates

Grid of `.skill-cert-card` components, one per skill category (same 5 categories as About page skills).

Each card:
- **Title:** category name
- **Certifications list:** Each entry has issuer logo + cert name + "View" button → links to PDF in `/docs/certificates/`

**12 total certifications:**
| # | Certificate | Issuer | PDF |
|---|---|---|---|
| 1 | Introduction to Front-End Development | Meta | `Introduction_to_Front-End_Development.pdf` |
| 2 | Programming with JavaScript | Meta | `Programming_with_Javascript.pdf` |
| 3 | HTML and CSS in depth | Meta | `HTML_and_CSS_in_depth.pdf` |
| 4 | React Basics | Meta | `React_Basics.pdf` |
| 5 | Version Control with Git | Atlassian | `Version_Control_with_Git.pdf` |
| 6 | Introduction to Git and GitHub | Google | `Introduction_to_Git_and_Github.pdf` |
| 7 | Version Control | Meta | `Version_Control.pdf` |
| 8 | Foundations of Cybersecurity | Google | `Foundation_of_Cybersecurity.pdf` |
| 9 | Play It Safe: Manage Security Risks | Google | `Play_It_Safe_Manage_Security_Risks.pdf` |
| 10 | Connect and Protect: Networks and Network Security | Google | `Connect_and_Protect.pdf` |
| 11 | Introduction to Artificial Intelligence (AI) | IBM | `Introduction_to_Artificial_Intelligence.pdf` |
| 12 | The Joy of Computing Using Python | NPTEL | `The_Joy_of_Computing_using_Python.pdf` |

### 11.3 Tab: Hackathons

**1 hackathon** (`.event-card` inside `.events-grid`):

**HackIndia 2025 Spark 2**
- **Type:** Regional Hackathon
- **Venue:** Muthayammal Engineering College, Namakkal
- **Team:** 4 Members
- **Project:** Smart Traffic Management System
- **Achievement:** Top 10 Finalist 🏆
- **Features:**
  - Real-time congestion monitoring using AI
  - Vehicle counting through CCTV analysis
  - Instant accident detection & SOS alerts
  - Smart route optimization for blocked roads
- **Photos:** 4 images with gallery thumbnail selector
  - `HackIndia 2025 hackathon-1.jpg`
  - `HackIndia 2025 hackathon-2.jpg`
  - `HackIndia 2025 hackathon-3.jpg`
  - `HackIndia 2025 hackathon-main.jpg`
  - Located at: `/images/Hackathon_imgs/HackIndia_Spark1/`
- **Gallery interaction:** Clicking a thumbnail updates the main image. Active thumbnail gets `.active` class (styled differently). First photo shown by default.

---

## 12. Page: Links & Contacts

**Route:** `activePage === 'links'`

**Layout:** Two sections stacked vertically inside `.links-container`.

### Section 1: Social Links
**Header text:** `> Connect_With_Me.exe` (styled as terminal command)

**5 social cards** in `.links-grid`:

| Platform | Username | URL | CSS class |
|---|---|---|---|
| GitHub | @Akash-rengaraj | https://github.com/Akash-rengaraj | `.github` |
| LinkedIn | Akash R | https://www.linkedin.com/in/akash-rengaraj-b45177355 | `.linkedin` |
| X (Twitter) | @akash_rengaraj | https://x.com/akash_020160 | `.twitter` |
| Facebook | Akash R | https://www.facebook.com/share/19HkrngpYe/ | `.facebook` |
| Reddit | u/akash_020160 | https://www.reddit.com/user/akash_020160/ | `.reddit` |

**Note:** Twitter display name is `@akash_rengaraj` but the actual handle is `@akash_020160` (the URL shows the real one).

### Section 2: Contact Information
**Header text:** `> Contact_Information.sh`

**3 contact cards:**

| Type | Value | URL | Opens |
|---|---|---|---|
| Email | akashrengaraj2007@gmail.com | `mailto:akashrengaraj2007@gmail.com` | Same tab |
| Discord | akash_rengaraj | https://discord.com/users/1281218820421320768 | New tab |
| Phone | +91 93453 86706 | `tel:+919345386706` | Same tab |

### Card design (`.social-card`)
Each card is a `<a>` tag. Inside: Font Awesome icon + platform name + username/value. Cards have hover effects and color-coded borders/highlights per platform.

---

## 13. External APIs (Live Data)

| API | URL | Data fetched | Used in |
|---|---|---|---|
| LeetCode (via CORS proxy) | `https://leetcode-cors-proxy.vercel.app/api/leetcode?username=Akash_Rengaraj` | `totalSolved[difficulty=All].count` and `totalQuestions[difficulty=All].count` | Events → Milestones tab |
| GitHub Contributions | `https://github-contributions-api.jogruber.de/v4/Akash-rengaraj` | Sum of `data.total` object values across all years | Events → Milestones tab |
| Firebase Realtime DB | Firebase project (env/config) | `pageViews` node — incremented once per session, subscribed real-time | Portfolio view count (all pages receive it, shown in Events → Milestones) |

**Firebase behavior:**
- `runTransaction(counterRef, (current) => (current || 0) + 1)` — increments once on App mount
- `onValue(counterRef, ...)` — live listener, updates `viewCount` state in real-time
- Cleanup: listener unsubscribed when App unmounts

---

## 14. Resume

**File:** `/Akash_Resume.pdf` (accessible at `https://www.akashr.dev/Akash_Resume.pdf`)
**Accessed via:** The "resume" nav link (opens in new tab)

---

## 15. Animation Inventory

| Animation name | Element | Effect | Duration |
|---|---|---|---|
| `fadeIn` | `.animate-fade-in` (About page wrapper) | opacity 0→1, translateY 10px→0 | 0.4s ease-out |
| `fadeInUp` | `.animate-card` (project cards) | opacity 0→1, translateY 20px→0 | 0.6s ease |
| Page transition | `.page` | opacity + translateY + scale | 0.5s cubic-bezier(0.4,0,0.2,1) |
| Typewriter | `.typewriter.first-line`, `.second-line` | CSS keyframe character reveal | Sequential |
| Bot wandering | TerminalBot | `setInterval` position updates every 20ms | Continuous |
| Bot walk cycle | `.bot-legs` | 4-frame text animation via `Date.now()` | 100ms/frame |
| Bot dancing | `.dancing` class | CSS animation | 5 seconds |
| Eye tracking | `.pupil` | `transform: translate()` on mousemove | Immediate |
| Tab underline | `.about-tab::before` | `scaleX(0)` → `scaleX(1)` | 0.3s ease |
| GitHub button | `.github-btn:hover` | translateY(-2px) + color change + box-shadow | 0.2s |
| Skill card hover | `.skill-category-card:hover` | translateY(-3px) | 0.2s ease |
| Hanging bulb | `.theme-toggle` | `hangingBulb`, `pullChain`, `swingBulb` keyframes | Custom |
| Cursor blink | `.cursor` | opacity 0↔1 | CSS keyframe |

---

## 16. SEO & Meta Tags (current after fixes)

```html
<title>Akash Rengaraj | Terminal Portfolio</title>
<meta name="author" content="Akash Rengaraj">
<meta name="description" content="Akash Rengaraj — AI & Data Science student and full-stack developer. Explore projects in React, Python, Flutter, IoT, and cybersecurity.">
<link rel="canonical" href="https://www.akashr.dev/">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#040404" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#888888" media="(prefers-color-scheme: light)">

<!-- Open Graph -->
<meta property="og:site_name" content="Akash Rengaraj — Terminal Portfolio">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.akashr.dev/">
<meta property="og:title" content="Akash Rengaraj — AI & Full-Stack Developer">
<meta property="og:description" content="AI & Data Science student and full-stack developer. Explore projects in React, Python, Flutter, IoT, and cybersecurity.">
<meta property="og:image" content="https://www.akashr.dev/screenshots/home-dark.png">
<meta property="og:image:alt" content="Akash Rengaraj's terminal-themed portfolio homepage">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@akash_020160">
<meta name="twitter:creator" content="@akash_020160">
<meta name="twitter:title" content="Akash Rengaraj — AI & Full-Stack Developer">
<meta name="twitter:description" content="AI & Data Science student and full-stack developer.">
<meta name="twitter:image" content="https://www.akashr.dev/screenshots/home-dark.png">
```

---

## 17. File & Asset Inventory

```
public/
  Akash_Resume.pdf                          ← downloadable resume
  favicon.svg                               ← terminal >_ icon, dark bg
  robots.txt                                ← allow all, sitemap → akashr.dev
  sitemap.xml                               ← 1 URL: https://www.akashr.dev/
  screenshots/
    home-dark.png                           ← OG image (homepage dark mode)
    about-dark.png
    projects-dark.png
  images/
    logos/
      meta_logo.png
      goole_logo.png                        ← note: typo in filename
      ibm_logo.webp
      atlassian_logo.webp
      nptel_logo.png
    Hackathon_imgs/HackIndia_Spark1/
      HackIndia 2025 hackathon-1.jpg
      HackIndia 2025 hackathon-2.jpg
      HackIndia 2025 hackathon-3.jpg
      HackIndia 2025 hackathon-main.jpg
  videos/project_disp/
    get_up_preview.webm                     ← WebM (Get Up project)
    icecream-website-preview.mp4
    jewellery-shop-website-preview.mp4
    portfolio-preview.mp4
  docs/certificates/
    Connect_and_Protect.pdf
    Foundation_of_Cybersecurity.pdf
    HTML_and_CSS_in_depth.pdf
    Introduction_to_Artificial_Intelligence.pdf
    Introduction_to_Front-End_Development.pdf
    Introduction_to_Git_and_Github.pdf
    Play_It_Safe_Manage_Security_Risks.pdf
    Programming_with_Javascript.pdf
    React_Basics.pdf
    The_Joy_of_Computing_using_Python.pdf
    Version_Control.pdf
    Version_Control_with_Git.pdf
  vite.svg                                  ← default Vite logo (unused)

src/
  main.jsx                                  ← ReactDOM.createRoot entry
  App.jsx                                   ← root: theme, Firebase, routing
  App.css                                   ← minimal app-level styles
  index.css                                 ← ALL styles (~3,200 lines)
  firebase/config.js                        ← Firebase init + db export
  components/
    TerminalHeader.jsx                      ← top bar (window buttons, title, bulb)
    ThemeToggle.jsx                         ← hanging bulb click-to-toggle
    StatsWidget.jsx                         ← eye-tracking face widget
    TerminalBot.jsx                         ← autonomous ASCII robot
    ProjectCard.jsx                         ← project card component
    Navigation.jsx                          ← bottom nav bar
  pages/
    HomePage.jsx                            ← ASCII banner + typewriter + bot
    AboutPage.jsx                           ← bio, education, skills, security
    ProjectsPage.jsx                        ← maps projectsData → ProjectCard
    EventsPage.jsx                          ← 3-tab: milestones, skills, hackathons
    LinksPage.jsx                           ← social + contact cards
  data/
    projects.js                             ← projectsData array (4 projects)
    skills.js                               ← skillsData + hackerrankBadgesData
    hackathons.js                           ← hackathonsData (1 hackathon)
```

---

## 18. Routing & Navigation Logic

```
App.jsx
  state: activePage = 'home' | 'about' | 'projects' | 'events' | 'links'

  renderPage() {
    switch(activePage):
      'about'    → <AboutPage />
      'projects' → <ProjectsPage />
      'events'   → <EventsPage viewCount={viewCount} />
      'links'    → <LinksPage />
      'home'     → <HomePage />  (default)
  }

Navigation.jsx
  'tmux'           → github.com/Akash-rengaraj (external, new tab)
  'home'           → onNavigate('home')
  'about'          → onNavigate('about')
  'resume'         → /Akash_Resume.pdf (external, new tab)
  'projects'       → onNavigate('projects')
  'honor'          → onNavigate('events')
  'links & contacts' → onNavigate('links')
```

**Important:** URL never changes. No history API. No browser back/forward support. This is a pure state-switch SPA.

---

## 19. Theme System

**Toggle mechanism:** Click the hanging bulb in the header → `toggleTheme()` → `document.body.className = theme === 'dark' ? 'light-mode' : ''`

**CSS implementation:**
- Dark mode: `:root` variables are the defaults (no class needed)
- Light mode: `body.light-mode` selector overrides every CSS variable and component style

**Persistence:** None — theme resets to dark on page reload (no localStorage).

---

## 20. Known Issues / Quirks

| Issue | Details |
|---|---|
| No SSR | React SPA — fetching the URL without JS execution shows only `<div id="root"></div>`. All content is JS-rendered. |
| Logo filename typo | Google logo file is named `goole_logo.png` (double-o) — not a runtime issue since it loads correctly |
| Twitter display vs handle mismatch | LinkedIn page shows `@akash_rengaraj` but actual Twitter/X handle is `@akash_020160` |
| No theme persistence | Light mode resets to dark on reload (no localStorage) |
| Firebase exposed config | Firebase config is client-side (standard for Realtime DB — rules control access) |
| `package.json` name | Still `akashr.one-react` though domain is now `akashr.dev` |
| Portfolio listed as HTML/CSS/JS | Project 4 data says `["HTML", "CSS", "JavaScript"]` but the site is actually React/Vite |
| Twitter description truncated in meta | `twitter:description` content is shorter than `og:description` |

---

## 21. Akash Rengaraj — Personal Profile

| Field | Value |
|---|---|
| Full name | Akash Rengaraj |
| Degree | B.Tech — Artificial Intelligence & Data Science |
| Institution | Kathir College of Engineering, Coimbatore, India |
| Year | 2024–present (1st year as of 2024, 3rd year from July 2026) |
| CGPA | 8.2 (Milestones page) / 8.8 approx (About page — discrepancy) |
| GitHub | https://github.com/Akash-rengaraj |
| LeetCode | Akash_Rengaraj |
| Twitter/X | @akash_020160 (URL) / @akash_rengaraj (display) |
| Reddit | u/akash_020160 |
| Discord | akash_rengaraj (ID: 1281218820421320768) |
| LinkedIn | https://www.linkedin.com/in/akash-rengaraj-b45177355 |
| Email | akashrengaraj2007@gmail.com |
| Phone | +91 93453 86706 |
| Status | Open to collaborating |
| Hackathon win | HackIndia 2025 Spark 2 — Top 10 Finalist |
