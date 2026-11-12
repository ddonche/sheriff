# Full-build output and snapshots

Full portal builds no longer ZIP the existing output. Sheriff renders into
`data/.desk/builds/<portal>/next`, keeping `dist/<portal>` available while it runs.
After success, the completed output replaces `dist/<portal>` and the former
output becomes `data/.desk/builds/<portal>/previous`. Only one previous full
build is retained; each successful full build replaces it. Failed builds discard
incomplete output and leave the current site intact. Existing ZIP backups are
left alone, but new automatic build ZIPs are not created.

On Windows, an open output folder can prevent directory renaming. In that case,
Sheriff copies the previous output privately and replaces completed files in the
existing directory. This happens after rendering succeeds; this fallback is a
file-by-file activation rather than an atomic directory switch.

Desk uses its existing build worker for preparation and activation. Direct CLI
builds invoke the platform helper. This avoids extra PowerShell startup in Desk,
but direct CLI builds can still incur helper startup overhead on Windows.

Single-page local builds continue to write that page's scheduled output into the
current directory. They do not rotate full builds or run pre/post schedules.

## Output contract for modules and glams

Build contexts include `output_dir`. Writers must use that output directory
instead of hardcoding `dist/<portal>`. Core's `build_output::directory(portal)`
provides it to regular modules. Isolated glams receive it through the context;
they do not import Core helpers. Without an explicit output directory, standalone
module calls retain their existing `../dist/<portal>` default.

## Cloud publishing

Hosted full builds remain in `next` until R2 publishing succeeds. The upload
script accepts only that portal's explicit `next` directory (or its private
single-page output directory). It never uploads `previous`, lease metadata, or
build history. A failed upload keeps one pending output for diagnosis; starting
the next full build replaces it. Published full output is activated locally only
after upload success. Uploads retain the existing R2 full-sync semantics; this
change does not make a multi-object R2 upload atomic.

Hosted single-page builds use `data/.desk/page-builds/<portal>/next`, publish only
that page's emitted files without remote deletions, and preserve the full search
index through the existing upload rules. Successful page output is merged into
an existing retained full build, when one exists.

## Source snapshots and transfer

Snapshots still archive only `site/portals/<portal>` and are explicit source
restore points. Generated output/history lives outside that tree. Container
packaging excludes portal source, `data`, and portal output. Any future source
transfer must select `site/portals/<portal>`; build publication must select only
the completed output directory, never the repository or the parent `dist` tree.

## Initial timing check

On an isolated copy of Programming (315 emitted files, about 5 MB of public
assets), two warmed Desk-worker samples averaged 5.93 seconds before and
5.75 seconds after. This is a small, noisy difference, not evidence of a large
speedup. Direct Windows CLI samples averaged 5.77 seconds before and
6.13 seconds after because the two platform helper launches cost more than
ZIP compression saved for this fixture. Rendering remains the main cost.
The emitted files matched after normalizing checkout line endings.
