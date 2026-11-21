# Howdy

Optional Sheriff Cloud authentication for public Sheriff headers. This Goblin module uses Sheriff Cloud's registered OpenID Connect sign-in and existing account forms. It grants no content-editing permissions.

For a standalone portal, enable it in `config.yall`. For a grouped site, enable it once in the parent's `site.yall`:

```yall
howdy:
  enabled: true
```

Desk's Config panel exposes the same switch. Switching it changes the editor buffer; Save persists it, and a rebuild updates the generated website. Grouped portal configuration points users to Site config.

All bundled full-header layouts place `{{{HOWDY::ACCOUNT}}}` beside the theme control. Grouped pages use the parent header once. Headerless layouts stay headerless. Without `enabled: true`, no auth client or Howdy assets are referenced in the page.

`howdy::apply` runs in the ordinary page schedule, including single-page builds. It copies its small browser loader and theme-aware stylesheet into the output. Parent overview pages use the same renderer through the site module. The build kernel contains no Howdy-specific code.

The browser loads Cloud's public `/howdy/client.js` bundle. That client uses the
registered Sheriff Howdy application with authorization code + PKCE (`S256`),
`state`, and `nonce`. Only Howdy-scoped identity credentials are stored on the
website origin. They cannot access Sheriff Cloud's database or storage. No
credentials or user sessions are written into source or generated site files.

The fixed Cloud callback relays a short-lived authorization code to the initiating
page; the page's private PKCE verifier stays in that tab. The client verifies the
ID-token signature, issuer, audience, expiry and nonce, checks UserInfo's subject,
and restores the original query and anchor. Refresh tokens rotate under a shared
browser lock. Signing out clears this site's Howdy session, leaving the Cloud
account signed in. Cloud's consent screen manages the user's grant.

Account settings open Cloud's existing forms in a separate, theme-matched Cloud
window. Privileged Cloud sessions stay on Cloud; these forms cannot be framed.
The menu has no View profile link until site-local contributor profiles exist.
Cloud domains, registered custom domains and localhost previews are supported.
Public reading does not require login.
Permissions, contributors, front-end editing, activity history and page locks are separate follow-up work.
