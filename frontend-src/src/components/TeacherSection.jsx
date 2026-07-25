import { useEffect, useState, useCallback } from 'react';
import { Sun, CloudSun, Calendar, Clock, Check, X, AlertCircle, AlertTriangle, Edit2, Edit3, MailWarning } from 'lucide-react';
import { fetchTeacherSchedule, fetchReminders, fetchMemos } from '../api.js';
import { formatTime } from '../utils.js';

function PeriodActionButton({ period, onMark }) {
  if (period.status === 'marked') {
    return (
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => onMark(period.period_no, period.subject, period.start_time, period.end_time, period.session)}
      >
        <Edit3 /> Edit Attendance
      </button>
    );
  }
  if (period.status === 'upcoming') {
    return (
      <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.5 }}>
        Upcoming
      </button>
    );
  }
  // ongoing, pending, overdue
  const isOverdue = period.status === 'overdue';
  return (
    <button
      className={`btn ${isOverdue ? 'btn-danger' : 'btn-primary'} btn-sm`}
      onClick={() => onMark(period.period_no, period.subject, period.start_time, period.end_time, period.session)}
    >
      {isOverdue ? <AlertTriangle /> : <Edit2 />} Mark Attendance
    </button>
  );
}

function PeriodCard({ period, onMark }) {
  const statusText = period.memo ? 'Memo Issued' : period.status;
  return (
    <div className={`period-card glass-panel ${period.status} ${period.memo ? 'memo-issued' : ''}`}>
      <div className="period-info">
        <span className="period-number">
          Period {period.period_no} • {period.session}
        </span>
        <h4 className="period-subject">{period.subject}</h4>
        <div className="period-time">
          <Clock style={{ width: 14 }} />
          <span>
            {formatTime(period.start_time)} - {formatTime(period.end_time)}
          </span>
        </div>
        {period.status === 'marked' && period.present_percentage !== null && (
          <div
            className="period-attendance-details"
            style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.8rem' }}
          >
            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check style={{ width: 14, height: 14 }} />
              <span style={{ fontWeight: 600 }}>
                Present: {period.present_count} / {period.present_count + period.absent_count} ({period.present_percentage}%)
              </span>
            </div>
            <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X style={{ width: 14, height: 14 }} />
              <span style={{ fontWeight: 600 }}>
                Absent: {period.absent_count} / {period.present_count + period.absent_count} ({period.absent_percentage}%)
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="period-status">
        <span className={`status-badge ${period.memo ? 'memo-issued' : period.status}`}>{statusText}</span>
        <PeriodActionButton period={period} onMark={onMark} />
      </div>
    </div>
  );
}

export default function TeacherSection({
  active,
  currentUser,
  simulatedDate,
  simulatedTime,
  refreshToken,
  onOpenMarkAttendance,
  onOpenAcknowledge,
  onOpenTimetable,
}) {
  const [schedule, setSchedule] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [memos, setMemos] = useState([]);

  const loadTeacherDashboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      const date = simulatedDate;
      const time = simulatedTime;

      const sched = await fetchTeacherSchedule(currentUser.id, date, time);
      setSchedule(sched);

      const rem = await fetchReminders(currentUser.id, date, time);
      setReminders(rem);

      const mem = await fetchMemos({ teacherId: currentUser.id, date });
      setMemos(mem);
    } catch (error) {
      console.error('Error loading teacher dashboard:', error);
    }
  }, [currentUser, simulatedDate, simulatedTime]);

  useEffect(() => {
    loadTeacherDashboard();
  }, [loadTeacherDashboard, refreshToken]);

  if (!currentUser) return null;

  const fnPeriods = schedule.filter((p) => p.session === 'FN');
  const anPeriods = schedule.filter((p) => p.session !== 'FN');

  const totalAssigned = schedule.length;
  const completedSubmissions = schedule.filter((p) => p.status === 'marked').length;
  const markedPeriods = schedule.filter((p) => p.status === 'marked' && p.attendance_percentage !== null);
  const avgAttendance =
    markedPeriods.length > 0
      ? Math.round(markedPeriods.reduce((acc, p) => acc + p.attendance_percentage, 0) / markedPeriods.length)
      : 0;
  const submissionRate = totalAssigned > 0 ? Math.round((completedSubmissions / totalAssigned) * 100) : 100;

  const activeMemos = memos.filter((m) => m.status === 'Issued');

  return (
    <section id="teacher-section" className={`view-section ${active ? 'active' : ''}`}>
      {/* Dashboard Alert Banners */}
      <div id="teacher-alerts" className="alerts-container">
        {reminders.map((rem) => (
          <div className="alert-banner warning" key={`${rem.period_no}-${rem.subject}`}>
            <div className="alert-content">
              <AlertCircle style={{ width: 24, height: 24 }} />
              <div>
                <p>Urgent Reminder: Unmarked Attendance</p>
                <span>
                  Attendance for <strong>Period {rem.period_no} ({rem.subject})</strong> has not been marked. This
                  class ended at {formatTime(rem.end_time)} and is now overdue by over 1 hour.
                </span>
              </div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onOpenMarkAttendance(rem.period_no, rem.subject, '', '', rem.session)}
            >
              Mark Now
            </button>
          </div>
        ))}
      </div>

      {/* Active Memos Alert Banner */}
      <div id="memo-alerts" className="alerts-container">
        {activeMemos.map((memo) => (
          <div className="alert-banner danger" key={memo.id}>
            <div className="alert-content">
              <MailWarning style={{ width: 24, height: 24 }} />
              <div>
                <p>Official Memo Issued by HOD</p>
                <span>
                  A disciplinary memo was issued for missing attendance marking on Period {memo.period_no} (
                  {memo.subject}). Reason: "{memo.reason}"
                </span>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenAcknowledge(memo.id, memo.period_no, memo.subject, memo.reason)}
            >
              Acknowledge
            </button>
          </div>
        ))}
      </div>

      {/* Teacher Dashboard Title */}
      <img src="/hits_campus.jpg" alt="HITS Campus" className="dashboard-hero-img" />
      <div className="section-title-area">
        <div>
          <h2 id="teacher-name-title">{currentUser.name}</h2>
          <p id="teacher-dept-title">Department of {currentUser.department} • Today's Schedule</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" id="btn-view-timetable" onClick={onOpenTimetable}>
            <Calendar style={{ width: 14 }} /> View Timetable
          </button>
          <div className="session-badges">
            <span className="badge fn-badge">FN: 8:30 AM - 12:30 PM</span>
            <span className="badge an-badge">AN: 1:25 PM - 4:05 PM</span>
          </div>
        </div>
      </div>

      {/* Teacher Stats Bar */}
      <div className="teacher-stats-bar" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div className="stat-card glass-panel">
          <span className="stat-num" id="teacher-stat-assigned">{totalAssigned}</span>
          <span className="stat-label">Assigned Classes</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num" id="teacher-stat-completed">{submissionRate}%</span>
          <span className="stat-label">Submission Rate</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-num" id="teacher-stat-average">{avgAttendance}%</span>
          <span className="stat-label">Avg Attendance</span>
        </div>
      </div>

      {/* Schedule Grid Split by FN & AN Sessions */}
      <div className="schedule-sessions">
        <div className="session-group">
          <div className="session-header">
            <Sun />
            <h3>Forenoon (FN) Session</h3>
          </div>
          <div className="periods-grid" id="fn-periods">
            {fnPeriods.map((p) => (
              <PeriodCard key={p.period_no} period={p} onMark={onOpenMarkAttendance} />
            ))}
          </div>
        </div>

        <div className="session-group">
          <div className="session-header">
            <CloudSun />
            <h3>Afternoon (AN) Session</h3>
          </div>
          <div className="periods-grid" id="an-periods">
            {anPeriods.map((p) => (
              <PeriodCard key={p.period_no} period={p} onMark={onOpenMarkAttendance} />
            ))}
          </div>
        </div>
      </div>

      {/* Teacher's Personal Memo History */}
      <div className="memo-history-section glass-panel">
        <div className="memo-header">
          <MailWarning />
          <h3>Memo &amp; Warning History</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Period</th>
                <th>Reason</th>
                <th>Issued At</th>
                <th>Status</th>
                <th>Your Explanation</th>
              </tr>
            </thead>
            <tbody id="teacher-memos-list">
              {memos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    No memos issued for this date.
                  </td>
                </tr>
              )}
              {memos.map((memo) => {
                let badgeClass = 'status-badge upcoming';
                if (memo.status === 'Issued') badgeClass = 'status-badge memo-issued';
                if (memo.status === 'Acknowledged') badgeClass = 'status-badge marked';
                return (
                  <tr key={memo.id}>
                    <td>{memo.date}</td>
                    <td>
                      Period {memo.period_no} ({memo.subject})
                    </td>
                    <td>{memo.reason}</td>
                    <td>{new Date(memo.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className={badgeClass}>{memo.status}</span>
                    </td>
                    <td>
                      {memo.status === 'Acknowledged' ? (
                        <span className="text-muted">{memo.acknowledgment}</span>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenAcknowledge(memo.id, memo.period_no, memo.subject, memo.reason)}
                        >
                          Submit Explanation
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
