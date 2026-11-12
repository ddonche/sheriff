$ErrorActionPreference='Stop'

function Build-Checked([string]$value) {
    $resolved=[IO.Path]::GetFullPath($value)
    if (-not $resolved.StartsWith($buildRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Build path escapes workspace.'}
    $cursor=$resolved
    while($cursor -and $cursor -ne $buildRoot) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked build paths are not supported.'}
        }
        $cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    return $resolved
}
function Remove-BuildTree([string]$value) {
    $resolved=Build-Checked $value
    if ([IO.Directory]::Exists($resolved)) {Remove-Item -LiteralPath $resolved -Recurse -Force}
}
function Write-BuildJson([string]$file,$value) {
    $temp=$file+'.tmp'
    [IO.File]::WriteAllText($temp,($value|ConvertTo-Json -Depth 8 -Compress))
    if ([IO.File]::Exists($file)) {[IO.File]::Delete($file)}
    [IO.File]::Move($temp,$file)
}
function Build-ProcessInfo([int]$processId) {
    try {
        $item=Get-Process -Id $processId -ErrorAction Stop
        $info=Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
        return @{pid=$processId;stamp=$item.StartTime.ToUniversalTime().Ticks.ToString();name=$item.ProcessName;parent=[int]$info.ParentProcessId}
    } catch {return $null}
}
function Find-BuildOwner {
    if ($env:SHERIFF_BUILD_OWNER_PID) {return Build-ProcessInfo ([int]$env:SHERIFF_BUILD_OWNER_PID)}
    $current=Build-ProcessInfo $PID
    $fallback=$current
    for($i=0;$i -lt 8 -and $current;$i++) {
        if ($current.name -like 'goblin*') {return $current}
        $current=Build-ProcessInfo $current.parent
    }
    return $fallback
}
function Copy-BuildTree([string]$from,[string]$to) {
    [IO.Directory]::CreateDirectory($to)|Out-Null
    foreach($item in Get-ChildItem -LiteralPath $from -Force -Recurse) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked output is not supported.'}
        $target=Join-Path $to $item.FullName.Substring($from.Length+1)
        if ($item.PSIsContainer) {[IO.Directory]::CreateDirectory($target)|Out-Null} else {[IO.File]::Copy($item.FullName,$target,$true)}
    }
}
function Activate-BuildFiles([string]$from,[string]$to) {
    # Keep open directory handles valid; replace completed files individually.
    foreach($file in Get-ChildItem -LiteralPath $to -File -Force -Recurse) {
        $relative=$file.FullName.Substring($to.Length+1)
        if (-not [IO.File]::Exists((Join-Path $from $relative))) {[IO.File]::Delete($file.FullName)}
    }
    Copy-BuildTree $from $to
}

function Invoke-BuildLifecycle([string]$root,[string]$portal,[string]$phase,[string]$id) {
    $buildRoot=[IO.Path]::GetFullPath($root)
    $buildPortal=$portal;$buildPhase=$phase;$buildId=$id
    if ($buildPortal -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$') {throw 'Invalid portal.'}
    $base=Build-Checked "$buildRoot/data/.desk/builds/$buildPortal"
    $active=Build-Checked "$buildRoot/dist/$buildPortal"
    $work=Build-Checked "$base/next";$previous=Build-Checked "$base/previous";$lease=Build-Checked "$base/lease"
    [IO.Directory]::CreateDirectory($base)|Out-Null
    if ($buildPhase -eq 'begin') {
        if ([IO.Directory]::Exists($lease)) {
            $meta="$lease/job.json"
            if (-not [IO.File]::Exists($meta) -and ((Get-Date).ToUniversalTime()-(Get-Item -LiteralPath $lease).LastWriteTimeUtc).TotalSeconds -lt 30) {throw 'Another build is starting for this portal.'}
            if ([IO.File]::Exists($meta)) {
                $old=Get-Content -LiteralPath $meta -Raw -Encoding UTF8|ConvertFrom-Json
                $running=Build-ProcessInfo ([int]$old.owner.pid)
                if ($running -and $running.stamp -eq $old.owner.stamp) {throw 'Another build is running for this portal.'}
            }
            Remove-BuildTree $lease
        }
        [IO.Directory]::CreateDirectory($lease)|Out-Null
        $buildId=[Guid]::NewGuid().ToString('N')
        $data=@{id=$buildId;portal=$buildPortal;output=$work.Replace('\','/');owner=(Find-BuildOwner);state='building'}
        $bytes=[Text.Encoding]::UTF8.GetBytes(($data|ConvertTo-Json -Depth 8 -Compress))
        $gate=[IO.File]::Open("$lease/job.json",[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
        try {$gate.Write($bytes,0,$bytes.Length);$gate.Flush()} finally {$gate.Dispose()}
        Remove-BuildTree $work
        [IO.Directory]::CreateDirectory($work)|Out-Null
        $data.message='Building fresh output; the current site is unchanged.'
        $data
        return
    }
    $data=Get-Content -LiteralPath "$lease/job.json" -Raw -Encoding UTF8|ConvertFrom-Json
    if ($data.id -ne $buildId) {throw 'Build ownership changed.'}
    if ($buildPhase -eq 'ready') {
        $data.state='ready';Write-BuildJson "$lease/job.json" $data
        @{id=$data.id;output=$data.output;state='ready';message='Build complete; output ready for publishing.'}
        return
    }
    if ($buildPhase -eq 'abort') {
        Remove-BuildTree $work;Remove-BuildTree $lease
        @{message='Incomplete output removed; the current site is unchanged.'}
        return
    }
    if ($buildPhase -eq 'upload-failed') {
        $data.state='upload-failed';Write-BuildJson "$base/pending.json" $data;Remove-BuildTree $lease
        @{message='Upload failed; current output and one pending build retained.'}
        return
    }
    if ($buildPhase -ne 'activate') {throw 'Invalid build phase.'}
    if (-not [IO.Directory]::Exists($work)) {throw 'Completed output is missing.'}
    Remove-BuildTree $previous
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($active))|Out-Null
    $moved=$false;$copied=$false
    if ([IO.Directory]::Exists($active)) {
        try {[IO.Directory]::Move($active,$previous);$moved=$true} catch {
            # A user may hold an output folder open on Windows.
            Copy-BuildTree $active $previous
            $copied=$true
        }
    }
    try {
        if ($copied) {Activate-BuildFiles $work $active;Remove-BuildTree $work} else {[IO.Directory]::Move($work,$active)}
    } catch {
        if ($moved) {[IO.Directory]::Move($previous,$active)}
        if ($copied) {Activate-BuildFiles $previous $active}
        throw
    }
    Write-BuildJson "$base/current.json" @{id=$data.id;portal=$buildPortal;output=$active.Replace('\','/');state='complete'}
    if ([IO.File]::Exists("$base/pending.json")) {[IO.File]::Delete("$base/pending.json")}
    Remove-BuildTree $lease
    @{output=$active.Replace('\','/');message='Activated completed output; one previous build retained privately.'}
}
if ($env:SHERIFF_BUILD_LIBRARY -ne '1') {
    try {Invoke-BuildLifecycle ([IO.Path]::GetFullPath('..')) $env:SHERIFF_BUILD_PORTAL $env:SHERIFF_BUILD_PHASE $env:SHERIFF_BUILD_ID | ConvertTo-Json -Depth 8 -Compress}
    catch {[Console]::Error.WriteLine('Build output: '+$_.Exception.Message);exit 1}
}
