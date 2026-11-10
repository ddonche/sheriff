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

## Tabbed Patterns

Add `@tab Label` inside a pattern to give it switchable sets of fields. Fields above the first tab stay visible. Each tab contains the fields after its marker, up to the next tab or the pattern's closing `:::`.

For example, a book can share its title and author while each edition has its own cover, ISBN, page count, and publication date:

```text
::: pattern vertical Book
@mode = template
title = My Book
author = [[Some Author]]

@tab Hardcover
_image = [[image:hardcover.jpg|full|center|]]
isbn = 978-1-23456-789-0
pages = 320
published = 2020

@tab Paperback
_image = [[image:paperback.jpg|full|center|]]
isbn = 978-1-23456-790-6
pages = 352
published = 2022
:::
```

Replace the example values and image filenames with your own. Keep using normal `label = value` fields inside each tab; you do not need a separate `::: tabs` fence.

Tabs work in vertical and horizontal patterns, in templates, and in reusable patterns inserted with tokens. Repeating a reusable pattern on a page gives each copy independent controls. Patterns can also sit inside ordinary content tabs.

The first tab opens by default. Use the left/right arrow keys, Home, or End to switch tabs from the keyboard. Printing the page shows all editions. Without JavaScript, each edition remains visible under its label.

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

Reusable patterns are registered as Sheriff tokens. Template patterns are not. Existing blocks without a mode setting remain reusable.

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

## Template And Reusable Modes

Choose **Template** in Sheriff Desk for an infobox structure that should be filled out separately on each page. Use **Copy template**, paste the source into a page, and edit its fields. Templates do not register tokens or show the token footer, even after their page-specific fields are filled in.

Choose **Reusable content** for a filled block that should stay the same wherever it is used. Use **Copy token** to insert the saved content. Changes to that saved pattern reach its uses on the next build.

New blank patterns in Desk default to Template. Existing patterns keep reusable behavior until you change their mode. Older inline copies without their own mode setting follow the saved pattern's mode, so switching a saved pattern to Template also hides their token footers. An explicit mode inside a copied block takes precedence. The **Use as** selector changes only the mode; your field names and values are preserved. Save the change before rebuilding the site.

The setting travels with copied source as a reserved metadata line:

```md
::: pattern vertical Region
@mode = template
_image =
government =
leadership =
:::
```

Use `@mode = reusable` to explicitly enable a shared token. Omitting the line keeps the legacy reusable behavior. The `@mode` line is metadata and never appears as an infobox field. A file containing multiple blocks can set each block's mode independently.

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
