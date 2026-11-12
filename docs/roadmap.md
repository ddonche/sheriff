# Sheriff work list

Updated: 2026-11-12. This records agreed work and its current status. The larger
product backlog is not automatically a requirement for Sheriff 1.0.

## Immediate release work

- [x] Finish the build-performance release.
  - [x] Implement ZIP-free full builds with one private previous output.
  - [x] Verify working output survives build failures and Windows open folders.
  - [x] Keep build history out of publication output and source snapshots.
  - [x] Implement bounded local swarm page rendering, ordered per-page schedules,
    deterministic result collection, live completion messages, and phase timings.
  - [x] Compare every output byte on a copied Programming portal: all 315 files match.
  - [x] Keep Cloud page rendering serial; no CPU allocation or hosting-cost change.
  - [x] Sync the changes into the local Cloud checkout and pass Windows hosted checks.
  - [x] Run Linux checks on the final combined package, including the new swarm
    test and the local/Cloud worker policy.
  - [x] Deploy the ZIP-free lifecycle and updated logs to Cloud with page rendering
    still serial. Do not upload local sites or change production portal source.
- [x] Bring GitHub up to date with the new build work, regression tests, and the
  already-deployed Prospector bounds fix. Resolve the release from a clean Core
  commit and refresh Cloud's Core lock. Application code and tests are pushed;
  local portal edits remain excluded.
- [x] Finish release documentation for build workers, output retention, snapshots,
  and local-versus-Cloud behavior; verify docs match the shipped release.
- [ ] Measure full-build scaling with larger synthetic portals (1,000 then 10,000
  pages), worker counts, memory, and per-phase timing. Identify remaining expensive
  pre-schedule/assets/routing work from measurements. No large-scale performance
  result has been established yet.

## Site seeding and stub articles — agreed next feature

Status: design agreed; not implemented.

- [ ] Add an explicitly invoked YALL seeder; do not seed on every normal build.
- [ ] Accept category-to-page nested maps, with optional page metadata and extra
  categories. Example:

  ```yall
  seed:
    Vaults:
      "Vault 101": {}
      "Vault 111":
        summary: "A Vault-Tec shelter featured in Fallout 4."
        categories: [Fallout 4]
  ```

- [ ] Create ordinary Markdown sources using Sheriff's filename/canonical rules,
  wiki frontmatter, supplied metadata, and `{{{SHERIFF::STUB}}}`.
- [ ] Preview planned creations, skips, and conflicts; report the actual result.
- [ ] Never overwrite existing articles or restore a stub marker an author removed.
- [ ] Merge repeated entries for the same article across category groups before
  creating it. Report conflicting paths/canonicals/metadata rather than silently
  combining unrelated pages or choosing a winner.
- [ ] Support the stub token on manually created pages independently of seeding.
- [ ] Render a theme-styled, customizable built-in stub notice. Keep the semantic
  marker independent of the notice's wording and presentation.
- [ ] Derive stub status centrally in wiki indexing and pass that status to consumers.
  Exclude code examples and comments from marker detection.
- [ ] Automatically derive membership in a dedicated Stub pages category without
  writing that membership into source frontmatter. Removing the token removes it.
- [ ] Add an accessible stub icon to All Pages and category listings. Stub articles
  are existing pages, so links to them are resolved and they count as real pages.
- [ ] Distinguish category pages from articles in directory listings with an
  accessible category/folder icon. Page kind and stub status are independent;
  a category can also be marked as a stub. Derive kind from wiki route metadata,
  not from title wording such as "books".
- [ ] Prefer a Subcategories section above the Pages section on category pages,
  with each section alphabetized separately and omitted when empty. Preserve
  unique heading/TOC anchors. Keep a category icon wherever categories appear
  alongside articles in mixed listings.
- [ ] Preserve build boundaries: a page build updates that article; a portal build
  refreshes shared category/directory listings. Do not silently trigger full builds.
- [ ] Keep this in modules and scheduled actions; no stub-specific logic in the
  generic Core build runner. A Desk seeding interface can follow the CLI workflow.

## Theme versions and safe updates

Status: discussed; not implemented.

- [ ] Give themes stable identities, versions, compatibility metadata, release
  locations, and integrity information.
