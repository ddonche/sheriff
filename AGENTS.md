# Sheriff project requirements

## Local and Cloud parity — explicit owner requirement

Sheriff Desk Local and Sheriff Desk Cloud are the SAME product and must provide
the SAME user experience and behavior. This is a standing requirement, not a
future enhancement. Do not ask the owner to repeat or reconfirm it.

- Use shared Desk UI, Howdy permission logic, and editor components. Do not build
  separate local and Cloud permission workflows.
- Reuse the existing Sheriff Cloud SSO login in both environments. Local Desk
  already supports signing into the same Sheriff account. Do not invent another
  login, account identity, or per-portal account-linking requirement.
- Permissions determine what the signed-in permanent account ID may do on a
  site, portal, or page. Authentication alone is not editing authorization.
  Enforce permissions in the backend as well as the interface; localhost is not
  a substitute for checking a signed-in contributor's permissions.
- The owner MUST be able to test permissions AND front-end editing on an actual
  local website before deployment. Do not make local permission management or
  local content saves depend on an undeployed production Cloud permissions or
  content endpoint. Existing SSO remains the shared identity service.
- Environment adapters change the storage/publication destination, not the
  permission workflow: local edits write local source and build the local page;
  hosted edits write hosted source and build/publish the hosted page.
- Front-end editing changes only the current page's content and uses its
  single-page build. It must not trigger a full-site build or grant configuration,
  theme, or permission-management access to ordinary content contributors.
- Show environment-specific controls only when their capability actually differs
  (for example, deliberate local Push to Cloud). Do not fork the shared UI merely
  because it is running locally.
- Test the same workflow in local and hosted modes. A typing fix, a mocked panel,
  or prepared Cloud source is not evidence that the complete local editing flow
  works. State exactly what was tested and what remains incomplete.

Actual repositories: `C:/Users/kc516/Desktop/sheriff` and
`C:/Users/kc516/Desktop/sheriffcloud`. Keep these parity instructions in both
repositories. This workspace is also used for task artifacts and coordination.

## Core-only upgrade contract

Sheriff is one implementation. The only Cloud-specific product adapter is R2
storage/publication. Keep Desk, module controls, Howdy policy and editing in
sheriff-core. Cloud must load those files from the installed Core; do not keep
a second implementation in the Cloud application or require a separate Desk
frontend build to apply a Core update. Reuse existing SSO. Test locally first.
