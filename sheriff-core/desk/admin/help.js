// Sheriff Desk — help drawer content
// Edit freely: each view key holds { title, docs, sections: [{ title, html }] }.
// Distilled from the Sheriff docs; each drawer links to its full page.

(function () {
  const D = 'https://sheriff.sheriffcloud.com/docs';

  window.DESK_HELP = {

  snapshots: {
    title: 'Snapshots',
    sections: [
      { title: 'Save a point', html: '<p>Choose a portal and click <strong>Save snapshot</strong>. Give it an optional name. Desk ZIPs the entire saved portal source, including content, assets, patterns, configuration, and portal-local module settings. Unsaved editor changes are not included.</p>' },
      { title: 'Keep and export', html: '<p>Keep as many snapshots as your storage allows. Each shows its name, date, time, and size. <strong>Download ZIP</strong> exports a copy; <strong>Delete</strong> removes the saved ZIP.</p>' },
      { title: 'Restore', html: '<p><strong>Restore</strong> replaces the selected portal source with the snapshot and rebuilds that portal. Changes made since the snapshot are discarded. Desk confirms before restoring and reports restore and build results separately. Other portals and Sheriff Core are left intact.</p>' },
      { title: 'Storage', html: '<p>Snapshots live outside portal directories, under <code>data/snapshots</code>, so they are never included in another snapshot or removed by a site build. Snapshot-only portals appear in the picker so you can restore a deleted portal. Modules can recommend taking a snapshot; Desk does not decide when one is needed.</p>' }
    ]
  },

  patterns: {
    title: 'Patterns',
    docs: D + '/guides/patterns.html',
    sections: [
      { title: 'Templates', html: '<p>Choose <strong>Template</strong> for a structure you want to fill out separately on each page. Use <strong>Copy template</strong>, paste into a page, and edit the fields. Templates do not publish tokens or show a token footer.</p>' },
      { title: 'Reusable content', html: '<p>Choose <strong>Reusable content</strong> for a filled block shared across pages. <strong>Copy token</strong> inserts the saved content wherever that token is used. Editing the saved pattern updates its uses on the next build.</p>' },
      { title: 'Tabbed editions', html: '<p>Inside a pattern, add <code>@tab Hardcover</code> followed by that edition’s normal <code>label = value</code> fields. Add <code>@tab Paperback</code> for the next edition. Fields above the first tab stay visible; covers, ISBNs, page counts, and other fields below a tab switch together.</p><pre>::: pattern vertical Book\n@mode = template\ntitle = My Book\nauthor = Some Author\n\n@tab Hardcover\nisbn =\npages =\n\n@tab Paperback\nisbn =\npages =\n:::</pre><p>Use the same source in a template or reusable pattern. The first tab opens by default. Arrow keys, Home, and End switch tabs. Printed pages and browsers without JavaScript show every edition.</p>' },
      { title: 'Changing modes', html: '<p>Use the <strong>Use as</strong> selector and save. The setting is kept in the source, so copied templates retain it. Older saved patterns without a setting keep their reusable behavior. Inline copies without a setting follow the mode of the saved pattern.</p>' }
    ]
  },

  content: {
    title: 'Writing content',
    docs: D + '/guides/writing_docs.html',
    sections: [
      { title: 'Insert an image', html: '<p>Open a Markdown page and click <strong>Insert image</strong>. Upload an image or select an existing one, choose its folder, size, alignment, and optional caption, then insert the generated syntax at your cursor. Folders are shared with Media and live under <code>public/images</code>. Use New folder to create a subfolder; Desk remembers your last folder for each portal.</p><p>Uploads preserve existing files: if a filename is already taken, choose that image or another folder. Uploading and inserting do not save or build the page. Use Save &amp; build when ready.</p>' },
      { title: 'Insert icons and patterns', html: '<p>Use <strong>Insert icon</strong> or <strong>Insert pattern</strong> beside Insert image. Pick an icon visually and optionally choose its color. Templates insert editable source; reusable patterns insert their shared token, with an option for an editable copy. Insertion replaces the selected text or uses your cursor position, and leaves the page unsaved.</p><p>Manage the originals in Icons and Patterns. Rename and delete files from their actions menu in the file tree.</p>' },
        { title: 'Editor and build log', html: '<p>The <strong>Editor</strong> and <strong>Log</strong> tabs share the main content area. Save &amp; build opens Log automatically and displays the full build output, errors, exit code, and elapsed time. Return to Editor to continue writing; switching tabs preserves your text. The latest build result stays available while you move around Desk.</p>' },
      { title: 'Active portal', html: '<p>The portal name and logo in the Desk header show which site you are working on. Use this header picker to choose a portal once and keep working across Content, Media, Interactive, Patterns, Navigation, Config, Themes, and Snapshots.</p><p>Desk remembers the selection after a refresh. Switching portals checks for unsaved edits across panels; canceling keeps your current portal and edits.</p>' },
      { title: 'Content tabs', html: '<p>Group sections inside one <code>::: tabs</code> fence. Start each panel with <code>@tab Your label</code>, and close the group with <code>:::</code>.</p><pre>::: tabs\n\n@tab ALGOL 58\nContent for ALGOL 58.\n\n@tab ALGOL 60\nContent for ALGOL 60.\n\n:::</pre><p>Panels support normal Markdown, code examples, wikilinks, patterns, and badges. Each group switches independently. The first tab opens by default. Use the arrow keys, Home, and End to move between tabs. Without JavaScript, every panel stays visible.</p>' },
      { title: 'Inline version badges', html: '<p>Every label in <code>documentation.versions</code> has a badge token: for example, <code>{{{SHERIFF::v1.0.0}}}</code>. Use <strong>Copy badge token</strong> in the Content version bar, or open <strong>Config → Version badge tokens</strong>. Paste it beside regular text, a heading, or inside a table.</p><p>The badge uses a tag icon and the exact version label. A separate page version is not required. Tokens inside code examples stay literal.</p>' },
      { title: 'Rename and delete', html: '<p>Use the <strong>⋯</strong> button beside a file or folder, or right-click its row, to rename or delete it. Renaming a versioned page moves all its versions and revisions together. Deleting a page or folder removes everything inside it after confirmation.</p><p>Renaming keeps page content and its canonical name. Filename-based URLs change; rebuild the portal and update any direct links or navigation paths that use the old filename.</p>' },
      { title: 'Managing revision files', html: '<p>Enable <strong>Show revision files</strong> to see version folders and individual R1.md, R2.md, and later revisions. Each has the same file actions. Deleting the latest revision makes the highest remaining revision current; deleting the final revision removes that version. When editing an older revision, New revision saves after the highest existing number.</p><p>File changes take effect in the source immediately. Use <strong>Build portal</strong> when ready to refresh generated pages.</p>' },
      {
        title: 'Markdown cheatsheet',
        html: `
<table class="hd-table">
<tr><td>Heading</td><td><code># H1</code> <code>## H2</code> <code>### H3</code></td></tr>
<tr><td>Bold</td><td><code>**bold text**</code></td></tr>
<tr><td>Italic</td><td><code>*italicized text*</code></td></tr>
<tr><td>Strikethrough</td><td><code>~~struck text~~</code></td></tr>
<tr><td>Blockquote</td><td><code>&gt; blockquote</code></td></tr>
<tr><td>Ordered list</td><td><code>1. First item</code></td></tr>
<tr><td>Unordered list</td><td><code>- First item</code></td></tr>
<tr><td>Code</td><td><code>\`code\`</code></td></tr>
<tr><td>Horizontal rule</td><td><code>---</code></td></tr>
<tr><td>Internal link</td><td><code>[[page-slug|custom name]]</code></td></tr>
<tr><td>External link</td><td><code>[[https://example.com|Website]]</code></td></tr>
<tr><td>Image</td><td><code>[[image:file.jpg|thumb|left|Caption]]</code></td></tr>
</table>
<p><a href="${'' + D}/guides/links.html" target="_blank" rel="noopener">All about links →</a></p>`
      },
      {
        title: 'Frontmatter',
        html: `
<p>Every page starts with a block fenced by <code>^^^^</code>:</p>
<pre>^^^^
title: Admonitions &amp; Spoilers
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: One sentence, used in search results.
gloss: One sentence, shown when hovering links to this page.
^^^^</pre>
<p><code>layout</code> must exist in your theme (<code>sheriff-core/themes/{theme}/layouts/</code>) or the build errors. <code>meta_kind</code> / <code>meta_type</code> are decorative — write what fits.</p>
<p>Blog posts additionally <em>require</em>:</p>
<pre>author_avatar: /public/avatars/dan.png
thumb: /public/images/blog/mtg-goblin.png
date: 2015-12-05</pre>
<p><a href="${'' + D}/guides/frontmatter.html" target="_blank" rel="noopener">Frontmatter →</a> · <a href="${'' + D}/guides/writing_blogs.html" target="_blank" rel="noopener">Writing a blog post →</a></p>`
      },
      {
        title: 'Images',
        html: `
<p>Files live in your portal's <code>public/</code> folder (see Media):</p>
<pre>[[image:blog/mtg-goblin.png|full|center|A lovely Goblin]]
[[image:filename.jpg|thumb|left|Caption]]</pre>
<p>Path · size · alignment · caption. Media's <em>Copy tag</em> button produces the scaffold for any image.</p>
<p><a href="${'' + D}/guides/images.html" target="_blank" rel="noopener">Images →</a></p>`
      },
      {
        title: 'Videos',
        html: `
<p>Embed from YouTube or Vimeo — provider, video id, size, alignment, caption:</p>
<pre>[[video:youtube|dQw4w9WgXcQ|full|center|Sheriff intro]]
[[video:vimeo|123456789|full|center|Build pipeline walkthrough]]</pre>
<p><a href="${'' + D}/guides/videos.html" target="_blank" rel="noopener">Videos →</a></p>`
      },
      {
        title: 'Admonitions',
        html: `
<p>Styled callout blocks. The shape is exact — forgetting the closing <code>:::</code> swallows everything below it:</p>
<pre>::: note
This is a note.
:::

::: warning Read This First
Custom title after the type.
:::</pre>
<p>Types: <code>note</code>, <code>tip</code>, <code>warning</code>, <code>important</code>, <code>example</code>, <code>strategy</code>, <code>lore</code>. Aliases: <code>info</code>→note, <code>hint</code>→tip, <code>caution</code>→warning, <code>rule</code>→important. Normal markdown works inside.</p>
<p><a href="${'' + D}/guides/admonitions.html" target="_blank" rel="noopener">Admonitions →</a></p>`
      },
      {
        title: 'Spoilers',
        html: `
<p>A collapsible block — starts closed, expands on click:</p>
<pre>::: spoiler
Hidden content here.
:::

::: spoiler Advanced Explanation
Custom label instead of the default "SHOW".
:::</pre>
<p>Good for advanced detail, answer reveals, optional theory. Never hide critical information in one.</p>
<p><a href="${'' + D}/guides/admonitions.html#spoilers-collapsible-blocks" target="_blank" rel="noopener">Spoilers →</a></p>`
      },
      {
        title: 'Footnotes',
        html: `
<pre>Here's a sentence with a footnote.[^one]

[^one]: This is the footnote text.</pre>
<p>Reuse the same <code>[^id]</code> to cite a source twice. Multi-paragraph or list content inside a footnote must be indented 4 spaces, or it breaks out of the note.</p>
<p><a href="${'' + D}/guides/footnotes.html" target="_blank" rel="noopener">Footnotes →</a></p>`
      },
      {
        title: 'Footer navigation links',
        html: `
<p>Guide readers through your docs with next/previous and related panels, written at the bottom of a page. Links are wiki-style; Sheriff resolves the paths.</p>
<pre>::: nav
next [[Tuple Bind]]
previous [[Tether]]
:::

::: nav
related [[Variables]]
related [[Scope]]
:::</pre>
<p><a href="${'' + D}/guides/navigation.html#page-navigation-blocks" target="_blank" rel="noopener">Next / previous →</a> · <a href="${'' + D}/guides/navigation.html#related-pages" target="_blank" rel="noopener">Related pages →</a></p>`
      }
    ]
  },

  portals: {
    title: 'About portals',
    docs: D + '/guides/portals.html',
    sections: [
      { title: 'Build output', html: '<p>Build a portal from its card to see its full output in the log beside the portal list. The heading names the portal being built. Successes and failures show both standard output and error output, with exit code and elapsed time. On smaller screens the log appears below the cards. Use Copy log to copy the complete result.</p>' },
      {
        title: 'What is a portal?',
        html: `
<p>A portal is an independent site living in your workspace. Each has its own content, theme, navigation, and config — one workspace can hold a docs site, a blog, and a wiki side by side.</p>
<p>Source lives in <code>site/portals/{name}/</code>. Building compiles it to <code>dist/{name}/</code>, served at <code>{name}.localhost:5173</code>.</p>`
      },
      {
        title: 'Names',
        html: `
<p>Portal names become subdomains: lowercase letters, numbers, and hyphens only. <code>admin</code>, <code>api</code>, and <code>public</code> are reserved by Sheriff Desk.</p>`
      },
      {
        title: 'Deleting',
        html: `
<p>Deleting a portal removes both its source folder and its built output. There is no undo — you must type the portal's name to confirm.</p>`
      }
    ]
  },

  media: {
    title: 'Managing media',
    docs: D + '/guides/images.html',
    sections: [
      {
        title: 'Where files live',
        html: `
<p>Everything here is your portal's <code>public/</code> folder, copied verbatim into the built site. Organize with subfolders — <code>public/images</code>, <code>public/avatars</code>, <code>public/images/blog</code> — and uploads land in whatever folder you're viewing.</p>`
      },
      {
        title: 'Using files in content',
        html: `
<p><em>Copy tag</em> on any image gives you a ready scaffold:</p>
<pre>[[image:blog/mtg-goblin.png|SIZE|ALIGN|CAPTION]]</pre>
<p>Non-image files get <em>Copy path</em> — a plain URL like <code>/public/docs/manual.pdf</code>. Blog frontmatter fields (<code>author_avatar</code>, <code>thumb</code>) also point at files in <code>public/</code>.</p>`
      },
      {
        title: 'When files go live',
        html: `
<p>Uploads trigger a build automatically, so new files are immediately servable. A thumbnail reading "not built yet" means the portal hasn't been built since that file appeared.</p>`
      }
    ]
  },

  navigation: {
    title: 'Editing navigation',
    docs: D + '/guides/navigation.html',
    sections: [
      {
        title: 'The two rules',
        html: `
<p>Everything lives under one <code>menus:</code> key, and there are only two rules:</p>
<p><strong>A string value is a link. A map value is a group.</strong></p>
<pre>menus:
  header:
    Features: features.html
    Docs:
      Overview: docs/index.html
      Getting Started:
        Installation: docs/getting_started/installation.html</pre>
<p>Nesting creates hierarchy — groups become dropdowns in the header, trees in the sidebar. Nest as deep as you like (deep nests may need CSS attention).</p>`
      },
      {
        title: 'The standard menus',
        html: `
<p><code>header</code> — top navigation, supports dropdowns. <code>left_docs</code> — the docs sidebar tree. <code>footer_left</code> / <code>footer_right</code> — footer link groups.</p>
<p>External URLs work the same way as internal paths. An empty <code>""</code> value makes a non-clickable label:</p>
<pre>footer_left:
  © 2026 My Site: ""
  built with Goblin: https://goblinlang.org</pre>
<p>You can add your own menus (e.g. <code>left_wiki</code>) but must wire them into layouts and style them yourself.</p>`
      },
      {
        title: 'Next / previous / related',
        html: `
<p>Separate from nav.yall: page-level navigation you write <em>inside content</em>, usually at the bottom of a page. Links are wiki-style; Sheriff resolves the paths.</p>
<pre>::: nav
next [[Tuple Bind]]
previous [[Tether]]
:::

::: nav
related [[Variables]]
related [[Scope]]
:::</pre>
<p>nav.yall defines the <em>site structure</em>; these blocks define the <em>learning path</em>.</p>
<p><a href="${'' + D}/guides/navigation.html#page-navigation-blocks" target="_blank" rel="noopener">Next / previous →</a> · <a href="${'' + D}/guides/navigation.html#related-pages" target="_blank" rel="noopener">Related pages →</a></p>`
      },
      {
        title: 'Naming tip',
        html: `
<p>Sheriff prefers underscores in directories and file names: <code>docs/getting_started/…</code> not <code>getting-started</code>. Keep labels short — nav is for scanning, not reading.</p>`
      }
    ]
  },

  themes: {
    title: 'Themes',
    docs: D + '/guides/themes.html',
    sections: [
      {
        title: 'How themes work',
        html: `
<p>Themes live in <strong>Sheriff core</strong>; your portal just picks one in <code>config.yall</code> (<code>theme: name:</code>) — which is what clicking a card here does. Sheriff ships with <code>outpost</code> and <code>siegemate</code>.</p>
<p><strong>Layouts</strong> (the HTML shells) belong to the theme in core. <strong>Templates</strong> (slot wiring) and <strong>override.css</strong> belong to your portal — so switching or upgrading a theme never eats your customizations.</p>`
      },
      {
        title: 'templates.yall (slot wiring)',
        html: `
<p>Each layout exposes named <em>slots</em>; your template says which <em>tokens</em> fill them:</p>
<pre>layouts:
  docs:
    slots:
      HEADER_NAV:
        - "SCOUT::header_DROPDOWN"
      SIDEBAR_MAIN:
        - "SCOUT::BREADCRUMBS"
        - "SCOUT::TOC"</pre>
<p>Editing a template means rearranging tokens between slots, or reordering the list within a slot. Keep a copy of the default so you can revert. Each theme has its own templates.yall in your portal, so if you use both themes, maintain both files.</p>
<p><a href="${'' + D}/guides/templates.html" target="_blank" rel="noopener">Templates →</a></p>`
      },
      {
        title: 'Hiding a slot',
        html: `
<p>To hide something, <strong>do not delete its slot</strong> — a missing slot is treated as an unresolved layout placeholder and breaks the page. Instead, replace the token with the built-in <code>GOBLIN::EMPTY</code>:</p>
<pre>VERSION:
  - "GOBLIN::EMPTY"</pre>
<p>The slot stays in the layout but renders nothing — e.g. a wiki with no version badge. This keeps the layout contract intact while producing no output.</p>`
      },
      {
        title: 'override.css',
        html: `
<p>Your portal's custom CSS. The layout links the theme stylesheet first, then <code>override.css</code> — so anything you write here wins, guaranteed, without touching the shared theme. Colors, spacing, component tweaks all go here.</p>`
      }
    ]
  },

  config: {
    title: 'Site configuration',
    docs: D + '/guides/config.html',
    sections: [
      {
        title: 'What this file does',
        html: `
<p><code>config.yall</code> is your site's identity: its name, active theme, branding, and routing. Because these values affect every page, saving here rebuilds the whole portal.</p>`
      },
      {
        title: 'The parts you change',
        html: `
<pre>name: "My Site"        # display name

theme:
  name: "outpost"      # or "siegemate"
  brand_name: "…"      # shown in the header
  logo: "logo.png"     # from public/
  favicon: "favicon.ico"
  highlight_dark: "base16-ocean.dark"
  highlight_light: "InspiredGitHub"

repo:                  # feeds the repo badge
  url: "https://github.com/you/repo"</pre>
<p>Leave <code>id</code> and the <code>routing:</code> block alone unless you know exactly why you're changing them.</p>
<p><a href="${'' + D}/guides/branding.html" target="_blank" rel="noopener">Site branding →</a></p>`
      }
    ]
  }

  };
})();
