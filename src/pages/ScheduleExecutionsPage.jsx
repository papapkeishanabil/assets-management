import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { History, CalendarRange, CalendarDays, Wrench, ClipboardCheck } from 'lucide-react';
import { formatDate, formatDateTime } from '../lib/constants';

const PERIODS = [
  { key: 'all', label: 'Semua', months: null },
  { key: '1m', label: '1 Bulan', months: 1 },
  { key: '3m', label: '3 Bulan', months: 3 },
  { key: '6m', label: '6 Bulan', months: 6 },
  { key: '1y', label: '1 Tahun', months: 12 }
];

function cutOffDate(months) {
  const d = new Date();
  if (months) d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function ScheduleExecutionsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_records')
        .select(`
          *,
          assets:asset_id (asset_code, asset_name),
          work_orders:work_order_id (id, work_order_number, assigned_user_id),
          performed_user:performed_by (full_name)
        `)
        .order('maintenance_date', { ascending: false })
        .limit(500);

      const periodDef = PERIODS.find(p => p.key === period);
      const cutoff = periodDef?.months ? cutOffDate(periodDef.months) : (dateFrom || null);
      if (cutoff) query = query.gte('maintenance_date', cutoff);
      if (dateTo) query = query.lte('maintenance_date', dateTo);
      if (search) query = query.or(`assets.asset_name.ilike.%${search}%,assets.asset_code.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching schedule executions:', error);
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const isInspection = (r) => r.inspection_status != null;

  return (
    <div className="page-container">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title mb-1">Pelaksanaan Jadwal</h1>
          <p className="text-sm text-ink-400">
            Daftar seluruh pelaksanaan jadwal pemeliharaan (kunjungan) yang telah dilakukan, dengan filter periode.
          </p>
        </div>
      </div>

      {/* Filter periode */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              period === p.key
                ? 'bg-primary-500/15 text-primary-300 border-primary-500/40'
                : 'bg-white/5 text-ink-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter rentang kustom & pencarian */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="label">Dari</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Sampai</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">Cari Aset</label>
          <input
            type="text"
            className="input"
            placeholder="Nama / kode aset..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Ringkasan */}
      <div className="flex items-center gap-2 text-sm text-ink-400 mb-3">
        <CalendarRange size={16} className="text-primary-400" />
        <span>
          Menampilkan <b className="text-white">{records.length}</b> pelaksanaan
          {period !== 'all' && (<> dalam periode <b className="text-primary-300">{PERIODS.find(p => p.key === period)?.label}</b></>)}
        </span>
      </div>

      <div className="card p-0">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state py-14">
            <div className="empty-state-icon"><History size={48} /></div>
            <p className="empty-state-text">Tidak ada pelaksanaan pada periode ini</p>
          </div>
        ) : (
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Aset</th>
                  <th>Kegiatan</th>
                  <th>Pelaksana</th>
                  <th>Hasil</th>
                  <th>Sumber</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formatDate(r.maintenance_date)}</td>
                    <td>
                      <div className="font-medium text-white">{r.assets?.asset_name || '-'}</div>
                      <div className="text-xs text-ink-500 font-mono">{r.assets?.asset_code || ''}</div>
                    </td>
                    <td className="max-w-[220px]">
                      <div className="truncate">{r.work_description || '-'}</div>
                    </td>
                    <td>{r.performed_user?.full_name || '-'}</td>
                    <td>
                      {r.inspection_status === 'selesai' ? (
                        <span className={`badge ${r.needs_repair ? 'badge-red' : 'badge-green'}`}>
                          {r.condition_assessment || (r.needs_repair ? 'Perlu Perbaikan' : 'Baik')}
                        </span>
                      ) : r.inspection_status ? (
                        <span className="badge badge-yellow">Menunggu Penilaian</span>
                      ) : (
                        <span className="badge badge-blue">Tercatat</span>
                      )}
                    </td>
                    <td>
                      {isInspection(r) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-300">
                          <ClipboardCheck size={14} className="text-primary-400" /> Pemeriksaan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-300">
                          <Wrench size={14} className="text-warning-400" /> Pemeliharaan
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {isInspection(r) && (
                        <Link to={`/inspections/${r.id}`} className="px-3 py-1.5 rounded-lg text-sm font-medium btn-primary">
                          Lihat
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

