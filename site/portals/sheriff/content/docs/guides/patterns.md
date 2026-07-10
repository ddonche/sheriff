^^^^
title: Patterns
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: docs
summary: Use reusable pattern blocks for infoboxes, navboxes, and other structured wiki page elements.
gloss: Patterns are reusable structured blocks that can be pasted into pages or injected with Sheriff tokens.
categories: [Patterns]
canonical: patterns
^^^^

Patterns are reusable structured blocks for wiki pages.

They are useful for things like infoboxes, region cards, character summaries, navboxes, timelines, and other repeated page elements.

Patterns are not page templates. They are content blocks that can be pasted into a page, filled out, rendered inline, or registered as reusable Sheriff tokens.

---

## Why Is It Important?

Patterns serve three primary purposes:

* They give repeated wiki structures a simple copy/paste format.
* They let themes style those structures consistently.
* They let Sheriff register finished patterns as tokens.

For wiki-style sites, this gives you the useful parts of infoboxes and navboxes without needing MediaWiki template logic.

---

## Pattern Syntax

A pattern block uses this shape:

```md
::: pattern vertical Region
image =
emblem =
government =
leadership =
capitol =
population =
languages =
:::
```

The first word after `pattern` is the orientation.

The second word is the pattern name.

The lines inside the block are fields.

---

## Orientation

Sheriff currently supports two pattern orientations:

```text
vertical
horizontal
```

Use `vertical` for infobox-style blocks that sit beside the article.

Use `horizontal` for full-width blocks such as navboxes or footer summaries.

---

## Fields

Each field is written as:

```md
label = value
```

Example:

```md
government = monarchy
leadership = [[House Andergard]]
population = 136,680
languages = [[Anderian]], [[Canderian]]
```

The label becomes the left side of the row.

The value becomes the content side of the row.

Values can contain normal Sheriff content, including text, wikilinks, and images.

---

## Image Fields

Use an underscore before a field name when the value should use a wide row:

```md
_image = [[image:Andermark_current.png|thumb|center|Andermark in red]]
```

Sheriff renders the label as `image`, but the value gets the full width of the pattern box.

This is useful for header images in vertical infoboxes.

---

## Image Sizes

Pattern values use normal Sheriff image syntax:

```md
[[image:filename.png|size|align|caption]]
```

Supported image sizes include:

```text
icon
mini
thumb
half
full
```

Use `icon` or `mini` for small emblems, currencies, faction marks, and similar inline images.

Use `_image` for a wide image row.

---

## Inline Filled Pattern

You can paste a pattern directly into a content page and fill it out:

```md
::: pattern vertical Region
_image = [[image:Andermark_current.png|thumb|center|Andermark in red]]
emblem = [[image:House_andergard_emblem.png|icon|center|House Andergard]]
government = monarchy
leadership = [[House Andergard]]
capitol = [[Deepwall]]
population = 136,680
languages = [[Anderian]], [[Canderian]]
:::
```

When Sheriff builds the page, the pattern becomes styled HTML.

Trailboss still processes the wikilinks and images inside the pattern values.

---

## Pattern Files

Store reusable pattern scaffolds in:

```text
site/
+-- portals/
    +-- {portal}/
        +-- patterns/
            +-- region.txt
```

Pattern files are saved as `.txt` files so they do not become normal rendered pages during a build.

This also makes them easy for Sheriff Desk to search, preview, and copy later.

---

## Sheriff Tokens

Every pattern file is automatically registered as a Sheriff token.

For example, this file:

```text
site/portals/everwind/patterns/region.txt
```

registers this token:

```text
{{{SHERIFF::PATTERN_REGION}}}
```

You can put that token into a content page to inject the pattern.

The token name is uppercase and based on the pattern name.

---

## Scaffold Patterns

A scaffold pattern is mostly blank:

```md
::: pattern vertical Region
_image =
emblem =
government =
leadership =
capitol =
population =
languages =
:::
```

This is useful when you want to copy the structure into a page and fill it out by hand.

---

## Filled Patterns

A pattern file can also be pre-filled:

```md
::: pattern horizontal Outrider Characters
title = Notable characters of [[Outrider]]
major factions = [[Edulon Dane]], [[Rendella Winter]], [[Boren Addlegard]]
minor factions = [[Danniver Oshek]]
nonhumans = [[Sleika]], [[Thagil]], [[Olibin]]
:::
```

This is useful for navbox-style blocks that should appear the same way on several pages.

---

## Showing A Pattern Without Rendering It

If you want to show pattern syntax on a page without rendering it, put the pattern inside a fenced code block:

```md
::: pattern vertical Region
government =
leadership =
capitol =
:::
```

Sheriff leaves pattern blocks inside code fences alone.

---

## Modules Involved

* **Sheriff Patterns** - publishes pattern files and renders pattern blocks.
* **[[Trailboss]]** - resolves wikilinks and images inside rendered pattern values.

---

::: nav
next [[Focus Panels]]
previous [[Categories]]
:::

::: nav
related [[Images]] - add image values inside patterns
related [[Links]] - use wikilinks inside pattern values
related [[Categories]] - group pages with frontmatter categories
:::
