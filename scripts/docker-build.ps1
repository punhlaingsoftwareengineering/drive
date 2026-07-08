# Build the drive image for GHCR (private: punhlaingsoftwareengineering/drive).
# Usage: .\scripts\docker-build.ps1 [tag]
# Example: .\scripts\docker-build.ps1 v1.0.0

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

Write-Host "Building ${FullImage}:${Tag} ..."
docker build -t "${FullImage}:${Tag}" .

if ($Tag -ne "latest") {
	docker tag "${FullImage}:${Tag}" "${FullImage}:latest"
	Write-Host "Tagged ${FullImage}:latest"
}

Write-Host "Done. Image: ${FullImage}:${Tag}"
