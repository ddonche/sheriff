# Mobile navigation

Implemented locally on 2026-11-13 after owner review of the three-theme prototype.
Cloud deployment is pending; production portal sources were not changed.

At widths up to 960px, Browse opens the site's existing left menu and On this page
opens the existing right sidebar. The contents list appears first, followed by the
other sidebar content. A blog sidebar uses the same right drawer. Empty sidebars
produce no control. Wiki, docs, docs_embed, admin, blog and blog_index layouts are
covered in all three public themes.

Native modal dialogs provide a backdrop and inert background. Close, outside tap
and Escape return focus to the launcher; heading links close the drawer, follow
the fragment and focus the target. Keyboard Tab remains inside the drawer. Nested
menu state and existing active-page attributes are retained because the original
nodes move into the drawer. Returning to desktop restores them to their original
positions and restores the TOC disclosure state. Without JavaScript or native
modal-dialog support, the original stacked navigation remains available.

The header's Special dropdown is touch/keyboard operable. Its navigation layer
paints above the wrapped search input and sticky mobile bar; the search results
remain available in their own header layer.

Implementation belongs to the theme modules, with no change to main.gbln or the
build schedules. Brindle adds the browser script to layouts containing Sheriff's
main layout classes and includes shared navigation CSS before portal override.css.
Stagehand refreshes both assets during full builds. A single-page build supplies missing assets and refreshes changed active-theme
CSS/header CSS and navigation assets without pre/post schedules or rebuilding
other pages. This prevents new markup from using an older generated stylesheet. Existing
portal templates inherit this without layout-file copies. Rebuild a portal to
regenerate its pages/assets; browsers may need a refresh to discard cached CSS/JS.

Source files:

- sheriff-core/modules/brindle_themes/sheriff-mobile-navigation.js
- sheriff-core/themes/mobile-navigation.css
- sheriff-core/modules/brindle_themes/brindle.gbln
- sheriff-core/modules/stagehand/stagehand.gbln

Validation:

- tests/test-mobile-navigation.cjs: 373 checks using real Goblin-rendered layouts,
  all three themes, light/dark, 320/390/768/1280px, nested menus, focus, heading
  links, desktop restoration, Special hit testing and no-JavaScript fallback.
- tests/test-single-page-build.cjs: 22 schedule-only build checks, including stale-theme CSS recovery,
  required navigation assets in otherwise empty output and preservation of
  unrelated generated files and source files.
- tests/test-content-tabs.cjs: 20 rendering checks. Refreshed its old standalone
  fixture's output-path dependency and builtin prefix for Goblin 0.51.26.
- Visual review of the actual Programming/Odin page sample in all three themes;
  all Special links remain visible and clickable over the search row.