- [ ] Track the installed version and the base files against which portal-local
  customizations can be compared.
- [ ] Add update discovery/checking through a small registry adapter. Spur Downloads
  can initially host releases and expose their metadata; Glamr can come later.
- [ ] Preview updates and distinguish unchanged files, user changes, and conflicts.
  Preserve customization; provide source backup/rollback and clear conflict handling.
- [ ] Include copied `templates.yall`/layout defaults in the update design so fixes
  do not remain stranded in Core while sites retain stale copies.

## MOWI — MediaWiki/Fandom migration

Status: agreed architecture; no MOWI implementation found in the active checkout.

- [ ] Start as a separately invoked module containing independently runnable modules.
- [ ] Use scheduled passes carrying ctx, with extension points for additional passes.
- [ ] Support full conversion and selective passes over imported or existing content.
- [ ] Preserve unsupported constructs and report their type, locations, and counts.
- [ ] Let later passes convert those preserved constructs without repeating the full
  migration over already converted material.
- [ ] Build and test one pipeline piece at a time; then validate a real MW import.
- [ ] After the pipeline works, add per-portal activation and Desk/admin integration.
  MOWI is optional and does not ship as part of frozen Core behavior.

## Local Desk to Cloud

Status: planned; local Cloud Sync is still a placeholder.

- [ ] Authenticate local Desk to Cloud and select/link an authorized remote site.
- [ ] Add deliberate one-click deployment of selected portal source or built output.
- [ ] Transfer only the selected source tree or current completed output. Exclude
  private build history and unrelated local portals; protect current production data.

## Sheriff/Spur integration and administration

Status: Studio already has Desk/Studio/Settings switching, feature controls,
custom-domain controls, site selection, and reused Blog/Forum editors. Do not
rebuild those completed pieces.

- [ ] Finish converging the legacy Cloud admin entry point and Studio onto the same
  workspace implementation, preserving all existing administration capabilities.
- [ ] Retain both branded entry URLs, appropriate site_origin defaults, selected-site
  continuity, custom-domain admin links, and ownership checks.
- [ ] Continue navigation/design refinement as actual usage reveals friction.
- [ ] Implement Sheriff public header modes across supported layouts: both rows,
  bottom row only, or no header.
- [ ] Connect Sheriff and Spur public sections through an explicit shared-header
  provider and shared branding/navigation settings, including how static pages
  receive header changes. Pilot one combined site before expanding.
- [ ] Extract the Spur theme and build paired Sheriff/Spur theme families for Spur,
  Compendium, Outpost, and Siegemate.

## Distribution and smaller follow-ups

- [ ] Document a public Spur Downloads metadata/download integration for other sites
  and UIs. Keep simple digital-file distribution separate from dependency resolution
  and the full Glamr marketplace.
- [ ] Add a Desk video-embed insertion button/picker alongside image/icon/pattern
  insertion, when we return to editor conveniences.

## Deliberately deferred

- Cloud multi-core rendering and extra Fly CPU allocation: only when the owner
  decides to buy more capacity. Current policy keeps Cloud page builds serial.
- Discussion-count badges: wait until a discussion source/integration exists.
- Full Glamr marketplace/dependency management: outside the initial Downloads work.

## Completed foundations — do not reopen as unfinished features

- Prospector search, categories, thumbnails, incremental records, and its deployed
  empty-heading/title bounds fix. Search concurrency uses its existing actor pool.
- Goblin 0.51.26 native runtime and WASM REPL update.
- Shared local/Cloud Desk, Save / Build page / Build portal behavior, R2 publication,
  build/upload timing separation, and streaming log transport.
- Lucide catalog, custom PNG icons, optional icon sizing, navigation insertion,
  default/custom admonition icons, pattern tabs, media/stat badges, category
  namespaces, and earlier theme/pattern presentation fixes.

Production release 605 deployed on 2026-11-12: ZIP-free retained builds, build
phase timings, and serial Cloud page rendering. Local swarm remains enabled.
Sheriff Core is pinned to clean commit f2ae60b; Cloud application commit 4cbe000.
Linux and live-machine regression checks passed; all 381 production source files
were unchanged. No CPU allocation or hosting-cost change was made. This list
authorizes no further deployment, CPU purchase, or production content changes
by itself.
