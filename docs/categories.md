# Category links

Article and category names use separate namespaces:

- `[[Outriders]]` links to the article.
- `[[Category:Outriders]]` links to the category and adds the containing page to that category.
- `[[category:Outriders|custom text]]` does the same with a custom visible label. The namespace is case insensitive.
- `[[:Category:Outriders|custom text]]` links to the category without adding membership. Use this in navigation or when merely referring to a category; it also supports category section links.

Category links work inside inline patterns, infobox fields, and reusable patterns. A category link stays visible where it was inserted. Sheriff combines membership from these links and frontmatter, with case-insensitive deduplication:

```text
^^^^
title: An Outrider
categories:
  - Outriders
^^^^

[[Category:Outriders|Meet the Outriders]]
```

Code examples and HTML comments do not register categories. Generated category-directory lists do not register their listed links as membership. Category pages can still belong to parent categories through frontmatter.

Category pages keep their `/categories/<slug>.html` URLs. Their copied canonical wikilinks use `[[Category:Name]]`, and their aliases stay within that namespace. A portal build refreshes existing generated category canonicals and membership indexes. Single-page builds continue to run only the page schedule: they render category links and page category tags, but do not regenerate category indexes or other pages.

## Parent categories and generated listings

A category page can belong to one or more parent categories. Set its categories
in frontmatter just as for an article. For example, the frontmatter of the
Rust books category can contain:

```yall
categories:
  - Books
  - Programming Books
```

This lists Rust books under both parents. Hierarchy is defined by category
membership; it does not require nested filesystem folders. Each category page
shows only its immediate subcategories and directly assigned articles. Articles
in Rust books do not automatically appear in either parent unless those articles
are explicitly assigned there too.

Generated category pages show **Subcategories** before **Pages**, alphabetizing
each section separately and omitting empty sections. Subcategories use a native
collapsible section, expanded by default; its heading works with mouse and
keyboard. Category links carry a
folder icon, including in the Categories index and any mixed listings where
category pages are present. Counts in the Categories index distinguish direct
article members from subcategories. Wider category sections use two columns
when useful; narrow screens use one.

Every category section keeps its alphabetic letter headings, like All Pages,
even when the list is short. The table of contents nests the letters under
Subcategories and Pages. Letter groups stay together across columns.

Article-letter anchors retain their existing lowercase names; subcategory-letter
anchors use `subcategories-` prefixes to avoid collisions.

Parent-category frontmatter and other custom metadata survive regeneration.
The generated listing body is rebuilt by **Build portal**. Single-page builds
continue to render only the requested page and do not regenerate directories.

## Category and stub icons

Theme defaults live in `sheriff-core/themes/{theme}/templates.yall`. To customize
your site, add a top-level `wiki_icons` map to
`site/portals/{portal}/themes/{theme}/templates.yall`, alongside
`admonition_icons` and `layouts`. Keep the existing layout settings.

```yall
wiki_icons:
  category: folder
  stub: file-pen-line
```

Use an icon name from Desk's Icons panel, including custom SVG or PNG icon names,
without a filename extension or icon syntax. A missing entry inherits its Core
theme default; `false` or an empty string disables that icon. Category icons apply
to category indexes, subcategory sections, and mixed All Pages listings.
Use **Build portal** to refresh these generated listings after changing icons.

The `stub` entry controls the [stub notice](stubs.md). Setting it does not mark
a page as a stub: insert `{{{SHERIFF::STUB}}}` in the page. The same icon marks
unfinished articles in generated listings after a portal build. Category entries
keep their folder icon.
The **Stub pages** category is derived automatically from the marker; its
membership is refreshed by a portal build. See [Stub articles](stubs.md).
