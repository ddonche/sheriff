^^^^
title: Images
author: Sheriff Docs
layout: docs
meta_kind: guide
meta_type: docs
summary: Add images to Sheriff pages with files in public/images and Sheriff wiki image syntax.
gloss: Images are stored in public/images and rendered with Sheriff wiki image syntax.
categories: [Images]
canonical: images
^^^^

Images are stored in your portal's `public/images` folder.

Add the file there, then reference it from markdown with Sheriff image syntax.

---

## File Location

Images for the `sheriff` portal go here:

```text
site/
└── portals/
    └── sheriff/
        └── public/
            └── images/
                └── my-image.png
```

For another portal, use that portal's folder:

```text
site/portals/everwind/public/images/
site/portals/goblin/public/images/
site/portals/vekke/public/images/
```

Do not put images in `content/`.

Do not create markdown pages for images.

---

## Syntax

```md
[[image:filename|size|align|caption]]
```

Example:

```md
[[image:House_andergard_emblem.png|thumb|right|Emblem of House Andergard]]
```

The image syntax has four parts:

| Part | Required | Example | Meaning |
| --- | --- | --- | --- |
| `filename` | yes | `House_andergard_emblem.png` | File path inside `public/images` |
| `size` | yes | `thumb` | Image size class |
| `align` | yes | `right` | Image alignment |
| `caption` | no | `Emblem of House Andergard` | Caption text shown under the image |

---

## Filename

The filename is relative to `public/images`.

If the file is here:

```text
site/portals/sheriff/public/images/emblem.png
```

write:

```md
[[image:emblem.png|thumb|right|House emblem]]
```

If the file is here:

```text
site/portals/sheriff/public/images/houses/andergard/emblem.png
```

write:

```md
[[image:houses/andergard/emblem.png|thumb|right|House emblem]]
```

Do not include `public/images/` in the image link.

Correct:

```md
[[image:castle.png|thumb|right|Castle]]
```

Wrong:

```md
[[image:public/images/castle.png|thumb|right|Castle]]
```

---

## Sizes

Sheriff supports these image sizes:

| Size | Width | Use |
| --- | ---: | --- |
| `icon` | `32px` | Small symbols, coins, tiny emblems |
| `mini` | `48px` | Small marks, seals, compact field images |
| `thumb` | `260px` | Standard article images |
| `half` | `420px`, max `50vw` | Larger floated images |
| `full` | `100%`, max `820px` | Maps, banners, wide images |

Examples:

```md
[[image:coin.png|icon|center|Anderian Pound]]
[[image:house-emblem.png|mini|center|House emblem]]
[[image:castle.png|thumb|right|Deepwall]]
[[image:portrait.png|half|right|Queen Andera]]
[[image:region-map.png|full|center|Map of the region]]
```

---

## Alignment

Sheriff supports these alignments:

| Align | Behavior |
| --- | --- |
| `left` | Floats the image left |
| `right` | Floats the image right |
| `center` | Centers the image block |

Examples:

```md
[[image:relic.png|thumb|left|Ancient relic]]
[[image:portrait.png|thumb|right|Character portrait]]
[[image:map.png|full|center|Regional map]]
```

`full` images are centered by the theme.

---

## Captions

The fourth part is the caption:

```md
[[image:map.png|full|center|Map of Andermark]]
```

Caption:

```text
Map of Andermark
```

To render an image with no visible caption, leave the fourth part empty:

```md
[[image:divider.png|full|center|]]
```

---

## Standard Article Image

```md
[[image:House_andergard_emblem.png|thumb|right|Emblem of House Andergard]]
```

Use this for most article images.

---

## Map Or Banner Image

```md
[[image:Andermark_current.png|full|center|Andermark in red]]
```

Use `full` and `center` for maps, diagrams, banners, and large reference images.

---

## Small Field Images

Use `icon` or `mini` for small images inside pattern fields:

```md
currency = [[image:Anderian_Pound.png|icon|center|Anderian Pound]]
emblem = [[image:House_andergard_emblem.png|mini|center|House Andergard]]
```

---

## Images In Patterns

Patterns can contain image syntax.

For a wide image row, prefix the field name with `_`:

```md
::: pattern vertical Region
_image = [[image:Andermark_current.png|thumb|center|Andermark in red]]
government = monarchy
leadership = [[House Andergard]]
capitol = [[Deepwall]]
:::
```

`_image` renders with the visible label `image`, but the image value spans the full pattern width.

Use this for infobox header images.

---

## Common Mistakes

### Including Too Much Path

Wrong:

```md
[[image:site/portals/sheriff/public/images/castle.png|thumb|right|Castle]]
```

Wrong:

```md
[[image:public/images/castle.png|thumb|right|Castle]]
```

Correct:

```md
[[image:castle.png|thumb|right|Castle]]
```

### Wrong Filename

These are different filenames:

```text
House_andergard_emblem.png
House Andergard Emblem.png
house_andergard_emblem.png
```

Use the exact filename.

### Missing Pipe Parts

Use all four pipe-separated parts:

```md
[[image:filename|size|align|caption]]
```

If there is no caption, keep the final pipe:

```md
[[image:filename.png|thumb|right|]]
```

---

## Modules Involved

* **[[Trailboss]]** - converts image wiki syntax into image HTML.
* **[[Stagehand]]** - copies portal public assets into the generated site.

---

::: nav
next [[Videos]]
previous [[Frontmatter]]
:::

::: nav
related [[Patterns]] - use images inside pattern fields
related [[Links]] - create normal wikilinks between pages
related [[Focus Panels]] - use images in sticky focus panels
:::
