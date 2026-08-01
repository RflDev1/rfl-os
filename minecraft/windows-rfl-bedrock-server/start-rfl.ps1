$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path $Root ".env"
if (-not (Test-Path $EnvPath)) { throw "Copy .env.example to .env and fill in every value first." }
Get-Content $EnvPath | ForEach-Object {
  $Line = $_.Trim()
  if ($Line -and -not $Line.StartsWith("#")) {
    $Parts = $Line.Split("=", 2)
    if ($Parts.Count -eq 2) { [Environment]::SetEnvironmentVariable($Parts[0].Trim(), $Parts[1].Trim(), "Process") }
  }
}
Set-Location $Root
npm start
