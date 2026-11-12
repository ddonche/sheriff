$script:snapshotDir = if ($env:SHERIFF_RUNTIME_MODE -eq 'cloud') { 'site/.desk/snapshots' } else { 'data/snapshots' }
# Native Windows ZIP support for Desk. All inputs arrive through environment
# variables; user names and paths are never interpolated into shell commands.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$script:root = [IO.Path]::GetFullPath($env:SHERIFF_SNAPSHOT_ROOT)
$script:portal = $env:SHERIFF_SNAPSHOT_PORTAL
$script:id = $env:SHERIFF_SNAPSHOT_ID
$script:action = $env:SHERIFF_SNAPSHOT_ACTION
$script:lock = $null
function Join-Workspace([string]$relative) {
    $value = [IO.Path]::GetFullPath([IO.Path]::Combine($script:root, $relative))
    $prefix = $script:root.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    if (-not $value.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the Sheriff workspace.' }
    $cursor = $value
    while ($cursor.Length -ge $script:root.Length) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked snapshot or portal paths are not supported.' }
        }
        if ($cursor -eq $script:root) { break }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
    return $value
}
function File-Hash([string]$path) {
    $reader = [IO.File]::OpenRead($path)
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($reader)).Replace('-', '').ToLowerInvariant() }
    finally { $reader.Dispose(); $hash.Dispose() }
}
function Assert-Portal([string]$value) {
    if ($value -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_-]*$') { throw 'Invalid portal ID.' }
}
function Read-Snapshot([string]$folder, [string]$snapshotId) {
    if ($snapshotId -notmatch '^[a-f0-9]{32}$') { throw 'Invalid snapshot ID.' }
    $json = Join-Workspace "$script:snapshotDir/$script:portal/$snapshotId.json"
    $zip = Join-Workspace "$script:snapshotDir/$script:portal/$snapshotId.zip"
    if (-not [IO.File]::Exists($json) -or -not [IO.File]::Exists($zip)) { throw 'Snapshot not found.' }
    $meta = [IO.File]::ReadAllText($json) | ConvertFrom-Json
    if ($meta.id -ne $snapshotId -or $meta.portal -cne $script:portal) { throw 'Snapshot metadata does not match this portal.' }
    return $meta
}
function List-Snapshots([string]$folder) {
    $items = @()
    if ([IO.Directory]::Exists($folder)) {
        foreach ($file in Get-ChildItem -LiteralPath $folder -Filter '*.json' -File -Force) {
            $meta = Read-Snapshot $folder $file.BaseName
            $meta.bytes = (Get-Item -LiteralPath (Join-Workspace "$script:snapshotDir/$script:portal/$($meta.id).zip")).Length
            $items += $meta
        }
    }
    return @($items | Sort-Object created_at -Descending)
}
function Check-Source([string]$source) {
    if (-not [IO.Directory]::Exists($source)) { throw 'Portal source directory not found.' }
    foreach ($item in Get-ChildItem -LiteralPath $source -Recurse -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'A portal contains a linked file or directory. Snapshot was not created.' }
    }
}
function Extract-Snapshot([string]$zip, [string]$destination) {
    [IO.Directory]::CreateDirectory($destination) | Out-Null
    $prefix = $destination.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName.Replace('\', '/')
            $parts = $name.TrimEnd('/').Split('/')
            if (-not $name -or $name.StartsWith('/') -or $name.Contains(':') -or $parts -contains '..' -or $parts -contains '.' -or $parts -contains '') { throw 'Snapshot contains an unsafe archive path.' }
            if ((($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Snapshot contains a symbolic link.' }
            if (-not $seen.Add($name.TrimEnd('/'))) { throw 'Snapshot contains duplicate archive paths.' }
            $target = [IO.Path]::GetFullPath([IO.Path]::Combine($destination, $name.Replace('/', [IO.Path]::DirectorySeparatorChar)))
            if (-not $target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Snapshot archive escapes its extraction directory.' }
            if ($name.EndsWith('/')) { [IO.Directory]::CreateDirectory($target) | Out-Null }
            else {
                [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
                [IO.File]::SetLastWriteTimeUtc($target, $entry.LastWriteTime.UtcDateTime)
            }
        }
    } finally { $archive.Dispose() }
}
try {
    $base = Join-Workspace $script:snapshotDir
    if (-not $script:portal -and $script:action -eq 'list') {
        $catalog = @()
        if ([IO.Directory]::Exists($base)) {
            foreach ($folder in Get-ChildItem -LiteralPath $base -Directory -Force) {
                Assert-Portal $folder.Name
                $checked = Join-Workspace "$script:snapshotDir/$($folder.Name)"
                if (@(Get-ChildItem -LiteralPath $checked -Filter '*.json' -File -Force).Count) { $catalog += $folder.Name }
            }
        }
        $out = @{ok=$true; portals=@($catalog)}
    } else {
        Assert-Portal $script:portal
        $source = Join-Workspace "site/portals/$script:portal"
        $folder = Join-Workspace "$script:snapshotDir/$script:portal"
        if ($script:action -eq 'list') { $out = @{ok=$true; snapshots=@(List-Snapshots $folder)} }
        else {
            if ($script:action -eq 'create') { Check-Source $source; [IO.Directory]::CreateDirectory($folder) | Out-Null }
            if (-not [IO.Directory]::Exists($folder)) { throw 'Snapshot not found.' }
            $lockPath = Join-Workspace "$script:snapshotDir/$script:portal/.operation.lock"
            try { $script:lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
            catch { throw 'Another snapshot operation is running for this portal.' }
            switch ($script:action) {
                'create' {
                    $body = $env:SHERIFF_SNAPSHOT_BODY
                    if ($body.Length -gt 4096) { throw 'Snapshot name is too long.' }
                    $name = ''
                    if ($body) { $request = $body | ConvertFrom-Json; if ($null -ne $request.name) { if ($request.name -isnot [string]) { throw 'Snapshot name must be text.' }; $name = $request.name.Trim() } }
                    if ($name.Length -gt 160) { throw 'Snapshot name must be 160 characters or fewer.' }
                    $newId = [Guid]::NewGuid().ToString('N')
                    $zip = Join-Workspace "$script:snapshotDir/$script:portal/$newId.zip"
                    $tempZip = Join-Workspace "$script:snapshotDir/$script:portal/$newId.partial"
                    $json = Join-Workspace "$script:snapshotDir/$script:portal/$newId.json"
                    try {
                        [IO.Compression.ZipFile]::CreateFromDirectory($source, $tempZip, [IO.Compression.CompressionLevel]::Optimal, $false)
                        [IO.File]::Move($tempZip, $zip)
                        $meta = @{id=$newId; portal=$script:portal; name=$name; created_at=[DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"); bytes=(Get-Item -LiteralPath $zip).Length; sha256=(File-Hash $zip)}
                        [IO.File]::WriteAllText($json + '.partial', ($meta | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
                        [IO.File]::Move($json + '.partial', $json)
                        $out = @{ok=$true; snapshot=$meta}
                    } catch {
                        foreach ($item in @($tempZip, $zip, $json, ($json + '.partial'))) { if ([IO.File]::Exists($item)) { [IO.File]::Delete($item) } }
                        throw
                    }
                }
                'download' {
                    $meta = Read-Snapshot $folder $script:id
                    $zip = Join-Workspace "$script:snapshotDir/$script:portal/$script:id.zip"
                    $out = @{ok=$true; filename="$script:portal-$script:id.zip"; zip_base64=[Convert]::ToBase64String([IO.File]::ReadAllBytes($zip))}
                }
                'delete' {
                    $meta = Read-Snapshot $folder $script:id
                    [IO.File]::Delete((Join-Workspace "$script:snapshotDir/$script:portal/$script:id.zip"))
                    [IO.File]::Delete((Join-Workspace "$script:snapshotDir/$script:portal/$script:id.json"))
                    $out = @{ok=$true}
                }
                'restore' {
                    $meta = Read-Snapshot $folder $script:id
                    $zip = Join-Workspace "$script:snapshotDir/$script:portal/$script:id.zip"
                    if ((File-Hash $zip) -cne $meta.sha256) { throw 'Snapshot ZIP failed its integrity check. Current portal files were kept.' }
                    if ([IO.Directory]::Exists($source)) { Check-Source $source }
                    $stage = Join-Workspace "$script:snapshotDir/$script:portal/.restore-$([Guid]::NewGuid().ToString('N'))"
                    $fresh = [IO.Path]::Combine($stage, 'source')
                    $previous = [IO.Path]::Combine($stage, 'previous')
                    try {
                        Extract-Snapshot $zip $fresh
                        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($source)) | Out-Null
                        if ([IO.Directory]::Exists($source)) { [IO.Directory]::Move($source, $previous) }
                        try { [IO.Directory]::Move($fresh, $source) }
                        catch {
                            if ([IO.Directory]::Exists($previous) -and -not [IO.Directory]::Exists($source)) { [IO.Directory]::Move($previous, $source) }
                            throw
                        }
                        $out = @{ok=$true; snapshot=$meta}
                    } catch {
                        if ([IO.Directory]::Exists($previous)) { throw "Restore failed. Recovery files are preserved at $previous. $($_.Exception.Message)" }
                        throw
                    } finally {
                        if ([IO.Directory]::Exists($stage) -and -not [IO.Directory]::Exists($previous)) { [IO.Directory]::Delete($stage, $true) }
                    }
                    # These paths were resolved and checked inside the workspace.
                    try { if ([IO.Directory]::Exists($stage)) { [IO.Directory]::Delete($stage, $true) } }
                    catch { $out.warning = "Restored. Temporary recovery files remain at $stage." }
                }
                default { throw 'Unknown snapshot action.' }
            }
        }
    }
    $out | ConvertTo-Json -Depth 12 -Compress
} catch { @{ok=$false; stderr=$_.Exception.Message} | ConvertTo-Json -Compress }
finally { if ($null -ne $script:lock) { $script:lock.Dispose() } }
