# Sheriff Desk — unified website builder and CMS direction

Recorded: 2026-11-14. Product planning only. The actionable backlog is
[the Sheriff work list](roadmap.md); this document explains the direction.

## Objective

Make Sheriff Desk a complete, approachable, local-first graphical website-building
and content-management experience powered by Goblin. A person should eventually
be able to launch Desk, create/design a site, write content, preview it, and publish
without learning Markdown, HTML, CSS, Git, or terminal commands. Preserve the same
portable source files and developer access underneath.

Aim for the clarity and completeness of a WordPress-style admin, with Sheriff's
static output, wiki/documentation features, themes, and modular architecture.
This is not a feature-for-feature clone of WordPress, Wix, Elementor, or Drupal.
Cloud is optional. An offline installation must still create, edit, preview, and build.

## Existing architecture comes first

Extend the current shared Desk, backend adapter, active-portal context, file/media
management, pickers, themes, configuration, wizard, seeding, snapshots, and logs.
Authentication and transfer primitives already exist; their interaction model is
being corrected. Do not recreate these features or treat a working transport as
proof of a complete user workflow.

One Desk means the same workspace and predictable operations in both environments.
Local actions use local files/builds. Hosted actions use authenticated Cloud
files/builds/publication. Show environment-appropriate controls, rather than placing
local-only machinery online or requiring Cloud for normal local work.

Sign in connects the account. Selecting a portal selects the site being worked on.
There is no manual per-portal login/linking wizard. Integrate Cloud-only/local-only
availability and Push/Pull into existing portal management and the selected workspace.
Remove the separate Cloud Sync page and its duplicate inventory.

Ordinary source operations must not force a build. Distinguish unsaved editor text,
saved changes needing a build, and completed output needing publication. Show an
unobtrusive persistent notice and let the author decide when to build. Retain the
Save / Build page / Build portal actions and explicit publication actions.

## Visual and source editing

The main editing interface should provide Visual / Source modes. Markdown remains
the authoritative representation on disk and in Cloud source storage. A structured
in-memory editor model is acceptable; a second authoritative HTML database or
proprietary saved-document format is not.

Do not implement this as a lossy Markdown-to-HTML-to-Markdown conversion. Preserve
raw source for untouched regions and unsupported constructs. Start by proving:

- Opening and switching modes without edits preserves source, including custom syntax.
- Editing a supported paragraph changes that paragraph without rewriting unrelated blocks.
- Unknown third-party syntax survives and remains directly source-editable.
- Wiki links, icon options, pattern fields/tabs, admonitions, code fences, template
  directives, HTML, columns, citations, badges, and interactive embeds retain meaning.
- Undo/redo, selections, unsaved buffers, saving, and the existing revision workflow
  remain coherent when modes are switched.

Unsupported elements can appear as labeled source-backed blocks with source editing.
Visual editing must not imply an element is safely editable when it is not.
Use the existing Goblin rendering semantics for previews and validation; avoid an
independent JavaScript implementation of Sheriff's backend feature behavior.
Browser editor interactions remain JavaScript, as with the current Desk.

Once preservation works, add ordinary formatted content and wikilinks, then images,
icons, tables, patterns, admonitions, and further Sheriff elements incrementally.
Reuse existing picker catalogs, upload rules, and insertion interfaces. Source mode
stays available throughout. Make Visual the default once those guarantees hold.

## Comprehensive GUI without flattening every feature into buttons

Expose common metadata, branding, typography, theme options, and menus through
purposeful forms and previews over existing source. Preserve unknown metadata,
custom templates, overrides, and raw editing. Separate routine controls from advanced
details without removing capabilities.

The proposal suggests Dashboard, Pages & Content, Media Library, Appearance,
Navigation, Modules, Site Health, Sync & Deploy, and Settings. These are conceptual
activities, not approved new routes or a replacement sidebar. In particular, the
publishing/sync activity must not resurrect the rejected separate Cloud Sync page.
Keep Icons, Patterns, Interactive, Seeding, versions, and Snapshots accessible.

Dashboard should report real counts/recent changes, build and publication state,
issues, active modules, preview, and quick actions. Site Health should reuse build
reports and wiki indexes, distinguish wanted/stub content from genuine errors, and
take authors to affected source. Module controls should reuse the current module/glam
architecture; optional editor support may be supplied by modules, but preserving
their source cannot depend on having a visual integration installed.

Desk manages Sheriff files and builds. Studio retains Spur pages/navigation/blogs/
forums/downloads. Shared admin Settings manages appropriate account/site services.
Both branded admin entry URLs remain valid; preserve selected site and site_origin
defaults rather than redirecting everyone into a different brand.

## Wiki and docs homepage composition

The planned visual builder must also work within wiki/docs pages. The owner's
Programming homepage example demonstrates the need for a composed landing page,
with useful themed sections instead of only an ordinary article introduction.
This is future builder functionality, not an existing product called Webkit.

