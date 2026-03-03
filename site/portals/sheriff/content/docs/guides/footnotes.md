^^^^
title: Footnotes & References
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: Add citations and endnotes using Comrak footnotes — with clear copy/paste examples and rendered output.
^^^^

Footnotes are **built into Sheriff** via the Markdown renderer (Comrak).
They’re perfect for citations, side commentary, or reference lists that shouldn’t interrupt the main flow.

This page always shows:

1. The **exact Markdown you type**
2. The **rendered result**

So you never have to guess.

---

# 1. The Smallest Possible Footnote

## What you write

```md
Here’s a sentence with a footnote.[^one]

[^one]: This is the footnote text.
```

## What it renders

Here’s a sentence with a footnote.[^one]

[^one]: This is the footnote text.

---

# 2. Multiple Footnotes in One Paragraph

## What you write

```md
The design prioritizes readability and speed.[^readability][^perf]

[^readability]: Readability wins when docs are used under pressure.
[^perf]: Static builds are fast because they ship HTML, not a server.
```

## What it renders

The design prioritizes readability and speed.[^readability][^perf]

[^readability]: Readability wins when docs are used under pressure.

[^perf]: Static builds are fast because they ship HTML, not a server.

---

# 3. Reusing the Same Footnote ID

You can reference the same definition multiple times.

## What you write

```md
You can cite the same source twice.[^same]

Later, cite it again.[^same]

[^same]: One footnote definition, reused multiple times.
```

## What it renders

You can cite the same source twice.[^same]

Later, cite it again.[^same]

[^same]: One footnote definition, reused multiple times.

---

# 4. Multi‑Paragraph Footnotes

This is where indentation matters.

If you want multiple paragraphs inside a single footnote, **indent continuation lines with 4 spaces**.

## What you write

```md
This claim needs nuance.[^nuance]

[^nuance]: First paragraph of the footnote.

    Second paragraph of the same footnote.

    Third paragraph, still the same footnote.
```

## What it renders

This claim needs nuance.[^nuance]

[^nuance]: First paragraph of the footnote.

    Second paragraph of the same footnote.

    Third paragraph, still the same footnote.

---

# 5. Lists Inside a Footnote

Lists must also be indented to stay inside the footnote.

If you do not indent them, Markdown will treat them as normal content below the footnote.

## What you write

```md
This pattern has multiple parts.[^list]

[^list]: The system requires:

    - Stable parsing
    - Clean rendering
    - Predictable styling
```

## What it renders

This pattern has multiple parts.[^list]

[^list]: The system requires:

    * Stable parsing
    * Clean rendering
    * Predictable styling

Notice the indentation in the Markdown. That is what keeps the list inside the footnote.

---

# 6. Reference Style Examples

Sheriff does not enforce citation format. You choose the style.

Below are a few common patterns.

---

## A. Note‑Style Commentary

### What you write

```md
The new routing model reduces churn.[^note-style]

[^note-style]: Internal note: the win here is fewer edge-case rewrites.
```

### What it renders

The new routing model reduces churn.[^note-style]

[^note-style]: Internal note: the win here is fewer edge-case rewrites.

---

## B. APA‑Style (Full Format)

### What you write

```md
Signal calibration follows a predictable human pattern.[^apa1]

[^apa1]: AuthorLast, A. A. (2020). *Title of the work: Subtitle*. Publisher. https://example.com
```

### What it renders

Signal calibration follows a predictable human pattern.[^apa1]

[^apa1]: AuthorLast, A. A. (2020). *Title of the work: Subtitle*. Publisher. [https://example.com](https://example.com)

---

## C. Docs “APA‑Lite” (Recommended for Portals)

Short, readable, credible.

### What you write

```md
Comrak supports CommonMark extensions, including footnotes.[^apalite]

[^apalite]: Comrak docs — “Footnotes” extension. (Accessed 2026‑03‑03)
```

### What it renders

Comrak supports CommonMark extensions, including footnotes.[^apalite]

[^apalite]: Comrak docs — “Footnotes” extension. (Accessed 2026‑03‑03)

---

## D. Spec / RFC Key Style

### What you write

```md
This behavior matches the spec.[^RFC9110]

[^RFC9110]: RFC 9110 — HTTP Semantics.
```

### What it renders

This behavior matches the spec.[^RFC9110]

[^RFC9110]: RFC 9110 — HTTP Semantics.

---

# Common Mistakes

### Forgot the definition

```md
This has a footnote.[^oops]
```

If you never define `[^oops]: ...`, nothing will render at the bottom.

---

### Forgot indentation in multi‑paragraph notes

Wrong:

```md
[^bad]: First paragraph.

Second paragraph (this will break out of the footnote).
```

Correct:

```md
[^good]: First paragraph.

    Second paragraph (indented 4 spaces).
```

---

# Quick Copy / Paste

Minimal:

```md
Text here.[^1]

[^1]: Footnote text.
```

Reusable key:

```md
Spec reference.[^RFC9110]

[^RFC9110]: RFC 9110 — HTTP Semantics.
```
