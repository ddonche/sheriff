# OS-only I/O for the Goblin seeder; never overwrite an existing article.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$created = New-Object System.Collections.Generic.List[string]
$failures = New-Object System.Collections.Generic.List[object]
try {
    $payload = [IO.File]::ReadAllText($env:SHERIFF_SEED_REQUEST, $utf8) | ConvertFrom-Json
    if ($payload.portal -cnotmatch '^[a-z0-9][a-z0-9_-]*$') { throw 'Invalid portal name.' }
    $portalBase = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path ('site/portals/' + $payload.portal)))
    function Safe-SeedPath([string]$relative) {
        $current = (Get-Location).Path
        foreach ($part in @('site', 'portals', $payload.portal) + @($relative.Split('/'))) {
            if ($part -in @('', '.', '..')) { throw 'Invalid seed path.' }
            $current = Join-Path $current $part
            if (Test-Path -LiteralPath $current) {
                if ((Get-Item -Force -LiteralPath $current).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Seed paths cannot contain links.' }
            }
        }
        $absolute = [IO.Path]::GetFullPath($current)
        if (!$absolute.StartsWith($portalBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Seed path escapes portal.' }
        return $absolute
    }
    if (!(Test-Path -LiteralPath (Safe-SeedPath 'config.yall') -PathType Leaf)) { throw 'Portal not found.' }
    $destination = Safe-SeedPath 'seeder.yall'
    $temporary = Safe-SeedPath ('.seeder-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::WriteAllText($temporary, $payload.source, $utf8)
        if ([IO.File]::Exists($destination)) { $backup = $temporary + ".bak"; [IO.File]::Replace($temporary, $destination, $backup); [IO.File]::Delete($backup) }
        else { [IO.File]::Move($temporary, $destination) }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
    foreach ($item in $payload.files) {
        $stream = $null
        try {
            if ($item.path -cnotmatch '^content/[A-Za-z0-9_./-]+\.md$') { throw 'Invalid article path.' }
            $target = Safe-SeedPath $item.path
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
            $target = Safe-SeedPath $item.path
            try { $stream = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
            catch [IO.IOException] { if ([IO.File]::Exists($target)) { continue }; throw }
            $bytes = $utf8.GetBytes($item.content)
            $stream.Write($bytes, 0, $bytes.Length)
            $created.Add($item.path)
        } catch { $failures.Add(@{path=$item.path; reason=$_.Exception.Message}) }
        finally { if ($stream) { $stream.Dispose() } }
    }
    @{ok=($failures.Count -eq 0); saved=$true; created=$created.Count; paths=@($created.ToArray()); failures=@($failures.ToArray()); stderr=$(if ($failures.Count) {'Some pages could not be created. Review the failures.'} else {''})} | ConvertTo-Json -Depth 20 -Compress
} catch { @{ok=$false; stderr=$_.Exception.Message; created=$created.Count; paths=@($created.ToArray())} | ConvertTo-Json -Depth 20 -Compress }
