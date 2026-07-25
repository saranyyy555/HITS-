export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Same period table the timetable modal in the original app.js built inline.
export const PERIODS = [
  { no: 1, start: '08:30', end: '09:25', session: 'FN' },
  { no: 2, start: '09:25', end: '10:20', session: 'FN' },
  { no: 3, start: '10:40', end: '11:35', session: 'FN' },
  { no: 4, start: '11:35', end: '12:30', session: 'FN' },
  { no: 5, start: '13:25', end: '14:15', session: 'AN' },
  { no: 6, start: '14:15', end: '15:05', session: 'AN' },
  { no: 7, start: '15:15', end: '16:05', session: 'AN' },
];
