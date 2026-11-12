# Parallel page builds

Full portal builds run their pre-schedule once, render pages with a bounded
Goblin `:swarm`, collect page results in source order, then run their
post-schedule once. Each page executes its complete schedule sequentially.
Single-page builds continue to execute only the page schedule.

Local builds default to two page workers. Choose a local count in `config.yall`:

```yaml
build:
  workers: 4
```

Supported values are 1, 2, 4, and 8. One uses the serial runner. The
`SHERIFF_BUILD_WORKERS` environment variable overrides the local portal setting
for benchmarking. Cloud mode (`SHERIFF_RUNTIME_MODE=cloud`) keeps page rendering
serial with one worker, regardless of these settings, until the Cloud CPU policy
is deliberately changed. Search preparation has its separate
`search.workers` setting.

Each swarm task gets isolated globals, context, and token state. Shared actor
and channel handles remain usable, allowing Prospector's record workers to
receive pages while rendering proceeds. Backlinks and wanted-page records are
collected in deterministic source order before the post-schedule uses them.

Modules must keep per-page changes in that page's context. Changes to ordinary
globals do not propagate to the next page in a swarm. Cross-page coordination
belongs in pre/post schedules or explicit actors/channels. File output must be
page-specific or safe when identical assets are copied concurrently. Use one
worker for extensions that require serial page processing.

A progress actor prints completed-page messages while the swarm is running.
Goblin's ordinary task output remains buffered until the swarm returns. Build
logs also report pre-schedule, page discovery, page schedules, and post-schedule
timings, separately from hosted R2 upload timing. A failed page cancels build
actors/channels, stops the full build, and leaves the previous working output
intact through the retained-build lifecycle.

## Initial measurement

An isolated Programming copy emitted 315 files. All bytes matched the original
pre-swarm runner, and 1/2/4-worker output matched. Two alternating measurements
averaged 5.40 seconds with one worker, 3.95 seconds with two, and 3.42 seconds
with four. Page-schedule time averaged 2.84, 1.59, and 1.05 seconds respectively.
These are local Windows measurements. Cloud CPU allocation and portal content
will affect the gain; the production machine currently has one shared vCPU.
