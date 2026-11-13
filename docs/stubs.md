# Stub article notice

Put this token on its own line where the notice should appear, usually near the
top of an unfinished article:

```text
{{{SHERIFF::STUB}}}
```

By default, it displays **Stub article** and “This article is a stub. You can help expand it.” The active theme supplies the styling. Removing the token removes the notice on the next page or portal build. No JavaScript or separate activation is needed.

Change its wording in the active theme's portal-local `templates.yall`, at the top level alongside `wiki_icons`:

```yall
stub_notice:
  title: "Stub article"
  text: "This article is a stub. You can help expand it."
```

Wording inherits per field from built-in defaults to the Core theme and then the portal theme. Missing, blank, or non-text fields keep the inherited value. Both fields render as plain text, including literal HTML and Sheriff syntax. Icon selection remains in `wiki_icons.stub`.

The token, rather than the configured wording, determines stub status and automatic Stub pages membership. A page build updates that article's wording; a portal build updates all articles. Local and Cloud use the same module.

Change the icon in your portal theme's `templates.yall`:

```yall
wiki_icons:
  stub: file-pen-line
```

Use a name from Desk's Icons panel, including custom SVG/PNG icons. Use `false`
or an empty string to hide the icon while keeping the notice. Omitted settings
inherit the Core theme default. Defaults are `file-pen-line` for Outpost,
`notebook-pen` for Compendium, and `scroll-text` for Siegemate.

Examples in inline/fenced/indented code, raw HTML code, and HTML comments do not
create notices. Tokens supplied by reusable patterns work through the normal
page schedule. A page build still updates only its selected page.

## Implementation and current scope

Trailboss Wiki owns the implementation in
`modules/trailboss_wiki/stubs.gbln`, with shared source detection in
`modules/trailboss_wiki/stub_source.gbln`. Its scheduled `prepare` and `render` actions
protect examples before Markdown and render notices afterward. Icon publication
uses the existing wiki icon renderer. The generic Core build runner is unchanged.

## Stub markers in generated listings

All Pages and category article lists display a small stub icon before articles
containing an active stub token, in the same leading position used for category
folder icons. Category entries keep their folder icon and do not display an
additional stub marker.

The marker uses the same `wiki_icons.stub` setting as the notice. It has an
accessible “Stub article” label and a tooltip. Disabling its icon changes only
the decoration; the page still has derived stub status.

Route indexing records `is_stub` from page content, including reusable patterns.
Frontmatter, code examples, and HTML comments do not trigger stub status. Sheriff
does not write this status into source frontmatter. Removing the token clears
its listing marker on the next **Build portal**. **Build page** updates the
selected article's notice and leaves shared directory pages alone.

## Automatic Stub pages category

An active stub token automatically adds the article to **Stub pages**
(`/categories/stub-pages.html`). Removing the token removes that derived
membership. Do not add this category manually: the name is reserved for the
marker-derived list, so a stale frontmatter or inline-category assignment cannot
keep a completed article in it.

Source frontmatter is unchanged. A page build updates the selected article's
notice and category tag; **Build portal** refreshes category membership, counts,
and directory listings. When the last stub is completed, the empty generated
category is removed during the portal build. Reusable patterns containing an
active marker also count; code examples and comments do not.

## Explicit site seeding

Trailboss Wiki's `seeder.gbln` is explicitly invoked through `seed.gbln` or Desk's
Portals > Seed pages dialog. It is not registered in any build schedule. Both
entry points share parsing, naming, merge/conflict validation and reporting.

From sheriff-core:

```text
goblin run seed.gbln <portal> preview [source.yall]
goblin run seed.gbln <portal> create [source.yall]
```

The default input is `<portal>/seeder.yall`. Preview is read-only. Creation saves
the exact plan at the portal root and exclusively creates missing Markdown
articles with wiki metadata and the stub token. Existing sources, revisions and
completed articles are skipped. Category assignments for repeated titles merge;
conflicting metadata, paths, canonicals or aliases block creation. OS helpers only
perform exclusive file creation, planning-file replacement, and path/link checks.

New portals receive the fully commented example; existing portals can use Desk's
example/upload/editor. Reports can be downloaded. Source creation never builds or
publishes; the normal Build portal action refreshes all generated listings.

See the authored Seeding guide for supported input and metadata.
