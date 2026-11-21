# Multi-portal sites — first local implementation

A site groups existing, explicitly selected portals under one public root. It does
not turn every portal in the installation into part of one website.

The new `site_portals` Goblin module provides site/portal pages and navigation.
Trailboss continues to resolve wiki canonicals. Prospector keeps a separate search
index for each wiki. Compendium, Outpost and Siegemate include the new layouts.
The generic page runner retains its existing pre/page/post schedule model.
This isolated restoration leaves main.gbln, frontmatter parsing, file discovery,
and the Prospector Goblin implementation unchanged.

## Configuration

Create `site/sites/iveki/site.yall`:

```yall
name: Iveki
description: Explore ideas and shared knowledge.
theme: compendium
# Multisite themes (uncomment to enable shared themes).
# shared: every portal uses the main site theme above.
# individual: each portal uses its own theme. This is the default.
# multisite_theming: shared
portals:
  programming:
    source: programming
    name: Programming
    icon: cpu
    description: Languages, tools, and software.
  philosophy:
    source: philosophy
    name: Philosophy
    icon: landmark
    description: Knowledge, ethics, and meaning.
```

Each source portal opts in through its own `config.yall`:

```yall
id: programming
membership:
  site: iveki
  portal: programming
theme:
  name: compendium
```

The registry `source` is the existing physical portal directory. Its public key
(`programming`) is the name used under `/p/`. Each portal keeps its own content,
navigation and theme customizations. With the setting omitted or commented out,
`multisite_theming: individual` is the default: the site theme controls the home
and directory, and each portal's theme controls its overview and wiki. Enable
`multisite_theming: shared` to use the parent site's `theme` for every portal.
Saved portal theme choices are preserved. Desk's Apply action changes and rebuilds
the whole site in shared mode; in individual mode it changes only the selected
portal. Changing the policy in site.yall requires a full site build to refresh all
existing output. Single-page and single-portal builds retain their usual scope. IDs use lowercase letters,
numbers, underscores or hyphens. The site output ID must not match a standalone
portal, protecting existing output.

## Build scopes

Run from `sheriff-core` with the installed Goblin executable:

```text
goblin run modules/site_portals/cli.gbln iveki
goblin run modules/site_portals/cli.gbln iveki portal programming
goblin run modules/site_portals/cli.gbln iveki portal programming page articles/overview.md
```

The first command builds the site's members. The second builds only Programming,
then refreshes its portal home and the shared site/directory pages. It does not
rebuild sibling portal output. The third runs only the page schedule for that
relative Markdown path; it requires an initial site/portal build. As elsewhere in
Sheriff, page builds do not refresh generated category/index pages.

Output is `dist/iveki/`. Serve that directory as the website's root:

| Route | Meaning |
| --- | --- |
| `/` | Site home |
| `/p/` | Portal directory |
| `/p/programming/` | Programming portal home |
| `/p/programming/wiki/` | Programming wiki home |
| `/p/programming/wiki/articles/overview.html` | An article |

The existing retained-build lifecycle protects each full portal build. The site
assembler copies a successfully completed member into its mounted wiki directory.
It is not yet an atomic publication transaction for the entire grouped site.

## Links and themes

Ordinary `[[Overview]]` links remain local to their portal. Use
`[[p/philosophy/wiki/Overview]]` or
`[[p/philosophy/wiki/Overview|Philosophy overview]]` for another member's canonical.
Identical article names in separate portals resolve independently. Code examples
are preserved. Cross-portal backlink/wanted-page aggregation is not implemented in
this first slice; neither is cross-site federation.

Theme files added: `layouts/site_header.html`, `layouts/site_home.html`,
`layouts/portal_home.html`, and `css/site-portals.css`. These use `SITE::` values
provided by the module. A compact site header appears above the portal’s complete
normal theme header. It links to the portal directory rather than embedding a
dropdown of every portal. Root-relative wiki assets and navigation
are mounted under that portal's wiki prefix. Search workers/indexes/thumbnails use
their mounted asset location. No external icon service is required.

The sample portal home currently features the first four non-generated articles.
Author-controlled home sections and a dedicated Iveki theme are follow-up work.

## Still to integrate

- Desk creation/settings/build/publish controls for grouped sites.
- Cloud site records, R2 publication manifests, nginx/custom-domain routing and
  source-sync ownership. Do not upload a grouped directory through the current
  single-portal Cloud path yet.
- Howdy authentication and site/portal permissions.
- Additional content types, cross-portal dependency/backlink tracking, arbitrary
  script-generated absolute URLs, and federation.

This change does not migrate or rebuild existing portals automatically.
