# Goblin capabilities needed to remove Sheriff's external helpers

Recorded: 2026-11-13. Baseline: Goblin 0.51.26.

## Decision and current status

Sheriff feature logic must be written in Goblin. Browser JavaScript and theme HTML/CSS remain appropriate for the frontend. Do not add Python, PowerShell, another helper language, or shell-command implementations to work around missing Goblin capabilities.

The owner explicitly deferred this migration on 2026-11-13 and authorized keeping the existing helpers temporarily. They have **not** been removed or converted. Preserve the working features until their Goblin replacements are implemented and tested. This note does not authorize editing, recompiling, upgrading, or deploying Goblin.

## Existing runtime helpers

Each source path below currently has a `.py` and `.ps1` implementation.

| Capability | Helper path under `sheriff-core/` | Goblin caller |
| --- | --- | --- |
| Create seeded articles and save the plan | `modules/trailboss_wiki/seed-support/write` | `modules/trailboss_wiki/seeder.gbln` |
| Fresh build output, activation, rollback and private retention | `build-support/lifecycle` | `build_output.gbln` |
| Background local builds and live stdout/stderr | `desk/api/build-support/progress` | `desk/api/build_progress.gbln` |
| Snapshot creation, listing, download, restore and deletion | `desk/api/snapshot-support/snapshots` | `desk/api/snapshots.gbln` |
| Read and validate uploaded PNG icons | `desk/api/icon-support/png-icons` | `desk/api/list_icons.gbln` |

The build-log, snapshot and PNG helpers also have tracked copies under `dist/api/`. Remove those copies when replacing their source implementations. Shared Core copies in Sheriff Cloud and its release lock must be updated as part of the eventual rollout.

## Missing capabilities

These are behavioral requirements, not decided builtin names. Pure Goblin implementations are welcome where the existing language can express them; not every item needs a separate new builtin.

| Capability Goblin needs | Required behavior | Sheriff users |
| --- | --- | --- |
| Binary file I/O | Read exact bytes without UTF-8 conversion; write exact bytes where needed. Existing `:read_text` reads UTF-8 and cannot substitute for binary access. | PNG icons, snapshot downloads/checksums/restores, Lucide import |
| Filesystem metadata and link inspection | Inspect entries without following links; identify symbolic links and Windows junctions/reparse points; expose size and modification time. Resolve actual paths to enforce workspace containment. | All five helper groups |
| Exclusive file creation | Create only if absent in a single filesystem operation. A separate existence check followed by `:write_text!` can overwrite a file created between those calls. | Seeder articles and build ownership records |
| Atomic file replacement and filesystem rename | Replace a completed metadata file without exposing a partial write; move files/directories for staged activation and rollback. Preserve the existing Windows open-directory fallback. | Seeder plans, build outputs, live-job records, snapshot metadata/restores |
| Cross-process locking | Nonblocking ownership with release on process exit; serialize conflicting operations on the same portal. | Build lifecycle and snapshots |
| Process identity and liveness | Obtain a process ID, parent ID and stable process-start identity; distinguish a surviving owner from PID reuse and recover abandoned build leases. | Build lifecycle and live builds |
| Background processes and output redirection | Start a Goblin worker that survives the initiating HTTP request; supply argument arrays, cwd and environment; stream stdout/stderr to separate readable files; support timeout, termination and exit status. Hide helper windows on Windows. | Local Desk live build logs |
| ZIP inspection and extraction | Inspect entries and extract into a staging directory. Reject escaping paths, absolute/drive paths, links and duplicate entries before activation. Existing `:zip_dir!` creates archives; it does not extract them. | Snapshot restore |
| Byte encoding and checksums | Encode arbitrary bytes as base64 and compute SHA-256/SHA-512 over exact bytes. These algorithms may be Goblin code once binary access is available. | PNG previews, snapshot downloads/integrity, Lucide import integrity |
| Gzip/TAR reading | Read the pinned Lucide package archive without running package code; select validated SVGs and retain its license. | Lucide maintenance importer |

### Operations already available

Goblin already exposes text/JSON reads and writes, append, directory creation, file copy, recursive path deletion, existence/type checks, path manipulation, directory walking, UUIDs, timing and ZIP creation. Reuse these instead of adding duplicate APIs.

In the checked runtime implementation, `:write_text!` overwrites, `:create_dir!` recursively creates directories, and `:run_cmd` waits for completion and returns captured output. They do not provide exclusive writes, filesystem renames or detached live process supervision.

Source evidence: the local Goblin checkout at `C:/Users/kc516/Desktop/GoblinLang/goblin`, particularly `crates/goblin-vm/src/builtins.rs`, `compiler.rs`, `value.rs`, and `crates/goblin-interpreter/src/actions/files.rs`. Recheck the available runtime before implementing the migration; Goblin may gain these capabilities in the meantime.

## Remaining non-Goblin tooling

- `tools/sync-lucide-icons.py`: a maintenance importer, not page-build runtime code. It downloads a pinned package, verifies SHA-512 integrity, inspects its gzip/TAR contents and SVG elements/attributes, preserves compatible names and copies the license/catalog. It also needs a Goblin replacement.
- `tests/test-locked-output.py`: Windows open-directory build activation regression test; uses a native Windows directory handle and currently invokes the lifecycle helpers.
- `tests/test-hash-canonicals.ps1`: an isolated canonical/link regression harness.
- Existing JavaScript test harnesses exercise Goblin features and browser behavior. Inventory them separately from shipped frontend JavaScript when deciding the scope of the tooling migration.

## Migration acceptance checks

1. Preserve seeder CLI/Desk parity, preview-only behavior, exact frontmatter, no-overwrite guarantees, partial-failure reports and path/link checks.
2. Preserve fresh full builds, unchanged working output after failure, bounded private retention, Windows open-directory behavior and exclusion of history from publication.
3. Preserve live output before process completion, single-page schedule boundaries, separate build/upload timing, timeout handling and cleanup.
4. Preserve snapshot integrity, binary round trips, safe extraction, rollback and protection against concurrent operations.
5. Preserve valid PNG previews, the existing size/name/signature checks and SVG/PNG naming precedence.
6. Remove all helper subprocess calls and source/generated copies only after their Goblin replacements pass on Windows and Linux. No shell-language substitute.
7. Sync the tested Core into Cloud, update its integrity lock and verify packaging/runtime requirements. Exclude local portals and credentials; do not overwrite production sources.
8. Remove Python from the production image only after auditing Cloud's own tooling and validation dependencies. Sheriff helper removal alone does not prove that the separate Cloud repository no longer uses it.
