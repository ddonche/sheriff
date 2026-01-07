🏜️ Sheriff — How It Works

A Modular, Event-Driven Static Site Generator Built in Goblin

Sheriff in 30 Seconds
Markdown files → Sheriff Pipeline → Static HTML
                       ↓
         ┌──────────────┼──────────────┐
         │              │              │
     Modules        Events.yall     Themes
   (features)      (pipeline)       (UI)


What Sheriff does:

Reads Markdown + frontmatter

Runs your configured pipeline

Outputs production-ready static sites

What makes it different:

Every feature is a module you can add/remove

Pipeline is config, not code

Core never changes

🚨 The Problem Sheriff Solves

Most static site generators have this problem:

❌ Want to add search? Fork the repo, hack core files.
❌ Want custom routing? Override internals, pray on upgrades.
❌ Want multi-site support? Good luck.
❌ Want to swap Markdown renderers? Rewrite half the codebase.

Sheriff fixes this with one rule:

✅ Core never changes. Everything is a module.

Want search? Add prospector_search::collect to your pipeline.
Want custom routing? Write a module. Core doesn't care.
Want to swap renderers? Replace markdown_core with markdown_custom.

You configure the pipeline. Sheriff runs it. That's it.

📖 What Sheriff Is

Sheriff is a static site generator written in the Goblin programming language.
Its purpose is simple:

Turn Markdown, templates, and configurations into a complete, production-ready website—documentation, wiki, blog, course portal, or knowledge base—without servers, databases, or frameworks.

Sheriff is designed to be:

Simple to use

Easy to extend

Impossible to break accidentally

Fast even at massive scale

Modular so every feature is a plug-in

Themeable with clean layouts

Portal-aware for multi-site setups (Iveki, organizations, multi-product docs, etc.)

A typical Sheriff site gives you:

Markdown pages

Wikilinks and route resolution

Beautiful responsive themes

Navigation menus and sidebars

Search (client-side, zero dependencies)

Version badges

Breadcrumbs, TOC, layout slots

Custom tokens for injecting dynamic UI

Multi-portal builds (e.g., /i/docs, /i/loricism)

Fast incremental builds

Pure static output in dist/

But what makes Sheriff different from every other static site generator is how it works internally.

Sheriff isn't a monolithic program with hardcoded rendering steps.
It is a pipeline, driven entirely by modules and configuration.

The architecture is what gives Sheriff its power.

🧠 Sheriff's Core Philosophy

Every design decision in Sheriff comes from one rule:

You should be able to change, upgrade, or replace any feature—Markdown, routing, theming, search, layout, anything—without ever touching Sheriff's core files.

This makes Sheriff:

Extremely stable

Extremely customizable

Future-proof

Safe to extend

Very hard to "break" by editing core

Sheriff core stays small and frozen.
Everything that changes lives in modules, themes, and portal configs.

In normal usage, you never need to edit Sheriff core. You extend it entirely through modules and configuration.

🏗️ How Sheriff Is Structured

Sheriff has six fundamental moving parts:

Core (main.gbln) — runs the pipeline

Modules — all features live here

Events (events.yall) — define the build pipeline

Themes — provide layouts and CSS (only know about SLOTS)

Templates config (templates.yall) — maps module tokens to theme slots

Import manifest — tells core what modules exist

Understanding these six pieces is understanding Sheriff.

1. Sheriff Core (main.gbln)

The Orchestrator, Not the Worker

Sheriff core does almost nothing except:

Load modules

Load the portal's config

Read the pipeline from events.yall

Run pre, schedule, and post actions

Pass a ctx map through each step

Write output files

Core doesn't know:

How Markdown works

How routing works

How themes work

How search works

How layout slots work

All of that lives in modules.

Because core knows almost nothing, it almost never needs to change—making Sheriff extremely stable.

2. Modules

Every Feature Is a Plugin

Every behavior in Sheriff lives in a module:

