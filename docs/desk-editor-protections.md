# Shared Desk editor protections

Local and hosted Desk use the same editor guards. These changes do not build or
publish anything automatically.

- Closing or refreshing Desk warns about unsaved Content, Navigation, Config,
  Themes, Patterns, Interactive markers, edited seed plans, and new-site drafts.
  Saved files with pending builds do not count as unsaved editor buffers.
- Saves, uploads, builds, restores, and other source mutations lock the shared
  portal picker until the operation finishes. A failed operation releases its lock.
- Pattern and Interactive saves capture the submitted source. Edits made while
  the request runs remain in the editor and remain unsaved after that save.
- Content reads and inventory loads ignore superseded responses. Image changes
  cannot replace Interactive markers while a save is running.
- Successful mutations invalidate the Content inventory. Media refreshes when
  visible, Icons reload on reentry, and Interactive refreshes image/icon choices
  without clearing marker edits. Inline rename controls survive list refreshes.
- Dashboard reports the selected portal's current build/publication state and
  separate Sheriff/R2 timing. A local Push's publication result supersedes its
  intermediate local build result. A later build supersedes that transfer result.
  History is scoped to the current browser session; this is not persistent build
  history, and closing a browser cannot guarantee cancellation of server work.

Regression coverage lives in Cloud's `scripts/check-desk-protections.mjs`, called
by both `check-hosted-desk.mjs` and `check-desk-connection-ui.mjs`. The harnesses
use temporary portals, real Goblin APIs, and mocked authentication/R2. They hold
save/read/upload responses to check newer edits, stale responses, picker locks,
unsaved warnings, source-only saves, inventories, and publication status.

Deployment is separate. No production sources or public output are changed by
these fixture checks.
