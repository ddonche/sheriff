# Sheriff work list

Updated: 2026-11-16. This records agreed work and its current status. The larger
product backlog is not automatically a requirement for Sheriff 1.0.

## Revision pruning and Config logs — 2026-11-18

- [ ] Add an explicit Prune revisions action in Desk, with a preview of affected
  files, revision counts and reclaimed space. Retain the newest revision of each
  page within every documentation version; allow retaining additional recent
  revisions. Use the existing Desk controls and a Goblin backend. Never silently
  prune during saves, builds or synchronization. Preserve all documentation
  versions: deliberately retiring a documentation version is a separate future
  action. Planning only; no revisions or documentation versions deleted.
- [x] Reuse the full build-log component on Config and Modules, including grouped
  site builds, progress, complete diagnostics and Copy log. Keep the editor above
  the log on narrow screens. Verified with 31 mocked browser scenarios, including
  a failed build followed by a successful retry. Local Desk installed and Cloud
  source prepared; not deployed.

## Howdy editing access and page locks — local foundation, 2026-11-19

- [x] First permission pass: reuse the existing Sheriff Cloud account and verified
  site ownership. An owner can grant or revoke content-editing access for an
  individual portal. Do not introduce named roles or a general role-management
  system yet. Editing access does not grant theme/configuration, permissions,
  publication, source-transfer, or site-deletion authority.
- [x] Let the owner lock and unlock an individual page using Desk's existing
  visible page action bar and Lucide lock icons. A lock prevents content edits
  through Desk and the later front-end editor. Keep public reading available;
  a lock does not hide a page, stop builds, or remove its published output.
- [x] Store grants and page locks as trusted permission state, separate from
  contributor-editable page content/frontmatter. Only the owner can change them.
  Enforce access and locks server-side on every affected write, including direct
  requests, moves/deletions, and new-revision saves. A new revision must not bypass
  a lock. The owner can unlock a page before editing; no implicit editing bypass.
- [x] Return capabilities to the shared Desk so unavailable editing controls and
  locked-page notices accurately reflect server decisions. Recheck on save so a
  lock or revoked grant takes effect for an editor who already has the page open;
  preserve their unsaved buffer when a save is denied.
- [x] Keep Howdy permission logic in its Goblin module, Desk UI under admin, and
  Cloud identity/storage adapters in the existing Cloud integration. Keep the
  generic Core runner module-agnostic. Preserve trusted local offline editing;
  browser controls do not claim to prevent direct filesystem edits.
- [x] Verify owner, permitted editor, unrelated/signed-out user, grant revocation,
  locked/unlocked pages, revision bypass attempts, and cross-portal isolation
  before adding front-end editing. Then reuse the existing Visual/Source editor
  for authorized editing of the current page's content only.
- [ ] Later: named roles, finer-grained capabilities, and delegated portal creation
  and permission management for community sites such as Iveki.

Local frontend editing now reuses Desk Visual/Source and passes real Goblin HTTP
and build checks across all three themes, including hosted-origin and multisite
fixtures, stale saves, locks, failed-build retry and full-build exclusion. Cloud
Core source matches; not deployed. Untrusted HTML/URL hardening, legacy upload-path
review and Linux validation remain before the public contributor release. See [editing access](howdy-editing-access.md).

## Modules controls and image galleries — local, 2026-11-18

- [x] Add a common Modules workspace. Installed modules/glams declare panels in
  desk.yall; Desk renders existing panels, fields and buttons. Howdy is the first
  control and moves out of the Config UI while retaining howdy.enabled in YALL.
  Changes share Config's buffer, Save and Save & rebuild actions. Multi-portal
  sites use parent settings. Goblin backend; authenticated Cloud gateway reused.
  Verified in both modes; matching Cloud source prepared, not deployed.
  See [module panels](desk-module-panels.md).
- [x] Add explicit image galleries with ::: gallery 2/3/4. Keep each image's caption
  and following explanation together, align related figures, and start subsequent
  content below the group. Preserve ordinary image floats elsewhere. Verified
  across Compendium, Outpost and Siegemate, light/dark and narrow layouts.
  Source authoring is available; Visual preserves the complete source block.
  See [image galleries](image-galleries.md).
- [ ] Add visual gallery authoring using the existing image picker, preserving the
  gallery's source, captions, descriptions, order, and insertion cursor.
- [x] Separate the Modules catalog from module control panels. Add panel API v1
  with shared Desk controls, module-owned JavaScript entry points, declared
  Goblin handlers, scoped authenticated dispatch and cleanup. Howdy uses it.
  Update links are supported; automatic package updates/marketplace remain pending.
- [ ] Extend module-panel declarations with additional shared control types and
  explicit portal scopes as modules need them. Keep installation and full Glamr
  dependency management separate from this first configuration foundation.

