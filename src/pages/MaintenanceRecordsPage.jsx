import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { History, Search } from 'lucide-react';
import { formatDate, formatCurrency } from '../lib/constants';

export default function MaintenanceRecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    const { data } = await supabase
      .from('maintenance_records')
      .select('*, assets:asset_id (asset_code, asset_name), work_orders:work_order_id (work_order_number), performed_user:performed_by (full_name), verified_user:verified_by (full_name)')
      .order('maintenance_date', { ascending: false })
      .limit(100);
    setRecords(data || []);
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="page-title mb-1">Riwayat Pemeliharaan</h1>
        <p className="text-sm text-ink-400">Seluruh riwayat pemeliharaan aset</p>
      </div>
      <div className="card p-0">
        {loading ? <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
        : records.length === 0 ? <div className="empty-state py-12"><div className="empty-state-icon"><History size={48} /></div><p className="empty-state-text">Belum ada riwayat pemeliharaan</p></div>
        : <div className="table-container border-0"><table className="table"><thead><tr><th>Tanggal</th><th>WO</th><th>Aset</th><th>Deskripsi</th><th>Biaya</th><th>Pelaksana</th><th>Status</th></tr></thead><tbody>
          {records.map(r => <tr key={r.id}>
            <td>{formatDate(r.maintenance_date)}</td>
            <td className="font-mono text-[12px]">{r.work_orders?.work_order_number || '-'}</td>
            <td>{r.assets?.asset_name || '-'}</td>
            <td className="max-w-xs truncate">{r.work_description || '-'}</td>
            <td>{formatCurrency(r.total_cost)}</td>
            <td>{r.performed_user?.full_name || '-'}</td>
            <td><span className={`badge ${r.verification_status === 'selesai' ? 'badge-green' : r.verification_status === 'menunggu' ? 'badge-yellow' : 'badge-red'}`}>{r.verification_status || 'Menunggu'}</span></td>
          </tr>)}
        </tbody></table></div>}
      </div>
    </div>
  );
}
