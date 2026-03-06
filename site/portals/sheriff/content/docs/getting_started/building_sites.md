^^^^
title: Building Sites
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: How to build an entire Sheriff site, a single portal, or an individual page.
^^^^

Sheriff can build content at **three different levels** depending on what you need:

* The **entire site** (all portals)
* A **single portal**
* A **single page**

All three use the same rendering engine. The difference is simply **how much of the site Sheriff compiles**.

Choosing the right build mode can dramatically speed up development and debugging.

---

## The three build modes

| Build Target | What Sheriff Compiles        | When to Use It                           |
| ------------ | ---------------------------- | ---------------------------------------- |
| Entire Site  | Every portal and page        | Production builds                        |
| Portal       | One portal and all its pages | Developing a specific documentation area |
| Single Page  | One document only            | Writing or debugging a specific page     |

---

# Building the Entire Site

This compiles **every portal and page** in your Sheriff project.

Use this for final builds or when you want to confirm the whole site works.

Example:

```
sheriff build all
```

During a full build Sheriff will:

* Discover every portal
* Load each portal's `nav.yall`
* Run sweep passes
* Render Markdown
* Apply layouts
* Generate navigation (TOC, breadcrumbs, menus)
* Write all output files

Full builds take the longest but ensure the **entire site is correct**.

---

# Building a Single Portal

A portal build compiles **only one portal and its pages**.

This is useful when you are working on a specific documentation section.

Example:

```
sheriff build {portal_name} <---- put your portal name here
```

Sheriff will:

* Load the selected portal
* Build all pages inside that portal
* Run portal navigation generation
* Apply layouts
* Write the output for that portal only

Portal builds are much faster than full builds and are ideal when developing a **specific documentation area**.

---

# Building a Single Page

A single-page build compiles **only one document**.

Example:

```
sheriff build {portal_name} page docs/loops.md
```

Sheriff will:

* Parse the page frontmatter
* Render Markdown
* Run page sweeps
* Apply the layout
* Output the resulting HTML

Single page builds are extremely fast and are perfect for:

* Writing documentation
* Testing Markdown
* Debugging layouts
* Verifying sweep behavior

You do not need to rebuild the entire portal just to preview one document.

---

## Why Single Page Builds Matter

Single-page builds provide a **tight development loop**.

Instead of rebuilding the entire site every time you edit a file, you can compile only the page you're working on.

This allows you to:

* Iterate quickly
* Test formatting changes
* Debug rendering issues
* Validate frontmatter

It turns Sheriff into a **fast documentation authoring tool**, not just a static site generator.

---

## How Sheriff Decides What to Build

Sheriff looks at the argument you pass to the build command.

| Input       | Result                |
| ----------- | --------------------- |
| No path     | Build the entire site |
| Portal path | Build that portal     |
| Page path   | Build only that page  |

This means the same command can handle all build levels.

---

## Typical Workflow

Most authors use a simple workflow:

1. Write a page
2. Build the page
3. Adjust formatting
4. Repeat

Example:

```
sheriff build {portal_name} page docs/loops.md
```

When the page looks correct, run a portal or full build to verify the rest of the site.

---

## Troubleshooting

### My page builds but the portal doesn't

Portal builds also generate navigation and other portal-level systems.

A page can render correctly while the portal build fails due to:

* navigation issues
* missing pages
* portal configuration errors

---

### My portal builds but the full site fails

Full builds include **all portals**, so failures can come from unrelated sections of the site.

Use portal builds to isolate problems.

---

## Summary

Sheriff supports three build scopes:

* **Full build** — everything
* **Portal build** — one documentation area
* **Page build** — a single document

Using the correct build scope makes Sheriff faster and easier to work with during development.

---

::: nav
next [[Navigation]]
previous [[Layouts]]
:::

::: nav
related [[Frontmatter]]
related [[Layouts]]
related [[Navigation]]
:::
