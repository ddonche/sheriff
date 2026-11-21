# One Sheriff Core package

Desk's HTML, styles, editor, module controls, existing hosted gateway and sync
bridges are owned by this Core package. Howdy's permission policy and source
content rules are Goblin modules. The existing Node transport has been moved,
not replaced by another backend implementation.

Cloud's former Desk files are compatibility imports. They must not acquire
product logic. Cloud still supplies the existing SSO/site-account integration
and R2 publication service to the packaged handler.

## Updating

After testing and reviewing Core changes, package their inventory from the
Sheriff checkout:

    node sheriff-core/desk/admin/server/release.mjs pack

Replace sheriff-core in Cloud with that tested package. The embedded
core-release.json supplies its file inventory and required Goblin version.
The old Cloud root lock may remain; the installed Core manifest takes precedence.
Verification checks content and the exact file inventory. Goblin is reused.

On startup Cloud exports the installed Core's Desk into dist/desk. A separate
build of the Cloud frontend is not required for a Desk/Core update. The existing
Cloud application, site sources and R2 files are not replaced by this export.
This bootstrap migration must be deployed once before that update path is live.

Neither admin/server nor admin/requests is exported as browser assets.

## Permissions

The Howdy panel uses SheriffDeskBackend.request in both hosts. Local operations
use the installed Goblin endpoint, not the production Cloud permissions endpoint.
Username lookup uses the existing public Sheriff account directory and stores
the permanent ID. service.json contains only the same public project URL and
anonymous public key used by the existing SSO frontend; no user session is stored.

The policy is either owner plus approved editors, or any signed-in Sheriff
account. Page locks apply in either mode. This does not, by itself, complete the
public page editing UI: that workflow must still be wired and tested on a real
local site before it is called ready.
