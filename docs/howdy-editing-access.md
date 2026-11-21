# Howdy editing access and shared frontend editor

Implemented locally, with matching Sheriff Cloud source prepared. Not deployed.

## Owner controls

- Desk → Content → open a Markdown page → Lock page / Unlock page beside Save.
- Desk → Modules → Howdy → Portal editing access. Choose approved contributors
  or all signed-in Sheriff accounts. Approved access resolves a username once and
  stores the permanent account ID; changes to usernames do not change access.
  Local Desk uses its existing Cloud sign-in and the same Goblin policy.
- Permission changes are immediate. They do not build or publish a site.
- A local page lock protects the local workspace. Online locks protect Cloud.
  Permission state is not copied with a portal or included in published output.

These controls use the existing Desk form/button styles and bundled Lucide icons.
Local source files remain under their owner's control; this cannot prevent edits
made directly on disk.

## Ownership and storage

The host verifies the existing Sheriff account and site ownership. Only an owner
can grant/revoke access or manage locks. Username lookup happens in Cloud; a
client-supplied user ID cannot grant itself access. Howdy's Goblin policy module
receives trusted identity through the request driver's environment.

State lives outside portal source:

- Local: `data/.desk/howdy/{portal}/access.json`
- Cloud: `site/.desk/howdy/{portal}/access.json` on the existing persistent volume

An editor grant covers page content in one portal. It does not grant access to
Desk configuration, themes, permission controls, bulk source transfers or full-site
builds. A page lock covers every revision/documentation version of its logical
article. The owner unlocks before editing. Saved content can still be built.

## Narrow content API

The hosted gateway provides `content.read` and `content.save`. The local native
Goblin endpoint `/api/page_content` invokes the same Goblin policy after verifying
the same Sheriff SSO identity. No production Cloud content endpoint is needed for
local saves. Both require a selected site/portal and a Markdown source
path. Read returns editable body, the original source as a comparison base, and
capabilities. Save receives `path`, `base`, and `body`; Howdy compares the original
source and writes the new body while preserving the frontmatter bytes exactly.

Every operation goes through the existing per-site queue, including a permission
recheck after waiting. Two editors saving the same base cannot silently overwrite
each other: the later save receives a conflict. The caller retains its unsaved
buffer. Locks and revocations also apply to already-open editors on their next
request. Normal Desk content saves now supply a comparison base as well.

On a successful content save, the existing single-page build and upload run. No
pre/post portal schedule is requested. Build and upload progress/timing remain
separate. A failed build or upload leaves the source saved and pending. Ordinary
Save in Desk still saves source only.

A full-site build uses the same site's queue. Editors may continue typing during
it; their saved operations wait. Separate sites have separate queues. This is a
single Cloud server process design; distributing writes across multiple machines
will require a shared queue/lock before that deployment model is enabled.

## Local frontend test

1. Open local Desk, select a portal and sign into your existing Sheriff account.
2. Open Modules → Howdy. Enable Howdy and select the editing policy. Visiting this
   trusted local management panel records your verified account as local owner.
3. Build the portal to emit the updated Howdy assets and page metadata. Open an
   ordinary article and sign in there through the existing Sheriff SSO.
4. Edit page appears beside the account control only after authorization. It opens
   the existing Desk Visual/Source editor. Save & build page preserves the exact
   frontmatter and runs only that page schedule. Cancel leaves source unchanged.

The frontend host currently excludes metadata/version controls and asset-library
management insertions. Existing text, links, tables, code, callouts and video
controls reuse Desk components. Temporary reservations while typing are not yet
implemented; compare-and-save rejects stale saves. A full build and page saves
share the output lease so a failed build releases the resource for a retry.

## Before public contributor release

- Harden untrusted article content. The current Markdown renderer permits raw HTML;
  public contributor editing must not ship without a reviewed HTML/URL safety
  policy and tests against stored script injection. Local trusted-owner testing
  does not establish that untrusted publication is safe.
- Before releasing that public workflow, review/retire the older non-Desk source
  upload entry points so they follow the same mutation queue and lock policy.
- Validate this change on Linux before deployment. Browser checks currently use
  synthetic accounts and a simulated R2 transport, not production users or sites.
- Later: temporary editing leases, roles, delegated portal administration,
  site-local public profiles and activity history.

## Verification

From Sheriff, with Goblin 0.51.26 on PATH:

```
node tests/test-frontend-editing.cjs
node tests/test-howdy-shared.cjs
node tests/test-desk-live-build.cjs
node tests/test-desk-retained-build.cjs
node tests/test-howdy-access.cjs
node tests/test-howdy-local.cjs
node tests/test-howdy-controls.cjs
```

The browser test accepts `SHERIFF_PLAYWRIGHT_MODULE` and `SHERIFF_CHROME`.
From Sheriff Cloud:

```
node scripts/check-howdy-access.mjs
node scripts/check-hosted-desk.mjs
```

Tests use disposable sites. They do not publish production content. Policy stays
in `sheriff-core/modules/howdy/access.gbln`; Desk drivers stay under
`sheriff-core/desk/admin/requests`, and the generic build runner is unchanged.

The frontend regression uses real Goblin HTTP, policy, source writes and page
builds on all three themes and multisite paths. Identity transport is a fixture,
and hosted uploads simulate R2. It does not test real Google login or R2 latency.
