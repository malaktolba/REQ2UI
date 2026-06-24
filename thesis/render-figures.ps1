# Re-render all PlantUML figures to PNG.
# Requires Java on PATH. Uses the bundled plantuml.jar with the Smetana layout engine.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$jar  = Join-Path $here "tools\plantuml.jar"
$src  = Join-Path $here "figures\src"
$out  = Join-Path $here "figures"

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  Write-Error "Java not found on PATH. Install a JDK/JRE and retry."
}

# plantuml.jar is gitignored (21MB) — fetch it once on first run.
if (-not (Test-Path $jar)) {
  New-Item -ItemType Directory -Force (Split-Path $jar) | Out-Null
  $url = "https://github.com/plantuml/plantuml/releases/download/v1.2025.2/plantuml-1.2025.2.jar"
  Write-Host "Downloading PlantUML jar..."
  Invoke-WebRequest -Uri $url -OutFile $jar -UseBasicParsing
}

& java -jar $jar -tpng -Smaxmessagesize=200 -Playout=smetana -o $out "$src\*.puml"
Write-Host "Rendered figures to $out (exit $LASTEXITCODE)"
Get-ChildItem $out -Filter *.png | Select-Object Name, @{n='KB';e={[math]::Round($_.Length/1KB,1)}} | Format-Table -AutoSize
