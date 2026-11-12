# Prospector Search

Prospector is the active search glam (`use prospector` in the Core manifest). It produces a static, full-text inverted index and a browser search client. No external search service is required.

## Enable the new index

After upgrading Sheriff Core, run **Build portal** once. This creates the complete index and the private records needed for incremental updates. Subsequent **Build page** actions update that page's search record and preserve all unrelated records, including when Cloud discards its temporary output folder.

A page build without a complete baseline leaves the published index untouched and logs that a portal build is needed. The client can read the previous NDJSON index during the upgrade.

**Save** still only saves the source file. It does not update the site or search. Unbuilt edits to other pages are not pulled into an individual page's index update.

## Search behavior

- Full article text, titles, aliases, headings, summaries, and categories are searchable.
- Exact titles and aliases rank first; title/alias/heading matches have additional weight.
- Multiple words must all match. The final word supports prefix matching.
- Double quotes require an exact normalized phrase, for example `"crimson harbors"`.
- A bounded one-edit typo fallback applies when a word has no exact/prefix match.
- Results include an excerpt near the matching text, an optional documentation version, and up to four categories.
- Optional article thumbnails use the page image selection described below.
- The category selector filters results to one category.
- `/` focuses search outside an editor; arrow keys choose a result; Enter opens it; Escape dismisses it.

Search loads lazily on the first query. A Web Worker parses and searches the index, with a main-thread fallback when workers are unavailable. Result text is rendered through DOM text nodes, not HTML.

## Index controls

Docs, wiki, blog, and custom article layouts are included. Admin and redirect layouts, draft pages, and Sheriff-generated directory pages are excluded. Opt an individual page out through frontmatter:

```yall
search: false
```

A full build removes deleted pages from the index. Rebuilding a page with `search: false` removes its previous search record. Rebuild the portal after restoring a snapshot or making widespread structural changes.

## Result thumbnails

Prospector chooses one image while preparing each page's search record:

1. A nonempty `thumb:` URL in frontmatter takes priority.
2. Otherwise, use the first image in a vertical infobox/pattern.
3. Otherwise, use the first article image (Sheriff `[[image:...]]`, Markdown, or HTML).

For example:

```yall
thumb: /public/images/books/my-cover.jpg
```

Relative image URLs resolve from the article URL. Images in code examples, comments, scripts, styles, and Sheriff icons are ignored. The search index stores only the URL; Prospector does not embed image bytes, generate resized files, or download remote images during builds.

The browser loads a small preview lazily, preserves the image's proportions, and removes failed images without leaving an empty slot. Pages without images retain the text-only layout. Thumbnail rendering permits HTTP(S) image URLs only.

Run **Build portal** once after adding thumbnail support to populate existing records. Later single-page builds update or remove only that page's thumbnail along with its search text.

## Build concurrency

Page schedules remain ordered. Prospector alone distributes record preparation through a 32-job backpressured channel to a bounded actor pool, then a single coordinator creates the deterministic index. Choose one, two (the default), or four preparation workers:

```yall
search:
  workers: 2
```

One and multiple workers produce the same index. Independent indexing benchmarks are available through `node tests/benchmark-prospector.cjs`; these measure record preparation and index assembly, not whole-site build time.

## Files and Cloud publishing

Public files are `public/search-index.json`, `public/prospector.js`, `public/prospector-engine.js`, and `public/prospector-worker.js`. The index contains public page text, so excluded/private text must not be added to it.

Derived per-portal records live under `site/.desk/prospector/{portal}/records.json`. They are ignored by Git and stay on Cloud's persistent site volume. They are not public assets.

A successful index write emits a private `.prospector-search-ready` marker. The Cloud page publisher uploads an updated index only when this marker confirms a complete baseline; incomplete/legacy partial builds retain the previous remote index. The marker and intermediate files are never uploaded. Partial publishing never deletes unrelated pages.

## Theme styling hooks

Themes own the appearance. The client provides `.sheriff-search-results`, `.sheriff-search-filter`, `.sheriff-search-result`, `.sheriff-search-result-title`, `.sheriff-search-result-summary`, `.sheriff-search-result-version`, `.sheriff-search-result-meta`, `.sheriff-search-result-categories`, `.sheriff-search-result-thumbnail`, `.sheriff-search-result-body`, and `.sheriff-search-status`. The selected result has `.is-active` and `aria-selected="true"`. Functional/browser checks cover Outpost, Compendium, and Siegemate in light and dark modes; theme-specific results CSS can be added independently.

Large indexes are downloaded by the browser; index sharding and a hosted backend remain future scaling options. The current index is a versioned format so those can be introduced without changing the authoring syntax.
