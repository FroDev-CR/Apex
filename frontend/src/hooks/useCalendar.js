import { useState, useMemo } from 'react';

/**
 * Get ISO week string for a date
 * @param {Date} date
 * @returns {string} - Week in format YYYY-WW
 */
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Parse ISO week string to start date (Monday)
 * @param {string} weekString - Week in format YYYY-WW
 * @returns {Date}
 */
function parseISOWeek(weekString) {
  const [year, week] = weekString.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const result = new Date(week1Monday);
  result.setDate(week1Monday.getDate() + (week - 1) * 7);
  return result;
}

/**
 * Custom hook for calendar navigation
 * @returns {Object} - Calendar state and navigation functions
 */
export function useCalendar() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'day'
  const [selectedDate, setSelectedDate] = useState(new Date());

  const weekStart = useMemo(() => parseISOWeek(currentWeek), [currentWeek]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [weekStart]);

  const goToNextWeek = () => {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(weekStart.getDate() + 7);
    setCurrentWeek(getISOWeek(nextWeek));
  };

  const goToPrevWeek = () => {
    const prevWeek = new Date(weekStart);
    prevWeek.setDate(weekStart.getDate() - 7);
    setCurrentWeek(getISOWeek(prevWeek));
  };

  const goToToday = () => {
    setCurrentWeek(getISOWeek(new Date()));
    setSelectedDate(new Date());
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + 1);
    setSelectedDate(next);
  };

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(selectedDate.getDate() - 1);
    setSelectedDate(prev);
  };

  return {
    currentWeek,
    weekStart,
    weekDays,
    viewMode,
    selectedDate,
    setViewMode,
    setSelectedDate,
    goToNextWeek,
    goToPrevWeek,
    goToNextDay,
    goToPrevDay,
    goToToday,
  };
}
