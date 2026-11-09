# Terminal interaktif: user memasukkan password sendiri. Tidak menjalankan migration.
[CmdletBinding()]
param([string]$BackupDirectory = 'D:\Backups')
$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repositoryRoot
$statusFile = Join-Path $repositoryRoot '.vercel\phase3-activation-status.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-ActivationStatus([string]$State, [string]$Message) {
  $status = [ordered]@{ state=$State; message=$Message; pid=$PID; updated_at=[DateTime]::UtcNow.ToString('o'); production_migration_executed=$false }
  [System.IO.File]::WriteAllText($statusFile, ($status | ConvertTo-Json), $utf8)
}
$securePassword = $null
try {
  $Host.UI.RawUI.WindowTitle = 'HARMAS - Preflight dan Backup Fase 3 (tanpa migration)'
  Write-Host 'HARMAS - Preflight read-only dan backup PostgreSQL produksi' -ForegroundColor Cyan
  Write-Host 'Target: project uwlxkwyauxwewoexfgwi. Tidak menjalankan migration, push atau deploy.'
  Write-Host 'Password tidak ditampilkan, tidak disimpan ke file, dan dihapus dari env sesi setelah selesai.'
  Write-Host 'Gunakan password koneksi PostgreSQL Supabase, bukan password login aplikasi HARMAS.'
  Write-ActivationStatus 'WAITING_FOR_PASSWORD' 'Menunggu input password koneksi PostgreSQL di terminal interaktif.'
  $securePassword = Read-Host 'Password PostgreSQL HARMAS' -AsSecureString
  $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
  if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) { throw 'Password kosong; tidak membuat koneksi.' }
  Write-ActivationStatus 'BACKUP_RUNNING' 'Preflight dan backup sedang berjalan; migration tidak dijalankan.'
  & (Join-Path $PSScriptRoot 'backup-vendor-phase3-production.ps1') -BackupDirectory $BackupDirectory
  Write-ActivationStatus 'BACKUP_CREATED_RESTORE_PENDING' 'Driver selesai; verifikasi manifest, restore aplikasi/platform dan blob Storage masih diperlukan.'
  Write-Host 'Driver selesai. Backup belum dianggap lengkap sebelum restore dan blob Storage terverifikasi.' -ForegroundColor Green
} catch {
  Write-ActivationStatus 'FAILED_OR_CANCELLED' 'Preflight/backup tidak selesai. Periksa pesan pada terminal; jangan menjalankan migration.'
  Write-Host ('Tidak selesai: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($null -ne $securePassword) { $securePassword.Dispose(); $securePassword = $null }
}
Write-Host 'Migration produksi tetap memerlukan persetujuan tersendiri.'
[void](Read-Host 'Tekan Enter untuk menutup jendela')
