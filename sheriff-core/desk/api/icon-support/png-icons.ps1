$ErrorActionPreference='Stop'
$icons=@()
Get-ChildItem -LiteralPath $env:SHERIFF_ICON_DIRECTORY -File -Filter '*.png' | Sort-Object Name | ForEach-Object {
    if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { return }
    if ($_.BaseName -cnotmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$' -or $_.Length -gt 1048576) { return }
    $bytes=[IO.File]::ReadAllBytes($_.FullName)
    if ($bytes.Length -lt 8 -or [Convert]::ToBase64String($bytes[0..7]) -cne 'iVBORw0KGgo=') { return }
    $icons+=@{name=$_.BaseName;source='Portal';format='png';png='data:image/png;base64,'+[Convert]::ToBase64String($bytes)}
}
ConvertTo-Json -InputObject @($icons) -Depth 4 -Compress