## Product direction — unified Desk and visual site management

Sheriff Desk is the local-first website-building and CMS experience; Cloud hosts
the online version of the same Desk. Aim for the completeness and clarity of a
WordPress-style admin, with Sheriff's file ownership, static output, wiki features,
and Goblin/module architecture. Cloud remains optional. The eventual end-to-end
GUI flow is launch Desk, create a site, edit/design it, preview, and publish without
requiring Markdown, HTML, CSS, Git, or terminal knowledge. Source editing stays available.

See [Desk experience plan](desk-experience-plan.md) for the owner-supplied proposal,
scope, sequencing, and acceptance requirements. This is a product direction and
backlog, not permission to replace working panels, deploy, or change production sites.
Finish the small correctness fixes and verify the existing Desk workflow first.
Then focus on UX improvements, followed by Visual/Source (WYSIWYG) editing and
front-end page editing. The visual editor must preserve Sheriff source before
front-end editing reuses it. This sequencing was reaffirmed on 2026-11-15.

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
  isolation and swarm regressions passed. Deployed in Cloud release 607; see
  [discovery measurements](discovery-performance.md).
- [ ] Measure full-build scaling with larger synthetic portals (1,000 then 10,000
  pages), worker counts, memory, and per-phase timing. Identify remaining expensive
  pre-schedule/assets/routing work from measurements. No large-scale performance
  result has been established yet.

## Sheriff Cloud launch — Made with Sheriff showcase

Priority: Cloud launch feature. **Planning only; do not begin implementation until
Sheriff's core functionality is stable.** See the complete
[Website Showcase plan](showcase-plan.md).

- [ ] Add a per-site Desk opt-in for published, public Sheriff sites. Reuse Cloud
  authentication and verify ownership through a unique registration token in
  generated static files. Support external hosting without Goblin on the server.
- [ ] Reuse Cloud storage and a small API for listings, metadata updates, opt-out,
  removal, duplicate prevention, rate limits, and administrator abuse removal.
  No public submission form, routine approval, separate CMS, or manual entries.
- [ ] Capture homepage screenshots automatically, refresh about every 30 days,
  and check accessibility/registration metadata daily. Retry temporary failures,
  hide after seven offline days, and restore verified returning sites automatically.
- [ ] Create a responsive, accessible gallery with screenshots, titles,
  descriptions, live links, and Wiki/Documentation/Blog/Business/Portfolio filters.
  Explain the Desk opt-in workflow prominently; update from stored listings.
- [ ] Launch with Programming, Goblin docs, Sheriff docs, Vekke docs, and Everwind,
  registered through the ordinary Desk workflow. Add Rainwall and Six docs when
  publicly available; do not manufacture or hardcode listings.
- [ ] Prepare polished Cloud website sections: Features, Documentation, Downloads,
  Showcase, and Getting Started, with a clear download-to-publication path.

## Site seeding and stub articles — agreed next feature

Status: stub notices, generated-listing markers, automatic stub-category membership,
and explicit CLI/Desk YALL seeding shipped in Cloud release 606 on 2026-11-13.
The plain-frontmatter seeder correction shipped in Cloud release 607. Theme icon settings
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
  Programming was rebuilt for review. These category changes shipped in Cloud release 606.
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

## Multi-portal sites, cross-portal links, and optional federation

Status: isolated local multisite foundation restored 2026-11-17. Site membership,
site/portal homes, scoped wiki links/search/assets, and site/portal/page CLI builds
passed 90 real-build/browser checks across all three themes. The generic runner,
metadata parser, file discovery and Prospector Goblin code retain their reverted
versions. The first local Desk/wizard integration is implemented: site/portal selection,
grouped inventory, automatic initial previews, adding portals, and scoped builds.
Site deletion with reviewed membership and independent site/portal logos are
implemented locally; contained portal rename/removal remains follow-up work.
Site/portal Config tabs and shared/individual theme policy are implemented locally.
Grouped Cloud publication and source transfer are implemented in the working
checkouts: one parent Cloud site, complete source push/pull, page/portal/site build
scopes, sibling preservation, and live Cloud build/upload logs with separate timings.
They have been tested locally with disposable sites and a simulated R2 store;
Linux-container validation and production deployment remain pending. Local Push
explicitly builds/publishes the whole grouped site; online Desk supports smaller
page and portal scopes. Grouped rename/removal and Howdy permissions follow. See [multi-portal sites](multi-portal-sites.md)
and [Desk multisite plan](desk-multisite-plan.md).
Preserve all three supported deployment models:

- A single site with one portal.
- Many separate sites/portals managed by the same Sheriff installation.
- A single site containing multiple portals.

