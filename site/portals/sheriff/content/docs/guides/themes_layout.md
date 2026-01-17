^^^^
title: Themes in Sheriff
author: Sheriff Docs
layout: docs
meta_kind: docs
meta_type: guides
summary: How themes, layouts, and overrides work in Sheriff.
^^^^

Sheriff’s theme system is intentionally simple, predictable, and non-magical.

Themes live in **Sheriff core**, while portals control *which* theme they use and *how* they override it. This lets you share one theme across many portals without duplicating CSS or layouts.

---

## The Big Picture

Sheriff separates responsibilities cleanly:

* **Sheriff core** owns themes (CSS, layouts, nav behavior)
* **Portals** choose a theme
* **Portals may optionally override styles** without forking the theme

This keeps themes DRY, upgrades safe, and customization explicit.

---

## Theme Location (Sheriff Core)

All themes live inside Sheriff itself:

```
sheriff-core/
└─ themes/
   └─ outpost/
      ├─ css/
      │  └─ outpost.css
      ├─ layouts/
      │  └─ docs.html
      |  └─ blog.html
      |  └─ blog_index.html
      └─ scout_nav.yall
```

Each theme may contain:

* **One CSS file** (the canonical theme stylesheet)
* **One or more layouts** (HTML shells)
* **A scout_nav.yall file** (connects to Scout module to make sure the menus get created correctly)

There is **no dark.css / light.css split**. Theme switching happens via CSS variables and runtime toggles, not duplicated files. 

---

## Selecting a Theme (Portal Config)

Each portal chooses its theme in `config.yall`, which lives inside each portal's root:

```yall
theme:
  name: "outpost"
```

If no theme is specified, Sheriff defaults to `outpost`. This way, changing themes is as easy as changing the name in your config file. 

---

## What Stagehand Does

During a build, the **Stagehand** module:

1. Reads the portal’s `config.yall`
2. Determines the active theme name
3. Copies the theme CSS from Sheriff core into the portal’s dist folder
4. Checks each portal's theme folder in case you have an override file, which it copies also.

Result:

```
dist/{portal}/public/css/
├─ outpost.css
└─ override.css
```

The layout always links **both files**, in this order:

1. Theme CSS (from Sheriff core)
2. `override.css` (portal-specific)

This guarantees overrides always win without hacks or conditionals.

---

## Portal Overrides (Optional)

Portals may override a theme **without forking it**.

To do this, create an override file here:

```
site/portals/{portal}/themes/{theme}/override.css
```

Example:

```
site/portals/goblin/themes/outpost/override.css
```

Stagehand will:

* Copy this file into `dist/{portal}/public/css/override.css`
* If it does not exist, create an empty stub automatically

This lets you:

* Change colors
* Adjust spacing
* Tweak components

…without touching the shared theme.

---

## Layouts vs Templates

Layouts live in **Sheriff core**:

```
sheriff-core/themes/outpost/layouts/docs.html
```

Templates remain **portal-owned**:

```
site/portals/{portal}/themes/{theme}/templates.yall
```

Why?

* Layouts define *structure*
* Templates define *slot wiring*

This gives portals control over how content is assembled, while keeping layout HTML centralized and upgrade-safe.

---

## Navigation Mapping (scout_nav.yall)

Each theme includes a `scout_nav.yall` file:

```
sheriff-core/themes/outpost/scout_nav.yall
```

This file tells Scout:

* Which menus go into which layout slots
* How they should be rendered (header, sidebar, footer)

Portals **do not override this**. It is part of the theme’s contract.

---

## Why This Design

This system was built to:

* Avoid duplicated CSS
* Make upgrades safe
* Keep overrides explicit
* Eliminate hidden magic

If you know where a file lives, you know who owns it.

That’s the Sheriff way.