frontier → frontmatter

markdown_core → markdown renderer

trailboss → routes & wikilinks

stagehand → slot wiring + public assets

brindle → theming + CSS tokens

scout → navigation trees, breadcrumbs, TOC, search UI

toc → table of contents helpers

campfire → blog engine

badge → version badges (from modules/badge_labels/badge)

prospector_search → search index builder

…and more

Modules export actions, for example:

frontier::strip_frontmatter
markdown_core::render
brindle::apply_layout
stagehand::wire_slots
scout::apply_tokens
badge::apply_tokens
prospector_search::collect


Modules never call each other directly.
They only receive the ctx and return an updated ctx.

Each module only resolves its own tokens:

brindle only resolves {{{BRINDLE::*}}}

scout only resolves {{{SCOUT::*}}}

badge only resolves {{{BADGE::*}}}

Because all logic lives in modules, not core, you can:

Add features

Remove features

Override features

Replace entire modules

Without ever touching Sheriff core.

3. Events (events.yall)

The Build Pipeline Is Declarative, Not Hardcoded

A portal defines its build steps in events.yall:

pre:
  - "stagehand::copy_assets"
  - "trailboss::build_routes_once"

schedule:
  - "frontier::strip_frontmatter"
  - "markdown_core::render"
  - "trailboss::process_wikilinks"
  - "brindle::apply_layout"
  - "stagehand::wire_slots"
  - "brindle::apply_tokens"
  - "badge::apply_tokens"
  - "scout::apply_tokens"

post:
  - "prospector_search::finalize"


This is the genius of Sheriff:

The build pipeline is configuration, not code.

Want to add search? Add one line (prospector_search::collect in schedule, scout::apply_tokens to render the UI).

Want to remove breadcrumbs? Remove a line.

Want to reorder transform steps? Just reorder them.

Want to inject a custom module? Add your step.

You never modify core.
You never fork the project.
You never hack around stuff.

Sheriff simply runs the pipeline you give it.

4. Themes

Layouts + CSS, Nothing Else

Themes provide two things:

HTML layouts with slot placeholders

CSS files for styling

Themes ONLY know about SLOTS.

They never reference modules directly.

Example layout (layouts/docs.html):

<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>{{{PAGE::TITLE}}}</title>
    {{{SLOT::STYLELINK}}}
</head>
<body>
    <div class="sheriff-shell">
        <header class="sheriff-header">
          <div class="sheriff-header-left">
            <a href="/" class="sheriff-logo-link">
              {{{SLOT::LOGO}}}
              <div class="sheriff-logo-text-wrap">
                {{{SLOT::BRANDNAME}}}
                {{{SLOT::VERSION}}}
              </div>
            </a>
          </div>
          <div class="sheriff-header-right">
            {{{SLOT::THEMESWITCHER}}}
            {{{SLOT::SEARCH}}}
            {{{SLOT::REPO}}}
          </div>
        </header>
        <div class="sheriff-main-layout">
            <aside class="sheriff-left-nav">
                {{{SLOT::LEFT_NAV}}}
            </aside>
            <article class="sheriff-article">
                {{{PAGE::CONTENT}}}
            </article>
            <aside class="sheriff-toc">
                {{{SLOT::SIDEBAR_TOP}}}
                {{{SLOT::SIDEBAR_MAIN}}}
            </aside>
        </div>
        <footer class="sheriff-footer">
            {{{SLOT::FOOTER}}}
        </footer>
    </div>
</body>
</html>


Notice:

Only {{{SLOT::*}}} and {{{PAGE::*}}} tokens

No {{{BRINDLE::*}}} or {{{SCOUT::*}}} tokens

Theme doesn't know what modules exist

This makes themes portable.

5. Templates Config (templates.yall)

The Mapping Layer: Module Tokens → Theme Slots

This is where you configure which module tokens fill which theme slots:

