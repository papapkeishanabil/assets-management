import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, SCHEDULE_STATUS_LABELS } from '../lib/constants';

export default function CalendarPage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { fetchSchedules(); }, [currentMonth]);

  const fetchSchedules = async () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const { data } = await supabase
      .from('maintenance_schedules')
      .select('*, assets:asset_id (asset_code, asset_name), maintenance_types:maintenance_type_id (maintenance_name)')
      .gte('next_maintenance_date', start.toISOString().split('T')[0])
      .lte('next_maintenance_date', end.toISOString().split('T')[0])
      .eq('is_active', true)
      .order('next_maintenance_date');
    setSchedules(data || []);
    setLoading(false);
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getSchedulesForDate = (day) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return schedules.filter(s => s.next_maintenance_date === dateStr);
  };

  const getStatusColor = (status) => {
    const map = { aman: 'bg-success-500', mendekati_jadwal: 'bg-warning-500', jatuh_tempo: 'bg-orange-500', terlambat: 'bg-danger-500' };
    return map[status] || 'bg-ink-500';
  };

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Kalender Pemeliharaan</h1>
        <p className="text-sm text-ink-400 mt-1">Lihat jadwal pemeliharaan dalam kalender</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="btn-secondary btn-sm">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-white">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="btn-secondary btn-sm">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-white/5 rounded-lg overflow-hidden border border-white/5">
          {dayNames.map(d => <div key={d} className="bg-white/[0.03] p-2 text-center text-xs font-medium text-ink-400">{d}</div>)}

          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="bg-white/[0.02] p-2 min-h-[80px]" />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
            const daySchedules = getSchedulesForDate(day);
            const isToday = dateStr === today;
            const isSelected = selectedDate === day;

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                className={`bg-white/[0.02] p-2 min-h-[80px] cursor-pointer hover:bg-white/5 transition-colors ${
                  isSelected ? 'ring-2 ring-primary-500 ring-inset' : ''
                }`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-gradient-to-br from-primary-500 to-indigo-600 shadow-glow-blue text-white' : 'text-ink-200'
                }`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {daySchedules.slice(0, 2).map(s => (
                    <Link key={s.id} to={`/assets/${s.asset_id}`} className="block">
                      <div className={`${getStatusColor(s.schedule_status)} text-white text-[10px] px-1 py-0.5 rounded truncate font-mono`}>
                        {s.assets?.asset_code}
                      </div>
                    </Link>
                  ))}
                  {daySchedules.length > 2 && <div className="text-[10px] text-ink-500">+{daySchedules.length - 2} lagi</div>}
                </div>
              </div>
            );
          })}
        </div>

        {selectedDate && (
          <div className="mt-4 p-4 bg-white/[0.03] rounded-lg border border-white/5">
            <h3 className="text-sm font-semibold text-white mb-3">
              Jadwal {selectedDate} {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            {getSchedulesForDate(selectedDate).length === 0 ? (
              <p className="text-sm text-ink-400">Tidak ada jadwal</p>
            ) : (
              <div className="space-y-2">
                {getSchedulesForDate(selectedDate).map(s => (
                  <Link key={s.id} to={`/assets/${s.asset_id}`} className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{s.assets?.asset_name}</p>
                      <p className="text-xs text-ink-400">{s.maintenance_types?.maintenance_name}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(s.schedule_status)}`}></span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
