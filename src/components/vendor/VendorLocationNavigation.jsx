import { Navigation } from 'lucide-react';
import { googleMapsUrl, vendorDirectionsUrl } from '../../lib/vendor-location-utils';

export default function VendorLocationNavigation({ latitude, longitude, showView = true }) {
  const view = googleMapsUrl(latitude, longitude), route = vendorDirectionsUrl(latitude, longitude);
  if (!route) return null;
  return <span role="group" aria-label="Navigasi lokasi" className="inline-flex flex-wrap items-center gap-3">
    {showView && <a className="text-primary-400 underline" href={view} target="_blank" rel="noopener noreferrer">Buka Google Maps</a>}
    <a className="inline-flex items-center gap-1 text-primary-400 underline" href={route} target="_blank" rel="noopener noreferrer"><Navigation size={14} aria-hidden="true" /> Rute ke Lokasi</a>
  </span>;
}
