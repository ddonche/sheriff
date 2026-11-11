# Icons

Use an icon anywhere in article text with:

```markdown
[[icon|name]]
[[icon|name|color]]
[[icon|name|color|size]]
[[icon|name||size]]
```

For example:

```markdown
[[icon|download]] Download Sheriff.
[[icon|warning|orange]] Experimental feature.
[[icon|heart|#d04455]] A favorite.
```

Color is optional. Without it, the icon inherits the surrounding text color and scales with the font size. Named CSS colors, hex colors, and RGB/HSL colors are supported.

## Size

The optional fourth argument is a whole-number pixel size from 8 to 256. Leave color empty when setting only a size:

```markdown
[[icon|book|orange|24]]
[[icon|book||32]]
```

Without a size, icons keep the theme's inline, text-relative size. Invalid sizes fall back to that size. Both Desk pickers include an optional Size field, a live syntax preview, and full-catalog search; previews load in batches with Show more.

## Finding icons

Use **Insert icon** beside Insert image in the Content editor to insert at the cursor (or replace selected text). Insertion leaves the page unsaved. Open **Icons** in Sheriff Desk to browse the full Lucide catalog and the active portal's icons. Search by name, optionally enter a color, and click **Copy syntax**. Paste the result into your content. Icon names match their SVG filenames without the extension.

## Admonitions and patterns

```markdown
::: warning [[icon|warning]] Experimental feature

[[icon|info]] This feature may change.

:::

::: pattern horizontal Feature
@mode = template
status = [[icon|warning|orange]] Experimental
help = [[icon|book]] Read the documentation
:::
```

Icons also work in headings, lists, tables, and content tabs, and in reusable patterns. Syntax inside inline code or code blocks stays literal.

You can also put the icon before the admonition type. For example:

```markdown
::: [[icon|warning]] lore
A historical note.
:::
```

## Navigation menus

Use the same icon syntax in a quoted menu label in `nav.yall`:

```yaml
menus:
  left_docs:
    Reference:
      "[[icon|book]] Documentation": /docs/index.html
      "[[icon|code]] Syntax": /docs/syntax.html
      "[[icon|warning|orange]] Experimental": /docs/experimental.html
```

Icons work in sidebar, header dropdown, and footer labels, including group headings. Without an explicit color, they inherit the label's color and active-link styling. Rebuild the portal after changing its navigation.

## Custom icons

Sheriff bundles all 2,350 SVGs from `lucide-static` 1.71.0 plus the compatible `warning` alias for `triangle-alert`. The exact version and package integrity are recorded in `sheriff-core/assets/lucide/catalog.json`. Put custom SVGs in your portal's `public/icons/` folder. Use lowercase names with hyphens, such as `my-icon.svg`, then write `[[icon|my-icon]]`. A custom icon with the same filename replaces the built-in icon for that portal.

Rendering copies referenced icons to `dist/{portal}/public/icons/` and includes `LUCIDE-LICENSE.txt`. The full catalog stays available in Desk without being copied into every published site. Page builds publish the icons they reference without running pre/post schedules. Built-in source files live in `sheriff-core/assets/icons/`.

An unknown name displays a question mark with the missing name in its tooltip. An invalid color falls back to the surrounding styling.

Update the bundled catalog deliberately with `python tools/sync-lucide-icons.py <exact-version>`. The importer verifies npm package integrity, retains license notices, and refuses to silently remove existing icon names. Core catalog updates require a portal build to refresh previously published assets.
