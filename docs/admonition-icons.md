# Default Admonition Icons

## Default Icons

Admonitions and spoilers automatically receive an icon from the active theme. You do not need to put icon syntax in every block:

```md
::: warning Read This First

Check your configuration before continuing.

:::
```

The theme chooses the icon for each type: `note`, `tip`, `warning`, `important`, `example`, `strategy`, `lore`, and `spoiler`. Icons inherit the title's color and size.

### Override One Admonition's Icon

Write an icon in the title to replace the theme's default for that block:

```md
::: warning [[icon|shield-alert|orange|24]] Read This First

This block uses the icon, color, and size specified above.

:::
```

Sheriff uses the explicit icon without adding a second default icon. An icon in the body does not replace the title icon.

To change defaults across your site or disable an icon for a particular type, see [[themes-layout#admonition-icons|Admonition Icons in Themes]].

## Admonition Icons

Each theme defines default icons for admonitions and spoilers in its Core `templates.yall`. Your site can override individual defaults without changing Sheriff Core.

### Customize Your Site's Icons

Open the active theme's portal template file. For example:

```text
site/portals/sheriff/themes/outpost/templates.yall
```

Add an `admonition_icons` section at the top level, alongside the existing `layouts` section. Keep your existing layout and slot settings.

```yaml
admonition_icons:
  note: notebook-pen
  warning: shield-alert
  lore: false
```

This gives notes a `notebook-pen` icon, warnings a `shield-alert` icon, and lore blocks no default icon. Types omitted from this map inherit their defaults from the active Core theme.

Use a Lucide icon name or the name of a custom SVG in the portal's `public/icons` folder. Write just the icon name, without `.svg` or `[[icon|...]]` syntax. You can find available names in Desk's Icons panel.

Set an entry to `false` to disable its default icon. An explicitly written icon in an individual admonition title still works.

### Theme Defaults

Theme designers define the defaults here:

```text
sheriff-core/themes/{theme}/templates.yall
```

Example mapping:

```yaml
admonition_icons:
  note: info
  tip: lightbulb
  warning: triangle-alert
  important: circle-alert
  example: code
  strategy: target
  lore: book-open-text
  spoiler: eye-off
```

Different themes may choose different icons. The icons inherit their admonition title's color and size. See [[Icons]] for icon syntax, custom colors, and explicit sizes.

### How Overrides Work

1. An icon explicitly written in an admonition title takes precedence for that block.
2. A portal's `admonition_icons` entry overrides that type's Core theme default.
3. Types without a portal override inherit from the active Core theme.

Older portal template files without an `admonition_icons` section inherit the Core defaults automatically. You do not need to copy the complete Core template file to receive them.

Use **Build portal** after changing these settings to update all existing pages. **Build** updates only the selected page. Referenced library icons are published through Sheriff's normal icon renderer.

### Wiki status icons in the same file

The same `templates.yall` also supports a separate top-level `wiki_icons` map:

```yall
admonition_icons:
  note: notebook-pen
  warning: shield-alert

wiki_icons:
  category: folder
  stub: file-pen-line
```

Both maps inherit defaults from the active Core theme and support per-site
replacement or disabling with `false`. Category directory icons use `category`.
The `stub` setting controls the [stub notice](stubs.md). Keep `layouts`
as its existing top-level section. See [Category and stub icons](categories.md#category-and-stub-icons).
