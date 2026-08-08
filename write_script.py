path = r'E:\PROJECT AI\Harmas Assets Management\src\pages\PPMCreateMeetingPage.jsx'
with open(path, 'a', encoding='utf-8') as f:
    f.write('  if (!canCreate) { return (<div className="page-container"><div className="empty-state"><div className="empty-state-icon"><Calendar size={48} /></div><h3 className="empty-state-title">Akses Ditolak</h3><p className="empty-state-text">Anda tidak memiliki permission untuk membuat meeting PPM.</p></div></div>); }')
print('part 1')
