^^^^
title: Navigation
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: documentation
summary: Build header, sidebar, and footer navigation using nav.yall.
gloss: nav.yall defines your site menus (header, docs sidebar, and footers) as a simple nested map of labels to links.
^^^^

Sheriff navigation is controlled by a single file: **nav.yall**.

You define one or more **menus** (header, left docs, footer, etc.) by writing a nested structure of **labels → links**.

The rules are intentionally simple:

* **A string value is a link** (internal path or external URL)
* **A map value is a group** (dropdown / section)
* Nesting creates hierarchy

::: note
Sheriff’s navigation is **data**, not code. You should be able to update menus without touching templates, modules, or build logic.
:::

--- 

## Where to Find Nav.yall

You can find your nav config file at `site/portals/{portal}/nav.yall`. 

::: note
If you duplicate a portal to make a new site, simply edit the new nav file, along with `config.yall` and `templates.yall`.
:::

---

## The Menus Root

Your file starts with a top-level `menus:` key.

Inside it, each key becomes a named menu Sheriff can render:

* `header` — top navigation (supports dropdowns)
* `left_docs` — docs sidebar tree
* `footer_left` / `footer_right` — footer link groups

::: tip
You can add additional menus for your own layouts (for example `left_wiki`, `sidebar_blog`, etc.). If a template asks for a menu by name, Sheriff can render it. Note: if you add new menus, you must include them in layout files and add your own css to make them work how you like.
:::

---

## Example `nav.yall`

Here's the actual nav.yall file from Sheriff's own docs site. This is so you can look around at the final product and see how we achieved this with our own nav file.

```yall
menus:
  header:
    Docs:
      Overview: docs/index.html
      Changelog: docs/changelog.html
      Roadmap: docs/roadmap.html
      Getting Started:
        Introduction: docs/getting-started/index.html
        Installation: docs/getting-started/installation.html
        Basics: docs/getting-started/basics.html

    Tutorials:
      Styling:
        Themes: docs/guides/themes.html
        Branding: docs/guides/branding.html
        Focus Panels: docs/guides/focus_panels.html
      Recipes:
        Password Generator: docs/tutorials/recipes/password_generator_recipe.html

    Features: features.html
    Downloads: downloads.html
    Blog: blog/index.html

  left_docs:
    DOCUMENTATION:
      Getting started:
        Introduction: docs/getting_started/index.html
        Installation: docs/getting_started/installation.html
        First build: docs/getting_started/first_build.html

      Theme Guide:
        Themes: docs/guides/themes.html
        Layout: docs/guides/layout.html
        Templates: docs/guides/templates.html
        Layout Slots: docs/guides/layout_slots.html
        Tokens: docs/guides/tokens.html
        Navigation: docs/guides/navigation.html
        Table of Contents: docs/guides/toc.html
        Site Branding: docs/guides/navigation.html

      Styling Guide:
        Using Markdown: docs/guides/using_markdown.html
        How to Write a Doc: docs/guides/writing_docs.html
        How to Write a Blog Post: docs/guides/writing_blogs.html
        Setting User Avatars: docs/guides/avatars.html
        Frontmatter: docs/guides/frontmatter.html
        Images: docs/guides/images.html
        Videos: docs/guides/videos.html
        Links: docs/guides/links.html
        Glossary Tooltips: docs/guides/glossary.html
        Focus Panels: docs/guides/focus_panels.html
        Infoboxes: docs/guides/infoboxes.html
        Admonitions: docs/guides/admonitions.html
        Code Blocks: docs/guides/code_blocks.html
        Footnotes: docs/guides/footnotes.html

      Under the Hood:
        How Sheriff Works: docs/how_sheriff_works.html
        Portals: docs/portals.html
        Content pipeline: docs/content_pipeline.html
        Modules: docs/modules.html

      Reference:
        Config schema: docs/reference/config_schema.html
        Sheriff Wiki Syntax: docs/reference/sheriff_wiki_syntax.html
        List of Modules: docs/reference/modules_list.html

  footer_left:
    © 2025-2026 Sheriff Docs: ""
    built with Goblin: https://goblinlang.org

  footer_right:
    GitHub: https://github.com/ddonche/sheriff
```

---

## Links vs Groups

Sheriff decides whether an item is a **link** or a **group** based on the value:

* `Label: some/path.html` → link
* `Label:` followed by indented children → group

Example:

```yall
menus:
  header:
    Features: features.html
    Docs:
      Overview: docs/index.html
      Getting Started:
        Installation: docs/getting-started/installation.html
```

::: note
Groups can be nested as deep as you want. Keep it readable—navigation is a map for humans. Note: you may have to tweak css to account for your depth choices.
:::

---

## External Links

External URLs work the same way:

```yall
menus:
  footer_right:
    GitHub: https://github.com/ddonche/sheriff
    Goblin: https://goblinlang.org
```

Sheriff will render them as external links (your theme may also add an external-link icon).

---

## Empty Links

Sometimes you want a label that isn’t clickable (a pure heading).

In Sheriff’s nav files, you can use an empty string:

```yall
menus:
  footer_left:
    © 2025-2026 Sheriff Docs: ""
```

::: tip
Use empty links sparingly. If the item is meant to be a section header, prefer a group with children.
:::

---

## How Navigation Actually Works

Navigation in Sheriff is built by the **Scout module**.

[[Scout Module|Scout]] is responsible for turning the simple data in `nav.yall` into the actual navigation HTML that your theme renders.