- [ ] Document multisite setup and theme/configuration controls in the public Sheriff docs.
  Cover parent site.yall versus each portal's config.yall; Desk's Config → Site config /
  Portal config tabs; multisite_theming: shared / individual (individual when omitted
  or commented out); preserved portal theme choices; and the difference between Save,
  a portal rebuild, and a whole-site rebuild. Include how to enable the commented
  example and rebuild after changing the policy. Provide copy-and-paste documentation
  for the live docs rather than adding articles to the outdated local docs portal.

- [ ] Introduce explicit site-to-portal membership and site/portal identity without
  conflating a Cloud account, a public site, and an individual portal. Keep the
  existing single-portal workflow working. Define how a grouped site is configured,
  built, previewed, and published, including shared assets and navigation. Decide
  site-wide versus portal-specific settings deliberately rather than forcing all
  portals into identical themes or configuration.
- [ ] Preserve independently scoped operations in grouped sites: save/edit one
  page, build/update/publish one page, build/update/publish one portal, and an
  explicit broader site build when requested. A single-page build still uses
  only its page schedule; grouping portals must not silently rebuild or overwrite
  sibling portals. Design shared-output/dependency refresh explicitly.
- [ ] Implement authentication integration and permission behavior in a new Goblin
  module named Howdy, reusing existing Cloud sign-in/session infrastructure.
  Keep account identity distinct from site and portal permissions, and keep
  authentication-specific behavior out of the generic build runner. Local offline
  editing must remain available without requiring a Cloud login.
- [ ] With Howdy, support site-authorized users creating new portals and managing
  those portals' editing permissions. Define creator ownership, delegation, and
  the site's overarching policy during this phase; being signed in does not by
  itself grant portal creation or editing authority. Enforce permissions server-side
  for each portal and operation, including direct API calls and source transfers.
- [ ] For community sites such as Iveki, default Desk to portals the signed-in user
  manages. Keep a separate searchable, paginated All portals administration
  directory for authorized site administrators. Fetch filtered pages on the server;
  do not load or expand every portal in the browser. Howdy enforces ownership,
  delegation and creation policy on the server. Site ownership must not flood the
  ordinary editor workspace with thousands of community-created portals.
- [ ] Offer public portal-directory presentations appropriate to site size:
  portal cards for small collections; searchable, paginated compact listings for
  large community sites. Large site homepages may feature a limited selection.
  Keep the shared site header independent of directory presentation; never embed
  the whole registry in a header dropdown or render thousands of cards eagerly.
  Public discovery is separate from Desk's permission-filtered My portals view.
- [ ] Add explicit cross-portal wikilink resolution within one site. Proposed form:
  `[[p/{portal}/wiki/{page_name}]]`. Resolve the destination within the named
  portal's wiki namespace, so identical article names in different portals do not
  collide. Preserve short local wikilinks for ordinary same-portal content.
- [ ] Reserve the content-type part of the address for other services, including
  `[[p/{portal}/blog/{post_name}]]` and
  `[[p/{portal}/forum/{topic_id}]]`. A link identifies a site/portal/content-type/
  content target; its resolver supplies the actual public URL. Final syntax,
  namespace compatibility, and public URL layout still require design. These
  examples do not imply blog/forum publication is already implemented.
- [ ] Define optional cross-site participation and resolution. Proposed forms:
  `[[s/{sitename}/p/{portal}/wiki/{page_name}]]` or
  `[[s/{site_id_number}/p/{portal}/wiki/{page_name}]]`. Participating sites need
  stable unique identities and discoverable address metadata. Define unique names,
  name/domain changes, lookup/cache behavior, and unavailable destinations. Existing
  sites must remain independently usable without joining the federation.
- [ ] Use this addressing foundation for Iveki and future article forking,
  sharing, and embedding. Design linking, copying/forking, and embedding as distinct
  operations, with source attribution, revisions, update behavior, and permission
  rules defined before implementation. Address resolution alone does not grant
  permission to edit, republish, or embed another site's content.
- [ ] Keep routing/content-type integrations in the appropriate Goblin modules
  and Cloud adapters; preserve the generic build runner's module independence.
  Work locally on grouped sites and cross-portal links before adding federation.

## Unified Desk correctness — immediate priority

Status: shared UI, account sign-in, local builds, source/output transfer, R2
publication, and fingerprint/checkpoint primitives are verified together locally.
The small correctness pass is complete in the working checkouts; the next stage
is UX. Cloud deployment is still separate. The owner rejected per-portal account linking and the separate
Cloud Sync management page on 2026-11-14. Do not restore that interaction model.

- [x] Keep one shared Desk UI, portal selection, and editing workflow locally and
  online. Show only operations meaningful in the active environment; retain offline use.
