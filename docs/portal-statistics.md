# Portal Statistics

Sheriff calculates portal statistics during each build. You can display them with individual Badge tokens or one combined stats block.

## Individual Badges

```text
{{{BADGE::PAGE_COUNT}}}
{{{BADGE::IMAGE_COUNT}}}
{{{BADGE::VIDEO_COUNT}}}
```

Each token produces a compact badge styled by your theme, such as **42 Pages**, **7 Images**, or **1 Video**. Zero totals are displayed as zero.

Use these tokens in page content, layouts, or theme slots. The existing page-count badge continues to work.

## Combined Statistics

Place this token on its own line:

```text
{{{BADGE::STATS}}}
```

This displays Pages, Images, and Videos together, with a label and a prominent number for each. The display follows your theme and adapts to narrow screens.

## Theme Templates

To replace the header's page-count badge, set the layout's `PAGECOUNT` slot in `templates.yall`:

```yaml
layouts:
  wiki:
    slots:
      PAGECOUNT:
        - "BADGE::STATS"
```

Slot entries accept either `BADGE::STATS` or `{{{BADGE::STATS}}}`. The stats display is compact beside the site name and larger in article content. An empty `PAGECOUNT: []` hides the header badge.

## What Gets Counted

- **Pages:** the existing indexed-page total from Trailboss. Archived revisions do not become extra pages. Index, 404, and missing-page routes are excluded by the existing page-count rules.
- **Images:** image files under your portal's `public/images` folder, including subfolders. Each file counts once, whether used once, used repeatedly, or not used yet. Files in `public/icons`, logos outside the image library, and theme assets are excluded. Remote image URLs are not library files.
- **Videos:** unique YouTube and Vimeo embeds written with Sheriff's `[[video:...]]` syntax. Using the same provider and video ID on multiple pages counts once. Used reusable patterns, inline patterns, and content tabs are included. Unused patterns are excluded.

Video scanning uses the latest revision of each published page version. Superseded revisions, frontmatter, code examples, scripts, and HTML comments do not add videos. Ordinary links to video sites are not embeds.

## When Totals Change

Statistics are collected once before page rendering and stored in the portal's `report.json` as `pages`, `images`, and `videos`. Every page rendered in that build uses the same totals. Single-page builds also refresh the report; other existing HTML pages show updated totals after they are rebuilt.

The numbers reflect the latest build. They do not need browser-side JavaScript or a database. Discussions are not counted yet.