layouts:
  docs:
    slots:
      STYLELINK:
        - "BRINDLE::STYLE"
      LOGO:
        - "BRINDLE::LOGO"
      BRANDNAME:
        - "BRINDLE::BRANDNAME"
      VERSION:
        - "BADGE::VERSION"
      THEMESWITCHER:
        - "BRINDLE::THEMESWITCHER"
      SEARCH:
        - "SCOUT::SEARCH"
      REPO:
        - "BADGE::REPO"
      HEADER_NAV:
        - "SCOUT::DOCS_NAV"
      LEFT_NAV:
        - "SCOUT::DOCS_TREE"
      SIDEBAR_TOP:
        - "SCOUT::BREADCRUMBS"
      SIDEBAR_MAIN:
        - "SCOUT::TOC"
      FOOTER:
        - "SITE::FOOTER"
  
  blog:
    slots:
      STYLELINK:
        - "BRINDLE::STYLE"
      LOGO:
        - "BRINDLE::LOGO"
      SEARCH:
        - "SCOUT::SEARCH"
      HEADER_NAV:
        - "SCOUT::MAIN_NAV"
      LEFT_NAV: []                      # ← Empty! No left nav
      SIDEBAR_MAIN:
        - "CAMPFIRE::RECENT_POSTS"      # ← Different content!
      FOOTER:
        - "SITE::FOOTER"


This is drag-and-drop UI composition:

Same theme, different layouts

Different slot mappings per layout

Want TOC on left instead of right? Change config

Want no search? Set slot to []

Want recent posts in sidebar? Map a different token

No code changes. No theme edits. Just config.

6. Import Manifest

Module Discovery Layer

The import manifest tells core:

What modules are available

What actions they export

What tokens they publish

For example:

import modules/trailboss_wiki/routes_json   as rjson
import modules/sawbones_sanitizer/sawbones  as sb
import modules/frontier_fm/frontier         as frontier
import modules/markdown_core/markdown       as markdown_core
import modules/trailboss_wiki/trailboss     as trailboss
import modules/stagehand/stagehand          as stagehand
import modules/brindle_themes/brindle       as brindle
import modules/scout_nav/scout              as scout
import modules/scout_nav/toc                as toc
import modules/campfire_blog/campfire       as campfire
import modules/badge_labels/badge           as badge
import modules/debug_body/debug_body        as debug


This prevents:

Namespace collisions

Dependency guessing

Hidden features

Hardcoded integrations

Core only interacts with modules through their public exported surface.

🔌 How the Three-Layer Token System Works

Sheriff uses a three-layer architecture to keep themes, modules, and configuration completely independent:

Modules provide tokens (functionality)

Config maps module tokens to slots (composition)

Themes define slot positions (layout)

This is the key insight: Themes never know about modules. Modules never know about themes. Config is the glue.

Layer 1: Modules Provide Tokens

Modules export named tokens:

/// modules/brindle/brindle.gbln
act resolve_token(ident)
    if ident == "LOGO"
        return raw "<img src='/public/logo.png' alt='Sheriff'>"
    end
    if ident == "THEMESWITCHER"
        return raw "<button id='theme-toggle'>...</button>"
    end
end


Modules publish things like:

BRINDLE::LOGO

BRINDLE::THEMESWITCHER

SCOUT::SEARCH

CAMPFIRE::RECENT_POSTS

BADGE::VERSION

etc.

Modules don't know where these go. They just provide functionality.

Modules only resolve their own namespace:

brindle::apply_tokens only replaces {{{BRINDLE::*}}}

scout::apply_tokens only replaces {{{SCOUT::*}}}

badge::apply_tokens only replaces {{{BADGE::*}}}

Each module runs on its turn in the pipeline and ignores other modules' tokens.

Layer 2: Config Maps Tokens to Slots

Your portal's templates.yall defines which module tokens fill which slots:

