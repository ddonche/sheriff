<p align="center">
  <img src="site/portals/sheriff/public/logo.png" alt="Sheriff static site generator logo" width="180">
</p>

# Sheriff

**A modular, flat-file static site generator written in [Goblin](https://github.com/ddonche/goblin-lang).**

Sheriff turns Markdown, templates, and site configuration into static websites. It began as the documentation system for the Goblin programming language and has grown to support documentation, wikis, blogs, and other content-driven sites.

Sheriff includes **Sheriff Desk**, a local browser-based interface for managing content, assets, themes, and builds. Published websites consist of static files and don't require Goblin to run on the hosting server.

## Features

- **Wiki publishing:** Wiki links, backlinks, categories, redirects, wanted pages, and structured infobox patterns.
- **Documentation:** Navigation, tables of contents, versioned documentation, code highlighting, admonitions, and footnotes.
- **Content management:** Markdown source files, blogging features, image uploads, search, and local site management through Sheriff Desk.
- **Themes:** Reusable site themes, light and dark modes, and site-specific overrides.
- **Modular architecture:** A configurable build pipeline with features supplied by modules rather than hardcoded into the core.
- **Static deployment:** Generate HTML, CSS, JavaScript, and assets for conventional web hosting.

## See Sheriff in action

**[Sheriff documentation and website](https://sheriff.sheriffcloud.com/)**

The documentation site is itself built with Sheriff.

## Getting started

Sheriff is under active development and currently runs using the [Goblin programming language](https://github.com/ddonche/goblin-lang). For the current setup instructions and documentation, visit the [Sheriff website](https://sheriff.sheriffcloud.com/).

Sheriff Desk runs locally; the generated website can be published to a separate hosting provider without installing a CMS or language runtime on that server.

## Repository structure

- `sheriff-core/` — Sheriff engine, Desk, modules, and themes
- `site/portals/sheriff/` — Source files for the Sheriff website
- `docs/` — Technical notes and development documentation
- `tests/` — Tests and regression checks

## Links

- [Sheriff website and documentation](https://sheriff.sheriffcloud.com/)
- [Goblin programming language](https://github.com/ddonche/goblin-lang)
- [Report an issue](https://github.com/ddonche/sheriff/issues)