Allow independent content panels arranged side by side, with equal or unequal
widths, category/article cards, featured content, and image/video sections. Each
panel should support normal Sheriff content, including wikilinks and patterns.
Keep the surrounding wiki/docs theme and navigation, with deliberate per-page
controls for article metadata, TOC, sidebars, and content width where needed.
Layouts must stack predictably on mobile and work across all three built-in themes.

The existing list-columns feature flows a list across columns. It does not provide
independent panels or a general section-layout editor. Track these as distinct
capabilities. Start with a reviewable Programming wiki homepage composition; do
not require a complete freeform designer or a new content database to support it.

## Optional front-end editing of the current page

Future work after the shared Visual/Source editor works. Authorized editors should
be able to choose Edit this page while viewing a published Cloud page, or while
viewing a local site, and edit only that page's authored content in place. Reuse
Desk's editor and source-save behavior; do not create another editor or save the
rendered page DOM as HTML.

Keep site headers, navigation, theme settings, global patterns, and generated
content outside this editing surface. Preserve the source frontmatter and custom
syntax. Resolve the exact page/version to its Markdown source through trusted
build/route information; a URL filename alone is not sufficient. Save updates that
source under the explicit existing overwrite/revision policy. It does not silently
create new revisions or edit a different version.

Use existing Cloud authentication and server-side site/page editing authorization.
Local editing uses the local Desk APIs and must not require Cloud or upload source
merely because an account is signed in. Public HTML must not expose credentials or
become writable simply because an Edit control is hidden. Check the source revision
on save so an older tab cannot silently overwrite newer work.

Save changes source only and marks pending build work. Preview edited content in
context, with deliberate build/publication controls consistent with Desk. Ordinary
visitors continue to receive the static reading experience; load editor assets only
when the feature is invoked. This plans an optional authoring convenience and does
not bring forward the separately deferred multi-author/role-management project.

## Shared public sign-in and editing permissions

Owner direction added 2026-11-14: put Login / Sign up to the right of the theme
switcher in the public header. Replace those controls with the signed-in account's
avatar/menu. Use the same Sheriff Cloud identity across sites, including custom
public domains, as the foundation for future comments, discussions, and other
account features. Reuse existing authentication/SSO rather than inventing per-site
accounts. Cross-domain sign-in must use the existing supported session flow;
separate domains do not share browser localStorage.

Authentication and authorization remain distinct. A site will choose who may edit
when editing permissions are implemented. Show Edit this page only when the current
account has the required editing capability; keep it hidden while capability is
unknown or denied. The server must enforce that decision on every edit/save, even
when a caller bypasses the interface. A valid SC login is not blanket editing access.

Later, add page-specific editing locks/restrictions that further limit site-level
permission, with policy and authorized exceptions designed explicitly. Editing
locks do not automatically make the public page private. No page-lock system or
collaborator-role UI is implemented or authorized for implementation by these notes.

Keep public reading available without sign-in, and preserve offline/local authoring.
Style account controls across Compendium, Outpost, and Siegemate, including mobile
and light/dark. Respect the future shared/headerless/Spur header arrangement so
there is one appropriate account entry rather than stacked duplicate headers.

## Sequencing

1. Correct existing Desk behavior: account/site selection, source/build/publish
   status, save-only paths, labels, list refresh, and shared safeguards.
2. Demonstrate the visual editor's lossless preservation on copied/synthetic content.
   Include custom Sheriff and unsupported module examples before broad formatting.
3. Add a small useful visual editor over real files, retaining Source and existing pickers.
4. Expand metadata/menu/appearance controls and responsive preview.
5. Add module management and Site Health incrementally, then broader site design.

Review working UI one piece at a time. This larger direction does not make every
builder feature a prerequisite for Sheriff 1.0. MOWI, theme updates, publishing
metadata, performance scaling, and the other existing backlog work remain tracked.

## Engineering and release boundaries

Sheriff backend feature logic belongs in Goblin, with browser JavaScript and theme
HTML/CSS for the UI. Keep the generic Core runner module-agnostic. Existing external
helpers remain temporarily permitted under the separately documented Goblin runtime
gaps; this plan does not authorize more helper-language workarounds.

Retain existing source snapshots, build-output recovery, ownership checks, and
conflict/revision safeguards. Do not overwrite production sites with local test
content. No Goblin recompilation, Fly deployment, CPU purchase, or production
content change is authorized merely by adding this plan to the backlog.

## Proposal provenance and limit

Based on the owner's supplied "Sheriff Desk — Unified Visual Website Builder & CMS"
proposal and the 2026-11-14 Desk audit/discussion. The attached text ends mid-item
after "4. Option" in Editor Workflow. Its unseen remainder has not been inferred
or recorded as agreed scope. Specific editor libraries and a generic freeform
page builder have not been selected.
