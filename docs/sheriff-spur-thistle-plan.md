# Sheriff, Spur and Thistle integration

Agreed direction: 2026-11-13. Backlog work; no implementation or migration authorized by this document alone.

## Responsibilities

- **Sheriff** generates the published static reading experience and remains independently usable without a Spur account.
- **Spur** remains the creator platform: Studio, content management, creator profiles, Discovery and the network experience.
- **Thistle** will eventually supply dynamic interactions. Keep the working Spur/Saloon services until their replacements are ready.
- **Sheriff Cloud** can host these applications together without merging their responsibilities or requiring creators to understand the implementation.

Published blog articles, public forum topics/replies, portfolio pages, galleries, episode pages and other suitable content can become Sheriff-generated HTML. Authentication, submissions, comments, reactions, following, read state, notifications, moderation and personalized feeds remain dynamic. Static public output must never bypass access control for private content.

## Publishing contract

Use stable author/site/article IDs, revisions, content format, metadata, publication status, original-source attribution and opt-in Discovery preferences. URLs/titles are editable attributes, not identity.

Keep an explicit editable source of truth for each article. Spur-authored posts can remain in the existing database; independent Sheriff blogs can remain file-based. Generated HTML is published output. Define edit ownership and revision/conflict behavior before introducing synchronization in both directions.

Sheriff-to-Spur submissions copy the complete authorized article into Spur, where Sheriff generates its public representation. Readers can consume it on Spur; retain visible credit and the original link. Spur-to-Sheriff integration can publish an existing Spur blog on the author's independent site using the same identities.

Support updates, withdrawals, moderation and removal across copies. Rebuild only affected articles and their dependent indexes/feeds; track build/publication success separately from saving. Establish canonical URL policy independently of visible attribution. Keep the interface reusable for future integrations, including WordPress.

## Implementation boundaries

Reuse and extend **Campfire**, Sheriff's existing Goblin blog module. The optional Spur module supplies integration behavior rather than another blog-generation engine. Keep module-specific code out of the generic Core runner.

Preserve Spur's existing HTML article bodies and embeds through an explicit input format; avoid forcing them through lossy Markdown conversion. Sheriff feature logic is Goblin; browser interactions use JavaScript.

Cloud currently sends `/blog` and `/forum` to the React application. Update serving routes deliberately as static publication is enabled; generating files alone will not change what visitors receive. Preserve existing public URLs, custom domains, themes and dynamic controls. Align the work with the separately tracked shared-header/theme plan.

Preserve stable content and conversation identities so the later Thistle transition does not require republishing articles or detaching their discussions. Keep the existing authentication authority until the explicit identity migration is designed.

## Development sequence

1. **Independent blog publishing:** extend the existing Sheriff capability and define normalized publishing inputs. Support layouts, thumbnails, categories/tags and RSS; verify without a live Spur connection.
2. **Spur static blog pilot:** publish one existing public article at its existing URL/theme with the current interaction services. Verify publishing, editing, unpublishing, serving routes and dependent indexes before expanding. Preserve Studio, authentication and Discovery.
3. **Authenticated publishing integration:** connect Sheriff and Spur accounts/blogs; support full-content opt-in Discovery submissions, imports, revisions and withdrawals using the shared contract.
4. **Thistle interactions:** migrate dynamic capabilities incrementally after they work; keep existing services until each replacement is ready.
5. **Additional content/integrations:** public forum topics/replies, portfolios, galleries, episodes and downloads; WordPress integration through the same interface. Treat forum pagination, edits, moderation and new-reply behavior explicitly.

## Review evidence

The source plan was supplied by the owner on 2026-11-13. Repository inspection confirms Campfire under `sheriff-core/modules/campfire_blog`, current React blog rendering and attached comments under Cloud's `src/site/pages/BlogPost.tsx`, forum rendering under `src/site/pages/ForumThread.tsx`, and dynamic route handling in Cloud's `nginx.conf`.
