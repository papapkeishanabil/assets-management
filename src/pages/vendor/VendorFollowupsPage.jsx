import { useSearchParams } from 'react-router-dom';
import VendorFollowupsPanel from '../../components/vendor/VendorFollowupsPanel';

export default function VendorFollowupsPage() {
  const [params] = useSearchParams();
  const candidate = params.get('candidate') || '';
  const overdue = params.get('overdue') === '1';
  return <div className="space-y-6 animate-fade-in">
    <div><h1 className="text-2xl md:text-3xl font-semibold text-white">Follow-Up Vendor</h1><p className="text-sm text-ink-400 mt-1">Komunikasi dan tindak lanjut lintas calon vendor</p></div>
    <VendorFollowupsPanel key={`${candidate}:${overdue}`} initialCandidate={candidate} initialOverdue={overdue} />
  </div>;
}
