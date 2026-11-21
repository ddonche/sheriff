# Desk saved changes and build status

Implemented locally, 2026-11-14. Cloud source is prepared; this change has not
been deployed. The existing shared Desk header shows a notice when saved work
needs building. Nothing forces a build.

Source-only lifecycle corrections were added on 2026-11-15. They also fix
starter-file YALL indentation and Windows listing of Cloud-download snapshots
whose metadata has no stored size property.

## User behavior

- Media uploads save files without building. Navigation, Config, and theme-file
  editors offer Save (also Ctrl+S) and a separate Save & rebuild. Interactive saves
  its marker sidecar and reports that no build ran. These saved changes remain
  pending until an explicit successful build covers them.
- Portal creation and renaming, page/file operations, seeding, and snapshot
  restoration do not force a build. Guided setup offers an unchecked optional
  build choice. A restored snapshot replaces saved source and confirmed unsaved
  buffers; it does not replace completed output or publish anything. The pending
  notice offers an explicit build afterward, including deleted-portal recovery.
- Saving ordinary Markdown body edits marks those page files as pending.
- The notice names one page, multiple pages, or site-wide changes. Clicking it
  shows the affected files and offers Build page / Build N changed pages.
- Building changed pages uses the existing single-page schedule, one page at a
  time. It does not rewrite the source, run pre/post schedules, or rebuild the
  portal. The existing live build log receives each page's output.
- Navigation, configuration, patterns, theme files, media operations, deletions,
  and moves require a portal build. New pages and changes to routing metadata,
  inline categories, or stub membership also require it for generated listings.
  The review lists these reasons separately from page edits.
- Unsaved editor buffers remain separate. Review actions build saved files;
  they do not save or discard open editors. The existing editor Save / Build
  page / Build portal controls retain their behavior.
- Successful builds acknowledge only captured source and asset revisions in
  their scope. Edits saved while a build runs remain pending. Page builds leave
  shared changes pending. Failed builds and failed Cloud uploads retain work.

## Implementation

`sheriff-core/modules/desk_changes/state.gbln` owns comparison and persistence.
`desk/admin/requests/changes_request.gbln` and `desk/api/changes.gbln` expose it through the existing
native API pattern. `desk/admin/backend.js` observes shared Desk operations and
captures/acknowledges builds. `pending-builds.js` displays the notice and review.
The build kernel is unchanged. There are no new Python/PowerShell helpers.

Snapshots and asset revision markers live in
`data/.desk/changes/<portal>/`, outside source uploads and published output.
Completed and failed acknowledged build tickets are deleted. Cloud uses its
existing authenticated, owner-scoped API and R2 publishing path. New `page.build`
reads the saved page without writing it again.

## Boundaries

- Existing sites have no historical source/build snapshot. On first use, tracking
  starts from their current source; unbuilt portals start with pending source.
- Source text edits outside Desk are detected on refresh/focus. Binary asset
  changes are recorded through Desk's upload/move/delete operations; arbitrary
  external binary edits still require a manually requested portal build.
- CLI builds do not acknowledge this Desk state. They can leave a conservative
  extra pending notice until a corresponding Desk build. No build-kernel hook
  was added just to clear that notice.
- A browser interrupted before receiving a final build result keeps work pending
  and may leave a private ticket. It never silently acknowledges that build.

## Verification

Run `node scripts/check-pending-builds.mjs` in Sheriff Cloud. It exercises the
actual Goblin tracker across separate processes, both shared backend modes,
saved-buffer builds, failure retention, partial coverage, newer edits, shared
metadata, media revisions, generated-page exclusion, and Cloud authorization.

A disposable native Desk portal was also checked through its UI: two Save-only
edits, refresh persistence, reviewing changed pages, then two actual single-page
builds and a cleared notice. Neither build ran pre/post schedules.

The broader existing `check-hosted-desk.mjs` also passed all 155 hosted Desk
API/browser checks, including full builds and mock R2 publishing. On Windows
these checks need process-identity access for build ownership; the restricted
sandbox produces an ownership error even with unchanged code. No live portals
or R2 data were touched.

## Saved-changes panel consistency

The build review reuses the existing help panel's header, close control, body,
footer, sizing, and shared drag code. It is modeless so editing can continue,
remembers its position, and closes with Escape. Local and hosted mode fixture
checks cover styling parity, dragging, focus, mobile fit, and page/portal choices.
Use Cloud's scripts/check-floating-review.cjs to rerun those focused checks.

## Persistent history and portal lifecycle — 2026-11-15

The Goblin tracker now stores the most recent build attempt, successful build,
and successful publication in its private per-portal state. The Dashboard shows
server timestamps after reload, plus whether saved changes need building or the
latest recorded build has no confirmed publication. This is a small history
summary; full terminal output remains the current session's live log.

A failed build preserves the previous successful build and publication. A failed
upload records its separate outcome and timing without claiming publication.
Local Push records publication only after Cloud confirms it, against the captured
build ID; a newer concurrent build is never incorrectly marked published. A
completed source/output push also records the received build in hosted Desk.
Failure to save history does not turn a completed R2 publication into a false
upload failure; the transfer log reports that history warning separately.

Renaming a local portal moves its saved-source baseline, asset revisions and
build/publication history to its new local name. It also retains the same private
Cloud site ID. No manual pairing or Cloud-site rename is required. Local deletion
clears those private records; it does not delete the Cloud site. Snapshot-only
names are excluded from Cloud's source inventory and cannot be pushed until their
source is restored/downloaded.

CLI acknowledgement and arbitrary external binary-file detection remain the
explicitly deferred native-runtime tasks described above. The generic build
kernel remains independent of Desk. This work adds no backend helper language.

## Failed-build retry correction — 2026-11-15

A Goblin run may print its terminal exit footer while actor teardown keeps its process alive. The existing local live-log workers and hosted process runner now preserve that final exit code and retire only that completed child after a short graceful-exit window. This releases the matching output lease and permits an immediate corrected retry while retaining the working site. The real pre-schedule failure/retry regression is scripts/check-build-retry.cjs in Cloud. The picker also refreshes preview URLs and retries failed image requests once; scripts/check-image-picker.cjs covers both environments. Verified locally, not deployed.

