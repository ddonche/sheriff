# Focused regression checks. Runs isolated link functions, never a site build.
param([switch]$UseSafeCanonicals)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ('sheriff-hash-links-' + [guid]::NewGuid().ToString('N'))
$core = Join-Path $fixture 'sheriff-core'
$portal = Join-Path $fixture 'site\portals\hash-link-fixture'
New-Item -ItemType Directory -Path $core,$portal -Force | Out-Null
foreach ($relative in @('modules\trailboss_wiki\routes_json.gbln','modules\trailboss_wiki\trailboss.gbln','modules\scout_nav\scout.gbln')) {
    $dest = Join-Path $core $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path "$repoRoot\sheriff-core" $relative) -Destination $dest
}
$routes = @(
    @{canonical_slug='c';slug='c';href='/languages/c.html';aliases=@()},
    @{canonical_slug='c#';slug='csharp';href='/languages/csharp.html';aliases=@('C sharp','C# language')},
    @{canonical_slug='f#';slug='fsharp';href='/languages/fsharp.html';aliases=@('F sharp')},
    @{canonical_slug='c++';slug='cpp';href='/languages/cpp.html';aliases=@('C plus plus')},
    @{canonical_slug='pl/i';slug='pl-i';href='/languages/pl_i.html';aliases=@('PL1')},
    @{canonical_slug='page';slug='page';href='/docs/page.html';aliases=@()},
    @{canonical_slug='page#literal';slug='hashpage';href='/docs/hashpage.html';aliases=@()}
)
if ($UseSafeCanonicals) {
    foreach ($route in $routes) {
        if ($route.canonical_slug -eq 'c#') { $route.canonical_slug = 'csharp'; $route.aliases += 'C#' }
        if ($route.canonical_slug -eq 'f#') { $route.canonical_slug = 'fsharp'; $route.aliases += 'F#' }
    }
}
$cases = @(
    @{target='C#';page='C#';anchor='';href='/languages/csharp.html'},
    @{target='F#';page='F#';anchor='';href='/languages/fsharp.html'},
    @{target='C++';page='C++';anchor='';href='/languages/cpp.html'},
    @{target='C++#syntax';page='C++';anchor='syntax';href='/languages/cpp.html#syntax'},
    @{target='PL/I';page='PL/I';anchor='';href='/languages/pl_i.html'},
    @{target='PL/I#syntax';page='PL/I';anchor='syntax';href='/languages/pl_i.html#syntax'},
    @{target='pl/i';page='pl/i';anchor='';href='/languages/pl_i.html'},
    @{target='C';page='C';anchor='';href='/languages/c.html'},
    @{target='C##syntax';page='C#';anchor='syntax';href='/languages/csharp.html#syntax'},
    @{target='F##examples';page='F#';anchor='examples';href='/languages/fsharp.html#examples'},
    @{target='Page#section';page='Page';anchor='section';href='/docs/page.html#section'},
    @{target='Page#literal';page='Page#literal';anchor='';href='/docs/hashpage.html'},
    @{target='Page#literal#section';page='Page#literal';anchor='section';href='/docs/hashpage.html#section'},
    @{target='C sharp';page='C sharp';anchor='';href='/languages/csharp.html'},
    @{target='C# language#syntax';page='C# language';anchor='syntax';href='/languages/csharp.html#syntax'},
    @{target=' C# ';page='C#';anchor='';href='/languages/csharp.html'},
    @{target='C#section';page='C';anchor='section';href='/languages/c.html#section'},
    @{target='Unknown#section';page='Unknown';anchor='section';href='/docs/missing.html#section';navHref='/docs/missing.html'}
)
[System.IO.File]::WriteAllText((Join-Path $portal 'routes.json'), (@{routes=$routes} | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $core 'cases.json'), (@{routes=$routes;cases=$cases;canonical_cases=@(@{name="C#";slug="c#"},@{name="F#";slug="f#"},@{name="C++";slug="c++"},@{name="PL/I";slug="pl/i"})} | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
$harness = @"
import modules/trailboss_wiki/routes_json as rjson
import modules/trailboss_wiki/trailboss as trailboss
import modules/scout_nav/scout as scout

data | :read_json("cases.json")
routes | data{"routes"}
for example in data{"canonical_cases"}
    name | example{"name"}
    fm | rjson::extract_frontmatter_map("^^^^\ntitle: {name}\ncanonical: {name}\n^^^^\nBody")
    :say("CANONICAL_CHECK " + :json_stringify({
        "name": name,
        "value": fm{"canonical"},
        "slug": rjson::canonical_to_slug(fm{"canonical"})
    }))
xx

ctx | {
    "path": "../site/portals/hash-link-fixture/content/source.md",
    "portal": "hash-link-fixture",
    "href": "/source.html",
    "frontmatter": {"title": "Source"},
    "body": "[[C#]] [[C##syntax]] [[F#]] [[C++]] [[PL/I]] [[Page#literal#section]]",
    "wanted_pages": [],
    "backlinks": []
}

for example in data{"cases"}
    target | example{"target"}
    parts | rjson::split_wikilink_target(target, routes)
    article | trailboss::resolve_wikilink("[[{target}]]", ctx, "hash-link-fixture")
    nav | scout::scout_link_info_for_wikilink("hash-link-fixture", "[[{target}]]")
    :say("HASH_CHECK " + :json_stringify({
        "target": target,
        "page": parts{"page"},
        "anchor": parts{"anchor"},
        "article": article,
        "nav": nav
    }))
xx

wl | trailboss::stash_code_for_wikilinks(ctx)
wl |= trailboss::sweep_wikilinks(wl)
result | wl{"ctx"}
:say("BACKLINK_CHECK " + :json_stringify({
    "backlinks": result{"backlinks"},
    "wanted": result{"wanted_pages"}
}))
"@
[System.IO.File]::WriteAllText((Join-Path $core 'verify.gbln'),$harness,[System.Text.UTF8Encoding]::new($false))
Push-Location -LiteralPath $core
try {
    $output = @(& goblin run verify.gbln 2>&1 | ForEach-Object { $_.ToString() })
    if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
} finally { Pop-Location }
$results = @($output | Where-Object { $_.StartsWith('HASH_CHECK ') } | ForEach-Object { $_.Substring(11) | ConvertFrom-Json })
if ($results.Count -ne $cases.Count) { throw "Expected $($cases.Count) cases; got $($results.Count).`n$($output -join "`n")" }
for ($i = 0; $i -lt $cases.Count; $i++) {
    $expected = $cases[$i]
    $actual = $results[$i]
    foreach ($field in @('target','page','anchor')) {
        if ([string]$actual.$field -cne [string]$expected[$field]) { throw "Incorrect $field for $($expected.target): $($actual | ConvertTo-Json -Compress)" }
    }
    $articleHref = [regex]::Match($actual.article, 'href="([^"]+)"').Groups[1].Value
    $expectedNavHref = if ($expected.ContainsKey('navHref')) { $expected.navHref } else { $expected.href }
    if ($articleHref -cne $expected.href -or $actual.nav.href -cne $expectedNavHref) { throw "Incorrect article/navigation URL for $($expected.target): $($actual | ConvertTo-Json -Compress)" }
}
$canonicalResults = @($output | Where-Object { $_.StartsWith('CANONICAL_CHECK ') } | ForEach-Object { $_.Substring(16) | ConvertFrom-Json })
$expectedCanonicals = @{'C#'='c#';'F#'='f#';'C++'='c++';'PL/I'='pl/i'}
if ($canonicalResults.Count -ne 4) { throw 'Missing canonical/frontmatter checks.' }
foreach ($result in $canonicalResults) {
    if ($result.value -cne $result.name -or $result.slug -cne $expectedCanonicals[$result.name]) { throw "Punctuation lost in frontmatter/canonical parsing: $($result | ConvertTo-Json -Compress)" }
}
$backlinkLines = @($output | Where-Object { $_.StartsWith('BACKLINK_CHECK ') })
if ($backlinkLines.Count -ne 1) { throw 'Missing backlink check output.' }
$backlinkCheck = $backlinkLines[0].Substring(15) | ConvertFrom-Json
$targets = @($backlinkCheck.backlinks | ForEach-Object { $_.target_href } | Sort-Object)
$expectedTargets = @('/languages/csharp.html','/languages/fsharp.html','/languages/cpp.html','/languages/pl_i.html','/docs/hashpage.html') | Sort-Object
if (@(Compare-Object $expectedTargets $targets).Count -gt 0 -or $targets.Count -ne 5) { throw "Incorrect backlink targets: $($targets -join ', ')" }
if (@($backlinkCheck.wanted).Count -ne 0) { throw 'Known hash-named pages were incorrectly reported as missing.' }
Write-Output "Passed $($cases.Count) fragment/name cases through parsing, article links, and navigation; four frontmatter/canonical checks, backlink deduplication, and wanted-page checks passed."
Write-Output "Isolated fixture: $fixture"