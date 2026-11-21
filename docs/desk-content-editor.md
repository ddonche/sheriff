# Shared Content editor — Page details and Visual / Source

Implemented locally on 2026-11-15. Cloud's checkout is prepared; not deployed.

Desk retains its file tree, Editor/Log tabs and Save / Build page / Build portal
actions. Page details exposes title, active-theme layout, author, categories,
summary, gloss and thumbnail. Categories use one line per name, including numeric
names such as years. Goblin handles these buffer-only metadata operations through
desk/api/frontmatter.gbln. Unknown metadata and comments remain in Source.

The shared Visual / Source controls appear on content/blog Markdown articles.
Source is the initial mode. Visual uses Tiptap, already used by Cloud's editors,
with a Sheriff-specific browser adapter. No new server endpoint, storage format,
runtime compilation, or publication step is introduced. JavaScript here is frontend
editing code. The original Markdown textarea remains the authoritative unsaved
buffer and existing Save/build/unsaved-change protections apply to both modes.

The first Visual increment supports paragraphs, headings, bold/italic, simple
lists, Sheriff wikilinks, image previews, undo/redo, and the existing image/icon/
pattern pickers. Selecting text and using Link writes Sheriff wikilink syntax.
Clicking an image or its Image settings button selects that occurrence and opens
inline, Desk-styled size/alignment/caption controls. These update only its existing
Sheriff image token in the unsaved Source buffer. Replace image reuses the gallery
and uploads, prefilled with the current image's properties; cancel and identical
replacement preserve the source. Custom existing sizes are retained. Remove from
page does not delete the media file; Undo restores the most recent image state.
Replacement bookmarks reject newer body/image edits or page switches. Invalid
caption delimiters are rejected with a message and the prior value kept. Source
editing remains available. Pickers capture Visual
selection and reject a stale selection after a newer body edit or page switch.

Patterns, tokens, code, HTML, complex lists/tables and unknown syntax
remain source-backed blocks/inline chips. Block Edit in Source selects that source.
Raw HTML is displayed as text, never executed in the editing surface. Clipboard
HTML is reduced to text. Pasted source is body content, never hidden as frontmatter.
Non-article files retain the Source editor.

Each parsed top-level block keeps its original raw slice and separator. No-op
mode switching reuses those slices exactly; edits serialize changed blocks only.
The current textarea's existing LF normalization is unchanged. Page details-only
changes preserve the active Visual body and its undo history. Changing modes does
not save, build, or publish anything.

Source: sheriff-core/desk/admin/visual/{visual-editor.js,visual-source.js}.
The self-contained browser bundle is admin/visual-editor.js; licenses are adjacent
in visual-licenses.txt. Rebuild with Cloud's tools/build-desk-visual.mjs using its
installed Tiptap packages, then sync the shared Core. Both environments ship the
same browser bundle, without CDN/runtime downloads.

Validation: check-visual-editor.mjs covers all current Programming page source
round trips plus local/hosted browser editing, formatting, links, insertion,
undo/redo, explicit Save without builds, metadata changes, stale selections,
source switching, empty pages, pasted syntax, non-article files, unsaved guards,
disabled source states and narrow layouts. Separate Page details and image-picker
regressions remain applicable. Desktop/mobile captures were visually reviewed.

Image properties were checked in local/hosted fixtures, including upload replacement,
keyboard controls, selection-only no-ops, invalid captions, removal/undo, custom
sizes, source locks and explicit Save without builds. Desktop/mobile controls were
visually reviewed.

Further work: visual pattern properties, complex tables and citations,
more inline Markdown, a preferred/default mode, and front-end page editing. This
increment is not a finished visual interface for every Sheriff construct.


Visual callouts (2026-11-16, local; Cloud checkout prepared, not deployed):
Note, tip, warning, important, example, strategy, lore and spoiler fences have
editable bodies. Callout settings changes type/title; removal supports Undo.
Default icons come from themes.config's read-only Goblin admonitions response,
using Core templates.yall then the portal's overrides. SVG previews use masks;
portal PNGs use the existing source asset URL. Explicit icon tokens are preserved.
Spoilers are expanded for authoring only. Nested callouts and protected child
syntax keep their source records, including exact untouched whitespace. Unknown
or incomplete fences remain source-backed cards. Source selection also works for
newly inserted callouts. New Visual sessions reset history; frontmatter-only
changes retain the current session and caret. No implicit saves/builds/publishing.