Scout also builds **page-scoped navigation elements** like the **Table of Contents (TOC)** and **breadcrumbs**.

So there are two kinds of navigation in Sheriff:

* **Portal navigation** → menus from `nav.yall`
* **Page navigation** → TOC and breadcrumbs generated from the page

::: note
Each portal has its own `nav.yall` file. This enables you to customize the menus for each portal.
:::

---

### Step 1 — Scout loads `nav.yall`

During the build, Scout loads the navigation file from the active portal:

```
site/portals/{portal}/nav.yall
```

If the file does not exist, Scout simply returns an empty map so the build continues without menus.

---

### Step 2 — Menus are parsed into a navigation tree

Scout reads the `menus:` map and converts the nested structure into an internal tree.

Example:

```
Docs
 ├─ Overview
 ├─ Changelog
 └─ Getting Started
      ├─ Introduction
      └─ Installation
```

The hierarchy you write in `nav.yall` is preserved exactly.

---

### Step 3 — Scout renders menu HTML

For each menu in `nav.yall`, Scout generates several navigation shapes:

* `<menu>_DROPDOWN` — header dropdown navigation
* `<menu>_SIDEBAR` — nested documentation sidebar
* `<menu>_FLAT` — simple footer links

These are published as **SCOUT [[tokens]]**.

Example if your menu is named `header`:

```
SCOUT::header_DROPDOWN
SCOUT::header_SIDEBAR
SCOUT::header_FLAT
```

Your **theme templates** decide which of these tokens are used and where they appear.

::: note
`nav.yall` defines the **structure**, while templates decide **how that structure is rendered**.
:::

---

### Page Navigation: TOC

Scout also builds a **Table of Contents** for each page.

It scans the rendered HTML for headings:

* `<h1>`
* `<h2>`
* `<h3>`
* `<h4>`

From those headings it generates a list of anchor links and publishes it as:

```
SCOUT::TOC
```

If the page contains footnotes, Scout will also add a **References & Footnotes** entry linking to `#footnotes`.

---

### Page Navigation: Breadcrumbs

Breadcrumbs are generated from the page path relative to the portal content directory.

Example path:

```
docs/guides/navigation.html
```

Becomes:

```
Docs
↳ Guides
↳ Navigation
```

Scout converts file names into readable labels by:

* removing `.md` / `.html`
* replacing `_` and `-` with spaces
* converting the result to Title Case

The final breadcrumb markup is published as:

```
SCOUT::BREADCRUMBS
```

---

## Tips for Keeping Nav Clean

* Keep labels short (nav is scanning, not reading).
* Use **Title Case** consistently.
* Don’t over-nest in the header—put deep trees in the docs sidebar.
* Keep your docs paths consistent (`docs/getting_started/...` vs `docs/getting-started/...`).

::: warning
Sheriff prefers underlines in directories and file names. When in doubt, use naming convention like `docs/getting_started/...`
:::

---

## Page Navigation Blocks

Sheriff supports two special navigation panels that appear at the bottom of documentation pages:

* **Next / Previous navigation**
* **Related pages**

These are written using simple `::: nav` blocks.

They are **page-level navigation helpers**, separate from the portal navigation defined in `nav.yall`.

---

### Next / Previous Navigation

This panel helps readers move **sequentially through documentation**. Where other sites might automatically generate these based on the directory structure, in Sheriff you curate these links to guide people exactly where you want them to go.

Example:

```
::: nav
next [[Tuple Bind]]
previous [[Tether]]
:::
```

This renders navigation links *wherever you put them on your page*, but best practice is to put them at the end of your article's content (you can scroll down to see how this page's navigation looks).

### Rules

* `next` moves forward in the learning flow
* `previous` moves backward
* Both values use **wiki-style links**

Example links:

```
[[Variables]]
[[Tuple Bind]]
[[Control Flow]]
```

Sheriff automatically resolves the correct page paths.

---

## Related Pages

Related navigation lists **concepts that connect to the current topic**.

This helps readers explore the documentation without forcing a strict order. Where other sites might automatically generate related content blocks, in Sheriff you curate the related content. 

Example:

```
::: nav
related [[Retether]]
related [[Shadow]]
related [[Local Variables]]
:::
```

This renders a **Related panel** with links to those pages.

---

### Multiple Related Links

You can include as many `related` lines as you want.

Example:

```
::: nav
related [[Variables]]
related [[Scope]]
related [[Tuple Bind]]
related [[Broadcast Tether]]
:::
```

Sheriff will display them as a clean related list.

---

## Combining Navigation Panels

Most docs use **both blocks**.

Example:

```
::: nav
next [[Tuple Bind]]
previous [[Tether]]
:::

::: nav
related [[Retether]]
related [[Shadow]]
related [[Local Variables]]
:::
```

This creates:

* A **Next / Previous** navigation panel
* A **Related concepts** panel

Both appear at the bottom of the page (if that is where you put them).

---

## Why This Exists

Portal navigation (from `nav.yall`) defines the **site structure**.

Page navigation blocks define the **learning path**.

They allow documentation authors to:

* guide readers step-by-step
* suggest related concepts
* create a clear documentation flow

without changing the portal’s sidebar structure.

::: nav
next [[Table of Contents]]
previous [[Tokens]]
::: 

::: nav
related [[Layouts]] - how your pages are arranged
related [[Templates]] - how to arrange your layouts with features and info
related [[Themes]] - how your site looks
:::


