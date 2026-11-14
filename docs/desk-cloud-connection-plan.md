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

A source transfer followed by Cloud build keeps hosted editable files current;
publishing built output alone leaves Cloud source unchanged. Owner choice is
pending. Do not silently choose or copy all local portals. Existing production
source is authoritative until the owner deliberately links/transfers selected
local content. Keep private retained outputs, snapshots and credentials out.

Authentication discovery: the repo has a legacy /cli-login token-in-query relay,
and a newer public OIDC provider whose app tokens deliberately have identity-only
authority. Public OIDC tokens cannot be treated as Cloud-data access tokens.
Use a deliberate internal Desk authorization path, with an origin-bound,
nonce-verified handoff. Do not put long-lived tokens in URLs or expose R2/service
credentials to local Desk. New Sheriff backend feature logic stays in Goblin;
frontend behavior may use JavaScript. Existing helper limitations remain deferred.

Do not expand this into collaborator roles, multi-author edits, marketplace login,
full two-way synchronization or unrelated site changes. Those remain separate work.