- [x] Remove the separate Cloud Sync page and duplicate site inventory. Integrate
  account access and Push/Pull into existing Desk workspace/portal management.
- [x] Sign in once using the existing Cloud auth modal/client, persist and refresh
  the account session, and represent connection consistently throughout Desk.
  Authentication is account-wide; selecting a site is not another authentication step.
- [x] Unify portal inventory and selected-site identity across Desk and the Cloud
  host: correct names/logos/URLs/content; distinguish local-only, Cloud-only, and
  both. Make Cloud-only source available for offline work through the normal workflow.
  Use stable internal identity without a manual portal-pairing wizard or a
  name-only assumption that can silently target the wrong site. Keep Build all
  scoped to sources available in the current execution environment.
- [x] Add a persistent per-portal notice for saved pages and site-wide changes.
  Review affected files and build one or several changed pages without pre/post
  schedules. Keep unsaved editor buffers separate; preserve newer edits, shared
  changes, and failed builds/uploads. Detect source-text edits and Desk media
  operations, survive refresh, and ignore generated-file churn. Verified locally
  and in hosted tests; Cloud deployment remains separate. See desk-build-status.md.
- [x] Retain per-portal build/publication history across browser reloads, including
  separate timings and failure results. Rename migrates saved-change history and
  stable Cloud identity; deleting a local portal clears its private tracking and
  connection records without deleting its Cloud site. Keep these records out of uploads.
- [ ] Deferred with native runtime work: acknowledge CLI builds without coupling
  the generic kernel to Desk, and detect arbitrary external binary asset edits.
  Existing Desk source/media tracking remains active; these known conservative
  limits are not part of the UX work. See goblin-native-runtime-gaps.md.
- [x] Remove Media's automatic upload build. Navigation, Config, and theme-file
  editors have separate Save and Save & rebuild actions; Ctrl+S saves only.
  Interactive saves its sidecar without building and says so. Saved changes appear
  in the pending-build notice in local and hosted Desk. Verified with real Goblin
  APIs and browser fixtures; Cloud deployment remains separate.
- [x] Keep Move, Rename, Delete, Seed, Create, and Restore source operations
  separate from building. Portal create/rename and snapshot restore no longer
  trigger builds. Guided setup automatically prepares the initial local preview and shows Open site. Restored,
  new, and renamed source is marked pending; existing explicit build controls
  apply it when requested. Cloud deployment remains separate.
  Content retains Save / Build page / Build portal, including saving the open page
  when a build action requires it. Keep page builds limited to the page schedule.
  Local testing also corrected Windows listing of Cloud-download snapshots whose
  older metadata lacks a stored size field; the existing ZIP bridge computes it.
- [x] Preserve selected-site Push: build locally, upload matching source/current
  completed output/build metadata, and publish through existing R2 infrastructure
  without another Cloud build. Pull restores Cloud source for offline editing.
  Exclude private history, credentials, and unrelated portals. Account connection
  alone never transfers, builds, publishes, or overwrites site content.
- [x] Retain baseline comparisons, understandable local/Cloud/both-changed status,
  explicit replacement choice for divergent copies, checksum/revision checks, and
  recoverable replaced source. No automatic merging or Git workflow for this phase.
- [x] Keep build success separate from publication success/failure in status and
  streamed logs, including Sheriff time, upload time, and last successful build/deploy.
  Dashboard now shows the selected portal's actual build/upload/result locally,
  including local Push publication status and separate Sheriff/R2 timing. Persistent
  last-successful-build/deploy records are stored by the Goblin change tracker.
  Build errors preserve earlier successes; upload failure never becomes publication
  success. Verified across reloads and local/hosted transfers.
- [x] Correct Cloud's misleading build-then-publish welcome and add environment-
  specific Save/Build/Publish/Push help to existing drawers. Local builds preview;
  Cloud builds publish. The log distinguishes Sheriff and R2 results. Local only;
  deployment remains separate.
- [x] Apply unsaved/busy/portal-switch/browser-close protection across all editors
  and refresh affected inventories after mutations; prevent stale asynchronous
  responses from replacing the currently selected site's data. Newer Pattern and
  Interactive edits survive in-flight saves. Verified in local/hosted disposable
  portal checks; Cloud deployment remains separate.
- [x] Fix Themes' quoted-name-only config detection/switching using Goblin's actual
  YALL parser. Preserve config formatting/comments and unrelated values, plus
  existing theme templates and CSS overrides. Refresh active-theme detection
  after Config saves and disable stale file controls during loading. Invalid
  config is reported without rewriting it. Cloud deployment remains separate.
- [x] Replace the local empty Settings placeholder with links to the existing
  Configuration, Navigation, and Themes editors, shared Cloud account access, and
  Cloud admin. Keep hosting/account controls in Cloud rather than duplicating them.
  Hosted Desk continues to use the surrounding workspace settings. Local only;
  deployment remains separate.

