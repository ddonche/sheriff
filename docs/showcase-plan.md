# Sheriff Cloud — Website Showcase

Feature: **Made with Sheriff**

Priority: **Sheriff Cloud launch feature**

Status: **Roadmap only. Do not begin implementation until Sheriff's core
functionality is stable.** This plan does not authorize registration, publication,
deployment, or changes to existing websites.

## Goal

Demonstrate real websites built with Sheriff and encourage users to share their
work. Provide a public Showcase gallery that updates automatically from stored
listings, with no routine manual administration.

## Desk workflow

Each site's settings include an opt-in checkbox:

**[ ] List this website in the Sheriff Showcase**

Submission is available only for published, publicly accessible Sheriff websites.
Desk sends the site title, public URL, description, site type, and unique site
identifier to Sheriff Cloud. Site types include wiki, documentation, blog,
business, and portfolio.

Use existing Sheriff Cloud sign-in. Verify control of the published website using
a unique registration token placed in its generated files. Do not require Sheriff
Cloud hosting or Goblin on the site's hosting server; the verification metadata
must work with ordinary static hosting.

Through the same Desk settings, owners can enable or disable participation,
update their public URL and metadata, and remove their listing. Changes synchronize
with Sheriff Cloud. Reuse the shared local/Cloud Desk rather than creating a
separate submission experience.

## Small Cloud API and stored listings

Reuse existing Cloud authentication and storage for registration, updates, removal,
verification status, and screenshot references. Do not create a separate application,
CMS, or public website submission form.

Ordinary submissions require no manual approval. Include basic duplicate
prevention, rate limits, and an administrator removal control for abuse. Automatic
checks must respect an owner's opt-out or administrator removal instead of
relisting it merely because the website is online.

## Screenshots and automatic monitoring

Capture a standardized screenshot of the homepage automatically and associate it
with the listing. No manual image upload or manually created showcase entry is
required. Refresh screenshots periodically, initially about every 30 days.

Run a daily scheduled check for public accessibility and the site's Sheriff
registration metadata:

- Online and verified: keep visible.
- Temporarily unavailable: retry automatically.
- Offline for seven days: hide from the public gallery.
- Back online: restore automatically after verification, unless the owner opted
  out or an administrator removed the listing.

Keep this automated without routine manual gallery maintenance.

## Public Showcase page

Display active listings in a responsive, accessible gallery with a screenshot,
title, description, site type/category, and link to the live website. Provide
category filters for Wiki, Documentation, Blog, Business, and Portfolio.

Read the gallery from stored listings so additions, updates, and removals do not
require manually editing the Sheriff Cloud website.

Prominently explain:

> **Built something with Sheriff?**
>
> Open your website in Sheriff Desk, enable *List in Showcase*, and your site will
> be added automatically.

## Initial launch listings

Register these existing sites once their public availability and owner control
are verified, using exactly the same Desk workflow as everyone else:

- Programming wiki
- Goblin documentation
- Sheriff documentation
- Vekke documentation
- Everwind

Add Rainwall and Six documentation when publicly available. Do not hardcode or
manually insert these showcase entries.

## Sheriff Cloud public website launch requirements

Provide polished, accessible sections for:

- **Features:** what Sheriff can build and why someone would use it.
- **Documentation:** installation, tutorials, configuration, and publishing.
- **Downloads:** installers and packages for supported operating systems.
- **Showcase:** real websites created with Sheriff.
- **Getting Started:** a clear path from downloading Sheriff to publishing a site.

## Scope and acceptance

Keep the implementation small and reuse existing Sheriff/Cloud infrastructure.
Use Goblin for Sheriff-side backend/build behavior and JavaScript for frontend
behavior, following the existing architecture. This is not a new marketplace,
package manager, or CMS.

Before launch, verify the complete opt-in, ownership check, screenshot, listing,
metadata-update, opt-out/removal, offline-hide, and online-restore workflow against
both Cloud-hosted and externally hosted static Sheriff websites. Check duplicate
prevention, rate limits, administrator removal, and accessible category filtering.
Implementation remains deferred until core functionality is stable.
