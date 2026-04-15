import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  pointerWithin, useSensor, useSensors
} from '@dnd-kit/core';
import { useState } from 'react';
import toast from 'react-hot-toast';
import TaskCard from '../TaskCard/TaskCard';
import CollaboratorColumn from '../CollaboratorColumn/CollaboratorColumn';
import { ordersApi } from '../../api';
import { useIsMobile } from '../../hooks/useIsMobile';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDate(date) {
  return date.toLocaleDateString('es-US', { month: 'short', day: 'numeric' });
}

function Calendar({ calendarData, weekDays, onAssign, onOrderClick }) {
  const [activeOrder, setActiveOrder] = useState(null);
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    // En móvil, empezar en el día actual dentro de la semana (o Lunes)
    const todayIdx = weekDays.findIndex(d => new Date().toDateString() === d.toDateString());
    return todayIdx >= 0 ? todayIdx : 1;
  });
  const [showSidebar, setShowSidebar] = useState(false);

  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const handleDragStart = ({ active }) => setActiveOrder(active.data.current?.order || null);

  const handleDragEnd = async ({ active, over }) => {
    setActiveOrder(null);
    if (!over) return;
    const { collaboratorId, date } = over.data.current || {};
    if (!collaboratorId || !date) return;
    try {
      await ordersApi.assign(active.id, collaboratorId, date);
      toast.success('✅ Orden asignada');
      onAssign?.();
    } catch (error) {
      toast.error(`Error al asignar: ${error.message}`);
    }
  };

  if (!calendarData) return null;

  // En móvil solo mostramos 1 día a la vez
  const displayDays = isMobile ? [weekDays[mobileDayIndex]] : weekDays;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveOrder(null)}
    >
      <div className="flex gap-2 md:gap-3 h-full">

        {/* ── Sidebar órdenes sin asignar — desktop siempre visible, móvil como sheet ── */}
        {/* Desktop */}
        <div className="hidden md:flex w-52 flex-shrink-0 flex-col">
          <div className="bg-steel-800 rounded-t-lg px-3 py-2 border border-steel-600 border-b-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-steel-300">Sin Asignar</span>
              <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {calendarData.unassigned?.length || 0}
              </span>
            </div>
          </div>
          <div className="flex-1 bg-steel-900 rounded-b-lg border border-steel-600 overflow-y-auto p-2 space-y-2">
            {calendarData.unassigned?.map(order => (
              <TaskCard key={order._id} order={order} onClick={onOrderClick} />
            ))}
            {(!calendarData.unassigned || calendarData.unassigned.length === 0) && (
              <p className="text-xs text-steel-500 text-center py-6 uppercase tracking-wide">
                Sin pendientes
              </p>
            )}
          </div>
        </div>

        {/* ── Grid del calendario ── */}
        <div className="flex-1 min-w-0 flex flex-col rounded-lg overflow-hidden border border-steel-300 shadow-steel-md">

          {/* Navegación de día en móvil */}
          {isMobile && (
            <div className="flex items-center bg-steel-800 border-b border-steel-600 px-2 py-1.5 gap-2 flex-shrink-0">
              <button
                onClick={() => setMobileDayIndex(i => Math.max(0, i - 1))}
                disabled={mobileDayIndex === 0}
                className="p-1 rounded text-steel-300 hover:text-white disabled:opacity-30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>

              <div className="flex-1 flex gap-1 overflow-x-auto">
                {weekDays.map((day, i) => {
                  const isToday = new Date().toDateString() === day.toDateString();
                  const isSelected = i === mobileDayIndex;
                  return (
                    <button key={i} onClick={() => setMobileDayIndex(i)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : isToday
                          ? 'bg-steel-700 text-primary-300'
                          : 'text-steel-400 hover:text-white hover:bg-steel-700'
                      }`}>
                      {DAY_NAMES[day.getDay()]} {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setMobileDayIndex(i => Math.min(weekDays.length - 1, i + 1))}
                disabled={mobileDayIndex === weekDays.length - 1}
                className="p-1 rounded text-steel-300 hover:text-white disabled:opacity-30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>

              {/* Botón para ver órdenes sin asignar en móvil */}
              <button onClick={() => setShowSidebar(true)}
                className="relative p-1.5 rounded bg-primary-500 text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
                </svg>
                {calendarData.unassigned?.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {calendarData.unassigned.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Header días — desktop */}
          {!isMobile && (
            <div className="grid flex-shrink-0 bg-steel-800 border-b border-steel-600"
              style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 1fr)` }}>
              <div className="px-3 py-2.5 border-r border-steel-600">
                <span className="text-xs font-bold uppercase tracking-widest text-steel-400">Instalador</span>
              </div>
              {displayDays.map((day, i) => {
                const isToday = new Date().toDateString() === day.toDateString();
                return (
                  <div key={i} className={`px-2 py-2.5 text-center border-r border-steel-600 last:border-r-0 ${isToday ? 'bg-primary-600/30' : ''}`}>
                    <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-primary-300' : 'text-steel-300'}`}>
                      {DAY_NAMES[day.getDay()]}
                    </div>
                    <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-primary-200' : 'text-white'}`}>
                      {day.getDate()}
                    </div>
                    {isToday && <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mx-auto mt-1"/>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Header días — móvil (1 columna) */}
          {isMobile && (
            <div className="grid flex-shrink-0 bg-steel-800 border-b border-steel-600"
              style={{ gridTemplateColumns: `120px 1fr` }}>
              <div className="px-2 py-2 border-r border-steel-600">
                <span className="text-xs font-bold uppercase tracking-widest text-steel-400">Instalador</span>
              </div>
              {displayDays.map((day, i) => {
                const isToday = new Date().toDateString() === day.toDateString();
                return (
                  <div key={i} className={`px-2 py-2 text-center ${isToday ? 'bg-primary-600/30' : ''}`}>
                    <div className={`text-xs font-bold uppercase ${isToday ? 'text-primary-300' : 'text-steel-300'}`}>
                      {DAY_NAMES[day.getDay()]} {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filas colaboradores */}
          <div className="flex-1 overflow-y-auto bg-concrete-100">
            {calendarData.collaborators?.map((collaborator, ci) => (
              <div key={collaborator._id}
                className={`grid border-b border-concrete-200 last:border-b-0 ${ci % 2 === 0 ? 'bg-white' : 'bg-concrete-50'}`}
                style={{ gridTemplateColumns: isMobile ? `120px 1fr` : `160px repeat(${displayDays.length}, 1fr)` }}>

                {/* Nombre */}
                <div className="px-2 md:px-3 py-2 border-r border-concrete-200 flex items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow"
                    style={{ backgroundColor: collaborator.color }}>
                    {collaborator.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <div className="text-xs font-bold text-steel-800 truncate">{collaborator.name}</div>
                    <div className="text-xs text-steel-400">{collaborator.totalOrders || 0} tareas</div>
                  </div>
                  {/* En móvil muy pequeño, solo inicial */}
                  <div className="min-w-0 sm:hidden">
                    <div className="text-xs font-bold text-steel-800 truncate">
                      {collaborator.name?.split(' ')[0]}
                    </div>
                  </div>
                </div>

                {/* Columnas de días */}
                {displayDays.map((day, di) => {
                  const orders = collaborator.ordersByDay?.[day.getDay()] || [];
                  const isToday = new Date().toDateString() === day.toDateString();
                  return (
                    <div key={di}
                      className={`p-1 md:p-1.5 border-r border-concrete-200 last:border-r-0 min-h-[80px] md:min-h-[90px] ${isToday ? 'bg-primary-50/50' : ''}`}>
                      <CollaboratorColumn
                        collaborator={collaborator}
                        date={day}
                        orders={orders}
                        onOrderClick={onOrderClick}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {(!calendarData.collaborators || calendarData.collaborators.length === 0) && (
              <div className="flex flex-col items-center justify-center h-40 text-steel-400">
                <svg className="w-8 h-8 mb-2 text-steel-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <p className="text-sm font-semibold">Sin instaladores</p>
                <p className="text-xs mt-0.5">Ve a Equipo para agregar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom sheet móvil: órdenes sin asignar ── */}
      {isMobile && showSidebar && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowSidebar(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-steel-900 rounded-t-2xl border-t-2 border-primary-500 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-steel-600 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-steel-700">
              <span className="font-bold text-white text-sm uppercase tracking-wide">Sin Asignar</span>
              <div className="flex items-center gap-2">
                <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {calendarData.unassigned?.length || 0}
                </span>
                <button onClick={() => setShowSidebar(false)} className="text-steel-400 hover:text-white p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {calendarData.unassigned?.map(order => (
                <TaskCard key={order._id} order={order} onClick={(o) => { onOrderClick(o); setShowSidebar(false); }} />
              ))}
              {(!calendarData.unassigned || calendarData.unassigned.length === 0) && (
                <p className="text-center text-steel-500 text-sm py-8">Sin órdenes pendientes</p>
              )}
            </div>
          </div>
        </div>
      )}

      <DragOverlay>
        {activeOrder && (
          <div className="rotate-2 scale-105 opacity-90">
            <TaskCard order={activeOrder} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default Calendar;
