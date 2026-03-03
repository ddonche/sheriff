^^^^
title: Admonitions & Spoilers
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: Styled callout blocks for notes, warnings, strategy, lore, and collapsible spoilers.
^^^^

Admonitions are **styled callout blocks** used to highlight important information inside your content.

They are flat margin-note panels with:

* A muted background wash
* A colored left border
* An uppercase title label
* Clean spacing that matches the Sheriff theme

You’ve already seen them throughout the docs.

---

## The one rule you can’t ignore

**Admonitions must follow the exact block shape.**

If you forget the closing `:::` line, your content may render incorrectly or swallow everything below it.

**Always use this shape:**

```
::: type Optional Title
Content here
:::
```

That’s it.

No brackets.
No pipes.
No inline syntax.

---

## Basic usage

### Example

```
::: note
This is a note.
:::
```

Renders as:

::: note
This is a note.
:::

---

### Custom title

If you include text after the type, it becomes the title.

```
::: warning Read This First
If you ignore this, things may break.
:::
```

::: warning Read This First
If you ignore this, things may break.
:::

If you don’t provide a title, Sheriff uses the default for that type.

---

## Supported types

Sheriff currently supports the following admonition types (accent styles are for Outpost and Siegemat themes; yours may differ):

| Type        | Default Title | Accent Style |
| ----------- | ------------- | ------------ |
| `note`      | Note          | Gold         |
| `tip`       | Tip           | Burnt Orange |
| `warning`   | Warning       | Red          |
| `important` | Important     | Hunter Green |
| `example`   | Example       | Neutral      |
| `strategy`  | Strategy      | Slate/Navy   |
| `lore`      | Lore          | Deep Teal    |

### Optional aliases

These map automatically:

| Alias     | Maps To   |
| --------- | --------- |
| `info`    | note      |
| `hint`    | tip       |
| `caution` | warning   |
| `rule`    | important |

---

## Full example (copy/paste)

```
::: strategy
Strong players will draft before they ransom.
:::
```

::: strategy
Strong players will draft before they ransom.
:::

---

## You can put anything inside

Admonitions support normal markdown:

* Lists
* Bold / italic
* Code blocks
* Nested content

Example:

````
::: important
Always remember:

- Draft before panic.
- Protect reserves.

```goblin
act reinforce()
  print("Think ahead")
end
````

:::

````

::: important
Always remember:

- Draft before panic.
- Protect reserves.

```goblin
act reinforce()
  print("Think ahead")
end
````

:::

---

# Spoilers (Collapsible Blocks)

A **spoiler** is a collapsible admonition-style block.

It looks identical in style to other panels, but starts **collapsed** and expands when clicked.

---

## Basic spoiler

```
::: spoiler
Hidden content here.
:::
```

::: spoiler
Hidden content here.
:::

If no title is provided, the default label is:

**SHOW**

---

## Custom spoiler title

```
::: spoiler Advanced Explanation
This is deeper detail that most readers can skip.
:::
```

::: spoiler Advanced Explanation
This is deeper detail that most readers can skip.
:::

---

## When to use spoilers

Use spoilers for:

* Advanced explanations
* Long technical breakdowns
* Optional theory
* Answer reveals
* Strategy analysis
* Walkthrough steps

Do **not** use spoilers for critical information readers must see immediately.

---

## Behavior rules

* Admonitions and spoilers must begin on their own line.
* They must end with a closing `:::` on its own line.
* Avoid indenting the block unless you are intentionally nesting it.
* Spoilers render using native `<details>` / `<summary>` elements (no JavaScript required).

---

## Troubleshooting

### Everything below my admonition disappeared

You probably forgot the closing:

```
:::
```

---

### My spoiler doesn’t collapse

Confirm:

* You used `::: spoiler`
* Your theme includes the spoiler CSS
* You didn’t accidentally indent the block inside another structure

---

## Quick copy/paste

**Note**

```
::: note
Content
:::
```

**Warning**

```
::: warning
Content
:::
```

**Spoiler**

```
::: spoiler
Content
:::
```

**Spoiler with title**

```
::: spoiler Deep Dive
Content
:::
```
