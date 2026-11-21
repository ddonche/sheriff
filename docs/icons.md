^^^^
title: Icons
author: Sheriff Docs
layout: docs
meta_kind: docs
meta_type: guide
summary: Insert Lucide icons, brand logos, and custom PNG icons with optional colors, sizes, and links.
gloss: Small reusable graphics for content, navigation, patterns, and admonitions.
canonical: icons
^^^^

Sheriff includes Lucide icons for general use and Simple Icons for brand logos. You can also upload your own PNG icons through Desk. All three use the same Sheriff syntax.

---

## Syntax

```markdown
[[icon|name]]
[[icon|name|color|size|link]]
```

Only `icon` and the name are required. Color, size, and link are optional. Leave an empty slot when skipping an option before another:

```markdown
[[icon|book]]
[[icon|book|orange]]
[[icon|book||24]]
[[icon|github|brand|24|https://github.com/gohugoio/hugo]]
[[icon|discord|||https://discord.com/invite/example]]
```

The established order is **name, color, size, link**. Sheriff also accepts **name, size, color, link** when the first option is a valid pixel size, so this works too:

```markdown
[[icon|reddit|24|brand|https://reddit.com/r/example]]
```

Desk generates the established `color|size` order. Existing icons do not need changing.

---

## Choosing Icons in Desk

Open **Icons** to browse the library. Choose **All icons**, **Lucide**, **Brands**, or **Uploaded**, then search by name or brand title. Select a tile to preview it, choose any optional settings, and click **Copy syntax**.

In the Content editor, click **Insert icon** in the Insert area. The same controls are available there. Select the icon and click **Insert icon** to place its syntax at the cursor, or replace selected text. This works in both Visual and Source modes. Your page remains unsaved until you save it.

The Navigation editor also has an **Insert icon** button for `nav.yall`. Use it within a menu label; keep the menu destination in the usual value after the label.

---

## Colors

Without a color, SVG icons inherit the surrounding text color. This follows your theme, light or dark mode, and link styling.

Use `brand` to select a brand logo's bundled color:

```markdown
[[icon|reddit|brand]]
[[icon|discord|brand]]
[[icon|youtube|brand]]
```

In Desk, select a brand icon and click **Use brand color**. **Reset** returns to inherited text color. Brand colors stay the same in light and dark mode, so an inherited or custom color may suit your background better.

You can also supply a CSS color:

```markdown
[[icon|heart|#d04455]]
[[icon|github|white]]
[[icon|info|rgb(50, 150, 171)]]
[[icon|check|hsl(145, 60%, 40%)]]
```

PNG icons keep their original colors and transparency. Color overrides do not recolor them. The `brand` option falls back to inherited styling for icons without brand-color metadata.

---

## Sizes

Use a whole-number pixel size from **8 to 256**:

```markdown
[[icon|book||18]]
[[icon|warning|orange|24]]
[[icon|discord|brand|32]]
```

Without a size, the icon uses your theme's text-relative inline size. Invalid sizes fall back to that default.

---

## Clickable Icons

Add a link as the fifth part of the syntax to make the icon clickable:

```markdown
[[icon|github|brand|24|https://github.com/gohugoio/hugo]]
[[icon|reddit|brand|24|https://reddit.com/r/example]]
[[icon|book||20|/docs/index.html]]
[[icon|arrow-up||18|#top]]
```

The link can be an HTTP or HTTPS URL, a site path beginning with `/`, or a section beginning with `#`. Unsafe links such as `javascript:` are ignored. The icon still renders. Desk highlights invalid links and disables insertion or copying until you fix them.

Linked icons have an accessible name based on their icon name. They work in ordinary content, tables, and pattern fields:

```markdown
::: pattern horizontal Community
@mode = template
source = [[icon|github|brand|24|https://github.com/gohugoio/hugo]]
chat = [[icon|discord|brand|24|https://discord.com/invite/example]]
:::
```

---

## Names and Collisions

Names use lowercase letters, numbers, and hyphens. Desk shows the exact name to use.

Existing names keep their meaning. For example, Lucide's `x` is a close symbol. Use `brand-x` for the X logo:

```markdown
[[icon|x]]
[[icon|brand-x|brand|24]]
```

The `brand-` prefix explicitly selects a Simple Icons logo. It works for any bundled brand, including `brand-github` and `brand-discord`.

For plain names, Sheriff checks your portal's SVG first, then its PNG, then Lucide, then Simple Icons. A portal icon named `github.svg` therefore replaces the plain `github` icon for that portal. `brand-github` still selects the bundled logo. Desk lists a colliding brand under its prefixed name so both choices remain available. Reserve existing `brand-` names for the bundled collection.

An unknown icon displays a question mark with the missing name in its tooltip. Brand availability follows the bundled Simple Icons version; names and colors may change in future catalog updates.

---

## Uploading Your Own PNG Icons

In **Desk → Icons**, click **Upload PNG**. Choose a PNG up to **1 MB**, enter a unique lowercase name with hyphens, and upload it. Desk prevents an upload from replacing a name already in the catalog.

For example, an icon named `everwind-emblem` can be used like this:

```markdown
[[icon|everwind-emblem]]
[[icon|everwind-emblem||32]]
[[icon|everwind-emblem||32|/about.html]]
```

Uploads belong to the selected portal and live in its `public/icons/` directory. You can also place SVG files there yourself. PNG icons work inside patterns, navigation, and admonitions just like SVG icons.

---

## Navigation, Headers, and Footers

Put icon syntax inside the quoted label in `nav.yall`. Put the destination after the label, as usual:

```yaml
menus:
  left_docs:
    Reference:
      "[[icon|book||18]] Documentation": /docs/index.html
  footer_right:
    "[[icon|github|brand|20]] GitHub": https://github.com/gohugoio/hugo
    "[[icon|discord|brand|20]] Discord": https://discord.com/invite/example
```

The menu's destination controls the whole item. An icon's optional link is ignored inside an already linked menu item, preventing nested links. Rebuild the portal after changing navigation.

---

## Other Content

Icons work in headings, lists, tables, content tabs, and reusable patterns. They can also appear in admonition titles:

```markdown
## [[icon|book]] Further Reading

- [[icon|check]] Install Sheriff.
- [[icon|settings]] Configure your portal.

::: [[icon|triangle-alert|orange]] warning Experimental feature
This feature may change.
:::
```

Syntax inside inline code and code blocks remains literal.

---

## Bundled Assets

Sheriff bundles Lucide and Simple Icons locally. Published pages do not contact an icon API or CDN. Rendering copies the referenced SVG or PNG files into the portal's output, including during single-page builds. The entire catalog is available in Desk without copying every icon into every website.

The bundled Simple Icons version is **16.38.0**, containing **3,472 brand icons**. Its version, package integrity, source information, guidelines, and license details are retained under `sheriff-core/assets/simple-icons/`. Referenced brand SVGs retain their upstream metadata; the Simple Icons license and disclaimer accompany published brand icons. Brand logos remain subject to their owners' usage guidelines.

---

::: nav
related [[Images]] - pictures, captions, and alignment
related [[Patterns]] - reusable content and infoboxes
related [[Admonitions & Spoilers]] - callout blocks and their icons
related [[Navigation]] - site menus, headers, and footers
:::
