import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchFullSchedule } from '../api.js';
import { formatTime, PERIODS } from '../utils.js';

export default function TimetableModal({ open, currentUser, onClose }) {
  const [rows, setRows] = useState(null); // null = loading, [] once resolved
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !currentUser) return;
    setRows(null);
    setError(false);

    (async () => {
      try {
        const schedule = await fetchFullSchedule();
        const myClasses = schedule.filter((s) => s.teacher_id === currentUser.id);
        const classMap = new Map();
        myClasses.forEach((c) => classMap.set(c.period_no, c.subject));
        setRows(PERIODS.map((p) => ({ ...p, subject: classMap.get(p.no) })));
      } catch (err) {
        console.error('Error generating timetable reference:', err);
        setError(true);
      }
    })();
  }, [open, currentUser]);

  if (!open || !currentUser) return null;

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} id="timetable-modal">
      <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h3>My Timetable Reference</h3>
            <p id="timetable-teacher-name">
              {currentUser.name} • Department of {currentUser.department}
            </p>
          </div>
          <button className="close-btn" id="btn-close-timetable" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: 0 }}>
          <div className="table-responsive" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Session</th>
                  <th>Subject / Assignment</th>
                </tr>
              </thead>
              <tbody id="timetable-roster-body">
                {rows === null && !error && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      Loading timetable...
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td colSpan={4} className="text-center text-danger">
                      Error loading timetable.
                    </td>
                  </tr>
                )}
                {rows &&
                  !error &&
                  rows.map((p) => (
                    <tr key={p.no}>
                      <td>
                        <strong>Period {p.no}</strong>
                      </td>
                      <td>
                        {formatTime(p.start)} - {formatTime(p.end)}
                      </td>
                      <td>
                        <span className={`badge ${p.session === 'FN' ? 'fn-badge' : 'an-badge'}`}>{p.session}</span>
                      </td>
                      <td style={p.subject ? { background: 'rgba(16, 185, 129, 0.05)' } : undefined}>
                        {p.subject ? (
                          <strong>{p.subject}</strong>
                        ) : (
                          <span className="text-muted" style={{ fontStyle: 'italic' }}>
                            Free Period
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
