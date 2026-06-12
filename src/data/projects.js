export const projectsData = [
  {
    slug: "arify",
    title: "ARify — 3D Room Scanning",
    tagline: "An open-source pipeline to AR-ify any physical space and share it with the world.",
    tech: ["Flutter", "FastAPI", "Android ARCore", "Unity (WebXR)"],
    preview: {
      type: "video",
      src: "/videos/project_disp/arify-preview.mp4",
      alt: "ARify App Preview"
    },
    description: [
      "ARify is an end-to-end open-source toolset designed to make 3D room scanning and spatial sharing completely free.",
      "Using native Android AR hardware, it guides users through capturing optimal angles of a room. It then processes these images locally into a photorealistic 3D environment.",
      "Key Features:",
      "<ul class='feature-list'>",
      "<li><b>Guided Spatial Tracking:</b> Maps a virtual sphere around the user, distributing 50 capture nodes (Spherical Fibonacci mapping) for 360-degree coverage.</li>",
      "<li><b>Auto-Trigger Capture:</b> Automatically snaps an environment frame the moment the device camera aligns with a spatial target.</li>",
      "<li><b>Zero-Cost Processing:</b> Bypasses expensive cloud APIs. ARify compresses the raw images into a `.zip` payload and beams it to a local backend for rendering.</li>",
      "<li><b>Asynchronous Backend:</b> Built on FastAPI to handle multi-part form uploads and queue heavy 3D rendering jobs in the background.</li>",
      "<li><b>Spatial Sharing:</b> Compress and share the 3D model for others to experience the space virtually.</li>",
      "</ul>",
      "Built with Flutter for the mobile frontend and FastAPI for the backend 3D processing pipeline."
    ],
    status: "in development",
    duration: "still working",
    role: "Solo developer — mobile UI/UX, spatial tracking algorithm, backend API, processing pipeline",
    challenge: "Standard 3D room scanning and mesh reconstruction relies on expensive cloud services. The challenge was to replicate this high-quality spatial reconstruction experience using only on-device AR hardware and open-source processing libraries, making spatial sharing accessible to everyone.",
    solution: "Developed a Flutter app with native Android ARCore integration. Implemented a Spherical Fibonacci algorithm to mathematically distribute 50 optimal capture nodes, ensuring complete 360-degree coverage while guiding the user via an AR guidance sphere. The backend uses FastAPI to receive compressed .zip payloads and triggers subprocesses to handle heavy mesh reconstruction.",
    impact: [
      "Open-source pipeline for 3D room reconstruction — completely free of cloud service costs",
      "Spherical Fibonacci mapping ensures optimal node distribution for 360-degree coverage",
      "Auto-trigger capture system captures environment frames automatically when aligned with targets",
      "Zero-latency UX with on-device processing and local backend infrastructure"
    ],
    githubUrl: "https://github.com/Akash-rengaraj/ARify.git"
  },
    {
      slug: "get-up",
      title: "Get Up — All-in-One Student App",
      tagline: "A Flutter productivity companion that helps students track habits, attendance, and finances.",
      tech: ["Flutter", "Hive", "fl_chart", "confetti", "intl"],
      preview: {
        type: "video",
        src: "/videos/project_disp/get_up_preview.webm",
        alt: "Get Up App Preview"
      },
      description: [
        "The Ultimate Personal Productivity & Student Companion.",
        "Get Up is a comprehensive Flutter-based productivity application designed to help users—particularly students—manage their daily life, habits, and academic requirements.",
        "Key Features:",
        "<ul class='feature-list'>",
        "<li><b>Daily Planner:</b> Habit tracking, To-Do list, and Daily Focus dashboard.</li>",
        "<li><b>Smart Attendance Tracker:</b> Bunk-o-Meter algorithm to calculate safe 'bunks'.</li>",
        "<li><b>Finance Manager:</b> Track income and expenses within budget.</li>",
        "<li><b>Analytics:</b> Visual productivity and consistency charts.</li>",
        "</ul>",
        "Built with Flutter for a smooth cross-platform experience and Hive for local-first storage."
      ],
      status: "Completed",
      duration: "6 weeks",
      role: "Solo developer — design, architecture, implementation, testing",
      challenge: "Students juggle attendance rules, assignment deadlines, and finances simultaneously. Existing apps solve only one of these problems. The challenge was building a unified, offline-first experience that felt personal — not corporate.",
      solution: "Built a Flutter app with four interconnected modules sharing a single Hive database. Designed a 'Bunk-o-Meter' algorithm that reads current attendance percentage and safe-to-miss class count from the local DB in real time. Used fl_chart for visual feedback loops that make abstract stats feel tangible.",
      impact: [
        "100% offline — no backend, no latency, no privacy concerns",
        "Bunk-o-Meter algorithm reduced attendance anxiety for daily users",
        "Finance module tracks monthly budget variance with color-coded alerts",
        "Shipped solo in 6 weeks as a 1st-year student project"
      ],
      githubUrl: "https://github.com/Akash-rengaraj/get_up.git"
    },
    {
      slug: "jewellery-ecommerce",
      title: "Full-Stack Jewellery E-Commerce",
      tagline: "A production-grade e-commerce platform with real-time inventory and JWT auth — built solo end-to-end.",
      tech: ["React", "TypeScript", "Vite", "Tailwind CSS", "GSAP", "Node.js", "Express", "MongoDB"],
      preview: {
        type: "video",
        src: "/videos/project_disp/jewellery-shop-website-preview.mp4",
        alt: "Sanjana Creations Preview"
      },
      description: [
        "A state-of-the-art e-commerce platform dedicated to showcasing and selling exquisite, handcrafted jewelry.",
        "Built with a modern technology stack featuring React, TypeScript, and Vite for a lightning-fast frontend, and powered by a robust Node.js and Express backend.",
        "Key Features:",
        "<ul class='feature-list'>",
        "<li><b>Immersive UX:</b> Visually stunning interface with smooth transitions, parallax effects, and interactive showcases.</li>",
        "<li><b>Dynamic Showcase:</b> Unique circular scroll interactions and detailed product views.</li>",
        "<li><b>Secure Auth:</b> Robust registration and login systems (JWT & BCrypt).</li>",
        "<li><b>Admin Dashboard:</b> Real-time management of products, inventory, and orders.</li>",
        "<li><b>High Performance:</b> Optimized for speed with Vite and modern React patterns.</li>",
        "</ul>",
        "Represents the perfect fusion of elegance and technology."
      ],
      status: "Active development",
      duration: "10 weeks (ongoing)",
      role: "Solo full-stack developer — schema design, REST API, React frontend, deployment",
      challenge: "A real jewellery business needed an online presence that matched the premium feel of their physical store. The challenge: build something production-grade with a real admin dashboard, proper auth, and zero budget for third-party services.",
      solution: "Designed a normalized MongoDB schema for products, orders, and users. Built a JWT + BCrypt auth system from scratch. Created a GSAP-powered product showcase with circular scroll interactions. Admin dashboard uses optimistic UI updates so the business owner sees changes instantly without page refreshes.",
      impact: [
        "Full auth system: registration, login, JWT refresh, BCrypt password hashing",
        "Admin dashboard with live product/inventory/order management",
        "GSAP circular scroll animations achieve 60fps on mid-range devices",
        "TypeScript throughout — zero runtime type errors in production build"
      ],
      githubUrl: "https://github.com/Akash-rengaraj/Full-Stack-E-Commerce-jewelery-website"
    },
    {
      slug: "icecream-website",
      title: "Millora — Premium Ice Cream Brand Site",
      tagline: "A buttery-smooth frontend with Lenis scroll, Framer Motion, and a fully functional shopping cart.",
      tech: ["React 19", "TypeScript", "Vite", "Framer Motion", "Lenis", "CSS Modules"],
      preview: {
        type: "video",
        src: "/videos/project_disp/icecream-website-preview.mp4",
        alt: "Millora Website Preview"
      },
      description: [
        "A premium, artisanal ice cream brand website built with React 19, TypeScript, and Vite.",
        "Features buttery smooth scrolling with Lenis, immersive animations via Framer Motion, and a dynamic shopping experience.",
        "Key Features:",
        "<ul class='feature-list'>",
        "<li><b>Modern Aesthetic:</b> Visually stunning design with glassmorphism, vibrant colors, and premium typography.</li>",
        "<li><b>Smooth Experience:</b> Integrated lenis for buttery smooth scrolling interactions.</li>",
        "<li><b>Immersive Animations:</b> Powered by framer-motion for engaging entry and hover effects.</li>",
        "<li><b>Dynamic Cart:</b> Fully functional shopping cart context with persistent state.</li>",
        "<li><b>High Performance:</b> Built on Vite for instant server start and optimized production builds.</li>",
        "</ul>",
        "Designed to showcase handcrafted flavors and the brand's story in a visually stunning interface."
      ],
      status: "Completed",
      duration: "3 weeks",
      role: "Solo frontend developer — design system, animation architecture, cart state management",
      challenge: "Most food brand sites feel generic. The goal was to make the product itself feel premium through motion — every scroll, hover, and transition had to reinforce the brand's quality. The technical challenge: keep animations silky while TypeScript strict mode enforces correctness.",
      solution: "Used Lenis for sub-pixel scroll interpolation and Framer Motion's layout animations for cart interactions. Built a CSS Modules design system with custom properties for colors and spacing. Cart state in Context API with localStorage persistence — the user's order survives a page refresh.",
      impact: [
        "Lenis + Framer Motion achieve 60fps scroll and animation on all tested devices",
        "Cart persistence via localStorage — zero data loss on refresh",
        "TypeScript strict mode: 0 any types, full prop inference throughout",
        "Lighthouse Performance score: 94+"
      ],
      githubUrl: "https://github.com/Akash-rengaraj/Front-End-Icecream-shop-website"
    },
    {
      slug: "portfolio",
      title: "Terminal Portfolio — akashr.dev",
      tagline: "A hacker-aesthetic portfolio with a real terminal emulator, wandering bot, and 30+ easter eggs.",
      tech: ["React 19", "Vite", "JavaScript", "Firebase", "react-router-dom"],
      preview: {
        type: "video",
        src: "/videos/project_disp/portfolio-preview.mp4",
        alt: "Portfolio Preview"
      },
      description: [
        "A terminal-themed personal portfolio website showcasing my projects, skills, and experiences.",
        "Features include:",
        "<ul class='feature-list'>",
        "<li>Interactive terminal interface with 20+ real commands</li>",
        "<li>Wandering ASCII bot with drag, dance, and mood states</li>",
        "<li>Dark/Light theme with localStorage persistence</li>",
        "<li>Firebase Realtime Database for live visitor counter</li>",
        "<li>Konami code easter egg (↑↑↓↓←→←→BA)</li>",
        "</ul>"
      ],
      status: "Active Development",
      duration: "4 weeks (ongoing)",
      role: "Solo developer — design, animation, terminal engine, Firebase integration",
      challenge: "Portfolios are forgettable. The goal was to build one that's genuinely interactive — something a recruiter would demo to a colleague. The constraint: no heavy frameworks, no paid services, must feel hand-crafted.",
      solution: "Built a full terminal emulator in React with sessionStorage history, tab autocomplete, and 20+ commands. The ASCII bot uses a custom movement engine (velocity + target interpolation at 50fps) and reacts to cursor proximity. Firebase Realtime Database powers the live visitor counter with zero backend code.",
      impact: [
        "Terminal emulator with 20+ commands, history, and tab autocomplete",
        "ASCII bot with 5 moods, drag physics, and dance animation",
        "Live visitor counter (Firebase RTDB) — updates across all open tabs",
        "6 easter eggs including Konami code Matrix rain effect"
      ],
      githubUrl: "https://github.com/Akash-rengaraj/Personal-Portfolio.git",
      liveUrl: "https://www.akashr.dev"
    }
];