See [current connection requirements](desk-cloud-connection-plan.md). These are
corrections to existing features, not a second implementation of their transport.

## Visual editing and comprehensive GUI — staged product work

Status: first shared Visual/Source increment implemented locally on 2026-11-15;
Cloud checkout prepared, not deployed. Source remains the initial mode. Paragraphs,
headings, bold/italic, lists, Sheriff links, image previews, and the existing three
insertion pickers work in Visual. Advanced constructs have source-backed cards.
The supplied text ends partway through its Editor Workflow. Do not assume missing
sections or specific editor libraries were approved.

- [ ] Build Visual / Source modes for the existing content editor. Markdown stays
  authoritative; the editor document model is transient and does not become a
  second HTML database or proprietary saved-content format. Default to Visual
  when the preservation requirements have been demonstrated.
- [x] Prove lossless no-op switching and preservation of untouched source before
  broad editing support. Preserve unsupported/unknown/third-party constructs as
  source-backed blocks. Editing nearby text must not discard or reinterpret them.
- [ ] Add visual paragraphs/headings, bold/italic, lists, links, blockquotes, code,
  separators, tables, images/captions, and editable Sheriff wikilinks. Reuse existing
  image/icon/pattern pickers; add visual properties for inserted elements.
- [ ] Progressively add visual pattern/infobox fields and tabs, admonitions,
  interactive-image embeds, badges/tokens, columns, and citations. Keep code,
  embedded HTML, template directives, and extension syntax intact throughout.
- [x] Add selected-image properties in Visual: size, alignment, caption, replacement
  through the existing image gallery/upload picker, and removal from the page with
  Undo. Preserve the existing Sheriff token and other content; changes stay in the
  unsaved buffer. Keep Source access, custom existing sizes, stale-picker guards,
  and shared local/hosted behavior. Implemented locally; not deployed.
- [x] Add editable admonition bodies and selected-callout type/title controls,
  theme-default icons, Source access and removal with Undo. Preserve explicit
  icons, nested/unsupported content and exact untouched source. Same local/hosted
  editor; implemented locally on 2026-11-16, not deployed.
- [x] Edit inline pattern/infobox fields and optional edition tabs through the
  existing draggable modal. Add/remove fields, rename/reorder/remove tabs, and
  update the same unsaved source with Undo. Preserve ordinary untabbed patterns,
  exact untouched source, custom lines, and reusable token references. Checked in
  local/hosted modes and narrow layouts on 2026-11-16; not deployed.
- [ ] Make saved template patterns share their structure with existing article
  instances. A definition owns field names/order/defaults; each article owns its
  values. Adding a links row to Framework should expose it in older Framework
  infoboxes on rebuild and in Desk when editing, without manually editing every
  article. Preserve existing values, explicit blanks, custom fields, optional tabs,
  and standalone copies. Renaming/removing fields must not silently discard data.
  Keep behavior consistent for page and portal builds in local and Cloud Desk;
  implement rendering/merging in the Goblin Sheriff Patterns module, not Core.
  Added 2026-11-16; deferred at the owner's request, alongside pattern editor UX.
- [x] Add Cancel beside Save to discard unsaved page edits and reload the saved
  file/revision, including Page details and Visual changes. Reuse the existing
  discard confirmation, keep editing mode, invalidate stale metadata/pickers, and
  never save/build/publish on Cancel. Checked locally and in hosted mode on
  2026-11-16; not deployed.
- [x] Keep local Desk API endpoints available during Stagehand refresh:
  copy before pruning retired files, avoid deleting dist/api or dist/admin, and
  leave unchanged Goblin endpoints untouched while build logs poll them. Preserve
  plain-text server errors with their HTTP status instead of JSON parser errors.
  Checked with actual Goblin sync and build-response fixtures; local only.
- [x] Add editable fenced code blocks to the shared page/admonition Visual toolbar.
  Accept any language name with common suggestions; keep code literal, preserve
  existing fences, and support indentation, undo, Source navigation, and narrow
  layouts. Local install and hosted-mode checks complete; not deployed.
- [x] Add directly editable Markdown tables to both Visual editors, with a shared
  Lucide Table menu for insertion, row/column actions, and column alignment.
  Preserve untouched source, Sheriff links and tokens, literal pasted text,
  cell line breaks, undo, and read-only behavior. Local/hosted checks and actual
  Goblin rendering verified on 2026-11-16; Cloud checkout updated, not deployed.
- [x] Add video insertion/editing with a shared Lucide dialog, YouTube/Vimeo preview,
  sizes, alignment and captions. Preserve source and code literals; local/hosted
  checks completed on 2026-11-16. Cloud checkout prepared, not deployed.
