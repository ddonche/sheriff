^^^^
title: Focus Panels
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: A sticky “reference card” that swaps images when you hover or click focus links.
^^^^

[[focuspanel:blog/mtg-goblin-guide.jpg|full|right|Goblin Guide]]

A **Focus Panel** is a sticky image card that lives beside the article while you scroll.
When you hover or click **focus links**, the panel swaps to whatever image you’re talking about *right now*.

This page has a real focus panel at the top — so you can test it immediately.
Hover these links:

* [[focus:image:blog/mtg-goblin-guide.jpg|Goblin Guide]]
* [[focus:image:blog/mtg-horde-of-notions.jpg|Horde of Notions]]
* [[focus:image:blog/mtg-burn-trail.jpg|Burn Trail]]
* [[focus:image:blog/mtg-provoke-the-trolls.jpg|Provoke the Trolls]]

---

## The one rule you can’t ignore

**Focus panels require exactly 4 parts.**

If you don’t include all four pipe-separated fields, Trailboss will not have the indexes it expects (e.g. `parts[2]`) and your build can crash.

**Always use this shape:**

* `[[focuspanel:<filename>|<size>|<align>|<caption>]]`

### The 4 parts

1. **filename** — image file path under the portal’s images directory (typically `public/images/`)
2. **size** — `thumb` or `full` (whatever your theme supports)
3. **align** — `left`, `right`, or `center`
4. **caption** — the text shown under the image

### Example (copy/paste)

* `[[focuspanel:blog/mtg-goblin-guide.jpg|full|right|Goblin Guide]]`

---

## Add a focus panel to a page

Put **one** focus panel directive anywhere in the markdown.
It **will not render inline** in your article — Sheriff captures it and places it in the layout’s focus slot.

**Example**

* `[[focuspanel:ui/login-screen.png|full|right|Login screen]]`

Rules:

* Only **one** focus panel per page (the **first** one wins)
* If a page has **no** focus panel directive, the layout slot stays empty

---

## Add focus links (the things that swap the panel)

Focus links are what swap the panel image and caption.

**Syntax (2 parts, required):**

* `[[focus:image:<filename>|<label>]]`

### The 2 parts

1. **filename** — image file path under the portal’s images directory
2. **label** — what the link shows, and what becomes the panel caption when swapped

**Example**

* `[[focus:image:ui/login-screen.png|Login screen]]`

---

## Behavior rules

* If a page has **no** `focuspanel:` directive, focus links do nothing.
* If a page has multiple `focuspanel:` directives, only the **first** one is used.
* Focus links swap the panel on **hover**, **focus**, and **click** (mobile-friendly).

---

## Troubleshooting

### The focus panel doesn’t show up

* Confirm you used **exactly 4 parts**:
  `[[focuspanel:file.png|full|right|Caption]]`
* Confirm the image file exists under `public/images/` for that portal.

### The panel shows up but doesn’t swap

* Confirm `/public/js/focus_panel.js` is included.
* Confirm your focus links render with `.sheriff-focus-link` and `data-focus-src` / `data-focus-caption`.

### Sticky is weird / shifts a few pixels

That’s layout/CSS interaction (float + sticky + container widths). We’ll tune the theme CSS once the feature is locked.

---

## Quick copy/paste

**Focus panel (4 parts):**

* `[[focuspanel:blog/mtg-goblin-guide.jpg|full|right|Goblin Guide]]`

**Focus link (2 parts):**

* `[[focus:image:blog/mtg-burn-trail.jpg|Burn Trail]]`
