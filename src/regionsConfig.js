// Region config — the SINGLE source of truth for every interactive spot in the
// world. Everything downstream maps over this array: the 3D markers, the
// proximity check, the prompts, and the section panels. Adding/removing a
// section is a config edit here; no component code changes.
//
// (Named regionsConfig.js, not regions.js, to avoid a case-only filename clash
// with Regions.jsx on case-insensitive filesystems like Windows/macOS.)
//
// Shape per region:
//   {
//     id, label,            // id = stable key; label = short name (prompt + heading fallback)
//     title,                // panel heading
//     markerColor,          // torii tint + orb emissive glow (also wayfinding colour)
//     position: [x, 0, z],  // on the flat walkable top (y = 0), inside WALKABLE_RADIUS
//     activationRadius,      // metres — how close to interact
//     type,                 // selects the panel layout: about|projects|experience|resume|contact
//     content,              // section-appropriate DATA (edit copy here, never in components)
//   }
//
// Markers are spaced ~72° apart on a ~9.5 m circle so each one is a short walk
// from spawn (centre) and from the others, and clear of the rim props (r > 13).

export const REGIONS = [
  {
    id: 'about',
    label: 'About',
    title: 'About Me',
    markerColor: '#7fe3ff', // cyan
    position: [7.3, 0, 6.1],
    activationRadius: 3.5,
    type: 'about',
    content: {
      paragraphs: [
        "I'm Karthik Sengupta, a Master's student in Computer Science at Northeastern University's Khoury College (4.0 GPA, graduating December 2027), focused on machine learning and AI. I build across the full depth of the stack — from real-time computer vision and applied LLM systems down to low-level compiler internals in C++ — with a consistent bias toward performance and code that holds up under scrutiny.",
        "My work spans research and industry. At IIT Delhi's National Center for Assistive Health Technology, I built an OpenCV-and-LLM web application that automated real-time image description for 200+ visually impaired students; at LTIMindtree, I engineered SQL pipelines and analytics automation that eliminated 15+ hours of manual reporting a month. I've also published on production LLM architecture at ICSSAS 2024.",
        "Beyond engineering, I serve as President of the Khoury Masters Student Council. This portfolio itself is one of my builds — a cel-shaded, fully interactive 3D world engineered from scratch with React Three Fiber — which reflects how I prefer to learn: by shipping the ambitious version.",
      ],
      skills: [
        { category: 'Languages', items: ['Python', 'C++', 'SQL', 'JavaScript', 'Java', 'R'] },
        {
          category: 'ML & Deep Learning',
          items: ['PyTorch', 'TensorFlow', 'Keras', 'Scikit-learn', 'CUDA', 'NumPy', 'Pandas'],
        },
        {
          category: 'Computer Vision',
          items: ['OpenCV', 'MediaPipe', 'Real-time video processing', 'Pose estimation'],
        },
        {
          category: 'Generative AI & NLP',
          items: ['Hugging Face Transformers', 'LangChain', 'RAG', 'LLM fine-tuning', 'OpenAI API'],
        },
        {
          category: 'Data & Infrastructure',
          items: ['PostgreSQL', 'MySQL', 'ChromaDB', 'ETL pipelines', 'Power BI', 'AWS', 'Docker', 'Linux', 'Git'],
        },
      ],
    },
  },
  {
    id: 'projects',
    label: 'Projects',
    title: 'Projects',
    markerColor: '#ffd47f', // gold
    position: [-3.6, 0, 8.8],
    activationRadius: 3.5,
    type: 'projects',
    content: {
      projects: [
        {
          name: 'minicompiler — C++ ML Compiler',
          description:
            'A custom C++ compiler for machine-learning compute graphs, built on a DAG-based intermediate representation with three optimization passes — dead-node elimination, constant folding, and operator fusion — targeting an Eigen CPU backend. Execution is benchmarked against PyTorch, the IR is visualized with Graphviz, and the codebase is covered by automated GoogleTest suites.',
          tech: ['C++', 'Eigen', 'CUDA', 'GoogleTest', 'Graphviz', 'Linux'],
          link: 'https://github.com/kartsen03/minicompiler',
        },
        {
          name: 'Document Retrieval & Benchmarking System',
          description:
            'A Python retrieval-augmented generation (RAG) pipeline with a purpose-built benchmark harness over a 500-query evaluation set, improving retrieval precision by 15% and cutting response latency 40% through caching.',
          tech: ['Python', 'RAG', 'ChromaDB'],
          link: 'https://github.com/kartsen03/Document_retrieval_system',
        },
        {
          name: 'RetailGPT — Fine-Tuned LLM Architecture (Publication)',
          description:
            'Published research at ICSSAS 2024 presenting a fine-tuned LLM architecture for customer-experience and sales optimization, covering the fine-tuning methodology and a deployment architecture for production LLM services.',
          tech: ['LLM Fine-Tuning', 'NLP', 'Python'],
          link: null,
        },
        {
          name: 'Git-to-Doc — Local-LLM Developer Tool',
          description:
            "A developer tool that reads git diffs and generates Conventional Commit messages and markdown changelogs using a local Gemma model served through Ollama, with a model-agnostic runtime resolution chain. Built as team lead of five at GDG Cloud Boston's BuildwithAI Hackathon — placed 4th.",
          tech: ['Python', 'Ollama', 'Gemma', 'Git'],
          link: null,
        },
        {
          name: 'FitFight — Real-Time Computer Vision',
          description:
            'A real-time pose-classification system running at 30+ FPS on CPU, using performance-tuned joint-angle state machines with hysteresis and temporal smoothing to reach 95%+ accuracy. The engine is fully decoupled from rendering I/O and unit-tested for isolated validation of all logic.',
          tech: ['Python', 'OpenCV', 'MediaPipe', 'PyTorch'],
          link: null,
        },
        {
          name: "This Portfolio — Interactive 3D World",
          description:
            "The world you're exploring: a gamified, cel-shaded 3D portfolio with a walkable VRM character, a custom Fresnel rim-light shader, an HDR bloom post-processing pipeline, Mixamo-to-VRM animation retargeting, and a proximity-based interaction system — engineered from scratch with React Three Fiber and Three.js.",
          tech: ['React', 'React Three Fiber', 'Three.js', 'GLSL', 'Vite'],
          link: null,
        },
      ],
    },
  },
  {
    id: 'experience',
    label: 'Experience',
    title: 'Experience',
    markerColor: '#b69cff', // violet
    position: [-9.5, 0, -0.7],
    activationRadius: 3.5,
    type: 'experience',
    content: {
      items: [
        {
          role: 'President',
          org: 'Khoury Masters Student Council, Northeastern University',
          dates: 'Apr 2026 – Present',
          points: [
            'Lead the graduate student council for Khoury College, having previously served as Treasurer and Event Coordinator.',
            "Organizing the council's inaugural student hackathon, from format and logistics to team delegation.",
          ],
        },
        {
          role: 'Research Intern',
          org: 'National Center for Assistive Health Technology, IIT Delhi',
          dates: 'Jun 2024 – Jul 2024',
          points: [
            'Built an AI-powered web application combining OpenCV computer vision with LLM-based generation (OpenAI API) to automate real-time image description for 200+ visually impaired students across 8 education centers, reaching 82% accuracy validated by education specialists.',
            'Engineered Python NLP pipelines for preprocessing, summarization, and descriptive analytics — cutting manual effort by 65% — deployed as Flask REST APIs supporting concurrent multi-center access with production-grade error handling.',
          ],
        },
        {
          role: 'Software Development Engineer Intern',
          org: 'LTIMindtree',
          dates: 'Aug 2023 – Oct 2023',
          points: [
            'Designed Power BI dashboards surfacing real-time workforce metrics (engagement, retention, performance), eliminating 15+ hours/month of manual reporting, and optimized SQL ingestion pipelines to modernize the analytics infrastructure.',
            'Built an HR analytics and automation platform on Microsoft Power Platform, automating 500+ employee lifecycle events, reducing onboarding cycle time by 35%, and driving 30% DAU adoption growth in the first quarter.',
          ],
        },
      ],
    },
  },
  {
    id: 'resume',
    label: 'Resume',
    title: 'Résumé',
    markerColor: '#7dffc4', // mint
    position: [-2.3, 0, -9.2],
    activationRadius: 3.5,
    type: 'resume',
    content: {
      // Served from public/. If this file is absent the panel shows a graceful
      // "coming soon" state (see RegionPanel — it HEAD-checks the file on open).
      file: '/resume.pdf',
    },
  },
  {
    id: 'contact',
    label: 'Contact',
    title: 'Contact',
    markerColor: '#ff9ec7', // pink
    position: [8.1, 0, -5.0],
    activationRadius: 3.5,
    type: 'contact',
    content: {
      // `kind` drives the icon + link target (see RegionPanel ContactPanel).
      links: [
        { kind: 'email', label: 'Email', href: 'mailto:sengupta.k@northeastern.edu' },
        { kind: 'github', label: 'GitHub', href: 'https://github.com/kartsen03' },
        { kind: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/karthik-sengupta' },
      ],
    },
  },
]
