# GeekNook — Desktop Archive Generator
# Automatically packs the clean production website into geeknook-website.zip on Desktop

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$desktopPaths = @(
  [System.IO.Path]::Combine($env:USERPROFILE, "OneDrive", "Desktop"),
  [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
)

$targetDesktop = $desktopPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $targetDesktop) {
  Write-Error "Desktop directory not found."
  exit 1
}

$zipPath = Join-Path $targetDesktop "geeknook-website.zip"
$tarExe = Join-Path $env:SystemRoot "System32\tar.exe"

Write-Host "Packing GeekNook website into: $zipPath ..." -ForegroundColor Cyan

Push-Location $root
try {
  & $tarExe -a -c -f $zipPath index.html 404.html .htaccess LICENSE README.md robots.txt sitemap.xml favicon.ico css js images
  
  # Also sync to alternate desktop path if exists
  foreach ($p in $desktopPaths) {
    if ((Test-Path $p) -and ($p -ne $targetDesktop)) {
      Copy-Item -Force $zipPath (Join-Path $p "geeknook-website.zip") -ErrorAction SilentlyContinue
    }
  }

  $item = Get-Item $zipPath
  $sizeMb = [math]::Round($item.Length / 1MB, 2)
  Write-Host "Success! Archive updated: $zipPath ($sizeMb MB)" -ForegroundColor Green
} finally {
  Pop-Location
}
