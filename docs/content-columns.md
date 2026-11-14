# Content and reference columns

Implemented locally on 2026-11-13. Cloud deployment is pending. No user portal
content was edited or built during implementation.

Write an ordinary Markdown list inside a columns block:

```markdown
::: columns 3
- First item
- Second item
- Third item
:::
```

Counts 2, 3 and 4 are supported. Lists keep their original semantics and order:
read down the first column, then down the next. Ordered lists remain one list,
so numbering continues across columns. Nested lists, wikilinks, tabs and
admonitions retain their normal rendering. Literal code examples and comments
are left alone; unsupported counts and unclosed blocks are preserved as text.

All three themes use a minimum column width of 14rem and a 2rem gap. The requested
count is a maximum: fewer columns are used when the containing area is too narrow.
At viewport widths up to 600px, the result is always one column. Lists need enough
items to distribute visibly across the requested columns.

For automatically generated footnotes/references, add this to existing frontmatter:

```text
footnote_columns: 2
```

Counts 2–4 opt in. Omit the setting or use 1 for the existing one-column behavior.
The generated References heading stays full width and the ordered list below it
uses columns. Reference numbering, anchors, citation links and backlinks are
unchanged. Definitions can remain wherever the author normally writes them;
Sheriff still renders the References section at the end of the page. An ordinary
handwritten reference list can instead use the regular columns block.

The parser is Goblin in modules/markdown_core/content_columns.gbln, called by
Markdown rendering. Trailboss applies the frontmatter setting to its existing
footnote section. Styling lives in each theme CSS file. No generic runner,
schedule, new JavaScript runtime or third-party parser was added.

Validation: 143 dedicated rendering/browser checks across Compendium, Outpost
and Siegemate, light/dark, narrow containers, tablets and phones. Existing
content tabs (20), code fences (10), schedule-only page builds (22), and pattern
tabs (18 scenarios) passed. Preview uses private generated fixtures only.

The actual Everwind Andermark page was verified after reproducing stale generated
CSS from a page-only build. Brindle now refreshes changed active-theme assets as
part of the page schedule. Both of its lists render in three columns; the article
source is unchanged. A portal-wide build is not required for this correction.
