// Harness lokal, tidak diimpor aplikasi produksi dan tidak memakai database.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import VendorMap from '../../src/components/vendor/VendorMap';
import MapPicker from '../../src/components/vendor/MapPicker';
import VendorLocationNavigation from '../../src/components/vendor/VendorLocationNavigation';

const points = [
  { location_id: 'a', business_name: 'Vendor A', location_name: 'Workshop', latitude: -6.9, longitude: 107.6 },
  { location_id: 'b', business_name: 'Vendor B', location_name: 'Gudang', latitude: -7.5, longitude: 110.3 }
];
function Harness() {
  const [mode, setMode] = useState('read'), [picked, setPicked] = useState({ latitude: -6.9, longitude: 107.6 });
  const [selected, setSelected] = useState('');
  const many = Array.from({ length: 1005 }, (_, n) => ({ ...points[0], location_id: `p${n}`, latitude: -6.9 + n / 1000000 }));
  return <main>
    <button onClick={() => setMode('read')}>Dua titik</button>
    <button onClick={() => setMode('many')}>Banyak titik</button>
    <button onClick={() => setMode('edit')}>Edit titik</button>
    <button onClick={() => setMode('same')}>Titik berimpit</button>
    <button onClick={() => setMode('invalid')}>Titik tidak valid</button>
    <output aria-label="Pilihan vendor">{selected}</output>
    <output aria-label="Koordinat dipilih">{JSON.stringify(picked)}</output>
    <VendorLocationNavigation latitude={picked.latitude} longitude={picked.longitude} />
    {mode === 'edit' ? <MapPicker {...picked} onChange={setPicked} />
      : <VendorMap points={mode === 'many' ? many : mode === 'same' ? points.map((p) => ({ ...p, latitude: -6.9, longitude: 107.6 })) : mode === 'invalid' ? [{ latitude: 91, longitude: 200 }] : points} onSelect={(p) => setSelected(p.location_id)} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<Harness />);
