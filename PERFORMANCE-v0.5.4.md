# Rayna v0.5.4 general performance

Tested: 2026-07-19 (Australia/Melbourne)

## Summary

Rayna's released v0.5.4 prerelease is responsive in normal library browsing. A cold launch reached its first window in **1.77 s** and a usable, populated Home view in **2.49 s**. Warm route changes generally completed in **0.54-1.01 s** (median **0.77 s**). Search-field input updated in **0.11 s**.

The main performance concern is memory use: the complete five-process app group settled at approximately **574 MiB RSS** while idle and briefly measured **703 MiB RSS** shortly after launch. Settled idle CPU averaged **2.7%** across five one-second samples, with most of it in the GPU helper.

Overall assessment: **good interactive responsiveness, moderate-to-high desktop memory footprint, and low-but-nonzero idle CPU use**.

## Release and test environment

| Item | Value |
| --- | --- |
| Tested app | `/Applications/Rayna.app` |
| Bundle version | `0.5.4-alpha.2` |
| Bundle identifier | `com.ib.rayna` |
| App bundle size | 523 MiB on disk (535,572 KiB) |
| Machine | MacBook Pro (Mac15,6), Apple M3 Pro, 36 GB RAM |
| OS | macOS 27.0, build 26A5378n, arm64 |
| Data state | Existing populated local library |
| Interaction method | macOS Computer Use against the released app UI |

The installed bundle identifies itself as `0.5.4-alpha.2`; this report treats it as the requested v0.5.4 prerelease.

## Measurements

### Startup

| Measurement | Time |
| --- | ---: |
| Cold launch to first window | 1,772 ms |
| Cold launch to usable Home view | 2,490 ms |
| Additional loading after first window | 718 ms |

The first window displayed a loading state. The usable threshold required the search field and populated Home content, including Recently Played, to be present.

### Warm interaction latency

| Interaction | Samples | Result |
| --- | --- | ---: |
| Albums to Home | 1,011 ms, 542 ms | 777 ms average |
| Home to Albums | 752 ms, 782 ms | 767 ms average |
| All warm route samples | 1,011 ms, 752 ms, 542 ms, 782 ms | 772 ms average; 767 ms median |
| Search field value update | 105 ms | 105 ms |

Routes were considered ready when the accessibility tree exposed the destination URL and populated content. These are end-to-end observed timings and include Computer Use capture/settling overhead, so they are best used as user-perceived regression baselines rather than pure renderer benchmarks.

Submitting the search field with Return did not navigate to a results route during this run, so search-result loading time was not recorded.

### Idle resource use

The settled app group comprised the main process, GPU helper, network utility, local API, and renderer.

| Sample | Aggregate CPU | Aggregate RSS |
| --- | ---: | ---: |
| 1 | 2.9% | 587,824 KiB |
| 2 | 2.6% | 587,824 KiB |
| 3 | 2.6% | 587,840 KiB |
| 4 | 1.9% | 587,840 KiB |
| 5 | 3.7% | 587,872 KiB |
| Average | **2.7%** | **587,840 KiB (574 MiB)** |

The GPU helper accounted for most steady idle CPU in four of the five samples. Memory was stable across the five-second idle window (only 48 KiB spread), so no short-window growth was observed.

### Shortly after cold launch

At roughly 11 seconds after launch, the app group measured:

- **23.9% aggregate CPU**
- **720,224 KiB RSS (703 MiB)**

This is a single post-launch snapshot, not a sustained average. The earlier multi-sample settled baseline is the better idle figure.

## Interpretation

- Startup is reasonable for a packaged desktop media app and reaches usable content within 2.5 seconds on this machine.
- Warm library navigation feels responsive, with all measured route changes at or near one second.
- The 574 MiB settled RSS footprint is the clearest optimization opportunity. The main process and renderer are the largest contributors, followed by the local API and GPU helper.
- Idle CPU is not excessive, but the persistent GPU-helper activity is worth profiling if battery life is a priority.
- No crash, blank screen, or visible interaction stall occurred during the successful benchmark paths.

## Suggested regression targets

| Metric | Current baseline | Suggested guardrail |
| --- | ---: | ---: |
| Cold launch to usable Home | 2.49 s | under 3.0 s |
| Warm route median | 0.77 s | under 1.0 s |
| Settled idle RSS | 574 MiB | under 600 MiB initially; optimize toward 450 MiB |
| Settled idle CPU | 2.7% | under 3.0% average |

## Scope and limitations

This was a general UI and process-level performance pass, not an instrumented profiler run. It covered cold launch, populated Home rendering, Home/Albums navigation, search-field responsiveness, and process CPU/RSS. Playback startup, long-session memory growth, background syncing, downloads, network variability, energy impact, and very large libraries were not benchmarked. CPU percentages are macOS process percentages and may span multiple cores.