- [ ] Add visual properties for columns, badges/tokens, and interactive
  embeds. Reuse shared Lucide controls, picker catalogs, and document styling.
- [x] Unify page/admonition formatting toolbars and typography using actual bundled
  Lucide icons. Correct new-file and Edit in Source positioning, preserve mode
  scroll positions, and add the editor back-to-top control. Expand the icon gallery
  to use the modal height with Show more below it. Implemented and checked locally
  on 2026-11-16; shared Cloud checkout updated, not deployed.
- [ ] After the shared Visual/Source editor is ready, add optional front-end
  Edit this page for authorized Cloud users and local site viewing. Reuse that
  editor for only the current page's authored body; exclude headers, navigation,
  theme/settings, generated listings, and global shared content. Save updates the
  correct Markdown source while preserving frontmatter, unsupported syntax, and
  explicit document-version/revision policy. Save alone does not build or publish;
  use the same pending-build notice and deliberate build actions as Desk. Resolve
  the current page to source through trusted route metadata; enforce site/page
  authorization and a source-revision precondition server-side. A stale edit must
  not silently overwrite a newer edit. Public reading must not require login or
  load the editor; local editing stays local and does not require Cloud sign-in.
- [x] Add a shared Sheriff Cloud account entry to public site headers, positioned
  to the right of the theme toggle: Login / Sign up when signed out, and the
  signed-in account avatar/menu when signed in. Use the existing SC identity,
  auth modal, and SSO infrastructure across standard/custom domains; do not create
  per-site accounts or assume browser storage is shared across origins. Support
  all built-in themes and integrate with the chosen shared header provider so
  connected Sheriff/Spur sites do not get duplicate account controls. This account
  entry is also the future identity foundation for comments/discussions, not only editing.
  Howdy is implemented as an opt-in Goblin module with a Config switch and shared
  browser auth/account client (2026-11-18). All themes, parent/portal headers, page
  builds, local concurrency, config saves, SSO routing and synthetic account flows
  tested. The shared client now uses the registered Sheriff Howdy OIDC application
  (authorization code + PKCE). Public sites receive identity-scoped credentials;
  Cloud account forms remain in a separate, theme-matched Cloud window. Callback,
  Google/consent return, token verification, rotation, revocation and cross-tab
  sign-out are covered by the browser regression suite. The real SSO service
  accepted the registered client and callback; real-account end-to-end confirmation
  follows deployment. Permissions and front-end editing remain separate work.
- [ ] Gate front-end Edit this page by the site's editing permissions for the
  signed-in account. Hide it while permission is unknown or denied; enforce the
  same authorization on every save server-side. Signing in alone grants no editing
  rights. Let each site decide its editing policy when permissions are implemented;
  do not make public reading require authentication. Keep offline authoring viable.
- [ ] Later add page-level editing locks/restrictions on top of site permissions,
  with explicit authorized exceptions and enforcement on direct API requests.
  Lock policy/roles and administrative controls remain to be designed; this is
  separate from authentication and from public-page visibility.
- [x] First Content UX increment: a collapsible Page details panel for title,
  author, layout, categories, summary/gloss and thumbnail. Reuse Desk's existing
  type, cards, fields and disclosure styling; separate Source/insertion tools
  from Save / Build page / Build portal. Goblin prepares buffer-only edits and
  preserves custom fields/comments; Source remains available. Source changes made
  during a pending form edit cannot be overwritten. Verified in local/hosted
  fixtures and narrow layouts; local preview updated, not deployed. See
  desk-content-editor.md.
- [ ] Extend metadata forms to aliases and documentation versions, reusing the
  existing revision controls and preserving unknown metadata and raw source.
- [ ] Make navigation editable as menus/dropdowns with existing icon insertion,
  validation, and source access. Preserve current nav.yall rather than inventing
  a separate menu store. Avoid coupling this to Spur's separate menu renderer.
- [ ] Extend the planned visual site builder to wiki and docs pages, especially
  wiki homepages. Authors should compose themed sections, independent side-by-side
  content panels, category/article cards, images, and video sections within the
  existing wiki/docs site. Support equal and unequal column widths, mobile stacking,
  and per-page control of article chrome/sidebars where needed. Existing flowing
  list columns are not a substitute for independent section layouts. Keep Sheriff
  source portable, preserve wiki syntax/patterns, and style across Compendium,
  Outpost, and Siegemate. Review a Programming wiki homepage example before expanding.
  This is proposed builder work, not an existing Webkit implementation.
- [ ] Expand Appearance using existing Themes: site branding, supported palette
  and typography controls, live responsive preview, templates/overrides, and source
  access. Validate changes against Sheriff's actual rendered output. No generic
  arbitrary drag-and-drop page builder is required by the initial editor work.
