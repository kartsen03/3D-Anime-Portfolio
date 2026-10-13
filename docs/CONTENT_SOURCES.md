# Content sources

Every claim on the site comes from a public repository's README or committed results,
from a course report, or from the résumé. Checked 2026-10-13. When a source changes,
update the copy in `src/content/` and this file together.

| Section | Claim | Source |
|---|---|---|
| About | MS CS, Northeastern Khoury, GPA 4.0, Sep 2025 – Dec 2027; BTech CSE, VIT, GPA 3.55 | `public/resume.pdf`, Education |
| About | President, Khoury Masters Student Council (Apr 2026 –); Treasurer (Dec 2025 – Mar 2026) | `public/resume.pdf`, Leadership |
| About | RetailGPT, ICSSAS 2024 | `public/resume.pdf`, Publications |
| minicompiler | 37 → 13 IR nodes for the MLP block | `kartsen03/minicompiler` README, "IR before and after" |
| minicompiler | Fused GELU 10.1–10.5× from 16 MB; 92–93% of peak bandwidth from 64 MB | README, GPU fusion section; `results/gpu/elementwise.json` |
| minicompiler | FP32 matmul 75–104% of cuBLAS (square and odd shapes); tensor cores 63–110% of cuBLAS tensor-core GEMM | README, matmul and tensor-core tables; `docs/CLAIMS_AUDIT.md` |
| minicompiler | README numbers generated from result files; sanitizer and CUDA 12.6 / 13.4 CI builds | `CONTRIBUTING.md`; `.github/workflows/ci.yml` |
| Trial Feasibility Explorer | 88,960 trials; 32.4% of 11,855 stopped trials cite low accrual | `kartsen03/trial-feasibility-explorer` README, Data and Findings |
| Trial Feasibility Explorer | MeSH-based areas; findings regenerated from SQL; table view for every chart | README, Methods and Dashboard; `methods.md` |
| Battery RUL | RF 16.6 vs ridge 25.3 cycles RMSE (sensor-only, leave-one-cell-out); capacity changes it by 0.2 | `kartsen03/battery-rul-prognostics` README; `reports/metrics/rul_overall.csv` |
| Battery RUL | LSTM loses to persistence over 1–5 cycles; ARIMA misses the threshold in 12 of 15 | README, negative results; `reports/metrics/eol_summary.csv` |
| Battery RUL | Elliptic envelope ROC-AUC 0.94; LSTM autoencoder 0.67 (synthetic, injected faults) | README; `reports/metrics/anomaly_overall.csv` |
| Validated Study Tracker | 219/219 tests, 15/15 requirements traced, 100% line and branch coverage at v1.0.0 | Release v1.0.0 test execution report; README |
| Validated Study Tracker | "Inspired by", no compliance claim | README banner |
| Perceptual Quality Lab | SSIM 0.896 / 0.878 / 0.761 at 31 dB (13 of 18 images); blind model SROCC 0.760 | `kartsen03/perceptual-quality-lab` README; `results/summary.md` |
| Git-to-Doc | Five-person team, five hours; my scaffold, team guide and benchmark script | `dkumar247/NU-Gemma-hackathon` (`HACKATHON_CONTEXT.md`, git log) |
| FitFight | 19.8 FPS mean over 1,190 frames; 94.3% mean rep-count agreement | CS5330 final project report, Tables I and II |
| Experience | IIT Delhi and LTIMindtree bullets | `public/resume.pdf`, Experience (quoted) |

Project "last updated" dates are refreshed from the GitHub API by `scripts/sync-github.mjs`,
which runs before every build.