layouts:
  docs:
    slots:
      LOGO:
        - "BRINDLE::LOGO"
      THEMESWITCHER:
        - "BRINDLE::THEMESWITCHER"
      SEARCH:
        - "SCOUT::SEARCH"
      SIDEBAR_MAIN:
        - "SCOUT::TOC"


This is the magic:

Same theme, different layouts, different slot mappings

You can rearrange where functionality appears without touching code

Want search in the header? Map it to SEARCH slot

Want search in the footer? Change the config

Want no search? Remove it from the mapping

Config is drag-and-drop for UI composition.

Layer 3: Themes Define Slot Positions

Themes provide HTML layouts with slot placeholders (not module tokens):

<!-- layouts/docs.html -->
<header>
  <a href="/">
    {{{SLOT::LOGO}}}           <!-- Slot, not BRINDLE::LOGO -->
  </a>
  <div class="header-right">
    {{{SLOT::THEMESWITCHER}}}  <!-- Slot, not BRINDLE::THEMESWITCHER -->
    {{{SLOT::SEARCH}}}         <!-- Slot, not SCOUT::SEARCH -->
  </div>
</header>


Themes only deal in SLOTS. They define:

Where slots appear in the layout

CSS styling for those positions

Responsive behavior

Themes never reference modules directly.

Why This Three-Layer System Is Powerful
✅ Themes are portable

Same theme works for docs, blog, wiki, course site

Just remap slots in config

✅ Modules are reusable

SCOUT::SEARCH works in any theme

Doesn't care if it's in header, sidebar, or footer

✅ Config is drag-and-drop

Want TOC in left sidebar instead of right? Change config

Want recent posts in header? Change config

Want a minimal layout? Set slots to []

✅ No coupling

Themes don't import modules

Modules don't know about layouts

Change either without breaking the other

Real Example: Rearranging a Layout

Original docs layout:

docs:
  slots:
    LEFT_NAV:
      - "SCOUT::DOCS_TREE"
    SIDEBAR_MAIN:
      - "SCOUT::TOC"


Want to swap them?

docs:
  slots:
    LEFT_NAV:
      - "SCOUT::TOC"          # ← TOC on left now
    SIDEBAR_MAIN:
      - "SCOUT::DOCS_TREE"    # ← Tree on right now


Same theme. Same modules. Just config changed.

That's the power of Sheriff's three-layer token system.

🔁 How a Page Is Actually Built (The Real Pipeline)

Let's trace a single page through Sheriff's actual pipeline:

Input: docs/getting-started.md

^^^^
title: "Getting Started"
layout: docs
^^^^

# Getting Started

Check out [[Installation]] and [[Configuration]].

Pre-Build (Once Per Portal)
pre:
  - "stagehand::copy_assets"
  - "trailboss::build_routes_once"


1. stagehand::copy_assets

Copies public/ directory (logo, favicon, images)

Copies CSS files from chosen theme to dist/public/css/

2. trailboss::build_routes_once

Scans all content files

Builds routes.json (maps slugs → URLs for wikilink resolution)

Result: Static assets in place, routes file ready.

Per-Page Pipeline
schedule:
  - "frontier::strip_frontmatter"
  - "markdown_core::render"
  - "trailboss::process_wikilinks"
  - "brindle::apply_layout"
  - "stagehand::wire_slots"
  - "brindle::apply_tokens"
  - "badge::apply_tokens"
  - "scout::apply_tokens"
  - "prospector_search::collect"


(You may choose to keep prospector_search::collect in schedule or move it to its own post-style aggregation if you ever change index strategy, but the doc matches the per-page JSONL design here.)

3. frontier::strip_frontmatter

Input ctx["body"]:
^^^^
title: "Getting Started"
layout: docs
^^^^

# Getting Started
...

Output ctx:
  ctx["frontmatter"] = { title: "Getting Started", layout: "docs" }
  ctx["body"] = "# Getting Started\n..."


Extracts frontmatter → stores in ctx["frontmatter"]
Removes ^^^^ block from body.

