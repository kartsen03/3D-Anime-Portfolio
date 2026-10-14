# Content sources

Source of truth: Karthik's October 2026 content brief and his résumé
(`public/Karthik_Sengupta_Resume.pdf`). Project numbers were also checked against each
public repository's README on 2026-10-13. When a source changes, update the copy in
`src/content/` and this file together.

| Section | Claim | Source |
|---|---|---|
| Headline | MS Computer Science, Northeastern University. ML systems, GPU computing, and computer vision. | Content brief |
| About | 4.0 GPA, graduating December 2027; graduate TA, KMSC president, Global Student Mentor | Content brief; résumé |
| About | Seeking Spring 2027 co-op roles (January 2027 start) | Content brief |
| About | MS CS, Northeastern Khoury, Sep 2025 – Dec 2027 (expected), with coursework; B.Tech CSE, VIT, GPA 3.55/4.0, Sep 2021 – May 2025 | Content brief; résumé, Education |
| About | RetailGPT, ICSSAS 2024 | Content brief; résumé, Publications |
| About | Skills (five groups, no standalone JavaScript) | Content brief |
| minicompiler | 22 → 4 compute nodes; fused GELU 10.1–10.5× on 16–256 MB, 92–93% of peak DRAM bandwidth from 64 MB | `kartsen03/minicompiler` README (IR, GPU fusion sections) |
| minicompiler | 93% of cuBLAS at 2048³, 145% on the B=128 second MLP layer; B=128 MLP block 1.86× idiomatic PyTorch, 2.04× torch.compile | README, FP32 matmul table and PyTorch comparison |
| minicompiler | Tensor cores 63–110% of cuBLAS per format; FP16 1.5–2.2× FP32 | README, tensor-core table; `docs/CLAIMS_AUDIT.md` |
| minicompiler | CUDA-graph timing, interleaved shuffled rounds, SM-clock sampling, medians of 3 runs; 103 GoogleTest cases, 200 random graphs, CI across GCC/Clang/sanitizers and CUDA 12.6 + 13.4 | README, methodology and testing sections |
| Validated Study Tracker | Trigger-enforced append-only audit trail, one transaction per change; 15 requirements → 219 tests, 100% line and branch coverage; CI matrix gate on Python 3.11–3.14; "inspired by", not compliant | `kartsen03/validated-study-tracker` README; release v1.0.0 |
| Trial Feasibility Explorer | 88,960 trials; 32.4% of 11,855; 25.9% vs 17.7%; 48 vs 1 sites; 32.5 vs 42.3 months; verified extracts and SHA-256 snapshot check | `kartsen03/trial-feasibility-explorer` README, Findings and pipeline |
| Battery RUL | 34 cells, 2,780 cycles, 770k samples, 7-cell cohort; LSTM 0.045 Ah RMSE, 24% better than persistence at 20 cycles; RF 16.6-cycle RMSE leave-one-cell-out; second test protocol found, injected faults 0.94 ROC-AUC | `kartsen03/battery-rul-prognostics` README; `reports/metrics/*.csv` |
| Perceptual Image Quality Lab | 234 seeded pairs; SSIM gaps up to 0.289 at fixed PSNR; 41-feature blind model, gradient boosting PLCC 0.926 grouped by image; 21 tests, one caught a normalisation error; no MOS labels | `kartsen03/perceptual-quality-lab` README |
| FitFight | 33 landmarks, 5 exercises, 95%+ accuracy, 30+ FPS on CPU; hysteresis state machines; unit-tested engine | Content brief and résumé (no public repo). Note: the CS5330 course report measured 19.8 FPS mean and 94.3% rep-count agreement. |
| Git-to-Doc | 4th place, GDG Cloud Boston Hackathon; 5-person team, 5 hours | Content brief; résumé (team repo is not under kartsen03, so no link) |
| This portfolio | GLSL cel-shading and outline shaders, VRM pipeline, ten milestones | Content brief; this repo's `CLAUDE.md` roadmap |
| Course projects | Calendar app (three releases, three edit scopes, 90%+ mutation coverage); data warehouse (Kimball star schema, 98,000+ transactions) | Content brief (course code is never linked) |
| Experience | Graduate TA, Global Student Mentor, IIT Delhi, LTIMindtree (team-effort wording for the 500+ events and 35%) | Content brief; résumé, Professional Experience |
| Experience | KMSC President (Apr 2026 –) and Treasurer (Dec 2025 – Mar 2026), earlier Event Coordinator | Content brief, Leadership |

Project "last updated" dates are refreshed from the GitHub API by `scripts/sync-github.mjs`,
which runs before every build.
