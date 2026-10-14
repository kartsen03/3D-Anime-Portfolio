// Who this site is about. Edit copy here; no component needs to change.
//
// Source of truth: Karthik's October 2026 content brief and résumé
// (public/Karthik_Sengupta_Resume.pdf). Project numbers were also checked against each
// repository's README on 2026-10-13; see docs/CONTENT_SOURCES.md. Don't add claims that
// aren't in those sources, and don't round numbers.

export const profile = {
  name: 'Karthik Sengupta',
  // One line under the name (splash, HUD, Quick view): the headline.
  role: 'MS Computer Science, Northeastern University · ML systems, GPU computing, and computer vision',
  location: 'Boston, MA',
  email: 'sengupta.k@northeastern.edu',
  links: [
    { kind: 'email', label: 'Email', href: 'mailto:sengupta.k@northeastern.edu', display: 'sengupta.k@northeastern.edu' },
    {
      kind: 'linkedin',
      label: 'LinkedIn',
      href: 'https://linkedin.com/in/karthik-sengupta',
      display: 'linkedin.com/in/karthik-sengupta',
    },
    { kind: 'github', label: 'GitHub', href: 'https://github.com/kartsen03', display: 'github.com/kartsen03' },
  ],
  resume: { file: '/Karthik_Sengupta_Resume.pdf', updated: 'October 2026' },

  about: [
    "I'm an MS Computer Science student at Northeastern University (4.0 GPA, graduating December 2027). I like making ML run fast and proving that it works: I've built an ML compiler with hand-written CUDA kernels, real-time computer vision systems, and data pipelines backed by rigorous testing. I'm a graduate TA for Program Design Paradigms, president of the Khoury Masters Student Council, and a Global Student Mentor for incoming international students.",
    'Seeking Spring 2027 co-op roles (January 2027 start) in ML systems, GPU computing, and software engineering.',
  ],

  education: [
    {
      school: 'Northeastern University, Khoury College of Computer Sciences, Boston, MA',
      degree: 'MS in Computer Science',
      dates: 'Sep 2025 – Dec 2027 (expected)',
      detail:
        'GPA 4.0/4.0 · Coursework: Algorithms, Program Design Paradigms, Building Scalable Distributed Systems, Database Management Systems, Pattern Recognition & Computer Vision, Essentials of Data Science',
    },
    {
      school: 'Vellore Institute of Technology, Vellore, India',
      degree: 'B.Tech in Computer Science and Engineering',
      dates: 'Sep 2021 – May 2025',
      detail: 'GPA 3.55/4.0',
    },
  ],

  publications: [
    {
      title: '“RetailGPT: A Fine-Tuned LLM Architecture for Customer Experience and Sales Optimization”',
      venue: 'ICSSAS 2024',
    },
  ],

  skills: [
    { category: 'Languages', items: ['C++ (C++17)', 'Python', 'Java', 'Go', 'SQL', 'R'] },
    {
      category: 'GPU & ML systems',
      items: [
        'CUDA',
        'NVRTC',
        'cuBLAS',
        'tensor cores (WMMA)',
        'Nsight Compute',
        'Nsight Systems',
        'PyTorch (including torch.compile)',
        'TensorFlow',
        'Keras',
        'scikit-learn',
      ],
    },
    {
      category: 'Vision & data',
      items: [
        'OpenCV',
        'MediaPipe',
        'image quality assessment',
        'time-series forecasting',
        'anomaly detection',
        'MySQL',
        'PostgreSQL',
        'SQLite',
        'Power BI',
      ],
    },
    {
      category: 'Testing & DevOps',
      items: ['GoogleTest', 'pytest', 'JUnit', 'requirements traceability', 'GitHub Actions', 'Docker', 'Linux', 'CMake', 'Bash'],
    },
    { category: 'Graphics', items: ['GLSL shaders', 'WebGL', 'Three.js', 'React Three Fiber'] },
  ],
}
