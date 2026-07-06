^^^^
title: Redirects
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: docs
summary: Use aliases to redirect old page names and alternate wikilinks to the real page.
gloss: Redirects let old page names and alternate wikilinks point to the real page.
^^^^

A redirect sends an old page name or alternate page name to the real page.

In Sheriff, redirects are defined on the destination page. Instead of creating a separate redirect page by hand, you tell the real page which names should point to it.

Sheriff uses the `aliases` field in frontmatter to build redirects and resolve wikilinks.

---

## Why Is It Important?

Redirects serve two primary purposes:

* They keep old links working after a page is renamed.
* They let alternate wikilink names point to the same real page.

For wiki-style sites, this is especially useful when a page has common abbreviations, old names, spelling variants, or plural/singular forms.

---

## Destination-Owned Redirects

Sheriff redirects are destination-owned.

That means aliases live on the real page:

```yall
^^^^
title: House Andergard
author: Janden
layout: docs
meta_kind: docs
meta_type: entry
summary:
gloss:
aliases: [Andergard, Andergard House, House Andergaard]
categories: [Houses, Royal Houses]
^^^^
```

This means:

```text
All of these names point to House Andergard.
```

---

## Generated Redirect Files

When you build your portal, Sheriff automatically creates redirect pages for each alias.

For example:

```yall
aliases: [Andergard, Andergard House]
```

generates redirect pages like:

```text
dist/
└── sheriff/
    ├── andergard.html
    └── andergard-house.html
```

Each generated redirect page sends visitors to the real page.

---

## Wikilinks

Aliases also work inside wikilinks.

If this page exists:

```yall
title: House Andergard
aliases: [Andergard, Andergard House]
```

then all of these links resolve to the same page:

```md
[[House Andergard]]
[[Andergard]]
[[Andergard House]]
```

Sheriff checks the real page slug first, then checks its aliases.

---

## Page Renames

When you rename a page, add the old name to the new page's `aliases` list.

Example:

```yall
title: Focus Panels
aliases: [Focus Panel, focus-panel]
```

Now old links such as:

```md
[[Focus Panel]]
[[focus-panel]]
```

will point to `Focus Panels`.

Sheriff will also generate redirect pages for those aliases.

---

## Conflicts

Sheriff will not generate a redirect page if the alias slug already belongs to a real page.

For example, if a real page already exists at:

```text
focus-panel.html
```

then an alias that would generate the same path is skipped.

The real page always wins.

---

## Modules Involved

* **[[Trailboss]]** - resolves wikilinks through route data.
* **[[Routes JSON]]** - stores aliases and generates redirect pages.

---

::: nav
next [[Categories]]
previous [[Glossary Tooltips]]
:::

::: nav
related [[Wanted Pages]] - find missing wikilinks before deciding whether to create aliases
related [[All Pages]] - view every generated route
related [[Trailboss]] - handles wiki links and routes
:::