4. markdown_core::render

Input ctx["body"]:
# Getting Started

Check out [[Installation]] and [[Configuration]].

Output ctx["body"]:
<h1>Getting Started</h1>
<p>Check out [[Installation]] and [[Configuration]].</p>


Markdown → HTML
Note: Wikilinks still in [[...]] format.

5. trailboss::process_wikilinks

Input ctx["body"]:
<p>Check out [[Installation]] and [[Configuration]].</p>

Output ctx["body"]:
<p>Check out <a href="/docs/installation/">Installation</a> and 
<a href="/docs/configuration/">Configuration</a>.</p>


Reads routes.json
Converts [[Installation]] → <a href="/docs/installation/">Installation</a>

6. brindle::apply_layout

Input:
  ctx["body"] = "<h1>Getting Started</h1><p>..."
  ctx["frontmatter"]["layout"] = "docs"

Brindle:
  1. Reads layout from frontmatter: "docs"
  2. Loads layouts/docs.html template
  3. Injects ctx["body"] into {{{PAGE::CONTENT}}}
  4. Injects ctx["frontmatter"]["title"] into {{{PAGE::TITLE}}}

Output ctx["body"]:
<!doctype html>
<html>
<head>
  <title>Getting Started</title>
  {{{SLOT::STYLELINK}}}
</head>
<body>
  <header>
    {{{SLOT::LOGO}}}
    {{{SLOT::SEARCH}}}
  </header>
  <article>
    <h1>Getting Started</h1>
    <p>Check out <a href="/docs/installation/">Installation</a>...</p>
  </article>
  <aside>
    {{{SLOT::SIDEBAR_MAIN}}}
  </aside>
</body>
</html>


At this stage, {{{SLOT::...}}} tokens are still placeholders.
Layout applied, but slots not yet resolved.

7. stagehand::wire_slots

Input ctx["body"]:
<header>
  {{{SLOT::LOGO}}}
  {{{SLOT::SEARCH}}}
</header>

Stagehand:
  1. Reads templates.yall config
  2. Sees: SLOT::LOGO   → ["BRINDLE::LOGO"]
  3. Sees: SLOT::SEARCH → ["SCOUT::SEARCH"]
  4. Replaces SLOT tokens with MODULE tokens

Output ctx["body"]:
<header>
  {{{BRINDLE::LOGO}}}
  {{{SCOUT::SEARCH}}}
</header>


This is the mapping layer:
{{{SLOT::LOGO}}} → {{{BRINDLE::LOGO}}}
{{{SLOT::SEARCH}}} → {{{SCOUT::SEARCH}}}

Now the HTML contains module tokens, not slot tokens.

8. brindle::apply_tokens

Input ctx["body"]:
{{{BRINDLE::LOGO}}}
{{{BRINDLE::THEMESWITCHER}}}
{{{SCOUT::SEARCH}}}

