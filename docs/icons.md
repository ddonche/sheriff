# Icons

Use an icon anywhere in article text with:

```markdown
[[icon|name]]
[[icon|name|color]]
```

For example:

```markdown
[[icon|download]] Download Sheriff.
[[icon|warning|orange]] Experimental feature.
[[icon|heart|#d04455]] A favorite.
```

Color is optional. Without it, the icon inherits the surrounding text color and scales with the font size. Named CSS colors, hex colors, and RGB/HSL colors are supported.

## Finding icons

Open **Icons** in Sheriff Desk to browse the built-in set and the active portal's icons. Search by name, optionally enter a color, and click **Copy syntax**. Paste the result into your content. Icon names match their SVG filenames without the extension.

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

Sheriff ships 66 built-in SVG icons. Put custom SVGs in your portal's `public/icons/` folder. Use lowercase names with hyphens, such as `my-icon.svg`, then write `[[icon|my-icon]]`. A custom icon with the same filename replaces the built-in icon for that portal.

During a portal build, icons are copied to `dist/{portal}/public/icons/`. Built-in source files live in `sheriff-core/assets/icons/`.

An unknown name displays a question mark with the missing name in its tooltip. An invalid color falls back to the surrounding styling.
