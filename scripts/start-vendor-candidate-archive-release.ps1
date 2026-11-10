# Password input only; database migration + frontend deployment already approved by user.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repositoryRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repositoryRoot
$securePassword=$null
try {
  $Host.UI.RawUI.WindowTitle='HARMAS - Arsip Kandidat - Lanjut setelah verifikasi ACL'
  Write-Host 'HARMAS - Backup terbaru, verifikasi restore lokal dan migration arsip yang disetujui.' -ForegroundColor Cyan
  Write-Host 'Target: uwlxkwyauxwewoexfgwi. Hanya migration 202611100001_vendor_candidate_archive.sql.'
  Write-Host 'Write hanya dijalankan bila preflight, backup, restore dan pemeriksaan clone lulus.'
  Write-Host 'Tidak menghapus/mengarsipkan kandidat existing, tidak membuat akun, tidak push Git.'
  Write-Host 'Password tidak ditampilkan, tidak disimpan ke file/chat dan dihapus setelah selesai.'
  $waitingStatus=[ordered]@{state='WAITING_FOR_PASSWORD';pid=$PID;updated_at=[DateTime]::UtcNow.ToString('o');production_migration_executed=$false}
  [System.IO.File]::WriteAllText((Join-Path $repositoryRoot '.vercel\candidate-archive-activation-status.json'),($waitingStatus | ConvertTo-Json),(New-Object System.Text.UTF8Encoding($false)))
  $securePassword=Read-Host 'Password PostgreSQL HARMAS' -AsSecureString
  $env:PGPASSWORD=[System.Net.NetworkCredential]::new('', $securePassword).Password
  if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {throw 'Password kosong; tidak membuat koneksi.'}
  & node.exe (Join-Path $PSScriptRoot 'release-vendor-candidate-archive.mjs')
  if ($LASTEXITCODE -ne 0) {throw 'Proses belum selesai; periksa status. Jangan mengulang migration otomatis.'}
  Write-Host 'Migration arsip dan verifikasi database selesai. Codex melanjutkan aktivasi frontend.' -ForegroundColor Green
}catch{Write-Host $_.Exception.Message -ForegroundColor Red}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($null -ne $securePassword) {$securePassword.Dispose();$securePassword=$null}
}
[void](Read-Host 'Tekan Enter untuk menutup jendela')
