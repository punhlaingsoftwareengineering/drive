# Push the drive image to private GHCR.
# Prereq: docker login ghcr.io (or set GHCR_USER + GHCR_TOKEN).
# Usage: .\scripts\docker-push.ps1 [tag]
# Example: $env:GHCR_TOKEN='ghp_...'; $env:GHCR_USER='you'; .\scripts\docker-push.ps1 latest

param(
	[string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$EnvFile = Join-Path $PSScriptRoot "docker-ghcr.env"
if (Test-Path $EnvFile) {
	Get-Content $EnvFile | ForEach-Object {
		if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
			$name = $matches[1].Trim()
			$value = $matches[2].Trim()
			Set-Item -Path "env:$name" -Value $value
		}
	}
}

$Registry = if ($env:GHCR_REGISTRY) { $env:GHCR_REGISTRY } else { "ghcr.io" }
$Org = if ($env:GHCR_ORG) { $env:GHCR_ORG } else { "punhlaingsoftwareengineering" }
$ImageName = if ($env:GHCR_IMAGE) { $env:GHCR_IMAGE } else { "drive" }
$FullImage = "${Registry}/${Org}/${ImageName}"

if ($env:GHCR_TOKEN -and $env:GHCR_USER) {
	Write-Host "Logging in to ${Registry} as $($env:GHCR_USER) ..."
	$env:GHCR_TOKEN | docker login $Registry -u $env:GHCR_USER --password-stdin
}
else {
	Write-Host "GHCR_TOKEN/GHCR_USER not set — using existing docker login session."
}

Write-Host "Pushing ${FullImage}:${Tag} ..."
docker push "${FullImage}:${Tag}"

if ($Tag -ne "latest") {
	$latest = docker image inspect "${FullImage}:latest" 2>$null
	if ($LASTEXITCODE -eq 0) {
		Write-Host "Pushing ${FullImage}:latest ..."
		docker push "${FullImage}:latest"
	}
}

Write-Host "Pushed ${FullImage}:${Tag}"
Write-Host "Pull on server: docker pull ${FullImage}:${Tag}"
