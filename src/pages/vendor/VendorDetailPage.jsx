import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, RefreshCw, Clock, History, Layers, MapPin, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import {
  PROCESS_STAGE, PROCESS_STAGE_LABELS, PROCESS_STAGE_BADGES, PROCESS_STAGE_FLOW,
  QUALIFICATION_LABELS, QUALIFICATION_BADGES,
  OPERATIONAL_LABELS, OPERATIONAL_BADGES,
  VENDOR_SOURCES, LEGAL_STATUS, LEGAL_STATUS_BADGES, BUSINESS_TYPES,
  VENDOR_WRITE_ROLES, DECISION_QUALIFICATION_STATUSES
} from '../../lib/vendor-constants';
import { fetchVendorCandidateDetail, fetchCandidateHistory, formatRupiah } from '../../lib/vendor-helpers';
import { formatDateID } from '../../lib/maintenance-helpers';
import VendorFormModal from '../../components/vendor/VendorFormModal';

// Tab yang hadir di fase berikutnya (placeholder agar struktur jelas).
const FUTURE_TABS = [
  { key: 'followup', label: 'Follow-Up', phase: 'Fase 2' },
  { key: 'sample', label: 'Sampel & QC', phase: 'Fase 4' },
  { key: 'location', label: 'Lokasi & Foto', phase: 'Fase 3' },
  { key: 'decision', label: 'Keputusan', phase: 'Fase 5' }
];

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-ink-500 mb-1">{label}</p>
      <p className="text-sm text-white font-medium leading-relaxed">{value ?? '-'}</p>
    </div>
  );
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const canWrite = role && VENDOR_WRITE_ROLES.includes(role.role_name);
  // Persetujuan akhir tidak operasional di Fase 1: nilai keputusan
  // disembunyikan dari SEMUA role — nanti hanya via mekanisme persetujuan
  // khusus Fase 5 (guard DB juga memblokir UPDATE langsung by siapa pun).
  const qualificationOptions = Object.entries(QUALIFICATION_LABELS).filter(
    ([value]) => !DECISION_QUALIFICATION_STATUSES.includes(value)
  );

  const [candidate, setCandidate] = useState(null);
  const [history, setHistory] = useState({ statusHistory: [], activityLogs: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [showForm, setShowForm] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, hist] = await Promise.all([
        fetchVendorCandidateDetail(id),
        fetchCandidateHistory(id)
      ]);
      setCandidate(detail);
      setHistory(hist);
    } catch (error) {
      console.error('Error loading vendor candidate:', error);
      toast.error('Gagal memuat detail calon vendor');
      navigate('/vendor/database');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showForm) return;
    Promise.all([
      supabase.from('vendor_categories').select('*, specialties:vendor_specialties(*)').order('display_order'),
      supabase.from('user_profiles').select('id, full_name').eq('account_status', 'ACTIVE').order('full_name')
    ]).then(([cats, usrs]) => {
      setCategories(cats.data || []);
      setUsers(usrs.data || []);
    });
  }, [showForm]);

  // Ubah dimensi status dari detail — trigger mencatat riwayat otomatis.
  const changeStatus = async (field, value) => {
    if (!candidate || candidate[field] === value) return;
    setSavingStatus(true);
    try {
      const { error } = await supabase
        .from('vendor_candidates')
        .update({ [field]: value, updated_by: profile?.id })
        .eq('id', candidate.id);
      if (error) throw error;
      toast.success('Status diperbarui (tercatat di riwayat)');
      load();
    } catch (error) {
      toast.error(`Gagal mengubah status: ${error.message}`);
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-64 bg-white/5 rounded-md animate-pulse"></div>
        <div className="card p-6 h-64 animate-pulse"></div>
      </div>
    );
  }

  if (!candidate) return null;

  const contactPrimary = candidate.contacts.find((c) => c.is_primary) || candidate.contacts[0];
  const currentFlowIdx = PROCESS_STAGE_FLOW.indexOf(candidate.process_stage);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/vendor/database')} className="btn-ghost text-xs text-ink-400 hover:text-white mb-2 -ml-2">
            <ArrowLeft size={14} /> Database Calon Vendor
          </button>
          <p className="font-mono text-xs text-primary-400">{candidate.candidate_code}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mt-1">{candidate.business_name}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={PROCESS_STAGE_BADGES[candidate.process_stage]}>{PROCESS_STAGE_LABELS[candidate.process_stage]}</span>
            <span className={QUALIFICATION_BADGES[candidate.qualification_status]}>{QUALIFICATION_LABELS[candidate.qualification_status]}</span>
            <span className={OPERATIONAL_BADGES[candidate.operational_status]}>{OPERATIONAL_LABELS[candidate.operational_status]}</span>
            {candidate.vendor_id && <span className="badge-green">Terhubung Master Vendor</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canWrite && (
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
              <Edit size={14} /> Edit Profil
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
            activeTab === 'summary' ? 'border-primary-400 text-white' : 'border-transparent text-ink-400 hover:text-white'
          }`}
        >
          <Layers size={14} className="inline mr-1.5 -mt-0.5" /> Ringkasan
        </button>
        {FUTURE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === t.key ? 'border-primary-400 text-white' : 'border-transparent text-ink-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
            activeTab === 'history' ? 'border-primary-400 text-white' : 'border-transparent text-ink-400 hover:text-white'
          }`}
        >
          <History size={14} className="inline mr-1.5 -mt-0.5" /> Riwayat
        </button>
      </div>

      {/* Placeholder fase berikutnya */}
      {FUTURE_TABS.some((t) => t.key === activeTab) && (
        <div className="card p-10 text-center">
          <div className="inline-flex p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 mb-3">
            {activeTab === 'location' ? <MapPin size={22} className="text-primary-400" />
              : activeTab === 'sample' ? <ClipboardCheck size={22} className="text-primary-400" />
              : <CheckCircle2 size={22} className="text-primary-400" />}
          </div>
          <h3 className="text-white font-semibold">Tab {FUTURE_TABS.find((t) => t.key === activeTab)?.label} — {FUTURE_TABS.find((t) => t.key === activeTab)?.phase}</h3>
          <p className="text-sm text-ink-400 mt-1 max-w-md mx-auto">
            Bagian ini hadir pada {FUTURE_TABS.find((t) => t.key === activeTab)?.phase} sesuai rencana implementasi bertahap.
          </p>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Profil Vendor</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoItem label="Jenis" value={BUSINESS_TYPES[candidate.business_type]} />
                <InfoItem label="Kategori" value={candidate.category?.name} />
                <InfoItem label="Spesialisasi" value={
                  candidate.specialties?.length
                    ? candidate.specialties.map((s) => s.name).join(', ')
                    : <span className="text-ink-500">Belum dicatat</span>
                } />
                <InfoItem label="Sumber Lead" value={VENDOR_SOURCES[candidate.source]} />
                <InfoItem label="PIC Harmas" value={candidate.internal_pic?.full_name || <span className="text-ink-500">Belum ditugaskan</span>} />
                <InfoItem label="Status Legal">
                  <span className={LEGAL_STATUS_BADGES[candidate.legal_status]}>{LEGAL_STATUS[candidate.legal_status]}</span>
                </InfoItem>
                <InfoItem label="Kapasitas / Bulan" value={
                  candidate.capacity_qty
                    ? `${Number(candidate.capacity_qty).toLocaleString('id-ID')} ${candidate.capacity_unit || ''}`
                    : <span className="text-ink-500">Belum diketahui</span>
                } />
                <InfoItem label="Minimum Order" value={candidate.moq} />
                <InfoItem label="Lead Time" value={candidate.lead_time_days ? `${candidate.lead_time_days} hari` : null} />
                <InfoItem label="Harga Indikatif" value={candidate.indicative_price ? formatRupiah(candidate.indicative_price) : null} />
                <InfoItem label="Termin Pembayaran" value={candidate.payment_term} />
                <InfoItem label="Area Layanan" value={candidate.service_area} />
              </div>
              {candidate.notes && (
                <div className="mt-5 pt-4 border-t border-white/5">
                  <InfoItem label="Catatan" value={candidate.notes} />
                </div>
              )}
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Kontak Vendor</h3>
              {candidate.contacts.length === 0 ? (
                <p className="text-sm text-ink-500">Belum ada kontak tercatat.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidate.contacts.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium">{c.contact_name}</p>
                        {c.is_primary && <span className="badge-blue">Utama</span>}
                      </div>
                      <p className="text-xs text-ink-400 mt-1">{c.role_title || '—'}</p>
                      <div className="text-xs text-ink-300 mt-2 space-y-0.5">
                        {c.phone && <p>Telepon: {c.phone}</p>}
                        {c.whatsapp && <p>WhatsApp: {c.whatsapp}</p>}
                        {c.email && <p>Email: {c.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Progres Kualifikasi</h3>
              <p className="text-[11px] text-ink-500 mb-4">Tahap proses — dimensi terpisah dari kelayakan & operasional</p>
              {candidate.process_stage === PROCESS_STAGE.ABANDONED ? (
                <p className="text-sm text-ink-400">Pipeline tidak dilanjutkan.</p>
              ) : (
                <>
                  <div className="flex gap-1 mb-2">
                    {PROCESS_STAGE_FLOW.map((stage, i) => (
                      <div
                        key={stage}
                        title={PROCESS_STAGE_LABELS[stage]}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < currentFlowIdx ? 'bg-success-500' : i === currentFlowIdx ? 'bg-warning-400' : 'bg-white/10'
                        }`}
                      ></div>
                    ))}
                  </div>
                  <p className="text-xs text-ink-400 mb-4">
                    Tahap {currentFlowIdx + 1} dari {PROCESS_STAGE_FLOW.length}: <span className="text-white">{PROCESS_STAGE_LABELS[candidate.process_stage]}</span>
                  </p>
                </>
              )}

              {canWrite && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div>
                    <label className="text-[11px] text-ink-500 block mb-1">Ubah Tahap Proses</label>
                    <select className="input" value={candidate.process_stage} disabled={savingStatus} onChange={(e) => changeStatus('process_stage', e.target.value)}>
                      {Object.entries(PROCESS_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-500 block mb-1">Ubah Kelayakan</label>
                    <select
                      className="input"
                      value={candidate.qualification_status}
                      disabled={savingStatus || DECISION_QUALIFICATION_STATUSES.includes(candidate.qualification_status)}
                      onChange={(e) => changeStatus('qualification_status', e.target.value)}
                    >
                      {qualificationOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <p className="text-[10px] text-ink-500 mt-1">
                      Keputusan akhir (Disetujui/Cadangan/Ditolak/Dibekukan) ditetapkan Direksi/Super Admin melalui mekanisme persetujuan khusus — hadir pada Fase 5.
                    </p>
                  </div>
                  <p className="text-[10px] text-ink-500 leading-relaxed">
                    Setiap perubahan tercatat otomatis di tab Riwayat (siapa & kapan). Status operasional (aktif) hanya berubah lewat aktivasi persetujuan — Fase 5.
                  </p>
                </div>
              )}
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Ringkasan Aktivitas Terbaru</h3>
              {history.activityLogs.length === 0 && history.statusHistory.length === 0 ? (
                <p className="text-sm text-ink-500">Belum ada aktivitas.</p>
              ) : (
                <div className="space-y-3">
                  {history.statusHistory.slice(0, 3).map((h) => (
                    <div key={`s-${h.id}`} className="flex gap-3">
                      <Clock size={13} className="text-ink-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white">
                          {h.field_name === 'process_stage' ? 'Tahap' : h.field_name === 'qualification_status' ? 'Kelayakan' : 'Operasional'}:{' '}
                          {h.old_value} → {h.new_value}
                        </p>
                        <p className="text-[10px] text-ink-500">{h.changed_by?.full_name || 'Sistem'} · {formatDateID(h.changed_at?.slice(0, 10))}</p>
                      </div>
                    </div>
                  ))}
                  {history.activityLogs.slice(0, 2).map((a) => (
                    <div key={`a-${a.id}`} className="flex gap-3">
                      <History size={13} className="text-ink-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white">{a.action === 'created' ? 'Kandidat dibuat' : 'Profil diperbarui'}</p>
                        <p className="text-[10px] text-ink-500">{a.actor?.full_name || 'Sistem'} · {formatDateID(a.created_at?.slice(0, 10))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Riwayat Lengkap</h3>
          <p className="text-[11px] text-ink-500 mb-5">Perubahan status & aktivitas tidak saling menimpa (spec §2)</p>
          {history.statusHistory.length === 0 && history.activityLogs.length === 0 ? (
            <p className="text-sm text-ink-500">Belum ada riwayat.</p>
          ) : (
            <div className="space-y-0 max-h-[600px] overflow-y-auto pr-2">
              {(() => {
                const items = [
                  ...history.statusHistory.map((h) => ({
                    key: `s-${h.id}`,
                    at: h.changed_at,
                    who: h.changed_by?.full_name || 'Sistem',
                    title: h.field_name === 'process_stage' ? 'Tahap Proses diubah' : h.field_name === 'qualification_status' ? 'Status Kelayakan diubah' : 'Status Operasional diubah',
                    detail: `${h.field_name === 'process_stage' ? PROCESS_STAGE_LABELS[h.old_value] : h.field_name === 'qualification_status' ? QUALIFICATION_LABELS[h.old_value] : OPERATIONAL_LABELS[h.old_value]} → ${h.field_name === 'process_stage' ? PROCESS_STAGE_LABELS[h.new_value] : h.field_name === 'qualification_status' ? QUALIFICATION_LABELS[h.new_value] : OPERATIONAL_LABELS[h.new_value]}`
                  })),
                  ...history.activityLogs.map((a) => ({
                    key: `a-${a.id}`,
                    at: a.created_at,
                    who: a.actor?.full_name || 'Sistem',
                    title: a.action === 'created' ? 'Kandidat dibuat' : a.action === 'profile_updated' ? 'Profil diperbarui' : a.action,
                    detail: a.new_values?.business_name ? `"${a.new_values.business_name}"` : ''
                  }))
                ].sort((a, b) => new Date(b.at) - new Date(a.at));

                return items.map((item) => (
                  <div key={item.key} className="relative pl-6 pb-6 border-l border-white/5 ml-2 last:pb-0">
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-primary-500/60 border-2 border-ink-950 -left-[5px] top-1"></div>
                    <p className="text-sm text-white font-medium">{item.title}</p>
                    {item.detail && <p className="text-xs text-ink-300 mt-0.5">{item.detail}</p>}
                    <p className="text-[10px] text-ink-500 mt-1">{item.who} · {formatDateID(item.at?.slice(0, 10))} {item.at?.slice(11, 16)}</p>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      <VendorFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
        editing={candidate}
        categories={categories}
        users={users}
        currentUserId={profile?.id}
      />
    </div>
  );
}
