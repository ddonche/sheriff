# Local Desk to Cloud — priority connection

Owner raised priority on 2026-11-13 for an anticipated YC submission the following
day. Ship a complete, verified connection; do not label a mocked UI as deployed.

The existing local Cloud Sync view is a placeholder. Cloud already mounts shared
Desk, verifies its internal session and checks site ownership/docs access on every
operation. Publishing uses its existing R2 workflow, with separate build/upload
progress. Reuse those pieces and the existing Goblin runtime.

First flow: connect from local Desk through Cloud's existing login, list authorized
sites, explicitly link one local portal to one remote site, and deploy that selected
portal with understandable progress and a live-site link. Permit disconnect and
handle expired login, denied ownership, build errors and upload failures clearly.

Owner decision: Download Cloud source for offline work; Deploy builds locally and
uploads both completed output and matching source. Cloud does not rebuild. Compare
source-content fingerprints against the last sync. If both changed, ask which
whole copy to keep; do not automatically merge. Keep replaced source recoverable.
Connecting never transfers a portal. Only the explicitly linked portal is eligible.

Implemented locally: browser authorization handoff; create/select a docs-capable
owned Cloud site; Goblin connection state and snapshot restore; browser binary ZIP
transport; authenticated, serialized Cloud publication. Access tokens stay in browser
memory. Reopening Desk remembers the site link and asks to reconnect the session.
The initial transfer limit is 48 MB combined source plus output. No billing, domain
management, collaborator roles or automatic merge UI is implemented.

Authentication discovery: the repo has a legacy /cli-login token-in-query relay,
and a newer public OIDC provider whose app tokens deliberately have identity-only
authority. Public OIDC tokens cannot be treated as Cloud-data access tokens.
Use a deliberate internal Desk authorization path, with an origin-bound,
nonce-verified handoff. Do not put long-lived tokens in URLs or expose R2/service
credentials to local Desk. New Sheriff backend feature logic stays in Goblin;
frontend behavior may use JavaScript. Existing helper limitations remain deferred.

Do not expand this into collaborator roles, multi-author edits, marketplace login,
automatic merging or unrelated site changes. Those remain separate work.
