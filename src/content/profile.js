// Who this site is about. Edit copy here; no component needs to change.
//
// Rule for everything in src/content: every claim must be verifiable, from a public
// repo (README or committed results) or from the résumé. No invented or rounded
// numbers. Sources were checked on 2026-10-13; see docs/CONTENT_SOURCES.md.

export const profile = {
  name: 'Karthik Sengupta',
  // One line under the name (splash, HUD, Quick view).
  role: 'MS Computer Science, Northeastern · ML, GPU systems & real-time graphics',
  location: 'Boston, MA',
  email: 'sengupta.k@northeastern.edu',
  links: [
    { kind: 'email', label: 'Email', href: 'mailto:sengupta.k@northeastern.edu', display: 'sengupta.k@northeastern.edu' },
    { kind: 'github', label: 'GitHub', href: 'https://github.com/kartsen03', display: 'github.com/kartsen03' },
    {
      kind: 'linkedin',
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/karthik-sengupta',
      display: 'linkedin.com/in/karthik-sengupta',
    },
  ],
  resume: { file: '/resume.pdf', updated: 'July 2026' },

  about: [
    "I'm a Master's student in Computer Science at Northeastern University's Khoury College in Boston (GPA 4.0, graduating December 2027), after a BTech in Computer Science and Engineering at VIT. I like work where performance and correctness can be measured: compilers and GPU kernels, model evaluation that holds up to scrutiny, and real-time graphics.",
    'Recent work includes a C++17 compiler for ML compute graphs with hand-written CUDA matmul kernels measured against cuBLAS, a battery remaining-life study evaluated leave-one-cell-out with its negative results reported, and a live ClinicalTrials.gov feasibility dashboard over 88,960 trials. Before Northeastern I interned at IIT Delhi’s National Center for Assistive Health Technology and at LTIMindtree.',
    'I’m President of the Khoury Masters Student Council. This site is one of my builds: a cel-shaded 3D world written from scratch with React Three Fiber. There is a text version of everything, too.',
  ],

  education: [
    {
      school: 'Northeastern University, Khoury College of Computer Sciences',
      degree: 'MS, Computer Science',
      dates: 'Sep 2025 – Dec 2027',
      detail: 'GPA 4.0 / 4.0 · Algorithms, Database Management Systems, Program Design Paradigms, Pattern Recognition & Computer Vision',
    },
    {
      school: 'Vellore Institute of Technology',
      degree: 'BTech, Computer Science and Engineering',
      dates: 'Sep 2021 – May 2025',
      detail: 'GPA 3.55 / 4.0 · Artificial Intelligence, Natural Language Processing, Statistics, Cloud Computing',
    },
  ],

  publications: [
    {
      title: 'RetailGPT: A Fine-Tuned LLM Architecture for Customer Experience and Sales Optimization',
      venue: 'ICSSAS 2024',
      detail: 'Fine-tuning methodology and deployment architecture for production LLM services.',
    },
  ],

  skills: [
    { category: 'Languages', items: ['C++17', 'Python', 'CUDA', 'R', 'SQL', 'JavaScript', 'Java'] },
    {
      category: 'GPU & systems',
      items: ['NVRTC', 'WMMA tensor cores', 'Nsight Systems', 'Nsight Compute', 'Eigen', 'CMake', 'GoogleTest', 'ASan / UBSan', 'Linux'],
    },
    {
      category: 'Machine learning',
      items: ['PyTorch', 'scikit-learn', 'Time-series forecasting', 'Anomaly detection', 'statsmodels', 'TensorFlow / Keras', 'Hugging Face'],
    },
    { category: 'Vision & graphics', items: ['OpenCV', 'MediaPipe', 'scikit-image', 'Three.js', 'React Three Fiber', 'GLSL'] },
    {
      category: 'Data & delivery',
      items: ['SQLite', 'MySQL', 'PostgreSQL', 'R Shiny', 'Flask', 'SQLAlchemy', 'Power BI', 'GitHub Actions', 'Docker'],
    },
    { category: 'LLM tooling', items: ['OpenAI API', 'Ollama', 'LangChain'] },
  ],
}