Validation: 584 Visual checks (local/hosted fixtures, source roundtrips, header and
body edits, configured/disabled/explicit icons, nested source selection and Undo,
empty/unknown/incomplete blocks, insertion, read-only states and mobile layout);
75 native theme-config, 80 Page details and 60 image-picker checks passed. The
broader hosted suite reached its unrelated source-actions folder-move test, which
failed because content/source-actions was absent from its destination options.
No claim that the entire hosted suite passed is made for this increment.
Admonition controls follow-up (2026-11-16, local only): Insert admonition now sits
beside the other insertion tools in Visual and Source. In Visual it inserts a new
note, opens its settings and focuses its empty body. Adding from an existing
callout creates a sibling without replacing it. Empty callouts show a writing
prompt. Edit content focuses the selected body (adding a paragraph after a
protected-only body when necessary). Close/Escape dismiss settings without a
source mutation; subsequent body edits keep them closed until explicitly reopened.
Source insertion wraps selected text and retains its surrounding content.
636 Visual browser/source checks passed, including the real insert/focus/close
buttons, keyboard typing, reopening and Undo in local and hosted modes. The local
served assets and Cloud checkout match; no production deployment was made.
Visual citations, blockquotes and insertion gaps (2026-11-16, local; Cloud checkout
prepared, not deployed): [^name] is a superscript inline atom retaining its exact
raw source. Paragraphs/headings/lists containing supported inline citations remain
editable. Consecutive footnote definitions, blank separators and indented
continuations form one References & footnotes source card, without relocating
prose or definitions. Code mentions remain literal. Blockquote toggling works in
ordinary prose and callout bodies; supported existing quotes are editable, while
advanced unsupported quoted blocks retain source cards. The serializer preserves
untouched quotes and references, and emits > prefixes for quote edits.

Visible Add paragraph decorations appear at protected/container block boundaries.
They do not enter the authored document until activated. Mouse/keyboard activation
inserts an empty editable paragraph with a writing prompt and clear caret; new
prose retains safe blank-line separation from existing source blocks. Undo and
read-only guards are covered. 737 Visual checks passed in local/hosted fixtures,
including the actual Eleventy source, citation preservation, grouped definitions,
quote editing inside callouts, insertion before/between/after protected blocks,
keyboard focus, disabled states, exact no-op source and desktop/mobile review.
Content dialog UX (2026-11-16, local; not deployed): removed the empty-paragraph
placeholder labels and dashed empty-paragraph boxes. Admonition settings now use
Desk's existing draggable help-window shell, with type, title and a rich content
editor visible together. There is no Edit content step. The window's toolbar
formats body text, lists and blockquotes; body changes update the same unsaved
source. Done/Close retains unsaved edits and does not save/build. Unknown complex
children are kept as protected originals in the body editor. Image properties,
the existing image gallery/upload picker, and the icon/pattern picker use matching
floating windows. Source-mode and navigation insertion retain their existing
capture/validation behavior. 425 updated Visual/source checks, 60 image-picker
checks and 80 Page details checks passed in local/hosted fixtures. Desktop and
narrow layouts were visually reviewed. No production site files changed.

The page and admonition editors share one formatting toolbar and one document typography class. Both use the bundled Lucide SVG artwork for formatting controls, including headings, links, lists, blockquotes, and undo/redo. Selection whitespace is trimmed consistently in both editors. Admonition content opens immediately in its draggable window; edits remain unsaved until Save or an existing build action.


Editor navigation: newly opened files and revisions start at the beginning. Edit in Source selects and reveals the requested block using wrapped text measurements. Visual and Source retain their separate scroll positions when toggled. The Lucide back-to-top button appears while scrolled and works with both the editor viewport and mobile workspace scrolling. Saving a revision preserves the source caret and scroll position.


Workspace layout (2026-11-16, local): navigation collapses to a labelled icon rail and remembers the preference. File-tree disclosures and Page details use Lucide chevrons. Page details and Visual/Source share one row. Content uses the full available width; large insert controls occupy a right rail on wide screens and return above the editor on narrower screens. Controls and source buffers are reused, with no implicit save/build or production deployment.


## Default revision save action

In a portal's config.yall, documentation.mode remains the policy: manual offers
both choices, always creates a revision, and off overwrites. The optional
`documentation.default_save_mode` selects revision or overwrite when opening a
page in manual mode. Omitting it or providing an unsupported value retains the
existing revision default. The user's radio selection applies to the current
page; opening another page starts with the configured default again. Saving a
new revision preserves the selected action. Always/off take precedence.

```text
documentation:
  mode: manual
  default_save_mode: overwrite
```

Keep the existing versions/default_version entries. This is a Desk preference,
shared by local and Cloud's identical frontend. No build is required to change
the editor default. Implemented and browser-tested locally on 2026-11-18; Cloud
source prepared, deployment pending.