$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$taskRoot = [IO.Path]::GetFullPath((Get-Location).Path)
$taskPortal = $env:SHERIFF_LOG_PORTAL
$taskId = $env:SHERIFF_LOG_ID
$taskAction = $env:SHERIFF_LOG_ACTION
if ($taskAction -in @('start','worker')) {
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
public static class SheriffLogProcess {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup { public int cb; public string reserved,desktop,title; public int x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reserved2; public IntPtr bytes,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct Info { public IntPtr process,thread; public int pid,tid; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,int flags,IntPtr environment,string directory,ref Startup startup,out Info info);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static void Spawn(string command,string directory) {
  var startup=new Startup();startup.cb=Marshal.SizeOf(startup);Info info;
  if(!CreateProcess(null,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,false,0x08000000,IntPtr.Zero,directory,ref startup,out info))throw new System.ComponentModel.Win32Exception();
  CloseHandle(info.process);CloseHandle(info.thread);
 }
 public static int Run(string exe,string arguments,string directory,string output,string error) {
  var settings=new ProcessStartInfo(exe,arguments);settings.WorkingDirectory=directory;settings.UseShellExecute=false;settings.CreateNoWindow=true;settings.RedirectStandardOutput=true;settings.RedirectStandardError=true;
  using(var p=new Process())using(var stdout=new FileStream(output,FileMode.Create,FileAccess.Write,FileShare.ReadWrite,1,FileOptions.WriteThrough))using(var stderr=new FileStream(error,FileMode.Create,FileAccess.Write,FileShare.ReadWrite,1,FileOptions.WriteThrough)) {
   p.StartInfo=settings;p.Start();var a=p.StandardOutput.BaseStream.CopyToAsync(stdout);var b=p.StandardError.BaseStream.CopyToAsync(stderr);
   if(!p.WaitForExit(180000)){p.Kill();throw new Exception("Build timed out.");}p.WaitForExit();Task.WaitAll(a,b);return p.ExitCode;
  }
 }
}
"@
}
function Checked([string]$relative) {
    $value = [IO.Path]::GetFullPath([IO.Path]::Combine($taskRoot,$relative))
    if (-not $value.StartsWith($taskRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside workspace.' }
    $cursor=$value
    while ($cursor.Length -gt $taskRoot.Length) {
        if (Test-Path -LiteralPath $cursor) { if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked build paths are not supported.' } }
        $cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    return $value
}
function Read-Live([string]$file) {
    $handle=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $reader=New-Object IO.StreamReader($handle,[Text.Encoding]::UTF8,$true)
    try {return $reader.ReadToEnd()} finally {$reader.Dispose();$handle.Dispose()}
}
function Write-Json([string]$file,$value) {
    $temp=$file+'.tmp';[IO.File]::WriteAllText($temp,($value|ConvertTo-Json -Depth 8 -Compress));[IO.File]::Move($temp,$file)
}
try {
    if ($taskPortal -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$') { throw 'Invalid portal.' }
    if ($taskAction -eq 'start') {
        if (-not [IO.Directory]::Exists((Checked "site/portals/$taskPortal"))) { throw 'Unknown portal.' }
        if ($env:SHERIFF_LOG_MODE -notin @('page','portal')) { throw 'Invalid build mode.' }
        if ($env:SHERIFF_LOG_MODE -eq 'page' -and ($env:SHERIFF_LOG_TARGET -notmatch '\.md$' -or $env:SHERIFF_LOG_TARGET -match '(^/|(^|[\\/])\.\.([\\/]|$))')) { throw 'Invalid page.' }
        $taskId=[Guid]::NewGuid().ToString('N')
        $taskJob=Checked "data/.desk/build-logs/$taskPortal/$taskId"
        [IO.Directory]::CreateDirectory($taskJob)|Out-Null
        Write-Json "$taskJob/request.json" @{mode=$env:SHERIFF_LOG_MODE;target=$env:SHERIFF_LOG_TARGET}
        $env:SHERIFF_LOG_ACTION='worker';$env:SHERIFF_LOG_ID=$taskId
        [SheriffLogProcess]::Spawn(('powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$PSCommandPath+'"'),$taskRoot)
        @{ok=$true;id=$taskId}|ConvertTo-Json -Compress
        exit
    }
    if ($taskId -notmatch '^[a-f0-9]{32}$') { throw 'Invalid build job.' }
    $taskJob=Checked "data/.desk/build-logs/$taskPortal/$taskId"
    if (-not [IO.File]::Exists("$taskJob/request.json")) { throw 'Unknown build job.' }
    if ($taskAction -eq 'worker') {
        $request=Get-Content -LiteralPath "$taskJob/request.json" -Raw -Encoding UTF8|ConvertFrom-Json
        $timer=[Diagnostics.Stopwatch]::StartNew()
        try {
            $env:SHERIFF_PAGE_TARGET=$request.target
            $env:GOBLIN_NONINTERACTIVE='0'
            $exe=if($env:SHERIFF_GOBLIN){$env:SHERIFF_GOBLIN}else{'goblin'}
            $arguments=@('run','main.gbln',$taskPortal)
            if ($request.mode -eq 'page') {$arguments+='page'}
            $code=[SheriffLogProcess]::Run($exe,($arguments -join ' '),"$taskRoot/sheriff-core","$taskJob/stdout.txt","$taskJob/stderr.txt")
            $stdout=[IO.File]::ReadAllText("$taskJob/stdout.txt");$stderr=[IO.File]::ReadAllText("$taskJob/stderr.txt")
            $ms=$timer.Elapsed.TotalMilliseconds
            if ($stderr -match 'goblin run .+ . exit \d+ in (\d+)ms') {$ms=[double]$Matches[1]}
            Write-Json "$taskJob/result.json" @{ok=($code -eq 0);code=$code;stdout=$stdout;stderr=$stderr;build_ms=$ms}
        } catch {Write-Json "$taskJob/result.json" @{ok=$false;code=1;stdout='';stderr=$_.Exception.Message;build_ms=$timer.Elapsed.TotalMilliseconds}}
        exit
    }
    if ($taskAction -eq 'status') {
        $result=@{ok=$true}
        foreach($stream in @('stdout','stderr')) {
            $file="$taskJob/$stream.txt";$text=''
            if ([IO.File]::Exists($file)) {$text=Read-Live $file}
            $offset=[Math]::Max(0,[int][Environment]::GetEnvironmentVariable(('SHERIFF_LOG_'+$stream.ToUpper())))
            $result[$stream]=if($offset -lt $text.Length){$text.Substring($offset)}else{''};$result[('next_'+$stream)]=$text.Length
        }
        $result.done=[IO.File]::Exists("$taskJob/result.json")
        if ($result.done) {$result.result=Get-Content -LiteralPath "$taskJob/result.json" -Raw -Encoding UTF8|ConvertFrom-Json}
        $result|ConvertTo-Json -Depth 8 -Compress
        exit
    }
    throw 'Unknown action.'
} catch {@{ok=$false;stderr=$_.Exception.Message}|ConvertTo-Json -Compress}
