# Videos

Embed YouTube or Vimeo videos with:

```text
[[video:youtube|VIDEO_ID|size|alignment|Caption]]
[[video:vimeo|VIDEO_ID|size|alignment|Caption]]
```

Use the video ID, rather than the complete URL. The caption is optional.

## Sizes and alignment

| Size | Behavior |
| --- | --- |
| `thumb` | Up to 260px wide. |
| `half` | Half the video group's width, allowing for the gap between two videos. |
| `full` | The video group's full width, up to 820px. |

Alignment accepts `left`, `center`, or `right`. The defaults are `full` and `center` when those arguments are omitted. Videos retain a 16:9 player frame.

## Text wrapping

A single `half` or `thumb` video aligned `left` or `right` lets adjacent paragraphs flow beside it. A centered video occupies its own row. Full-width videos and groups of consecutive videos keep following content below them.

```text
[[video:youtube|VIDEO_ID|half|left|Watch this introduction]]

This paragraph flows to the right of the video.
```

## Multiple videos

Consecutive video embeds automatically form one group. Put them on their own lines; blank lines between embeds are also allowed. No extra fence is needed.

For a featured video above two smaller videos:

```text
[[video:youtube|FEATURED_ID|full|center|Featured video]]
[[video:youtube|FIRST_ID|half|left|First video]]
[[video:youtube|SECOND_ID|half|right|Second video]]
```

The two halves share the same overall width as the full video, with a gap between them. Following headings and paragraphs begin below the group.

Prose, headings, and HTML container boundaries end a group. Videos in separate pattern fields or tab panels remain separate groups.

## Infoboxes and narrow spaces

Video groups fit beside floated infoboxes and vertical patterns without overlapping them. On narrow screens, or when the space beside an infobox is narrow, half-width videos stack at full available width. This also applies inside patterns, admonitions, and content tabs.
