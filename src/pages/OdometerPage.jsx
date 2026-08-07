import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Gauge, Plus, X } from 'lucide-react';
import { formatDate } from '../lib/constants';

export default function OdometerPage() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ current_odometer: '', notes: '' });

  useEffect(() => {
    fetchVehicleAssets();
  }, []);

  const fetchVehicleAssets = async () => {
    try {
      const { data: kendCategory } = await supabase
        .from('asset_categories')
        .select('id')
        .eq('category_code', 'KEND')
        .single();

      if (!kendCategory) {
        setAssets([]);
        setLoading(false);
        return;
      }

      const { data: vehicleCategoryIds } = await supabase
        .from('asset_categories')
        .select('id')
        .eq('parent_category_id', kendCategory.id);

      if (!vehicleCategoryIds?.length) {
        setAssets([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('assets')
        .select(`*, categories:category_id (category_name)`)
        .eq('is_active', true)
        .in('category_id', vehicleCategoryIds.map(c => c.id))
        .order('asset_name');
      setAssets(data || []);
      if (data?.length > 0) setSelectedAsset(data[0].id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (assetId) => {
    if (!assetId) return;
    const { data } = await supabase
      .from('odometer_logs')
      .select('*, submitted_user:submitted_by (full_name)')
      .eq('asset_id', assetId)
      .order('log_date', { ascending: false })
      .limit(20);
    setLogs(data || []);
  };

  const handleSelectAsset = (assetId) => {
    setSelectedAsset(assetId);
    fetchLogs(assetId);
    const asset = assets.find(a => a.id === assetId);
    if (asset) setForm(prev => ({ ...prev, current_odometer: asset.current_odometer || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset || !form.current_odometer) {
      toast.error('Isi kilometer terbaru');
      return;
    }
    try {
      const asset = assets.find(a => a.id === selectedAsset);
      const prev = parseFloat(asset?.current_odometer || 0);
      const current = parseFloat(form.current_odometer);

      if (current <= prev && profile?.role !== 'super_admin') {
        toast.error('Kilometer baru harus lebih besar dari sebelumnya');
        return;
      }

      const { error } = await supabase.from('odometer_logs').insert([{
        asset_id: selectedAsset,
        previous_odometer: prev,
        current_odometer: current,
        distance_difference: current - prev,
        notes: form.notes,
        submitted_by: profile.id
      }]);
      if (error) throw error;

      await supabase.from('assets').update({ current_odometer: current }).eq('id', selectedAsset);

      toast.success('Kilometer berhasil diperbarui');
      setShowForm(false);
      setForm({ current_odometer: '', notes: '' });
      fetchLogs(selectedAsset);
      fetchVehicleAssets();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Kilometer Kendaraan</h1>
          <p className="text-sm text-ink-400 mt-1">Catat dan pantau kilometer kendaraan</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} /> Catat Kilometer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Pilih Kendaraan</h3>
            <div className="space-y-2">
              {assets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => handleSelectAsset(asset.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedAsset === asset.id ? '!bg-primary-500/10 !text-primary-300 !border-primary-500/20' : 'border-white/5 hover:bg-white/5'
                  }`}
                >
                  <p className="text-sm font-medium text-white">{asset.asset_name}</p>
                  <p className="text-xs text-ink-400 font-mono">{asset.asset_code} | {Number(asset.current_odometer || 0).toLocaleString()} km</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Riwayat Kilometer</h3>
            {logs.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon"><Gauge size={40} /></div>
                <p className="empty-state-text">Belum ada data kilometer</p>
              </div>
            ) : (
              <div className="table-container border-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kilometer Sebelum</th>
                      <th>Kilometer Baru</th>
                      <th>Selisih</th>
                      <th>Dicatat Oleh</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td>{formatDate(log.log_date)}</td>
                        <td className="font-mono">{Number(log.previous_odometer || 0).toLocaleString()} km</td>
                        <td className="font-medium font-mono">{Number(log.current_odometer).toLocaleString()} km</td>
                        <td className="font-mono text-success-400">+{Number(log.distance_difference || 0).toLocaleString()} km</td>
                        <td>{log.submitted_user?.full_name || '-'}</td>
                        <td className="max-w-[200px] truncate">{log.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Gauge size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Catat Kilometer</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Kendaraan</label>
                <select className="input" value={selectedAsset || ''} onChange={e => handleSelectAsset(e.target.value)} required>
                  <option value="">Pilih Kendaraan</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Kilometer Saat Ini</label>
                <input type="number" className="input" value={form.current_odometer} onChange={e => setForm({...form, current_odometer: e.target.value})} placeholder="Contoh: 50000" required />
              </div>
              <div>
                <label className="label">Catatan</label>
                <textarea className="input" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Opsional"></textarea>
              </div>
              <button type="submit" className="btn-primary w-full">Simpan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
