^^^^
title: Sheriff – Simple Documentation Site Generator
author: Sheriff Docs
layout: docs
meta_kind: overview
meta_type: documentation
summary: What Sheriff is, why it was built, and how it keeps documentation simple.
gloss: Sheriff is a simple documentation and knowledge-base site generator written in Goblin that turns Markdown and wiki-style content into a complete static website.
^^^^

**Sheriff** is a documentation and knowledge-site generator designed to be **simple to understand and easy to customize**.

Many static site generators are built primarily for developers.[^ssg] Changing small things often requires digging through complex project structures, plugin systems, or framework conventions.

[^ssg]: *What is a static site generator?*. Cloudfare. https://www.cloudflare.com/learning/performance/static-site-generator/

Sheriff was created to solve that problem.

The goal is straightforward:

**You should be able to build and customize a documentation site without digging through a maze of code.**

Sheriff keeps things predictable so most customization happens in just a few places:

* your **content files**
* your **navigation file**
* your **templates**
* your **site configuration**

In many cases, you can drop your logo in the public folder, edit a few files, and your site is ready.

Sheriff is written in the [[https://goblinlang.org|Goblin programming language]] as a proof of concept for building practical tools with Goblin.

---

**Quick Overview**

* **Type:** Static site generator
* **Language:** [[https://goblinlang.org|Goblin]]
* **Content:** Markdown + Sheriff wiki syntax (wiki links, focus panels, etc.)
* **Purpose:** Documentation sites, wikis, manuals, and knowledge bases
* **Output:** Static HTML

---

## What Sheriff Actually Does

Sheriff takes a folder of content files and turns them into a complete website.

You write pages using **Markdown** plus a few Sheriff features such as [[links|wiki links]], [[images]], [[Focus Panels|focus panels]], and embeds (like [[videos]]).[^markdown]

[^markdown]: *What is Markdown?*. Markdown Guide. https://www.markdownguide.org/getting-started/

Example page:

```md
^^^^
title: My Page
layout: docs
^^^^

# Hello

Welcome to my site.

See the [[frontmatter]] guide for more details.
```

When Sheriff builds the site it:

1. reads the page
2. applies the layout template
3. builds navigation
4. renders the final HTML

The output is a **static website** that can be hosted anywhere.[^static]

[^static]: *Static web page*. Wikipedia. https://en.wikipedia.org/wiki/Static_web_page

::: note
Because Sheriff generates static files, the site loads quickly and does not rely on a backend server or database.
:::

::: lore Why ^^^^ for Frontmatter
Sheriff uses `^^^^` delimiters for frontmatter instead of the common `---` to avoid confusion with Markdown horizontal rules and thematic breaks (which also use `---`).  
When you see `^^^^`, you immediately know everything inside is metadata—and it won't appear on the final site.
:::

---

## Designed To Stay Simple

Sheriff was designed specifically to avoid the complexity common in many documentation systems.

Instead of spreading configuration across dozens of files or plugin layers, Sheriff keeps customization concentrated in a few clear locations:

| File                | Purpose                             |
| ------------------- | ----------------------------------- |
| **config.yall**     | global site configuration           |
| **nav.yall**        | navigation menu structure           |
| **templates.yall**  | page layouts and site structure     |
| **public**          | static assets like logos and images |

This means you almost always know exactly where to look when you want to change something.

---

## Typical Workflow

1. Write pages in Markdown
2. Organize navigation in `nav.yall`
3. Customize layouts in `templates.yall`
4. Run Sheriff to build the site
5. Upload the generated files

::: tip Markdown Cheat Sheet
Sheriff pages come with a built-in Markdown cheat sheet. Look to the right of the author name. Click the icon with the question mark and you'll see it.
:::

---

## More Than Markdown

While most content is written in Markdown, Sheriff also supports several built-in extensions that make documentation easier to write.

These include:

* **wiki-style links** for connecting pages
* **image syntax** designed for documentation
* **focus panels** for highlighting important information
* **video embeds**
* **tooltips** and inline references

These features are built directly into Sheriff rather than requiring external plugins.

::: tip
You can find links to the most commonly-needed pages in the documentation menu in the left sidebar.
:::

---

## Y'all Configuration

Sheriff also introduces **Y'all**, a configuration format designed to replace YAML.[^yaml]

[^yaml]: Sharma, A. (2024). *What is YAML? A beginner's guide*. CircleCI Blog. https://circleci.com/blog/what-is-yaml-a-beginner-s-guide/

YAML is powerful but often confusing for non-developers. Y'all is a clean, readable alternative to YAML for configuration.

Navigation files such as **nav.yall** define the menu structure for a site.

---

## Portals

One of Sheriff’s most important features is **[[portals]]**.

A portal allows a single Sheriff installation to generate **multiple separate sites**.

For example, one installation could build:

* product documentation
* a knowledge base
* a developer wiki
* internal manuals

Each portal can have its own:

* layouts
* themes
* navigation
* assets

You can build all portals at once or generate only a specific one.

This makes Sheriff useful for organizations managing multiple documentation projects.

---

## Flexible Build Pipeline

Sheriff also allows parts of the build process to be customized or skipped.

For example, portals can:

* disable certain built-in features
* skip parts of the build pipeline
* avoid built-in widgets or tokens

This allows Sheriff to remain flexible without becoming overly complex.

---

## Built With Goblin

Sheriff is written entirely in the **[[https://goblinlang.org|Goblin]] programming language**.

Sheriff began as a proof-of-concept project to demonstrate that Goblin can be used to build real-world tools.

Sheriff serves as a working example of a practical Goblin application.

::: lore 
Dan Donche Jr. created both Goblin and Sheriff in 2025. Development is ongoing. He also created Vekke, an abstract strategy game, and you can see Sheriff in action on the site, [[https://vekke.net|Vekke.net]].
:::

---

## Where To Go Next

If you're new to Sheriff, these pages are a good place to continue:

* [[Frontmatter]] — metadata used by Sheriff pages
* [[Portals]] — organizing multiple sites
* [[Navigation]] — building menus with nav.yall
* [[Admonitions]] — notes, warnings, and callouts
* [[Links|Wiki Links]] — connecting pages together
