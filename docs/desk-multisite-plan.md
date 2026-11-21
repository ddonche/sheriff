# Desk and the new-site wizard: multisite integration

Status: first local Desk/wizard implementation completed 2026-11-17.
Real Goblin API and browser checks cover creation, adding portals, selection,
scoped builds and standalone compatibility. Grouped Cloud publication, site-level
settings and grouped portal rename/removal are still follow-up work.

## One Desk, two levels of selection

Keep the existing Desk workspaces and editor. A site is the public website/domain;
a portal is a content area inside it. The top context area shows the site identity
and icon, then the active portal and icon. A standalone site automatically selects
its only portal, so it does not acquire an extra required selection step.

The current Portals panel should group portals beneath their owning site. Retain
standalone sites alongside grouped sites; do not automatically combine existing
portals. Existing account sign-in remains account-wide, with no per-portal linking.

Content, Media, Patterns, Navigation and portal themes operate on the selected
portal. Site identity, public address, directory/home and portal membership belong
to site settings. Make this scope visible using the existing Desk styling and
Lucide icons rather than adding a separate administration application.

## Extend the existing new-site wizard

1. Choose a standalone site or a site with multiple portals.
2. Reuse the existing name/address, theme and logo steps for the site.
3. For a grouped site, add named portals with a visible route preview such as
   /p/programming/. New portals may use the site's theme by default; allow explicit
   portal themes. Do not silently absorb existing standalone sites.
4. Reuse the first-page step for the initial wiki content. Explain the separate
   site home, portal home and wiki home through previews rather than extra jargon.
5. Review the site and portal list, then create the source. Keep building optional,
   as it is in the current wizard. Saving source must not publish a site.

Adding a portal later belongs in the selected site's Portals panel using the same
creation controls. Existing source directories and public portal slugs are separate
identities; the user should normally only need the public name and slug.

## Keep operation scope explicit

- Save: the open source document only.
- Build page: the selected page, using only its page schedule.
- Build portal: the active portal, preserving sibling portal output.
- Build site: an explicit site-level action for all its portals.

Cloud publishing/sync must carry the same site and portal identities and paths.
Do not pass a grouped output folder through the existing single-portal publisher.
Implement the Cloud adapter before enabling grouped-site publication in Desk.
Local and Cloud should use the same controls once each backend supports them.

## Implementation order

First show site/portal selection and grouped inventory in the existing Desk UI.
Review that locally before extending the wizard. Then wire the site's scoped build
actions, followed by Cloud routing/publication. Howdy later enforces site and portal
permissions using the current sign-in infrastructure. Preserve offline editing.


## Try the local implementation

Refresh Desk and open Portals → Guided setup (or Set up a new site on Dashboard).
Choose Multiple portals, set the site name/address, theme and optional logo, then
add the portal names and addresses. Setup automatically builds a local preview
and finishes with Open site. Adding a portal also prepares it automatically.

The header shows Site and Active portal once at least one grouped site exists.
The Portals panel groups members with Add portal and Build site actions. Existing
Content Save, Build page and Build portal controls retain their scope. Grouped
portal URLs use the owning site host and /p/<portal>/wiki/ path. All-standalone
installations retain the original single selector. Account sign-in is unchanged.

A grouped build currently returns its complete output at completion through the
existing log display; live grouped-site output is a follow-up. Ordinary standalone
builds retain their current streaming transport. Grouped source uses the existing
portal storage under site/portals and membership in site/sites/<site>/site.yall.

## Site controls and community-scale administration

The trash icon beside a grouped site lists its portals and requires the site
address as confirmation. It deletes that local site, its contained portal sources
and built output; unrelated standalone portals and Cloud sites remain untouched.
The API verifies the reviewed member list and ownership before deletion.

A site logo is stored under site/sites/<site>/public, independently of portal
logos. The setup logo belongs to the site; adding a portal with a logo assigns it
to that new portal only. Without a logo, an identity shows its own initials.

Howdy will introduce a My portals editor view and a separate searchable, paginated
All portals administration directory. Portal ownership, delegated editing and
site-wide administration are distinct permissions; filtering belongs on the server.

## Public portal appearance

Portal wiki/docs pages keep the complete existing theme header, brand, statistics,
navigation, search, sidebar and footer. A separate compact site navigation bar is
added above the portal shell, following the Iveki mockup. Its Portals link opens
the directory; it does not embed every portal in a dropdown on every page.
Headerless layouts retain their existing headerless behavior.
