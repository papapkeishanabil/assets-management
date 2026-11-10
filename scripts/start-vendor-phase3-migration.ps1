# User sudah menyetujui migration tertentu. Prompt hanya untuk password koneksi.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repositoryRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repositoryRoot
$securePassword=$null
try {
  $Host.UI.RawUI.WindowTitle='HARMAS - Migration Fase 3 - Pemeriksaan izin platform'
  Write-Host 'Migration Fase 3 produksi telah disetujui user.' -ForegroundColor Cyan
  Write-Host 'Target tetap: uwlxkwyauxwewoexfgwi. Preflight/backup diverifikasi sebelum write.'
  Write-Host 'Hanya 202611090001_vendor_management_phase3.sql; tanpa push/deploy/data dummy.'
  Write-Host 'Password tidak disimpan ke file/chat dan dibersihkan setelah selesai.'
  $securePassword=Read-Host 'Password PostgreSQL HARMAS' -AsSecureString
  $env:PGPASSWORD=[System.Net.NetworkCredential]::new('', $securePassword).Password
  if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {throw 'Password kosong; tidak membuat koneksi.'}
  & node (Join-Path $PSScriptRoot 'apply-vendor-phase3-production.mjs')
  if ($LASTEXITCODE -ne 0) {throw 'Proses belum selesai; lihat status teredaksi, jangan mengulang migration otomatis.'}
  Write-Host 'Migration dan verifikasi selesai.' -ForegroundColor Green
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($null -ne $securePassword) {$securePassword.Dispose();$securePassword=$null}
}
[void](Read-Host 'Tekan Enter untuk menutup jendela')