- [ ] Improve Dashboard with real page counts, recent changes, local/Cloud state,
  last successful build/publication, current issues, preview, and working quick actions.
- [x] Improve Content's existing-image picker for large libraries such as book
  covers. Make the thumbnail gallery expandable/resizable to use more workspace,
  show larger previews and readable filenames, add a filename filter, and reduce
  nested scrolling. Preserve the selected folder/image, insertion cursor, and
  unsaved document while expanding or closing it. Use the same picker locally
  and in Cloud, with a usable narrow-screen layout. Verified with 56 isolated
  browser checks across both modes. Local preview updated; not deployed to Fly.
- [ ] Add a module/glam management interface for discovery, configuration, and
  enable/disable with clear effects. Plan installation separately from dependency
  resolution; reuse Downloads initially where appropriate and leave full Glamr later.
  Third-party editor integration is optional and never required for source preservation.
- [ ] Add Site Health using existing build/index/report data: distinguish intended
  wanted pages and stubs from actual failures, identify missing assets/broken
  explicit destinations, and link issues to the source. Reuse diagnostics and avoid
  blocking builds for intentionally incomplete wiki content.
- [ ] Refine information architecture around Dashboard, Pages & Content, Media,
  Appearance, Navigation, Modules, Site Health, and Settings as useful groupings.
  Preserve access to Icons, Patterns, Interactive, Snapshots, and Seeding. These
  are conceptual groupings, not an approved replacement sidebar. Publishing/sync
  actions belong in existing workspaces, not a new duplicate Cloud Sync inventory.
- [ ] Review each small increment in the real UI before advancing. Verify keyboard
  operation, narrow screens, all built-in themes, source fidelity, and both backend
  environments as applicable. Preserve Source mode and existing tools at every step.

## Sheriff Cloud authentication and multi-author Desk access

Status: planned for the multi-portal phase after editor fixes (owner direction
2026-11-16). Howdy is the new Goblin module for authentication integration and
permissions. Reuse existing sign-in/session infrastructure. This is roadmap work,
not authorization to replace the current login or implement collaboration now.

- [ ] Use Howdy to extend Cloud/Desk authentication and authorization for multiple
  authors and portal-level management, building on existing Cloud login/access checks.
- [ ] Define site membership, collaborator roles, and editing permissions; enforce them on the server for each portal and operation.
- [ ] Attribute edits to the authenticated author and handle conflicting edits so one author's save cannot silently overwrite another's work.
- [ ] Add site-local Howdy contributor profiles when contribution tracking exists.
  Keep the shared Sheriff Cloud account identity, but show activity for the current
  site (and its portals): pages created/edited, images added, and contribution history.
  Do not send View profile to Spur. Hide that action until a local profile exists;
  retain account settings and sign-out. Deferred by owner on 2026-11-18.
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

## Spur static publishing, Discovery and Thistle integration

Status: agreed architecture on 2026-11-13; implementation is future work. See
[the integration plan](sheriff-spur-thistle-plan.md). Keep Sheriff independently
usable and Spur a full creator platform; retain current interaction services until
Thistle replacements are ready.

- [ ] Reuse/extend Campfire for standalone blog publication; define the shared
  content/metadata interface and optional Spur adapter in Goblin modules.
- [ ] Pilot Sheriff-generated public Spur blog articles at existing URLs, preserving
  Studio, themes, authentication and current comments/interaction services. Verify
  edits, withdrawal, dependent indexes/feeds and actual static-serving routes.
- [ ] Connect authenticated Sheriff-to-Spur full-content Discovery submissions and
  Spur-to-Sheriff publication with stable IDs, revisions, source ownership,
  attribution, opt-in preferences and update/removal synchronization.
- [ ] Migrate dynamic functionality to Thistle incrementally, preserving identities,
  permissions and existing functionality until each replacement works.
- [ ] Expand static publication to public forum topics/replies, portfolios, galleries,
  episodes and downloads; add a WordPress integration through the same interface.
  Respect private content and explicit moderation/cache/pagination behavior.

## Distribution and smaller follow-ups

- [ ] Enhance glossary/link tooltips with an optional small image from the linked
  page, such as its logo or thumbnail. Reuse the search-result image selection
  rules where practical. Keep text-only tooltips when no suitable image exists;
  handle failed images without a broken-image placeholder. Match all built-in
  themes and preserve accessible tooltip behavior. Future enhancement only.
- [x] Design and implement mobile navigation across Compendium, Outpost and
  Siegemate. The reviewed Browse and On this page drawers replace stacked sidebars
  below 960px, preserving nested menus, current-page indication, keyboard access,
  focus return and normal desktop layouts. The Special dropdown stays above the
  wrapped search row. Local implementation verified; not deployed to Cloud yet.
  See [mobile navigation](mobile-navigation.md).

