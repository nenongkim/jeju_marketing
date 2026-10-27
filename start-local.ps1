param([ValidateRange(1024,65535)][int]$Port = 8766, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$siteRoot = Join-Path $PSScriptRoot '02_제품'
$route = '/' + [uri]::EscapeDataString('화면시안_Make') + '/evidence/'
$url = "http://127.0.0.1:$Port${route}index.html"
$probe = "http://127.0.0.1:$Port${route}case-data.json"
try {
    $response = Invoke-WebRequest -Uri $probe -UseBasicParsing -TimeoutSec 2
    $remote = [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
    $expected = Get-Content -LiteralPath (Join-Path $siteRoot '화면시안_Make/evidence/case-data.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($remote.schema_version -eq $expected.schema_version -and $remote.snapshot -eq $expected.snapshot -and $remote.region -eq $expected.region) {
        Write-Host "Local prototype already running: $url"
        if (-not $NoBrowser) { Start-Process $url }
        return
    }
} catch { }
$bundled = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$pythonCommand = $null
$pythonArgs = @()
if (Test-Path -LiteralPath $bundled) { $pythonCommand = $bundled }
elseif (Get-Command py -ErrorAction SilentlyContinue) { $pythonCommand = (Get-Command py).Source; $pythonArgs = @('-3') }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $pythonCommand = (Get-Command python).Source }
else { throw 'Python 3 is required. Install Python or use the Codex bundled runtime.' }
Write-Host "Local prototype: $url"
Write-Host 'Only this PC can connect. Keep this window open; press Ctrl+C to stop.'
Write-Host 'If the port is occupied, run with -Port 8767.'
# The browser may briefly open before the server finishes binding; refresh if needed.
if (-not $NoBrowser) { Start-Process $url }
& $pythonCommand @pythonArgs -m http.server $Port --bind 127.0.0.1 --directory $siteRoot
if ($LASTEXITCODE -ne 0) { throw "Local server exited with code $LASTEXITCODE. Check the message above or choose another port." }
