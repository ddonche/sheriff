<p align="center">
  <img src="site/portals/sheriff/public/logo.png" alt="Sheriff static site generator logo" width="180">
</p>

# Sheriff

**A modular, flat-file static site generator written in [Goblin](https://github.com/ddonche/goblin-lang).**

Sheriff turns Markdown, templates, and site configuration into static websites. It began as the documentation system for the Goblin programming language and now supports documentation, wikis, blogs, knowledge bases, and other content-driven sites.

Sheriff is built around a configurable, module-driven publishing pipeline. It also includes **Sheriff Desk**, a local browser-based interface for editing content, managing assets, configuring themes, and building sites.

**[Website and documentation](https://sheriff.sheriffcloud.com/)** · **[Source code](https://github.com/ddonche/sheriff)** · **[Report an issue](https://github.com/ddonche/sheriff/issues)**

## Features

- **Documentation publishing:** Navigation, tables of contents, breadcrumbs, versioned documentation, code highlighting, admonitions, and footnotes.
- **Wiki tools:** Wiki links, backlinks, categories, redirects, wanted pages, and structured infobox patterns.
- **Blogs and content sites:** Markdown pages, article publishing, search, and reusable layouts.
- **Sheriff Desk:** A local browser-based interface for content, images, themes, configuration, and build management.
- **Multi-portal builds:** Generate multiple separate websites from one Sheriff installation, each with its own configuration and presentation.
- **Themes:** Reusable layouts and styling, including light and dark modes and portal-specific overrides.
- **Modular pipeline:** Enable, reorder, extend, or replace publishing steps through modules and configuration.
- **Static output:** Publish HTML, CSS, JavaScript, and assets to ordinary static hosting, without running Goblin on the web server.

## How Sheriff works

Sheriff reads source content, runs a configured series of publishing actions, applies layouts and themes, and writes static output.

~~~text
Markdown + frontmatter + site configuration
                     |
              Sheriff pipeline
           (modules + build events)
                     |
              Layouts and themes
                     |
              Static website
           HTML + CSS + JavaScript
~~~

Build steps are configured with **YALL** files. Modules provide functionality such as Markdown rendering, routing, navigation, theming, and search. The pipeline is designed so those features can be changed without modifying the central build runner.

### Write content in Markdown

A Sheriff page can use Markdown together with wiki links and page metadata:

~~~markdown
^^^^
title: Getting Started
layout: docs
^^^^

# Getting Started

Welcome to the documentation.

Read the [[Installation]] and [[Configuration]] guides.
~~~

Sheriff resolves the wiki links, renders the content, applies the selected layout, and generates static HTML. Additional syntax supports images, icons, footnotes, admonitions, and structured wiki content.

## Getting started

Sheriff is under active development and currently requires the **[Goblin programming language](https://github.com/ddonche/goblin-lang)** to run its build system.

For the current setup instructions, use the **[Sheriff website and documentation](https://sheriff.sheriffcloud.com/)**.

Once your Sheriff installation and portals are configured, the documented build commands include:

~~~sh
# Build every portal
sheriff build all

# Build one portal
sheriff build myportal

# Rebuild a single page in that portal
sheriff build myportal page docs/getting-started.md
~~~

See the [building sites guide](site/portals/sheriff/content/docs/getting_started/building_sites.md) for the three build scopes.

### Sheriff Desk

Sheriff Desk provides a local web interface for managing site content and assets, selecting themes, and running builds. It is part of the authoring workflow; published static websites do not require Desk, Goblin, or a database on the hosting server.

## See Sheriff in action

The **[Sheriff website and documentation](https://sheriff.sheriffcloud.com/)** are built with Sheriff itself.

The repository includes the source for that site, alongside the generator, modules, themes, and regression tests.

## Repository structure

| Path | Contents |
| --- | --- |
| `sheriff-core/` | Build engine, modules, Sheriff Desk, and themes |
| `site/portals/sheriff/` | Source files and assets for the Sheriff website |
| `docs/` | Technical notes, feature documentation, and development plans |
| `tests/` | Regression and integration tests |

## Project status and contributions

Sheriff is actively developed, and interfaces and setup instructions may change as the project evolves.

For bugs, feature requests, or discussions, please [open a GitHub issue](https://github.com/ddonche/sheriff/issues). For implementation details, browse the [source repository](https://github.com/ddonche/sheriff) and the [official documentation](https://sheriff.sheriffcloud.com/).
