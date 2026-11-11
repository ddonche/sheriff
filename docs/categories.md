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
