# Ordinary image viewer

Implemented locally on 2026-11-13. Cloud deployment is pending. The owner clarified
that interactive maps are already complete and are outside this change.

Click an ordinary content image to open its original/current image resource in a
modal viewer. Large images fit inside the viewport without distortion. Small
images retain their natural dimensions. Available captions/alt text appear as
plain text. Close with the close button, Escape or the backdrop; keyboard focus
returns to the original image. Enter and Space also open an eligible image.

Works with Sheriff image syntax, Markdown/HTML article images, pattern/infobox
images and focus-panel images. Explicitly linked images keep their destinations.
Branding, author-avatar and existing custom image controls are excluded. Existing
interactive images keep their own behavior; asynchronous upgrades remove the
ordinary-image affordance without replacing the interactive code. No sidecar
requests or interactive-map implementation were added.

Frontend: sheriff-core/modules/brindle_themes/sheriff-image-viewer.js.
Styles live in each of the three theme CSS files. Brindle includes the script in
supported main layouts and refreshes changed assets on page builds; Stagehand
publishes the script in full builds. No generic runner or schedule was changed.
Rebuild a page or portal to add the viewer to existing generated HTML. A browser
refresh may be needed for previously cached assets.

Validation: tests/test-image-viewer.cjs passed 147 checks across all three themes,
light/dark, desktop and phone widths, large/wide/tall/small images, infoboxes,
keyboard closing/focus, errors, dynamic images and existing control ownership.
The schedule-only page-build regression passed 22 checks. The local Everwind
Paelor article was rebuilt and its 883-by-883 portrait was opened and visually
verified on desktop and phone. Interactive-map source files were not changed.
