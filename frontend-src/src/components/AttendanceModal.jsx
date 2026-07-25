import { useEffect, useState } from 'react';
import { X, Edit3 } from 'lucide-react';
import { fetchAttendanceForPeriod, submitAttendanceRequest } from '../api.js';

export default function AttendanceModal({
  open,
  period, // { period_no, date, subject, start, end, session, teacher_id, teacherName, mode }
  allStudents,
  onClose,
  onSubmitted,
}) {
  const [statusMap, setStatusMap] = useState(new Map());
  const [editable, setEditable] = useState(true);

  useEffect(() => {
    if (!open || !period) return;

    setEditable(period.mode === 'mark');

    // renderStudentsRoster always pulls submitted attendance for the period,
    // regardless of read-only/edit mode, matching the original app.js.
    (async () => {
      try {
        const records = await fetchAttendanceForPeriod(period.period_no, period.date);
        const map = new Map();
        records.forEach((r) => map.set(r.student_id, r.status));
        setStatusMap(map);
      } catch (e) {
        console.log('Error pulling attendance roster:', e);
        setStatusMap(new Map());
      }
    })();
  }, [open, period]);

  if (!open || !period) return null;

  function statusFor(studentId) {
    return statusMap.get(studentId) || 'Present';
  }

  function setStatus(studentId, status) {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(studentId, status);
      return next;
    });
  }

  function markAll(status) {
    setStatusMap((prev) => {
      const next = new Map(prev);
      allStudents.forEach((s) => next.set(s.id, status));
      return next;
    });
  }

  async function handleSubmit() {
    const attendanceRecords = allStudents.map((s) => ({
      student_id: s.id,
      status: statusFor(s.id),
    }));

    try {
      const payload = {
        date: period.date,
        period_no: period.period_no,
        teacher_id: period.teacher_id,
        attendance: attendanceRecords,
      };
      const data = await submitAttendanceRequest(payload);
      if (data.success) {
        onSubmitted();
      } else {
        alert('Error submitting attendance: ' + data.message);
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
    }
  }

  const showSubmit = editable;
  const showQuickSelectors = editable;
  const showEditButton = period.mode === 'view' && !editable;

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} id="attendance-modal">
      <div className="modal-content glass-panel animate-slide-up">
        <div className="modal-header">
          <div>
            <h3 id="modal-subject-title">{period.subject}</h3>
            <p id="modal-period-details">
              {period.mode === 'mark'
                ? `Period ${period.period_no} (${period.session}) • Mark attendance`
                : `Period ${period.period_no} • Roster View ${period.teacherName ? `(${period.teacherName})` : ''}`}
            </p>
          </div>
          <button className="close-btn" id="btn-close-modal" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="modal-body">
          <div className="roster-actions">
            <span>Student Attendance Sheet</span>
            <div className="quick-selectors" style={{ display: showQuickSelectors ? 'flex' : 'none' }}>
              <button className="btn btn-secondary btn-sm" id="btn-mark-all-present" onClick={() => markAll('Present')}>
                Mark All Present
              </button>
              <button className="btn btn-danger btn-sm" id="btn-mark-all-absent" onClick={() => markAll('Absent')}>
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="student-list-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody id="students-roster-body">
                {allStudents.map((student) => {
                  const status = statusFor(student.id);
                  return (
                    <tr key={student.id}>
                      <td>{student.roll_no}</td>
                      <td>
                        <strong>{student.name}</strong>
                      </td>
                      <td className="text-center">
                        {!editable ? (
                          <span className={`status-badge ${status === 'Present' ? 'marked' : 'memo-issued'}`}>
                            {status}
                          </span>
                        ) : (
                          <div
                            className={`attendance-switch ${status === 'Present' ? 'present-selected' : 'absent-selected'}`}
                            data-student-id={student.id}
                          >
                            <span className="switch-option present-opt" onClick={() => setStatus(student.id, 'Present')}>
                              P
                            </span>
                            <span className="switch-option absent-opt" onClick={() => setStatus(student.id, 'Absent')}>
                              A
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" id="btn-cancel-attendance" onClick={onClose}>
            Cancel
          </button>
          {showEditButton && (
            <button className="btn btn-primary" id="btn-edit-attendance" onClick={() => setEditable(true)}>
              <Edit3 style={{ width: 14 }} /> Edit Attendance
            </button>
          )}
          {showSubmit && (
            <button className="btn btn-primary" id="btn-submit-attendance" onClick={handleSubmit}>
              Submit Attendance
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
