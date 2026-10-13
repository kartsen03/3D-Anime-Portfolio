// Project cards, strongest first. Fields:
//   id, name, tagline, period, description, facts[] (short, each verifiable), tech[]
//   repo (GitHub URL) — also used by scripts/sync-github.mjs to keep "last updated" current
//   live (URL of a running demo), note (badge such as "Team project")
//
// Every number below is quoted from the linked repo's README or committed results (or,
// for course work, from the course report). Wording follows each repo's own claims
// rules: "x% of cuBLAS at shape S", never "beats cuBLAS"; "inspired by", never
// "compliant". Sources: docs/CONTENT_SOURCES.md.

export const projects = [
  {
    id: 'minicompiler',
    name: 'minicompiler',
    tagline: 'An ML-graph compiler in C++17 with hand-written CUDA kernels',
    period: 'May – Oct 2026',
    description:
      'Parses a graph program into a DAG IR, runs dead-node elimination, constant folding and elementwise fusion, plans buffer reuse from value lifetimes, and executes on an Eigen CPU backend or a CUDA backend that generates one NVRTC-compiled kernel per fused group. The matmuls are a ladder of hand-written kernels — naive to double-buffered and split-K, plus opt-in tensor-core versions — each step measured against cuBLAS and profiled with Nsight Compute.',
    facts: [
      'The MLP block’s IR shrinks from 37 nodes to 13 after the passes.',
      'The fused GELU chain runs 10.1–10.5× faster than unfused from 16 MB up, at 92–93% of peak memory bandwidth from 64 MB up.',
      'The default FP32 matmul reaches 75–104% of cuBLAS on square and odd shapes; FP16/BF16/TF32 tensor-core kernels reach 63–110% of cuBLAS’s tensor-core GEMM.',
      'Every README number is generated from committed result files; CI builds with sanitizers and two CUDA versions.',
    ],
    tech: ['C++17', 'CUDA', 'NVRTC', 'WMMA', 'Eigen', 'Nsight Compute', 'GoogleTest', 'CMake'],
    repo: 'https://github.com/kartsen03/minicompiler',
  },
  {
    id: 'trial-feasibility-explorer',
    name: 'Trial Feasibility Explorer',
    tagline: 'A live dashboard over 88,960 ClinicalTrials.gov trials',
    period: 'Oct 2026',
    description:
      'An R Shiny dashboard for the questions a feasibility team asks when designing a study: how many participants and sites comparable trials use, how long they take, and how often and why they stop early — by phase, therapeutic area, status, sponsor type and start year. A scripted pipeline pulls the registry through its API with counts verified, builds a SQLite database with integrity checks, and GitHub Actions deploys the app from a pinned, checksummed data snapshot.',
    facts: [
      'Low accrual is the most common reason trials stop early: 32.4% of the 11,855 terminated or withdrawn trials.',
      'Therapeutic areas come from the MeSH hierarchy rather than keyword matching; estimated and actual enrollment are kept apart.',
      'The README’s findings are generated from the dashboard’s own SQL, and the build fails if a new snapshot makes one of them false.',
      'Every chart has a table view, so no value is reachable only by hovering.',
    ],
    tech: ['R', 'Shiny', 'SQLite', 'httr2', 'testthat', 'GitHub Actions'],
    repo: 'https://github.com/kartsen03/trial-feasibility-explorer',
    live: 'https://karthik-sengupta.shinyapps.io/trial-feasibility-explorer/',
    liveNote: 'May take a few seconds to wake up',
  },
  {
    id: 'battery-rul',
    name: 'Battery RUL prognostics',
    tagline: 'Battery life forecasting and anomaly detection, scored leave-one-cell-out',
    period: 'Aug 2026',
    description:
      'Remaining-useful-life regression, capacity forecasting and unsupervised anomaly detection on the NASA PCoE lithium-ion ageing dataset. Evaluation is leave-one-cell-out with backward-looking features throughout, and the write-up reports where the models lose, not just where they win. The fault benchmark uses injected, synthetic faults, and says so.',
    facts: [
      'From sensor features alone, random forest RUL error is 16.6 cycles RMSE leave-one-cell-out, against 25.3 for ridge; adding capacity features changes it by only 0.2 cycles.',
      'Over the first five cycles ahead the LSTM forecaster loses to persistence; ARIMA fails to cross the end-of-life threshold in 12 of 15 cases.',
      'An elliptic envelope detects the injected faults at ROC-AUC 0.94; the LSTM autoencoder trails at 0.67.',
    ],
    tech: ['Python', 'PyTorch', 'scikit-learn', 'statsmodels', 'Prophet', 'pandas', 'pytest'],
    repo: 'https://github.com/kartsen03/battery-rul-prognostics',
  },
  {
    id: 'validated-study-tracker',
    name: 'Validated Study Tracker',
    tagline: 'A requirements-first study tracker with an append-only audit trail',
    period: 'Oct 2026',
    description:
      'A Flask and SQLAlchemy app for clinical study records, written requirements-first: 15 numbered requirements, a status lifecycle enforced in the service layer and again by SQLite triggers and CHECK constraints, and an audit trail that requires a reason for every change. Tests are named after the requirement they verify, and CI fails unless every requirement has a passing test. It is inspired by the audit-trail expectations of GxP practice and 21 CFR Part 11; it has not been validated and makes no claim of compliance.',
    facts: [
      'v1.0.0: 219 of 219 tests pass, and 15 of 15 requirements are traced to passing tests.',
      '100% line and branch coverage at release; CI fails below 90%.',
      'Audit entries can’t be updated or deleted, enforced by database triggers as well as the application.',
    ],
    tech: ['Python', 'Flask', 'SQLAlchemy', 'SQLite', 'pytest', 'ruff', 'GitHub Actions'],
    repo: 'https://github.com/kartsen03/validated-study-tracker',
  },
  {
    id: 'perceptual-quality-lab',
    name: 'Perceptual Quality Lab',
    tagline: 'When PSNR and SSIM disagree, plus a blind image-quality model',
    period: 'Jul 2026',
    description:
      'A reproducible study of when PSNR and SSIM disagree across JPEG compression, blur and additive noise, on 18 reference images and 13 distortion conditions (234 scored pairs), with a 41-feature blind model that predicts SSIM from the distorted image alone. There are no human opinion scores, so it measures metric disagreement rather than perceptual accuracy — and the README says so.',
    facts: [
      'At a fixed 31 dB PSNR, mean SSIM is 0.896 for blur and 0.878 for JPEG but 0.761 for noise (over the 13 images that reach 31 dB in all three).',
      'The blind gradient-boosting model reaches SROCC 0.760 under GroupKFold by source image.',
      'Every number regenerates from one script in about a minute.',
    ],
    tech: ['Python', 'scikit-image', 'scikit-learn', 'NumPy', 'SciPy', 'pandas'],
    repo: 'https://github.com/kartsen03/perceptual-quality-lab',
  },
  {
    id: 'portfolio',
    name: 'This portfolio',
    tagline: 'A walkable, cel-shaded 3D world built from scratch',
    period: 'Jul 2026 – now',
    description:
      'The island you are exploring. A VRM character with Mixamo clips retargeted onto its humanoid rig and blended by speed with foot-synchronised walk and run cycles; custom GLSL toon lighting and a screen-space outline pass; a lean post-processing chain with adaptive quality tiers; keyboard, mouse and touch controls; and a text version of every section for screen readers.',
    facts: [
      'Rebuilt in October 2026 around a frame-time budget for integrated laptop GPUs.',
      'Every section is reachable by keyboard alone, by touch, and in the text version.',
    ],
    tech: ['React', 'React Three Fiber', 'Three.js', 'GLSL', 'three-vrm', 'Vite'],
    repo: 'https://github.com/kartsen03/3D-Anime-Portfolio',
  },
  {
    id: 'git-to-doc',
    name: 'Git-to-Doc',
    tagline: 'Commit messages and changelogs from a local Gemma model',
    period: 'Jun 2026',
    note: 'Team project',
    description:
      'Built by a five-person team in five hours at the GDG Cloud Boston × Northeastern University hackathon powered by Gemma. A command-line tool that reads a git diff, sends it to a local Gemma model through Ollama or LM Studio, and prints a validated Conventional Commit message and a changelog snippet. The model is chosen at run time, so teammates could run different Gemma sizes against the same code. I wrote the initial scaffold, the team guide and the benchmark script.',
    facts: [],
    tech: ['Python', 'Ollama', 'Gemma', 'Git'],
    repo: 'https://github.com/dkumar247/NU-Gemma-hackathon/tree/main/git-to-doc',
    repoLabel: 'Team repo',
  },
  {
    id: 'fitfight',
    name: 'FitFight',
    tagline: 'A webcam fighting game you play with your body',
    period: 'Spring 2026',
    note: 'Course project',
    description:
      'Fight three AI bosses with squats, punches, lunges, overhead presses and jumping jacks, recognised in real time from 33 MediaPipe BlazePose landmarks by joint-angle state machines with hysteresis and smoothing. The game engine has no rendering or I/O dependencies, so its logic can be exercised apart from the camera.',
    facts: [
      'Measured in the course report: about 20 FPS on a CPU (19.8 FPS mean over 1,190 frames).',
      '94.3% mean rep-count agreement across the five exercises, on one scripted trial each.',
    ],
    tech: ['Python', 'OpenCV', 'MediaPipe', 'NumPy', 'pygame'],
  },
]
