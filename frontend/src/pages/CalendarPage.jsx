import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Calendar from '../components/Calendar/Calendar';
import OrderDetailModal from '../components/OrderDetailModal/OrderDetailModal';
import { useCalendar } from '../hooks/useCalendar';
import { calendarApi } from '../api';

function CalendarPage() {
  const { currentWeek, weekDays, viewMode, setViewMode, goToNextWeek, goToPrevWeek, goToToday } = useCalendar();
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const data = await calendarApi.getWeek(currentWeek);
      setCalendarData(data);
    } catch (error) {
      toast.error(`Error cargando calendario: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCalendarData(); }, [currentWeek]);

  // Recargar cuando el scraper termina
  useEffect(() => {
    window.addEventListener('orders-synced', fetchCalendarData);
    return () => window.removeEventListener('orders-synced', fetchCalendarData);
  }, []);

  const formatWeekRange = () => {
    if (weekDays.length < 7) return '';
    const start = weekDays[0].toLocaleDateString('es-US', { month: 'short', day: 'numeric' });
    const end   = weekDays[6].toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} — ${end}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px-24px)]">

      {/* ── Barra de control compacta ── */}
      <div className="flex items-center justify-between mb-2 px-1">

        {/* Navegación semana */}
        <div className="flex items-center gap-1">
          <button onClick={goToPrevWeek}
            className="p-1.5 rounded bg-steel-800 text-steel-300 hover:bg-steel-700 hover:text-white transition-colors border border-steel-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button onClick={goToToday}
            className="px-3 py-1.5 rounded bg-steel-800 text-steel-200 hover:bg-steel-700 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wide border border-steel-600">
            Hoy
          </button>
          <button onClick={goToNextWeek}
            className="p-1.5 rounded bg-steel-800 text-steel-300 hover:bg-steel-700 hover:text-white transition-colors border border-steel-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Rango de semana */}
        <div className="flex items-center gap-3">
          <span className="text-steel-800 font-bold text-base">{formatWeekRange()}</span>
          <span className="text-xs text-steel-500 bg-steel-200 px-2 py-0.5 rounded font-mono uppercase">
            Sem {currentWeek.split('-W')[1]}
          </span>
        </div>

        {/* Vista */}
        <div className="flex items-center gap-1 bg-steel-800 rounded p-0.5 border border-steel-600">
          {['week', 'day'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-all ${
                viewMode === mode
                  ? 'bg-primary-500 text-white shadow'
                  : 'text-steel-300 hover:text-white'
              }`}>
              {mode === 'week' ? 'Semana' : 'Día'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendario — ocupa todo el espacio restante ── */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full bg-white/60 rounded-xl border border-concrete-200">
            <div className="flex items-center gap-3 text-steel-500">
              <svg className="w-5 h-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Cargando calendario...
            </div>
          </div>
        ) : (
          <Calendar
            calendarData={calendarData}
            weekDays={weekDays}
            onAssign={fetchCalendarData}
            onOrderClick={setSelectedOrder}
          />
        )}
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}

export default CalendarPage;
