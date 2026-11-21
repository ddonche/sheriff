# Desk module panels — API v1

Modules is the catalog of installed modules and glams that declare Desk controls. Active modules appear first, followed by inactive modules, alphabetically within each group. Search and All/Active/Inactive filters narrow the catalog. Activate/Deactivate, Settings and available Updates are text actions; Deactivate is red and Activate is teal. Select a module name or Settings to open its control panel, with **Modules** returning to the catalog. The workspace does not display a build log. Module code is not mounted while browsing the catalog.

Activation changes the shared configuration buffer. **Save** persists it without building; **Save & rebuild** uses Desk's existing build action. Standalone settings use the portal's `config.yall`; grouped sites currently use the parent `site.yall`. Custom actions receive the selected portal separately. Opening, closing or retrying a panel does not build or publish anything.

## Module package

Place these files inside the installed module directory. Glams use the same structure under `glams/<name>`.

```text
modules/example/
  desk.yall
  admin/
    panel.js
    panel.gbln
```

No changes to Desk's JavaScript, its operation list, or Sheriff's build runner are needed to register another module. All discovery and backend dispatch are in Goblin's `modules/desk_modules/panels.gbln`.

```yaml
api_version: 1
name: Example
version: 1.0.0
icon: puzzle
scope: site
description: What this module adds to the website.
activation: enabled
updates: https://example.org/releases
settings:
  enabled:
    type: boolean
    section: example
    key: enabled
    label: Enable Example
    description: Add this feature to the website.
    default: false
panel:
  entry: admin/panel.js
  handler: admin/panel.gbln
  actions: [inspect]
  icons: [refresh-cw]
```

`activation` names one declared boolean setting. A module without a declared activation setting is shown as always active; Desk cannot safely disable arbitrary build dependencies. The module's scheduled actions must honor its own enabled setting. Declaring a switch alone does not alter the build schedule.

`panel` is optional: modules with simple declared settings need no custom JavaScript. `handler` and `actions` are optional for panels that need no server actions. Entries are self-contained ES modules; v1 does not resolve relative imports from the dynamically loaded entry. Bundle additional browser dependencies into that entry.

`updates` is an optional HTTPS release-information link. It does **not** claim to detect or install a newer package. When absent, Update is disabled with an explanation; bundled modules update with Sheriff. Automatic registry checks, package installation, dependency resolution and Glamr integration remain future work. There is no new marketplace or upload service in this change.

## Navigation contract

All module settings belong under **Modules → module panel**. Modules must render controls only inside `context.container`; they must not add, rename or reorder Desk sidebar items, create top-level workspaces, or place settings elsewhere. Desk owns its navigation, and the panel API offers no sidebar-registration hook. This is an authoring requirement for trusted installed code, not a JavaScript security sandbox.

## Browser interface

Export `mount(context)` from `admin/panel.js`. Desk calls it only when the module is opened. It may be async and may return a cleanup function.

```javascript
export async function mount({container, portal, ui, request, signal}) {
  const status = ui.message('Loading…');
  const refresh = ui.button('Refresh', load);
  refresh.prepend(ui.icon('refresh-cw'));
  container.append(refresh, status);

  async function load() {
    refresh.disabled = true;
    try {
      const data = await request('inspect', {});
      if (!signal.aborted) status.textContent = data.message;
    } catch (error) {
      if (!signal.aborted) status.textContent = error.message;
    } finally {
      if (!signal.aborted) refresh.disabled = false;
    }
  }
  await load();
}
```

Context contains:

| Property | Purpose |
| --- | --- |
| `apiVersion` | Interface version, currently `1` |
| `container` | Module panel's DOM element |
| `portal`, `site` | Selected portal ID and parent site's display name |
| `mode` | `local` or `cloud` |
| `settings` | Current declared setting values, including unsaved buffer changes |
| `signal` | Aborted on close, navigation, portal change or remount |
| `request(action, payload)` | Calls this module's declared Goblin handler |
| `ui` | Shared Desk control builders and declared bundled Lucide icons |
| `services` | Existing authenticated Desk backend and, locally, signed-in Cloud connection |

`ui.node(tag,text,className)`, `ui.button(label,onClick,className)`, `ui.field(label,options)`, `ui.message(text)` and `ui.icon(name)` use Desk's existing styles. `ui.field` returns `{element,input}`. Icons must be listed under `panel.icons`; they are loaded from Sheriff's bundled Lucide assets. Use shared controls, CSS variables and semantic labels rather than shipping another visual design system.

Release subscriptions, timers and other resources in the returned cleanup function or on `signal.abort`. Ignore late results after abortion. Desk recreates the panel after configuration changes, so synchronize meaningful edits through a declared setting or explicit module action rather than relying on transient DOM state.

## Goblin action interface

`admin/panel.gbln` is a normal Goblin program. It receives a JSON file containing `{action,payload}` through `GOBLIN_REQUEST_FILE`, and returns one JSON object on stdout. Use stderr for diagnostics. Return `{ok:false,stderr:message}` for a recoverable error.

```goblin
request | :read_json(:env("GOBLIN_REQUEST_FILE"))
portal | :env("SHERIFF_MODULE_PORTAL")
if request{"action"} == "inspect"
    :say(:json_stringify({"ok":true,"message":"Ready for " + portal}))
else
    :say(:json_stringify({"ok":false,"stderr":"Unknown action."}))
xx
```

The handler runs from `sheriff-core`, so existing module imports work. Context also includes `SHERIFF_MODULE_ID`, `SHERIFF_ROOT` and `SHERIFF_RUNTIME_MODE`. Cloud supplies the authenticated `SHERIFF_ACCESS_SUBJECT` and owner flag; these are not taken from the request body. Local Desk is the trusted local workspace, not a signed-in Cloud owner. Do not treat a blank local owner flag as Cloud authorization.

Requests can select only installed module IDs and explicitly declared actions. Module-relative entry paths reject traversal and shell syntax. Cloud verifies ownership of the selected site and runs module actions in its existing per-site queue. Contributors do not gain access to these management endpoints. Local action requests require local Desk's loopback origin. Module handlers must still validate their payloads and use safe paths for files they manage.

Installed modules are trusted executable code. This interface is not a sandbox for arbitrary public submissions. Marketplace verification and installation policy must precede accepting third-party uploads on Cloud. No credentials belong in module declarations, source files, or generated sites.

## Howdy

Howdy's declaration is `modules/howdy/desk.yall`; its control panel is `modules/howdy/admin/panel.js`. Its panel reuses the existing Cloud connection and access endpoints. The content editor's page lock remains beside Save, independently of the module catalog.

Cloud access controls need the corresponding Cloud API deployment. A failed load disables grants, displays a useful connection/service message, and offers Retry. It never displays an empty editor list as though permissions had loaded successfully.

## Validation

`tests/test-module-panels.cjs` exercises real Goblin discovery, activation-buffer patches, panel loading, a separate example module's Goblin action, authenticated Cloud isolation, local-origin rejection, browser mount/unmount cleanup, network failure/retry, and both local and Cloud UI paths. `tests/test-modules-gallery.cjs` additionally checks the full Desk configuration and multisite flow.
