import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Printer, QrCode, Square } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import './AssetQrLabelsPage.css';

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://harmas-asset-management.vercel.app').replace(/\/$/, '');

export default function AssetQrLabelsPage(){
  const navigate=useNavigate(); const [params]=useSearchParams();
  const [assets,setAssets]=useState([]); const [selectedIds,setSelectedIds]=useState([]);
  const [qrMap,setQrMap]=useState({}); const [search,setSearch]=useState(''); const [loading,setLoading]=useState(true); const [printMode,setPrintMode]=useState('a4');
  useEffect(()=>{(async()=>{
    const {data}=await supabase.from('assets').select('id,asset_code,asset_name,qr_token,label_number,is_active').order('label_number');
    const rows=(data||[]).filter(a=>a.qr_token); setAssets(rows);
    const requested=(params.get('ids')||'').split(',').filter(Boolean);
    setSelectedIds(requested.length?requested:rows.filter(a=>a.is_active).map(a=>a.id));
    const generated=await Promise.all(rows.map(async a=>[a.id,await QRCode.toDataURL(`${PUBLIC_APP_URL}/scan/assets/${a.qr_token}`,{errorCorrectionLevel:'Q',margin:4,width:420})]));
    setQrMap(Object.fromEntries(generated)); setLoading(false);
  })()},[]);
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return q?assets.filter(a=>`${a.asset_code} ${a.asset_name}`.toLowerCase().includes(q)):assets},[assets,search]);
  const selected=assets.filter(a=>selectedIds.includes(a.id));
  const printPages=printMode==='a4'?Array.from({length:Math.ceil(selected.length/18)},(_,i)=>selected.slice(i*18,i*18+18)):selected.map(a=>[a]);
  const toggle=id=>setSelectedIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  return <div className="space-y-5 animate-fade-in qr-label-page">
    <style>{`@media print{@page{size:${printMode==='a4'?'A4':'60mm 40mm'};margin:${printMode==='a4'?'0':'0'}}}`}</style>
    <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3"><button onClick={()=>navigate('/assets')} className="p-2 hover:bg-white/5 rounded-md"><ArrowLeft size={18}/></button><div><h1 className="text-2xl font-semibold text-white">Cetak Label QR Aset</h1><p className="text-sm text-ink-400 mt-1">Label 60 × 40 mm dengan pratinjau sesuai ukuran kertas.</p></div></div>
      <button onClick={()=>window.print()} disabled={!selected.length||loading} className="btn-primary"><Printer size={15}/>Cetak {selected.length} Label</button>
    </div>
    <div className="no-print grid lg:grid-cols-[340px_1fr] gap-5">
      <aside className="card lg:sticky lg:top-5 lg:self-start"><label className="label">Format kertas</label><select className="input mb-4" value={printMode} onChange={e=>setPrintMode(e.target.value)}><option value="a4">A4 - 18 label per lembar</option><option value="roll">Printer label - 60 × 40 mm</option></select><label className="label">Pilih aset</label><input className="input mb-3" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari kode atau nama aset..."/><div className="flex gap-2 mb-3"><button className="btn-secondary text-xs flex-1" onClick={()=>setSelectedIds(assets.map(a=>a.id))}><CheckSquare size={13}/>Semua</button><button className="btn-secondary text-xs flex-1" onClick={()=>setSelectedIds([])}><Square size={13}/>Kosongkan</button></div><div className="max-h-[52vh] overflow-y-auto space-y-1 pr-1">{filtered.map(a=><label key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer"><input type="checkbox" checked={selectedIds.includes(a.id)} onChange={()=>toggle(a.id)}/><span className="min-w-0"><span className="block text-xs font-mono text-primary-400">{a.asset_code}</span><span className="block text-sm text-ink-200 truncate">{a.asset_name}</span></span></label>)}</div></aside>
      <section className="card overflow-auto"><div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><QrCode size={17} className="text-primary-400"/><h2 className="font-semibold text-white">Pratinjau Kertas</h2></div><span className="text-xs text-ink-500">{printMode==='a4'?`${printPages.length} lembar A4`:`${selected.length} label dalam satu roll`}</span></div>{loading?<p className="text-sm text-ink-400">Membuat QR Code...</p>:<><div className={`paper-preview ${printMode==='a4'?'paper-a4':'paper-roll'}`}>{selected.slice(0,printMode==='a4'?18:selected.length).map(a=><AssetLabel key={a.id} asset={a} qr={qrMap[a.id]}/>)}</div>{printMode==='a4'&&printPages.length>1&&<p className="text-sm text-ink-400 mt-3 text-center">Pratinjau menampilkan lembar pertama. {printPages.length-1} lembar berikutnya ikut dicetak.</p>}{printMode==='roll'&&selected.length>1&&<p className="text-sm text-ink-400 mt-3 text-center">Roll berlanjut ke bawah sebanyak {selected.length} label.</p>}</>}</section>
    </div>
    <div className={`qr-print-area print-${printMode}`}>{printPages.map((page,pageIndex)=><div className="print-sheet" key={pageIndex}>{page.map(a=><AssetLabel key={a.id} asset={a} qr={qrMap[a.id]}/>)}</div>)}</div>
  </div>;
}
function AssetLabel({asset,qr}){const uniqueNumber=String(asset.label_number).padStart(4,'0');return <article className="asset-qr-label"><div className="asset-qr-code">{qr&&<img src={qr} alt={`QR ${asset.asset_code}`}/>}</div><div className="asset-qr-copy"><div className="asset-qr-brand">HARMAS</div><div className="asset-qr-number">ASET {uniqueNumber}</div><div className="asset-qr-full-code">{asset.asset_code}</div><div className="asset-qr-name">{asset.asset_name}</div><div className="asset-qr-help">SCAN INFO &amp; CATAT SERVICE</div></div></article>}