Brindle module:
  - Sees {{{BRINDLE::LOGO}}}
  - Calls resolve_token("LOGO")
  - Returns: <img src="/public/logo.png" alt="Sheriff">
  - Replaces {{{BRINDLE::LOGO}}} with HTML
  
  - Sees {{{BRINDLE::THEMESWITCHER}}}
  - Calls resolve_token("THEMESWITCHER")
  - Returns: <button id="theme-toggle">...</button>
  - Replaces {{{BRINDLE::THEMESWITCHER}}} with HTML
  
  - IGNORES {{{SCOUT::SEARCH}}} (not Brindle's namespace)

Output ctx["body"]:
<img src="/public/logo.png" alt="Sheriff">
<button id="theme-toggle">...</button>
{{{SCOUT::SEARCH}}}


Brindle only resolves BRINDLE:: tokens.
Other modules' tokens remain in place.

9. badge::apply_tokens

Input ctx["body"]:
{{{BADGE::VERSION}}}
{{{BADGE::REPO}}}
{{{SCOUT::SEARCH}}}

Badge module:
  - Sees {{{BADGE::VERSION}}}
  - Calls resolve_token("VERSION")
  - Returns: <span class="version">0.10.0</span>
  - Replaces token with HTML
  
  - IGNORES {{{SCOUT::SEARCH}}} (not Badge's namespace)

Output ctx["body"]:
<span class="version">0.10.0</span>
<a href="https://github.com/...">...</a>
{{{SCOUT::SEARCH}}}


Badge only resolves BADGE:: tokens.

10. scout::apply_tokens

Input ctx["body"]:
{{{SCOUT::SEARCH}}}
{{{SCOUT::TOC}}}

Scout module:
  - Sees {{{SCOUT::SEARCH}}}
  - Calls resolve_token("SEARCH")
  - Returns: <input type="search" id="sheriff-search"...>
  - Replaces token with HTML

Output ctx["body"]:
<input type="search" id="sheriff-search" placeholder="Search...">
<nav class="toc">...</nav>


Scout only resolves SCOUT:: tokens.

11. prospector_search::collect

At the end of schedule, Prospector:

Reads the final HTML from ctx

Extracts title, headings, summary, body text

Appends a single JSON object line to search-index.jsonl for this page

No reads, no rewrites—just a fast append per page.

Final Result
<!doctype html>
<html>
<head>
  <title>Getting Started</title>
  <link rel="stylesheet" href="/public/css/dark.css">
</head>
<body>
  <header>
    <img src="/public/logo.png" alt="Sheriff">
    <input type="search" id="sheriff-search" placeholder="Search...">
  </header>
  <article>
    <h1>Getting Started</h1>
    <p>Check out <a href="/docs/installation/">Installation</a>...</p>
  </article>
  <aside>
    <nav class="toc">...</nav>
  </aside>
</body>
</html>


All tokens resolved. All slots filled. Production-ready HTML.
Sheriff writes this to dist/docs/getting-started/index.html.

🎯 Why This Pipeline Design Matters
✅ Modules Don't Know About Each Other

brindle doesn't know scout exists

badge doesn't know brindle exists

prospector_search doesn’t know scout exists

Each module only resolves its own MODULE:: namespace.

Result: You can add/remove/replace any module without breaking others.

✅ Sheriff Doesn't Care About Modules

Sheriff core just runs the pipeline:

for action in schedule:
    ctx = action(ctx)
end


Sheriff never hardcodes:

What modules exist

What they do

What order they run in

Result: Pipeline is pure config. Core stays frozen.

✅ Themes Don't Hardcode Modules

Themes use {{{SLOT::X}}}, not {{{MODULE::Y}}}.

Result: Same theme works for:

Docs site (SIDEBAR_MAIN → TOC)

Blog site (SIDEBAR_MAIN → Recent Posts)

Wiki site (SIDEBAR_MAIN → Page Tree)

Just change templates.yall config.

✅ Users Can Rearrange Everything

Want search in footer instead of header?

# templates.yall
slots:
  SEARCH: []              # Remove from header slot
  FOOTER:
    - "SCOUT::SEARCH"     # Add to footer slot
    - "SITE::FOOTER"


No code changes. No theme edits. Just config.

✅ Pipeline Is Traceable

Every step is explicit:

Strip frontmatter → frontier

Render Markdown → markdown_core

Resolve links → trailboss

Apply layout → brindle

Wire slots → stagehand

Resolve tokens → each module on its turn

Collect search metadata → prospector_search

Debugging is trivial: Add logging at any step, inspect ctx.

🛠️ Common Tasks (How Sheriff Stays Simple)
Add Search to Your Site

Step 1: Add modules to pipeline in events.yall:

schedule:
  # ... existing steps ...
  - "prospector_search::collect"
  - "scout::apply_tokens"


Step 2: Map search to a slot in templates.yall:

layouts:
  docs:
    slots:
      SEARCH:
        - "SCOUT::SEARCH"


Step 3: Theme already has the slot:

{{{SLOT::SEARCH}}}


Done. No core changes. No theme edits. Just composition.

Swap Markdown Renderers

Want to use a different Markdown processor?

Write modules/markdown_custom/markdown.gbln

Change events.yall:

   - "markdown_custom::render"  # instead of markdown_core::render


Core doesn't know. Core doesn't care. It just runs your pipeline.

Add a Custom Build Step

Want to minify HTML? Optimize images? Generate social cards?

Write a module:

/// modules/minifier/minify.gbln
act minify(ctx)
    html     | ctx["body"]
    minified | :minify_html(html)
    :update!(ctx["body"], minified)
    return ctx
end


Add it to pipeline:

schedule:
  # ... existing steps ...
  - "minifier::minify"


Sheriff runs it. No special integration needed.

Create a Custom Theme

Want a different look?

Copy an existing theme (themes/outpost → themes/custom)

Edit HTML layouts and CSS

Keep using {{{SLOT::*}}} placeholders

Update portal config:

theme:
  name: custom


Themes are just HTML templates with slot placeholders.
No framework. No JavaScript bundling. Just templates.

🧠 The Key Insight

Most static site generators:

# Hardcoded pipeline in core
def build_page(content):
    html = render_markdown(content)
    html = apply_layout(html)
    html = inject_search(html)      # ← Search is hardcoded
    html = inject_nav(html)         # ← Nav is hardcoded
    return html


Want to remove search? Fork the codebase.
Want to add a feature? Edit core files.
Want to rearrange UI? Edit theme templates.

Sheriff:

# Pipeline is config (events.yall)
schedule:
  - "markdown_core::render"
  - "brindle::apply_layout"
  - "stagehand::wire_slots"
  - "scout::apply_tokens"
  - "prospector_search::collect"

# UI composition is config (templates.yall)
slots:
  SEARCH:
    - "SCOUT::SEARCH"
  SIDEBAR_MAIN:
    - "SCOUT::TOC"

<!-- Themes just define positions -->
<header>{{{SLOT::SEARCH}}}</header>
<aside>{{{SLOT::SIDEBAR_MAIN}}}</aside>


Want to remove search? Delete one line from events.yall.
Want to add a feature? Add one line to events.yall.
Want to rearrange UI? Edit templates.yall config.

Core never changes. Modules are isolated. Themes are portable.

🎯 Why Sheriff Is Designed This Way

Because this architecture guarantees:

✅ You can add/remove/replace any feature without touching core.
✅ No module can trivially break another module.
✅ Themes can evolve independently of functionality.
✅ Core remains frozen, stable, tiny, and safe.
✅ Portals have full control over their build pipeline.
✅ Sheriff can scale to thousands of pages with predictable behavior.

Sheriff is not just a static site generator.

It's a modular Goblin-powered build engine with:

Composability

Safety

Clarity

Extensibility

Zero framework overhead

It is the cleanest possible architecture for long-term maintainability.

❌ What Sheriff Is NOT

Sheriff is not:

❌ A CMS (no admin panel, no database)

❌ A framework (no JavaScript runtime, no hydration)

❌ A server (outputs pure static HTML)

❌ Opinionated about your content structure

Sheriff is:

✅ A build tool that turns Markdown → HTML

✅ Modular (every feature is optional)

✅ Portable (works anywhere static files work)

✅ Goblin-native (written in Goblin, for Goblin projects)

🧩 Sheriff in One Definitive Sentence

Sheriff is a modular static site generator where every feature is a plugin, the pipeline is config, themes only know about slots, and core never changes—so you can build, extend, and scale sites without ever forking the codebase.

🚀 Get Started

Ready to build with Sheriff?

quick-start.md

modules.md

themes.md

portals.md

Sheriff: The static site generator that gets out of your way.