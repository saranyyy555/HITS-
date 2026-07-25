// All backend interactions live here, unchanged from the original app.js.
// Endpoints, methods, headers, and request/response bodies are identical.

export async function loginRequest(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function fetchStudents() {
  const res = await fetch('/api/students');
  return res.json();
}

export async function fetchTeacherSchedule(teacherId, date, simTime) {
  const res = await fetch(`/api/teacher/${teacherId}/schedule?date=${date}&simTime=${simTime}`);
  return res.json();
}

export async function fetchReminders(teacherId, date, simTime) {
  const res = await fetch(`/api/reminders?teacherId=${teacherId}&date=${date}&simTime=${simTime}`);
  return res.json();
}

export async function fetchMemos({ teacherId, date } = {}) {
  const params = new URLSearchParams();
  if (teacherId !== undefined && teacherId !== null) params.set('teacherId', teacherId);
  if (date) params.set('date', date);
  const qs = params.toString();
  const res = await fetch(`/api/memos${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function fetchHODSummary(date, simTime) {
  const res = await fetch(`/api/hod/summary?date=${date}&simTime=${simTime}`);
  return res.json();
}

export async function fetchAttendanceForPeriod(periodNo, date) {
  const res = await fetch(`/api/attendance/period/${periodNo}?date=${date}`);
  return res.json();
}

export async function submitAttendanceRequest(payload) {
  const res = await fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function submitMemoRequest({ date, period_no, teacher_id, reason }) {
  const res = await fetch('/api/memos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, period_no, teacher_id, reason }),
  });
  return res.json();
}

export async function submitAckRequest(memoId, explanation) {
  const res = await fetch(`/api/memos/${memoId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledgment: explanation }),
  });
  return res.json();
}

export async function fetchFullSchedule() {
  const res = await fetch('/api/schedule');
  return res.json();
}