- [x] Add author-controlled list columns with ::: columns 2/3/4 blocks. Preserve
  list order, numbering and nested content; use fewer columns to fit their
  container and one column on phones. Per-page footnote_columns: 2/3/4 applies
  the same behavior to generated references without moving them or changing
  citation IDs/backlinks. Verified across all three themes; local, not deployed.
  See [content columns](content-columns.md).

- [x] Add click-to-enlarge viewing for ordinary content images, including
  thumbnails and images in patterns/infoboxes. Use original image URLs, fit large
  images to the screen, keep small images at natural size, and support close,
  Escape, backdrop and keyboard focus across all three themes. Preserve explicit
  image links. Interactive maps are already complete and excluded from this task.
  Verified locally with 147 viewer checks and the actual Everwind portrait page;
  not deployed to Cloud. See [image viewer](image-viewer.md).

- [ ] Explore an optional interactive-timeline plugin later. Present dated events
  and periods with annotations/media and links to wiki articles, making timelines
  another way to explore the wiki. Keep this separate from the existing
  interactive-map feature and from generic Sheriff Core. Planning only for now.

- [ ] Document a public Spur Downloads metadata/download integration for other sites
  and UIs. Keep simple digital-file distribution separate from dependency resolution
  and the full Glamr marketplace.
- [x] Add a Desk video-embed insertion button/picker alongside image/icon/pattern
  insertion. Completed locally on 2026-11-16; not deployed.

## Brand icons and linked icons — completed locally

- [x] Add locally bundled Simple Icons brand SVGs and brand-color metadata beside
  the existing Lucide and portal-uploaded icon catalogs. Keep one icon pipeline
  for article content, Scout navigation, headers/footers, and pattern fields.
- [x] Extend icon syntax with an optional fifth link parameter and accessible
  linked-icon labels. Current implementation uses name, color, size; preserve
  existing syntax while resolving the different order in the supplied proposal.
- [x] Offer theme/inherited color, explicit brand color, and custom colors; extend
  Desk's existing picker with Brands filtering and an optional link field. Preserve
  local overrides/name-collision behavior and provider/source information.
- [x] Check actual collection coverage, retain pinned local assets/metadata, and
  update the Icons documentation. No runtime dependency on an external icon CDN.
  Completed 2026-11-16: Simple Icons 16.38.0, 3,472 brand SVGs. Existing
  color|size syntax remains supported; unambiguous size|color is accepted too.
  Use brand-x for the brand logo without replacing Lucide x. Local Desk installed;
  matching Cloud source prepared. Deployment remains a separate step.

## Publishing metadata — future work

- [ ] Give draft: true actual publishing semantics. Exclude draft articles from
  public output and generated public listings/search; handle pages that were
  previously published so stale public HTML does not remain accessible. Define
  deliberate preview behavior. Current draft handling only excludes search records.
- [ ] Add optional last-updated display for documentation/wiki layouts in all
  themes. Define the metadata fields and retain the actual content-edit timestamp,
  rather than changing it on every build. Allow an author-supplied date and connect
  authenticated edit attribution when multi-author Desk support is implemented.

## Deliberately deferred

- Cloud multi-core rendering and extra Fly CPU allocation: only when the owner
  decides to buy more capacity. Current policy keeps Cloud page builds serial.
- Discussion-count badges: wait until a discussion source/integration exists.
- Full Glamr marketplace/dependency management: outside the initial Downloads work.

## Completed foundations — do not reopen as unfinished features

- Prospector search, categories, thumbnails, incremental records, and its deployed
  empty-heading/title bounds fix. Search concurrency uses its existing actor pool.
- Goblin 0.51.26 native runtime and WASM REPL update.
- Shared local/Cloud Desk frontend and backend transport, Content Save / Build page / Build portal, R2 publication,
  build/upload timing separation, and streaming log transport. These foundations
  exist; account/site integration and the small correctness pass are locally
  verified above. UX refinement follows; production deployment remains separate.
- Lucide catalog, custom PNG icons, optional icon sizing, navigation insertion,
  default/custom admonition icons, pattern tabs, media/stat badges, category
  namespaces, and earlier theme/pattern presentation fixes.

Historical release checkpoint (not the latest release): release 605 deployed on 2026-11-12: ZIP-free retained builds, build
phase timings, and serial Cloud page rendering. Local swarm remains enabled.
Sheriff Core is pinned to clean commit f2ae60b; Cloud application commit 4cbe000.
Linux and live-machine regression checks passed; all 381 production source files
were unchanged. No CPU allocation or hosting-cost change was made. This list
authorizes no further deployment, CPU purchase, or production content changes
by itself.
