# Sheriff work list

Updated: 2026-11-13. This records agreed work and its current status. The larger
product backlog is not automatically a requirement for Sheriff 1.0.

## Goblin-only feature implementation — deferred migration

- [ ] Replace the existing Python/PowerShell helpers with Goblin implementations
  after the missing native capabilities are available. The owner authorized keeping
  the current helpers temporarily on 2026-11-13. Include seeding, build lifecycle,
  live local logs, snapshots, PNG loading, and the Lucide maintenance importer;
  remove generated helper copies too. Preserve behavior and verify Windows/Linux.
  See [Goblin capability requirements](goblin-native-runtime-gaps.md) for the
  inventory, runtime gaps and acceptance checks. Do not introduce more helper
  languages or shell-command substitutes.

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
- [x] Remove repeated full-list source-discovery scans using Goblin lookup maps.
  Local copied Programming portal: 184 pages, 9.19s to 4.78s with four workers;
  all 479 output files byte-identical. Version/history, routing, stats, page-build
  isolation and swarm regressions passed. Local only; see
  [discovery measurements](discovery-performance.md).
- [ ] Measure full-build scaling with larger synthetic portals (1,000 then 10,000
  pages), worker counts, memory, and per-phase timing. Identify remaining expensive
  pre-schedule/assets/routing work from measurements. No large-scale performance
  result has been established yet.

## Site seeding and stub articles — agreed next feature

Status: stub notices, generated-listing markers, automatic stub-category membership,
and explicit CLI/Desk YALL seeding shipped in Cloud release 606 on 2026-11-13.
The later seeder plain-frontmatter correction is local only. Theme icon settings
are editable in each local portal theme
`templates.yall`; `wiki_icons.category` and `wiki_icons.stub` support per-site
overrides. See `docs/stubs.md`.

- [x] Add an explicitly invoked YALL seeder; do not seed on every normal build.
- [x] Accept category-to-page nested maps, with optional page metadata and extra
  categories. Example:

  ```yall
  seed:
    Vaults:
      "Vault 101": {}
      "Vault 111":
        summary: "A Vault-Tec shelter featured in Fallout 4."
        categories: ["Fallout 4"]
  ```

- [x] Create ordinary Markdown sources using Sheriff's filename/canonical rules,
  wiki frontmatter, supplied metadata, and `{{{SHERIFF::STUB}}}`.
- [x] Preview planned creations, skips, and conflicts; report the actual result.
- [x] Never overwrite existing articles or restore a stub marker an author removed.
- [x] Merge repeated entries for the same article across category groups before
  creating it. Report conflicting paths/canonicals/metadata rather than silently
  combining unrelated pages or choosing a winner.
- [x] Support the stub token on manually created pages independently of seeding.
- [x] Render a theme-styled built-in stub notice with a configurable icon.
- [x] Make the notice wording configurable through stub_notice.title/text in theme
  templates. Portal overrides inherit per field; the semantic token remains independent
  of wording and presentation. Deployed in Cloud release 606.
- [x] Derive stub status centrally in wiki indexing and pass that status to consumers.
  Exclude code examples and comments from marker detection.
- [x] Automatically derive membership in a dedicated Stub pages category without
  writing that membership into source frontmatter. Removing the token removes it.
- [x] Add an accessible stub icon to All Pages and category listings. Stub articles
  are existing pages, so links to them are resolved and they count as real pages.
- [x] Distinguish category pages from articles in directory listings with an
  accessible category/folder icon. Article stub icons use the leading folder-icon position;
  category entries keep their category icon without an extra stub marker. Derive kind from wiki route metadata,
  not from title wording such as "books".
- [x] Prefer a Subcategories section above the Pages section on category pages,
  with each section alphabetized separately and omitted when empty. Preserve
  unique heading/TOC anchors. Keep a category icon wherever categories appear
  alongside articles in mixed listings.
  Implemented and browser-tested locally across all three themes on 2026-11-12;
  Programming was rebuilt for review. These category changes are not yet deployed.
- [x] Preserve build boundaries: a page build updates that article; a portal build
  refreshes shared category/directory listings. Do not silently trigger full builds.
- [x] Keep this in modules and scheduled actions; no stub-specific logic in the
  generic Core build runner. Desk and CLI now share the same explicitly invoked seeder.

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

## Sheriff Cloud authentication and multi-author Desk access

Status: explicitly deferred by the owner. Not required for the current release.

- [ ] Extend Cloud/Desk authentication and authorization to support multiple authors on a site, building on the existing Cloud login and access checks.
- [ ] Define site membership, collaborator roles, and editing permissions; enforce them on the server for each portal and operation.
- [ ] Attribute edits to the authenticated author and handle conflicting edits so one author's save cannot silently overwrite another's work.
- [ ] Keep collaboration in the Cloud/Desk layer; preserve the generic Core build runner.

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

- [ ] Design mobile navigation so the left sidebar does not become a long menu
  above the article. Review an explicit Browse/Menu control that opens the site
  navigation on demand, with a separate On this page control for the page TOC.
  Choose and review the interaction before implementation. Preserve nested menus,
  current-page indication, keyboard access, focus handling, and consistent behavior
  across Compendium, Outpost, and Siegemate.

- [ ] Add author-controlled list columns in content using `::: columns 2`,
  `::: columns 3`, or `::: columns 4` blocks. Support 2–4 requested columns,
  reduce the count to fit available width, and use one column on phones.
  Keep list semantics and consistent styling across all three themes.

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
