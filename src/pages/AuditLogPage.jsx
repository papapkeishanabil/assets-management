import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Search, RefreshCw } from 'lucide-react';
import { formatDateTime } from '../lib/constants';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, user:user_id (full_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs(data || []);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (log.user?.full_name || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.table_name || '').toLowerCase().includes(q) ||
      (log.reason || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Audit Trail</h1>
          <p className="text-sm text-ink-400 mt-1">Catatan aktivitas pengguna dalam sistem</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Cari pengguna, aksi, tabel, atau alasan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Shield size={48} /></div>
            <h3 className="empty-state-title">Belum ada aktivitas tercatat</h3>
            <p className="empty-state-text">Aktivitas pengguna akan muncul di sini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Aksi</th>
                  <th>Tabel</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover-card">
                    <td className="text-xs font-mono text-[12px] text-ink-300 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="font-medium text-white">{log.user?.full_name || '-'}</td>
                    <td>
                      <span className={`badge ${log.action === 'insert' ? 'badge-green' : log.action === 'update' ? 'badge-yellow' : log.action === 'delete' ? 'badge-red' : 'badge-blue'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-[12px] text-ink-300">{log.table_name || '-'}</td>
                    <td className="max-w-xs truncate text-xs text-ink-400">{log.reason || '-'}</td>
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
