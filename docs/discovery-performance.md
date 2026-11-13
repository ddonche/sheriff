# Local source discovery performance correction

Measured: 2026-11-13, Windows, existing Goblin 0.51.26. Deployed to Cloud in Fly release 607 on 2026-11-13, alongside the plain-frontmatter seeder correction. Goblin remains 0.51.26 and Cloud remains on one page worker.

## Finding

The reported Desk build rendered 184 pages with two page workers. Its log recorded 4,497 ms pre-schedule, 983 ms discovery, 3,746 ms page schedules and 372 ms post-schedule, with a Sheriff runtime of 9,912 ms and total Desk elapsed time of 12.21 seconds.

A copied Programming portal reproduced the bottleneck. Source discovery repeatedly split and scanned every source row for each emitted page to find its selected version, available versions, version URLs and revision history. Both route passes, portal video statistics and final render discovery invoked this work. ZIP removal and parallel rendering did not eliminate it.

## Change

In `sheriff-core/modules/trailboss_wiki/routes_json.gbln`, `records_from_rows` now builds per-page/per-version lookup maps once. `source_row_sets` uses maps for membership checks while retaining the existing ordered row arrays. All feature changes are Goblin. The generic runner, schedules, runtime binary and external helpers are unchanged.

The local Programming portal's `config.yall` now selects `build.workers: 4`, following measurement on this machine (12 logical processors). Other portals retain their existing settings. Cloud remains capped at one page worker.

## Copied full-build measurements

Same copied source portal, 184 rendered pages, warmed baseline:

| Phase | Original / 2 workers | Indexed / 2 workers | Indexed / 4 workers |
| --- | ---: | ---: | ---: |
| Pre-schedule | 3,391 ms | 916 ms | 924 ms |
| Final page discovery | 941 ms | 23 ms | 19 ms |
| Page schedules | 3,652 ms | 3,735 ms | 2,406 ms |
| Post-schedule | 309 ms | 295 ms | 378 ms |
| Full Goblin command | 9,189 ms | 5,923 ms | 4,780 ms |

Full command time also includes runner startup and the retained-output lifecycle. These are measured samples, not guaranteed timings or 1,000/10,000-page benchmarks. The copied CLI runs include their own output lifecycle; Desk's worker starts/activates output outside the timed Goblin child process, so its displayed build time and total elapsed time are different measurements.

## Verification

- All 479 generated files match the original baseline byte for byte with both two and four workers.
- Ten native Goblin regression checks cover selected/alternate/fallback versions, ordered revision history, legacy pages, repeat calls and empty portals (`tests/test-source-record-index.gbln`; run from `sheriff-core` using `goblin run ../tests/test-source-record-index.gbln`).
- Category namespace integration, canonical-conflict diagnostics, 20 schedule-only page checks, 13 portal-statistics scenarios and deterministic serial/swarm worker checks passed.
- The existing canonical/stats test fixtures were updated to include their current module dependencies; the stats fixture also had one stale pre-0.51.26 builtin call corrected.
- Measurements and output-hash comparisons are retained locally under `C:/Users/kc516/Documents/Sheriff/build-performance-20261113`. No original portal pages or active output were rebuilt during profiling.

The remaining measured work includes page rendering and process/output lifecycle overhead. Larger scaling measurements and the separately deferred Goblin-native helper migration remain pending.

## Deployment verification

Fly release 607 passed the Linux container checks and live health checks. Deployed Core hash: b5b59978982ecb8fa2640773444e765320a28a0e0aee5521018b8609a2e38f3d. All 393 production source files were unchanged. No production portal was built or published during rollout. The performance measurements above are local copied-portal measurements, not a production Cloud benchmark.
