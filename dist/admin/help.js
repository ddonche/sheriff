// Sheriff Desk — help drawer content
// Edit freely: each view key holds { title, docs, sections: [{ title, html }] }.
// html is trusted (authored here, not user input).
// PLACEHOLDER sections are marked — fill them with real syntax.

window.DESK_HELP = {

  content: {
    title: 'Writing content',
    docs: 'https://sheriff.sheriffcloud.com',
    sections: [
      {
        title: 'Page structure (frontmatter)',
        html: `
<p>Every page starts with a frontmatter block fenced by <code>^^^^</code>:</p>
<pre>^^^^
title: What is money?
author: Sheriff
layout: docs
meta_kind: overview
meta_type: docs
summary: A one-line description.
^^^^</pre>
<p><code>layout</code> picks the template (<code>docs</code>, <code>blog</code>, <code>home</code>). New pages created here get this block automatically.</p>`
      },
      {
        title: 'Markdown basics',
        html: `
<pre># Heading 1
## Heading 2

**bold** and *italic*

[link text](/foundations/what-is-money)

- bullet item
1. numbered item

\`inline code\`</pre>
<p>Fenced code blocks use triple backticks with an optional language for highlighting.</p>`
      },
      {
        title: 'Images',
        html: `
<p>Reference files from your portal's <code>public/</code> folder:</p>
<pre>[[image:blog/mtg-goblin.png|SIZE|ALIGN|CAPTION]]</pre>
<p>The path is relative to <code>public/</code>. Replace <code>SIZE</code>, <code>ALIGN</code>, and <code>CAPTION</code>. The Media panel's <em>Copy tag</em> button produces this scaffold for any image.</p>`
      },
      {
        title: 'Admonitions',
        html: `
<p>Callout boxes for asides. Seven types: <code>note</code>, <code>tip</code>, <code>warning</code>, <code>important</code>, <code>example</code>, <code>strategy</code>, <code>lore</code>.</p>
<p class="help-todo">PLACEHOLDER — add the admonition markup syntax here.</p>`
      },
      {
        title: 'Spoilers',
        html: `
<p class="help-todo">PLACEHOLDER — add spoiler syntax here.</p>`
      },
      {
        title: 'Footnotes',
        html: `
<p class="help-todo">PLACEHOLDER — add footnote syntax here.</p>`
      }
    ]
  },

  portals: {
    title: 'About portals',
    docs: 'https://sheriff.sheriffcloud.com',
    sections: [
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
    docs: 'https://sheriff.sheriffcloud.com',
    sections: [
      {
        title: 'Where files live',
        html: `
<p>Everything here is your portal's <code>public/</code> folder, copied verbatim into the built site. Organize with subfolders — <code>public/images</code>, <code>public/images/blog</code>, <code>public/docs</code> — and uploads land in whatever folder you're viewing.</p>`
      },
      {
        title: 'Using files in content',
        html: `
<p><em>Copy tag</em> on any image gives you a ready <code>[[image:…]]</code> scaffold to paste into a page. Non-image files get <em>Copy path</em> — a plain URL like <code>/public/docs/manual.pdf</code> for regular markdown links.</p>`
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
    docs: 'https://sheriff.sheriffcloud.com',
    sections: [
      {
        title: 'How nav.yall works',
        html: `
<p>All menus live under one <code>menus:</code> key. Each named menu is rendered by the theme in a specific spot:</p>
<pre>menus:

  header:
    Home: index.html
    Guide: guide/intro.html

  left_docs:
    PAGES:
      Home: index.html
      Setup: guide/setup.html

  footer_left:
    Built with Sheriff: ""
  footer_right:
    GitHub: "https://github.com/you"</pre>`
      },
      {
        title: 'The pieces',
        html: `
<p><code>header</code> is the top bar. <code>left_docs</code> is the docs sidebar — its UPPERCASE keys are section headings with pages nested under them. <code>footer_left</code> / <code>footer_right</code> are the footer columns.</p>
<p>Entries are <code>Label: url</code>. Internal links point at built paths like <code>guide/setup.html</code>; external links use full URLs; an empty <code>""</code> renders as plain text.</p>`
      }
    ]
  },

  themes: {
    title: 'Themes',
    docs: 'https://sheriff.sheriffcloud.com',
    sections: [
      {
        title: 'Switching themes',
        html: `
<p>Click a theme card to switch this portal and rebuild. Your content is untouched — only the look changes. Sheriff copies the theme's default <code>templates.yall</code> into your portal the first time you switch to it.</p>`
      },
      {
        title: 'templates.yall (layout slots)',
        html: `
<p>Each layout (<code>docs</code>, <code>blog</code>, <code>home</code>…) is a map of named slots to the components that fill them:</p>
<pre>layouts:
  docs:
    slots:
      HEADER_NAV:
        - "SCOUT::header_DROPDOWN"
      LEFT_NAV:
        - "SCOUT::left_docs_SIDEBAR"</pre>
<p>Remove a component to hide it, reorder the list to rearrange. This file is per-portal, so edits here don't affect your other sites.</p>`
      },
      {
        title: 'override.css',
        html: `
<p>Your portal's custom CSS, loaded <em>after</em> the theme's stylesheet — anything you write here wins. Colors, fonts, spacing tweaks all belong in this file rather than in the theme itself, so theme updates never overwrite your changes.</p>`
      }
    ]
  },

  config: {
    title: 'Site configuration',
    docs: 'https://sheriff.sheriffcloud.com',
    sections: [
      {
        title: 'What this file does',
        html: `
<p><code>config.yall</code> is your site's identity: its name, active theme, branding, and routing. Because these values affect every page, saving here rebuilds the whole portal.</p>`
      },
      {
        title: 'The keys',
        html: `
<pre>id: my-site          # internal id (folder name)
name: "My Site"      # display name

theme:
  name: "outpost"    # active theme
  brand_name: "…"    # shown in the header
  logo: "logo.png"   # from public/
  favicon: "favicon.ico"

routing:
  dist_root: "my-site"
  content_dir: "content"
  public_dir: "public"</pre>
<p>The <code>repo:</code> block feeds the repo badge if your theme shows one. <code>highlight_dark</code> / <code>highlight_light</code> pick code-highlighting styles.</p>`
      }
    ]
  }
};
