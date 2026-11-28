# Mobile LCP: compiled storefront

The mobile lab now meets its **2.5 s median LCP** budget: **3.50 s → 2.11 s**. This is a synthetic loopback result, not production or real-user LCP.

## Diagnosis and change

All ten reports attribute LCP to `figure.hero-photo > store-product-photo > picture > img`. The initial SSR HTML already contained an eager, high-priority image; the fixture itself is only 2,980 bytes. The network trace showed that the compiled 315,685-byte entry script was requested beside it without transfer compression. The response waterfall and local timings gave no reason to change the hero image, add preloads, or defer accessible content.

The storefront's Express runtime now negotiates gzip/Brotli for compressible responses, using the maintained [Express compression middleware](https://expressjs.com/en/resources/middleware/compression/). The API/media route is outside that server. `Range` and responses setting cookies bypass compression. The HTTP regression requests gzip and Brotli separately and checks their encodings, `Vary: Accept-Encoding`, decoded byte equality with identity, and an exact uncompressed `206` response.

## Comparable five-run batches

- Baseline `051939b`; change: Express transfer compression only. URL `http://127.0.0.1:43863/`, compiled SSR, same disposable PHP/SQLite fixture and loopback lab proxy, no dev server or staging. One warm-up GET to each fresh Node SSR process; a freshly launched Lighthouse Chrome and storage reset per run. No browser suites or Docker builds ran during either batch.
- Lighthouse **13.6.0**, Playwright Headless Chrome **159**, Windows, Node **24.20.0**. Unchanged simulated mobile profile: **412×823**, DPR **1.75**, **150 ms RTT**, **1,638.4 Kbit/s** configured throughput, **4× CPU slowdown**. Results include all five runs in their recorded order.

| Run | Baseline LCP | Compressed LCP |
| --- | ---: | ---: |
| 1 | 3,500.8 ms | 2,059.8 ms |
| 2 | 3,426.3 ms | 2,267.9 ms |
| 3 | 3,464.8 ms | 2,193.0 ms |
| 4 | 3,547.9 ms | 2,073.7 ms |
| 5 | 3,499.7 ms | 2,109.0 ms |
| **Median** | **3,499.7 ms** | **2,109.0 ms** |

Median total transfer fell from **406,637 B to 161,260 B** (60% less); CLS was 0 and median TBT was 162/172 ms. The unthrottled trace breakdown had median TTFB **612/839 ms**, resource start delay **33/18 ms**, resource transfer **14/13 ms**, and render delay **485/481 ms** (baseline/compressed). These raw trace values do not sum to simulated LCP. The lab improved in spite of measured TTFB variation, not because TTFB improved. Verify TTFB, cache/edge negotiation, real main images and field metrics when staging and traffic exist. See the [Chrome LCP diagnosis guide](https://web.dev/articles/optimize-lcp).

## Reproduce

Use the three [isolated lab servers](DEVELOPMENT.md#reproduce-the-mobile-storefront-audit). From `web/` run `node e2e/fixtures/check-store-encoding.mjs` and the Lighthouse command five times, appending `--save-assets` and choosing a distinct JSON report path for each invocation. The local comparison, raw JSON, initial HTML, traces and DevTools network logs are in `web/performance-results/section9-051939b/{before,encoding}/` (excluded from Git). Do not replay the old candidate's closed reviews to compare builds.

For field follow-up, use the public storefront's mobile 75th-percentile INP once Chrome UX Report has sufficient data. If it does not, arrange first-party telemetry collecting only the timing, route class and coarse device class; do not transmit form values, order IDs, raw URL parameters or session data. Lab TBT and the browser flows above do not stand in for field INP.
