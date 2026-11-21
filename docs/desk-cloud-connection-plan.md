# Local and Cloud Desk — unified account and site workflow

Updated: 2026-11-15. This replaces the earlier manual per-portal linking plan,
which the owner explicitly rejected. See [the work list](roadmap.md) and
[Desk experience direction](desk-experience-plan.md).

## Required experience

Local Desk is the offline/local version of hosted Desk. Sign in to Sheriff once
with the existing auth modal/client and the account is connected. Choose a site
through normal portal management; do not ask for another connection or a manual
portal-pairing wizard. Cloud access remains optional for offline work.

Remove the separate Cloud Sync management page and second inventory. Existing
portal/workspace UI must represent local-only, Cloud-only, and both copies, with
correct names/logos/URLs and environment-appropriate actions. Use stable site
identity internally rather than silently treating equal names as sufficient identity.
Keep Build all scoped to sources available in the current execution environment.

## Existing pieces and remaining gaps

Shared Desk UI/adapters, the shared auth modal and persistent Supabase client,
local build execution, source/output transfer, authenticated Cloud ownership checks,
R2 publication, build-state transfer, fingerprints, and recovery already exist.
The small correctness pass now verifies these as one local/hosted workflow; UX refinement follows. The rejected Cloud Sync page has been removed. Selected-portal Push/Pull and
comparison use a focused dialog; account controls stay on Dashboard, and Cloud-only
downloads appear in the existing Portals list. Preserve the tested transport and recovery.

The local and hosted sites have separate browser origins/storage. Use the same auth
client/flow with persistent refresh; never claim different origins share localStorage.
Account status must remain accurate across portal changes. No credentials belong
in portal files, source archives, build output, or URLs.

## Transfer semantics to preserve

- Push builds the selected portal locally, transfers its matching source, current
  completed output, and required build metadata, then publishes through Cloud's
  existing R2 workflow. Cloud does not build that completed output again.
- Pull downloads the selected site's source for offline editing, preserving replaced
  local source for recovery. Cloud-only sites can become local through this flow.
- Compare source fingerprints with the last successful sync. Distinguish equal,
  local-changed, Cloud-changed, and both-changed copies. Ask which complete copy to
  retain when divergent; no automatic merge or Git-style conflict UI in this phase.
- Sign-in never transfers, builds, publishes, or overwrites a portal. Keep operations
  explicitly selected and scoped; exclude unrelated portals, private build history,
  and credentials. Verify checksums, revision preconditions, and ownership server-side.
- Keep source-save, build, and upload/publication success separate, with live output
  and separate timings. Retain pending work after failures and edits during a build.

The present combined source/output transfer cap is 48 MB. This is an implementation
limit, not an account storage entitlement. Do not confuse it with plan capacity.

Collaborator roles, multi-author editing, automatic merging, and full marketplace
identity/dependency management remain separately deferred. Current Cloud rendering
stays serial until the owner decides to purchase additional cores.
## Contextual transfer UI — implemented locally, 2026-11-14

The header and Dashboard Push to Cloud buttons only open a review modal showing
the selected portal and destination. The modal reuses the shared portal picker,
including its logo and name, so the portal can be changed without closing the
review. Switching updates the active Desk portal and destination, respects the
existing unsaved-edit guard, and starts no transfer. The picker locks while a
confirmed transfer runs. Opening or closing the modal starts no build,
upload, or Cloud-site creation. Only **Build & push this portal** begins the
operation; confirmation also checks that the selected portal and account have
not changed. The action stays in the current workspace. Its dialog
shows Check changes, Build locally, and Upload & publish, with live output and
separate Sheriff/R2 timings. Closing the dialog does not cancel the operation;
View progress reopens that same transfer without starting another push. Failed
and cancelled operations remain distinct from successful publication.

The old #cloud bookmark redirects to Portals. There is no Cloud Sync sidebar
entry or duplicate Cloud sites page. Existing local portal cards expose Cloud
actions, and Cloud-only entries offer Download to Desk. Pull retains checksum,
revision-conflict and recovery checks. Account sign-in/sign-out use Dashboard's
existing Cloud card and the shared authentication client/modal.

Verified with the isolated connection browser suite, 260 hosted Desk checks,
102 Studio checks and 8 actual legacy-admin site-selection checks. Authentication,
databases and R2 are synthetic; no live portals are modified. Local Desk is
updated; Cloud source is prepared, not deployed.

Internal identity now uses the existing private account/site-ID checkpoint after
first sync, rather than reassigning a renamed local portal by its new name. A
missing or inaccessible saved Cloud ID stops transfer; it never silently targets
a different site that reused the name. Unbound local names with ambiguous Cloud
normalization are rejected before transfer. No user-facing linking step is added.
Rename migrates the checkpoint, and delete clears it locally without deleting
Cloud data. The inventory includes actual source portals; snapshot-only recovery
names cannot break account loading or become upload targets. The native lifecycle
and browser tests cover rename persistence, reloads and publication history.
