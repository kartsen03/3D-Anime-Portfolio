// Project cards, in the order set by the October 2026 content brief, then course
// projects. Fields:
//   id, name, tagline, period, description, facts[] (short, each verifiable), tech[]
//   repo (GitHub URL) — also used by scripts/sync-github.mjs to keep "last updated" current
//   live (URL of a running demo), note (badge such as "Course project")
//
// Wording follows the brief, and each repo's own claims rules: "x% of cuBLAS at shape S",
// never "beats cuBLAS"; "injected faults"; "inspired by", never "compliant". Every number
// was checked against the linked README on 2026-10-13 (docs/CONTENT_SOURCES.md). Course
// projects are described briefly and never linked.

export const projects = [
  {
    id: 'minicompiler',
    name: 'minicompiler',
    tagline: 'CUDA ML Graph Compiler',
    period: 'May – Oct 2026',
    description:
      'An ML graph compiler with CPU and CUDA backends that generates fused GPU kernels and beats PyTorch on a small MLP block.',
    facts: [
      'SSA DAG IR with dead-node elimination, constant folding, elementwise operator fusion, and lifetime-based buffer planning; the passes cut an MLP block from 22 compute nodes to 4.',
      'One CUDA kernel per fused group, generated at run time with NVRTC. On an RTX 3060 Laptop GPU, the fused GELU chain runs 10.1–10.5× faster than one kernel per op on 16–256 MB inputs, reaching 92–93% of peak DRAM bandwidth from 64 MB up.',
      'A ladder of FP32 matmul kernels, each step guided by Nsight Compute (shared-memory tiling, register tiling, 128-bit loads, double buffering, split-K). They reach 93% of cuBLAS at 2048³ and 145% on a small-output MLP layer, making a B=128 MLP block 1.86× faster than idiomatic PyTorch and 2.04× faster than torch.compile.',
      'TF32, BF16, and FP16 tensor-core kernels (WMMA, FP32 accumulation) at 63–110% of cuBLAS in each format. FP16 runs 1.5–2.2× faster than FP32.',
      'A reproducible benchmark harness: CUDA-graph timing, interleaved shuffled rounds, SM-clock sampling, and medians of 3 runs.',
      '103 GoogleTest cases check every kernel against a double-precision reference and 200 random graphs on GPU against CPU, with CI across GCC, Clang, ASan/UBSan, and CUDA 12.6 and 13.4.',
    ],
    tech: ['C++17', 'CUDA', 'NVRTC', 'cuBLAS', 'CMake', 'GoogleTest', 'Nsight Compute/Systems'],
    repo: 'https://github.com/kartsen03/minicompiler',
  },
  {
    id: 'validated-study-tracker',
    name: 'Validated Study Tracker',
    tagline:
      'A clinical study records app built the way validated software is built — requirements first, every requirement traced to a passing test.',
    period: 'Oct 2026',
    note: 'Release v1.0.0',
    facts: [
      'Append-only audit trail enforced by database triggers, with every change and its audit entries written in a single transaction.',
      '15 documented requirements traced to 219 pytest cases at 100% line and branch coverage.',
      'A CI-generated traceability matrix fails the build whenever a requirement lacks a passing test; each tagged release publishes a test execution report. CI runs on Python 3.11–3.14.',
      'Inspired by GxP and 21 CFR Part 11 practices, not compliant with them.',
    ],
    tech: ['Python', 'Flask', 'SQLAlchemy', 'SQLite', 'pytest', 'GitHub Actions'],
    repo: 'https://github.com/kartsen03/validated-study-tracker',
  },
  {
    id: 'trial-feasibility-explorer',
    name: 'Clinical Trial Feasibility Explorer',
    tagline: 'An interactive dashboard over 88,960 ClinicalTrials.gov trials for clinical-trial feasibility questions.',
    period: 'Oct 2026',
    facts: [
      'Low accrual drove 32.4% of 11,855 terminated or withdrawn trials.',
      'Oncology trials stop early 25.9% of the time, versus 17.7% for cardiovascular.',
      'Industry Phase 3 trials use a median of 48 sites versus 1 for academic trials, and run 32.5 versus 42.3 months.',
      'Every API extract is verified against the reported total, with referential-integrity checks and a GitHub Actions pipeline that verifies the data snapshot’s SHA-256 checksum before deploying.',
    ],
    tech: ['R', 'Shiny', 'SQL', 'SQLite', 'GitHub Actions'],
    repo: 'https://github.com/kartsen03/trial-feasibility-explorer',
    live: 'https://karthik-sengupta.shinyapps.io/trial-feasibility-explorer/',
    liveNote: 'May take a few seconds to wake up',
  },
  {
    id: 'battery-rul',
    name: 'Battery RUL Prognostics',
    tagline: 'Forecasting, remaining-useful-life, and fault-detection models on NASA lithium-ion battery telemetry.',
    period: 'Aug 2026',
    facts: [
      '34 cells and 2,780 cycles (770k raw sensor samples), with a 7-cell supervised cohort selected through data-quality gates.',
      'LSTM capacity forecasting at 0.045 Ah RMSE, 24% better than a persistence baseline at a 20-cycle horizon.',
      'Random-forest remaining-useful-life regression at 16.6-cycle RMSE under leave-one-cell-out validation.',
      'Found that cycles labeled as faults were actually a second test protocol, so detectors scored at chance against them; rebuilt the evaluation on injected faults, reaching 0.94 ROC-AUC.',
    ],
    tech: ['Python', 'PyTorch', 'scikit-learn', 'statsmodels'],
    repo: 'https://github.com/kartsen03/battery-rul-prognostics',
  },
  {
    id: 'perceptual-quality-lab',
    name: 'Perceptual Image Quality Lab',
    tagline: 'When do PSNR and SSIM disagree, and can a model predict quality without a reference image?',
    period: 'Jul 2026',
    facts: [
      '234 seeded, reproducible distorted image pairs (JPEG, blur, noise), with up to a 0.29 SSIM gap at fixed PSNR.',
      'A no-reference quality model on 41 natural-scene-statistics features (gradient boosting), reaching 0.93 PLCC under image-grouped cross-validation.',
      '21 ground-truth tests, one of which caught a normalization error in the noise estimator.',
      'Honest limit: it measures where metrics disagree, not human opinion. Human (MOS) labels are the next step.',
    ],
    tech: ['Python', 'scikit-image', 'scikit-learn'],
    repo: 'https://github.com/kartsen03/perceptual-quality-lab',
  },
  {
    id: 'fitfight',
    name: 'FitFight',
    tagline: 'Real-Time Pose Perception Game',
    period: 'Spring 2026',
    facts: [
      'Tracks 33 body-pose landmarks from a webcam and classifies 5 exercises at 95%+ accuracy and 30+ FPS on CPU.',
      'Joint-angle state machines with hysteresis and temporal smoothing suppress noisy detections, inside a decoupled, fully unit-tested game engine.',
    ],
    tech: ['Python', 'MediaPipe', 'OpenCV', 'PyTorch', 'Pygame'],
  },
  {
    id: 'git-to-doc',
    name: 'Git-to-Doc',
    tagline: '4th Place, GDG Cloud Boston Hackathon',
    period: 'Jun 2026',
    facts: ['An LLM developer tool built by a 5-person team in a 5-hour sprint, with defensive output parsing and a benchmark harness.'],
    tech: ['Python', 'Ollama', 'Gemma'],
  },
  {
    id: 'portfolio',
    name: 'This portfolio',
    tagline:
      'A 3D anime-styled site with custom GLSL cel-shading and outline shaders and a VRM character pipeline, built over ten milestones.',
    period: 'Jul 2026 – now',
    facts: [],
    tech: ['React Three Fiber', 'Three.js', 'WebGL', 'GLSL'],
    repo: 'https://github.com/kartsen03/3D-Anime-Portfolio',
  },
  {
    id: 'calendar',
    name: 'Multi-Calendar Scheduling App',
    tagline: 'Strict MVC across three releases, recurring events with three edit scopes, and 90%+ mutation coverage.',
    note: 'Course project',
    facts: [],
    tech: ['Java', 'MVC', 'Swing', 'JUnit'],
  },
  {
    id: 'warehouse',
    name: 'Streaming Analytics Data Warehouse',
    tagline: 'A Kimball star schema and ETL pipeline over 98,000+ transactions into a cloud-hosted MySQL datamart.',
    note: 'Course project',
    facts: [],
    tech: ['R', 'MySQL', 'SQLite'],
  },
]
