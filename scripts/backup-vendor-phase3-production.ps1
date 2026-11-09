# Backup/read-only preflight. Tidak menjalankan migration, push atau deployment.
# PGPASSWORD hanya dari env sesi. Dump mengandung data privat: selalu di luar repo.
[CmdletBinding()]
param(
  [string]$BackupDirectory = 'D:\Backups',
  [switch]$PreflightOnly
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
  throw 'PGPASSWORD belum tersedia pada environment sesi. Isi secara aman; jangan kirim password di chat atau simpan di repo.'
}
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destinationRoot = [System.IO.Path]::GetFullPath($BackupDirectory)
$repositoryPrefix = $repositoryRoot.TrimEnd('\') + '\'
if ($destinationRoot.Equals($repositoryRoot, [StringComparison]::OrdinalIgnoreCase) -or $destinationRoot.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Backup berisi data produksi tidak boleh disimpan di dalam repository.'
}
if ($destinationRoot.Contains(',')) { throw 'Path backup dengan koma tidak didukung Docker mount.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDirectory = Join-Path $destinationRoot ('harmas-pre-phase3-' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $runDirectory | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8
# Target tetap sesuai koneksi backup terdokumentasi; tidak menerima target bebas.
$connection = @('--env','PGPASSWORD','--env','PGHOST=aws-0-ap-southeast-1.pooler.supabase.com',
  '--env','PGPORT=6543','--env','PGUSER=postgres.uwlxkwyauxwewoexfgwi',
  '--env','PGDATABASE=postgres','--env','PGSSLMODE=require','--env','PGCONNECT_TIMEOUT=20',
  '--env','PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=120000')
$query = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'sql\vendor-phase3-preflight-readonly.sql'))
$manifest = [ordered]@{
  target = 'https://uwlxkwyauxwewoexfgwi.supabase.co'
  started_at = [DateTime]::UtcNow.ToString('o')
  preflight_only = [bool]$PreflightOnly
  production_migration_executed = $false
  database_backup_created = $false
  application_restore_verified = $false
  supabase_platform_restore_complete = $false
  storage_blob_backup_verified = $false
  ready_for_production_migration = $false
}
function Read-ProductionSnapshot {
  # SET TRANSACTION READ ONLY berlaku sebelum SELECT apa pun pada koneksi langsung.
  $snapshotSql = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;`n$query;`nCOMMIT;"
  $snapshotLines = $snapshotSql | & docker run --rm -i @connection postgres:17 psql -X -q -A -t -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'SELECT snapshot PostgreSQL gagal; periksa koneksi/izin tanpa menampilkan password.' }
  $snapshotText = $snapshotLines -join "`n"
  $snapshotObject = $snapshotText | ConvertFrom-Json
  return $snapshotObject
}
try {
  $before = Read-ProductionSnapshot
  $preflightFile = Join-Path $runDirectory 'production-preflight.json'
  # Dua SELECT independen membuktikan stabilitas selama preflight. Dump selanjutnya
  # memakai snapshot pg_dump sendiri; baseline backup wajib dibandingkan lewat restore.
  $after = Read-ProductionSnapshot
  [System.IO.File]::WriteAllText($preflightFile, (@{
    target=$manifest.target; checked_at=[DateTime]::UtcNow.ToString('o'); before=$before; after=$after
  } | ConvertTo-Json -Depth 100), $utf8)
  & node (Join-Path $PSScriptRoot 'preflight-vendor-phase3-production.mjs') --from-file $preflightFile
  if ($LASTEXITCODE -ne 0) { throw 'Preflight belum lulus. Backup/rilis dihentikan; lihat hasil teredaksi di phase3-evidence.' }
  $manifest.preflight_pass = $true
  if (-not $PreflightOnly) {
    $dumpFile = Join-Path $runDirectory 'database.dump'
    $mount = 'type=bind,source=' + $runDirectory + ',target=/backup'
    & docker run --rm @connection --mount $mount postgres:17 pg_dump --format=custom --lock-wait-timeout=10000 --file=/backup/database.dump
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump gagal; dump parsial tidak boleh dipakai untuk rilis.' }
    $tocLines = & docker run --rm --mount ($mount + ',readonly') postgres:17 pg_restore --list /backup/database.dump
    if ($LASTEXITCODE -ne 0) { throw 'Daftar archive pg_restore gagal dibaca.' }
    [System.IO.File]::WriteAllText((Join-Path $runDirectory 'database.toc.txt'), ($tocLines -join "`n"), $utf8)
    $manifest.database_backup_created = $true
    $manifest.archive_format = 'PostgreSQL custom; ownership/ACL retained'
    $manifest.sha256 = (Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifest.bytes = (Get-Item -LiteralPath $dumpFile).Length
    $manifest.archive_list_verified = $true
    $manifest.post_dump_baseline = Read-ProductionSnapshot
    # Dump/list/hash tidak membuktikan restore atau menyertakan blob Storage.
    Write-Output 'Backup database dibuat; restore aplikasi/platform dan salinan blob Storage masih wajib diverifikasi. Belum siap migration.'
  }
  Write-Output ('Direktori bukti privat: ' + $runDirectory)
} catch {
  $manifest.failure = $_.Exception.Message
  throw
} finally {
  $manifest.finished_at = [DateTime]::UtcNow.ToString('o')
  [System.IO.File]::WriteAllText((Join-Path $runDirectory 'manifest.json'), ($manifest | ConvertTo-Json -Depth 100), $utf8)
}
