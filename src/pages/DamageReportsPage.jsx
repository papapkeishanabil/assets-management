import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import { formatDate, formatDateTime, DAMAGE_STATUS_LABELS } from '../lib/constants';

export default function DamageReportsPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_id: '', damage_type: '', description: '', urgency: 'normal', operational_impact: '', can_still_operate: true });

  useEffect(() => { fetchData(); fetchAssets(); }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('damage_reports').select('*, assets:asset_id (asset_code, asset_name), reported_user:reported_by (full_name)').order('created_at', { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  const fetchAssets = async () => {
    const { data } = await supabase.from('assets').select('id, asset_code, asset_name').eq('is_active', true);
    setAssets(data || []);
  };

  const generateReportNumber = async () => {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase.from('damage_reports').select('*', { count: 'exact', head: true });
    return `DK-${ymd}-${String((count || 0) + 1).padStart(3, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_id || !form.description) { toast.error('Isi aset dan deskripsi'); return; }
    try {
      const num = await generateReportNumber();
      const { error } = await supabase.from('damage_reports').insert([{ report_number: num, ...form, reported_by: profile.id }]);
      if (error) throw error;
      toast.success('Laporan kerusakan berhasil dibuat');
      setShowForm(false);
      setForm({ asset_id: '', damage_type: '', description: '', urgency: 'normal', operational_impact: '', can_still_operate: true });
      fetchData();
    } catch (error) { toast.error(error.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Laporan Kerusakan</h1>
          <p className="text-sm text-ink-400 mt-1">Laporkan dan pantau kerusakan aset</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={18} /> Buat Laporan</button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-5 w-5 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
        ) : reports.length === 0 ? (
          <div className="card">
            <div className="empty-state py-8">
              <div className="empty-state-icon"><AlertTriangle size={48} /></div>
              <p className="empty-state-text">Belum ada laporan kerusakan</p>
            </div>
          </div>
        ) : reports.map(r => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white font-mono">{r.report_number}</span>
                  <span className="text-xs text-ink-500">{formatDateTime(r.report_date)}</span>
                </div>
                <p className="text-sm font-medium text-ink-200">{r.assets?.asset_name} (<span className="font-mono">{r.assets?.asset_code}</span>)</p>
                <p className="text-sm text-ink-400 mt-1">{r.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-ink-500">
                  <span>Pelapor: {r.reported_user?.full_name || '-'}</span>
                  <span>Urgensi: {r.urgency}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${r.status === 'baru' ? 'badge-red' : r.status === 'selesai' ? 'badge-green' : r.status === 'sedang_ditinjau' ? 'badge-yellow' : 'badge-blue'}`}>
                  {DAMAGE_STATUS_LABELS[r.status] || r.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-danger-500/10 border border-danger-500/20">
                  <AlertTriangle size={18} className="text-danger-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Laporan Kerusakan Baru</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Aset <span className="text-danger-400">*</span></label>
                <select className="input" value={form.asset_id} onChange={e => setForm({...form, asset_id: e.target.value})} required>
                  <option value="">Pilih Aset</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.asset_code} - {a.asset_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Jenis Kerusakan</label>
                  <input type="text" className="input" value={form.damage_type} onChange={e => setForm({...form, damage_type: e.target.value})} placeholder="Contoh: Mesin mati" />
                </div>
                <div>
                  <label className="label">Tingkat Urgensi</label>
                  <select className="input" value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})}>
                    <option value="rendah">Rendah</option>
                    <option value="normal">Normal</option>
                    <option value="tinggi">Tinggi</option>
                    <option value="mendesak">Mendesak</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Deskripsi Kerusakan <span className="text-danger-400">*</span></label>
                <textarea className="input" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required placeholder="Jelaskan kerusakan yang terjadi"></textarea>
              </div>
              <div>
                <label className="label">Dampak Operasional</label>
                <textarea className="input" rows="2" value={form.operational_impact} onChange={e => setForm({...form, operational_impact: e.target.value})} placeholder="Dampak terhadap produksi"></textarea>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="can_operate" checked={form.can_still_operate} onChange={e => setForm({...form, can_still_operate: e.target.checked})} className="rounded" />
                <label htmlFor="can_operate" className="text-sm text-ink-200">Aset masih dapat dioperasikan</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">Buat Laporan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
