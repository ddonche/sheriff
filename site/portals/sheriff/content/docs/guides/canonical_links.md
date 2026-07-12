^^^^
title: Canonical Links
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: docs
summary: Canonical links give each Sheriff page a stable wiki identity.
gloss: Canonical links are the stable wikilink names Sheriff stores for each page.
canonical: canonical-links
^^^^

A canonical link is the stable wikilink name for a page.

In Sheriff, every normal page can have a `canonical` field in frontmatter. That value is the page's official wiki identity.

For example:

```yall
^^^^
title: House Andergard
author: Janden
layout: docs
meta_kind: docs
meta_type: entry
summary:
gloss:
canonical: house-andergard
aliases: [Andergard, Andergard House]
categories: [Houses, Royal Houses]
^^^^
```

This means Sheriff treats the page as:

```md
[[house-andergard]]
```

You can still write natural wikilinks such as:

```md
[[House Andergard]]
```

Sheriff normalizes wikilinks before resolving them.

---

## Why Is It Important?

Canonical links make wiki navigation stable.

They serve three primary purposes:

* They give every page one official wikilink name.
* They let navigation menus use wikilinks instead of hard-coded output URLs.
* They prevent page-name conflicts from silently pointing to the wrong page.

Without canonical links, a page's wiki identity is derived from its filename. That works for simple sites, but it gets messy when a wiki grows, pages move, or two pages share the same filename in different folders.

---

## Frontmatter

The recommended form is a plain slug:

```yall
canonical: house-andergard
```

Do not include the full wikilink syntax in frontmatter unless you have a specific reason.

Write this:

```yall
canonical: house-andergard
```

Not this:

```yall
canonical: [[house-andergard]]
```

The rendered copyable link still appears as:

```md
[[house-andergard]]
```

---

## Automatic Canonicals

If a page does not have a `canonical` field, Sheriff creates one during the build.

For example, this file:

```text
content/wiki/houses/house_andergard.md
```

gets this canonical value:

```yall
canonical: house-andergard
```

Sheriff writes that value back into the page's frontmatter.

After that, the canonical link belongs to the page until you change it yourself.

---

## Moving Pages

Canonical links are stored in frontmatter so a page can move without changing its wiki identity.

For example, this page:

```text
content/wiki/houses/house_andergard.md
```

might later move to:

```text
content/wiki/royalty/houses/house_andergard.md
```

As long as the frontmatter still says:

```yall
canonical: house-andergard
```

then links to `[[house-andergard]]` still resolve to the page.

---

## Name Conflicts

Sheriff does not allow two pages to claim the same canonical link.

For example, these two pages cannot both use:

```yall
canonical: tallahassee
```

If that happens, Sheriff stops the build and prints a readable Trailboss message showing both files.

You then choose which page keeps the canonical name and which page gets a more specific one.

For example:

```yall
canonical: tallahassee
```

and:

```yall
canonical: places-tallahassee
```

This keeps `[[tallahassee]]` from becoming ambiguous.

---

## Generated Names

When Sheriff creates a canonical field for a new page, it starts with the filename.

For example:

```text
content/wiki/characters/tallahassee.md
```

becomes:

```yall
canonical: tallahassee
```

If another page would receive the same canonical name, Sheriff uses the parent folder to make the new one more specific.

For example:

```text
content/wiki/places/tallahassee.md
```

can become:

```yall
canonical: places-tallahassee
```

You can edit the generated value if you want a different canonical link.

---

## Aliases And Redirects

Use `canonical` for the page's official name.

Use `aliases` for old names, alternate names, spelling variants, and redirects.

For example:

```yall
^^^^
title: Focus Panels
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: docs
summary:
gloss:
canonical: focus-panels
aliases: [Focus Panel, focus-panel]
^^^^
```

This page's official wikilink is:

```md
[[focus-panels]]
```

These older or alternate links also resolve to it:

```md
[[Focus Panel]]
[[focus-panel]]
```

Sheriff also generates redirect files for aliases when possible.

---

## Navigation

Scout navigation can use canonical wikilinks.

In `nav.yall`, you can write:

```yall
menus:
  left_docs:
    Styling Guide:
      Images: [[Images]]
      Redirects: [[Redirects]]
      Canonical Links: [[Canonical Links]]
```

Sheriff resolves those links through `routes.json`.

That means the menu does not need to know the final output path, such as:

```text
docs/guides/canonical_links.html
```

The route data knows where the page renders.

---

## Generated Pages

Generated admin pages also receive canonical route data.

If a generated page would conflict with a hand-written page, Sheriff gives the generated page a more specific canonical name.

For example, the hand-written Categories guide can keep:

```yall
canonical: categories
```

while the generated category index can use:

```yall
canonical: categories-index
```

The real authored page wins the clean name.

---

## Routes JSON

Canonical links are stored in `routes.json`.

Each route includes the old filename-derived slug and the persistent canonical slug:

```json
{
  "slug": "house-andergard",
  "canonical_slug": "house-andergard",
  "canonical": "[[house-andergard]]",
  "href": "/wiki/houses/house_andergard.html"
}
```

Trailboss and Scout use `canonical_slug` first, then fall back to `slug` for older route data.

---

## Modules Involved

* **[[Routes JSON]]** - stores canonical route data and writes missing canonical fields.
* **[[Trailboss]]** - resolves wikilinks using canonical route data.
* **[[Scout]]** - resolves navigation wikilinks using canonical route data.
* **[[Redirects]]** - uses aliases for old names and alternate links.

---

::: nav
next [[Redirects]]
previous [[Categories]]
:::

::: nav
related [[Redirects]] - point old page names to real pages
related [[Categories]] - generated pages also receive canonical route data
related [[Navigation]] - menus can use canonical wikilinks
:::
