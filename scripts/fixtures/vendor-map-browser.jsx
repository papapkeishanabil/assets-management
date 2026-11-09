// Harness lokal, tidak diimpor aplikasi produksi dan tidak memakai database.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import VendorGoogleMap from '../../src/components/vendor/VendorGoogleMap';
import MapPicker from '../../src/components/vendor/MapPicker';

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
    <output aria-label="Pilihan vendor">{selected}</output>
    <output aria-label="Koordinat dipilih">{JSON.stringify(picked)}</output>
    {mode === 'edit' ? <MapPicker {...picked} onChange={setPicked} />
      : <VendorGoogleMap points={mode === 'many' ? many : points} onSelect={(p) => setSelected(p.location_id)} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<Harness />);
