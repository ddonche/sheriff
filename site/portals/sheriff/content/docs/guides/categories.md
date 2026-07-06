^^^^
title: Categories
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: docs
summary: Use frontmatter categories to collect related pages into generated category indexes.
gloss: Categories group related pages and generate category index pages automatically.
^^^^

Categories group related pages together.

In Sheriff, categories are defined in page frontmatter. When you build a portal, Sheriff reads those categories from `routes.json` and generates category pages automatically.

You do not create category pages by hand.

---

## Why Is It Important?

Categories serve two primary purposes:

* They collect related pages into browsable indexes.
* They help readers discover pages that belong to the same topic, faction, type, guide, or reference group.

For wiki-style sites, categories are useful for things like houses, factions, locations, rules, tutorials, or any other collection of related pages.

---

## Frontmatter

Add categories to the real page's frontmatter:

```yall
^^^^
title: House Andergard
author: Janden
layout: docs
meta_kind: docs
meta_type: entry
summary:
gloss:
categories: [Houses, Royal Houses]
^^^^
```

This puts `House Andergard` in both categories:

```text
Houses
Royal Houses
```

---

## Generated Category Pages

When you build your portal, Sheriff automatically creates:

```text
content/
├── categories.md
└── categories/
    ├── houses.md
    └── royal-houses.md
```

Those markdown files are generated before the normal page pipeline runs, so they render like any other Sheriff page.

---

## Category Index

The generated category index lists every category with a page count.

For example:

```md
* [[Houses]] - 1 page
* [[Royal Houses]] - 1 page
```

This page is generated at:

```text
content/categories.md
```

and renders to:

```text
categories.html
```

---

## Category Detail Pages

Each category also gets its own page.

For example, the `Royal Houses` category generates:

```text
content/categories/royal-houses.md
```

The generated page lists every page in that category:

```md
* [[House Andergard]]
```

Sheriff writes normal wikilinks here, so Trailboss resolves them the same way it resolves links in hand-written pages.

---

## Multi-Word Categories

Multi-word categories are allowed:

```yall
categories: [Houses, Royal Houses]
```

Sheriff treats `Royal Houses` as one category and generates:

```text
categories/royal-houses.html
```

You can also quote category names if you prefer:

```yall
categories: ["Houses", "Royal Houses"]
```

---

## Missing Categories

Pages do not need a `categories` field.

If a page has no categories, Sheriff treats it as:

```yall
categories: []
```

This keeps older pages working without forcing you to edit every existing article.

---

## Modules Involved

* **[[Frontier]]** - normalizes missing category frontmatter.
* **[[Routes JSON]]** - stores category data and generates category pages.
* **[[Trailboss]]** - builds routes before generated category pages are rendered.

---

::: nav
next [[Wanted Pages]]
previous [[Redirects]]
:::

::: nav
related [[All Pages]] - view every generated route
related [[Redirects]] - point old page names to real pages
related [[Trailboss]] - handles wiki links and routes
:::
