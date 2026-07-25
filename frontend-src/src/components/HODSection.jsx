import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, MailWarning, Circle, Eye, ClipboardList, Hourglass } from 'lucide-react';
import { fetchHODSummary, fetchMemos } from '../api.js';
import { timeToMinutes } from '../utils.js';

function PeriodPill({ p, report, isEOD, onOpenIssueMemo, onOpenViewAttendance }) {
  let pillClass = '';
  let StatusIcon = Circle;

  if (p.is_marked) {
    pillClass = 'is-marked';
    StatusIcon = CheckCircle;
  } else if (p.memo) {
    pillClass = 'has-memo';
    StatusIcon = MailWarning;
  } else if (p.is_overdue) {
    pillClass = 'is-overdue';
    StatusIcon = AlertTriangle;
  }

  let attendanceText = p.is_marked ? 'Marked' : p.memo ? 'Memoed' : 'Pending';
  if (p.is_marked && p.present_percentage !== null) {
    attendanceText = `${p.present_count}P (${p.present_percentage}%) | ${p.absent_count}A (${p.absent_percentage}%)`;
  }

  const showIssueMemo = !p.is_marked && !p.memo && (p.is_overdue || isEOD);
  const showRoster = p.is_marked;

  return (
    <div className={`period-pill ${pillClass}`}>
      <span className="pill-dot"></span>
      <span>
        P{p.period_no} ({p.session}): {attendanceText}
      </span>
      {showIssueMemo && (
        <button
          className="btn btn-danger btn-sm"
          style={{ marginLeft: 8, padding: '2px 6px', fontSize: '0.65rem' }}
          onClick={() => onOpenIssueMemo(report.teacher_id, p.period_no, report.teacher_name, p.subject)}
        >
          Issue Memo
        </button>
      )}
      {showRoster && (
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 8, padding: '2px 6px', fontSize: '0.65rem', background: 'transparent' }}
          onClick={() => onOpenViewAttendance(p.period_no, p.subject, report.teacher_name, report.teacher_id)}
        >
          <Eye style={{ width: 10 }} /> Roster
        </button>
      )}
    </div>
  );
}

function HODTeacherRow({ report, isEOD, onOpenIssueMemo, onOpenViewAttendance }) {
  return (
    <div className="teacher-row glass-panel">
      <div className="teacher-meta">
        <div className="teacher-info">
          <h4>{report.teacher_name}</h4>
          <span>
            {report.department} • Assigned classes: {report.total_assigned}
          </span>
        </div>
        <div className="teacher-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${report.percentage}%` }}></div>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{report.percentage}% completed</span>
        </div>
      </div>
      <div className="teacher-periods-row">
        {report.periods.map((p) => (
          <PeriodPill
            key={p.period_no}
            p={p}
            report={report}
            isEOD={isEOD}
            onOpenIssueMemo={onOpenIssueMemo}
            onOpenViewAttendance={onOpenViewAttendance}
          />
        ))}
      </div>
    </div>
  );
}

export default function HODSection({
  active,
  currentUser,
  simulatedDate,
  simulatedTime,
  refreshToken,
  onOpenIssueMemo,
  onOpenViewAttendance,
}) {
  const [reports, setReports] = useState([]);
  const [memos, setMemos] = useState([]);

  const loadHODDashboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      const date = simulatedDate;
      const time = simulatedTime;

      const summary = await fetchHODSummary(date, time);
      setReports(summary);

      const mem = await fetchMemos({ date });
      setMemos(mem);
    } catch (error) {
      console.error('Error loading HOD dashboard:', error);
    }
  }, [currentUser, simulatedDate, simulatedTime]);

  useEffect(() => {
    loadHODDashboard();
  }, [loadHODDashboard, refreshToken]);

  if (!currentUser) return null;

  const isEOD = timeToMinutes(simulatedTime) >= timeToMinutes('16:05');

  let totalClasses = 0;
  let markedClasses = 0;
  let overdueCount = 0;
  reports.forEach((t) => {
    totalClasses += t.total_assigned;
    markedClasses += t.marked_count;
    t.periods.forEach((p) => {
      if (p.is_overdue) overdueCount++;
    });
  });
  const completionRate = totalClasses > 0 ? Math.round((markedClasses / totalClasses) * 100) : 100;
  const activeMemoCount = memos.filter((m) => m.status === 'Issued').length;

  return (
    <section id="hod-section" className={`view-section ${active ? 'active' : ''}`}>
      <img src="/hits_campus.jpg" alt="HITS Campus" className="dashboard-hero-img" />
      <div className="section-title-area">
        <div>
          <h2>HOD Monitoring Dashboard</h2>
          <p>Dr. Richard Feynman • Computer Science Department Head</p>
        </div>
        <div className="hod-stats">
          <div className="stat-card glass-panel">
            <span className="stat-num" id="stat-attendance-rate">{completionRate}%</span>
            <span className="stat-label">Submissions</span>
          </div>
          <div className="stat-card glass-panel">
            <span className="stat-num warning-text" id="stat-missing-hours">{overdueCount}</span>
            <span className="stat-label">Missing Hours</span>
          </div>
          <div className="stat-card glass-panel">
            <span className="stat-num error-text" id="stat-active-memos">{activeMemoCount}</span>
            <span className="stat-label">Active Memos</span>
          </div>
        </div>
      </div>

      {/* HOD Teacher Status Monitor Grid */}
      <div className="hod-monitor-container glass-panel">
        <div className="monitor-header">
          <h3>Faculty Attendance Submissions</h3>
          <span className="badge info-badge" id="eod-warning" style={{ display: isEOD ? 'inline-flex' : 'none' }}>
            <AlertTriangle /> End of Day (Past 4:05 PM) - Memo options unlocked
          </span>
        </div>

        <div className="teacher-reports-list" id="hod-teachers-list">
          {reports.map((report) => (
            <HODTeacherRow
              key={report.teacher_id}
              report={report}
              isEOD={isEOD}
              onOpenIssueMemo={onOpenIssueMemo}
              onOpenViewAttendance={onOpenViewAttendance}
            />
          ))}
        </div>
      </div>

      {/* HOD Memo Log */}
      <div className="memo-history-section glass-panel">
        <div className="memo-header">
          <ClipboardList />
          <h3>Departmental Memos Log</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Period</th>
                <th>Reason</th>
                <th>Issued At</th>
                <th>Status</th>
                <th>Teacher Explanation</th>
              </tr>
            </thead>
            <tbody id="hod-memos-list">
              {memos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    No memos issued on this date.
                  </td>
                </tr>
              )}
              {memos.map((memo) => {
                let badgeClass = 'status-badge upcoming';
                if (memo.status === 'Issued') badgeClass = 'status-badge memo-issued';
                if (memo.status === 'Acknowledged') badgeClass = 'status-badge marked';
                return (
                  <tr key={memo.id}>
                    <td>
                      <strong>{memo.teacher_name}</strong>
                    </td>
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
                        <>
                          <span className="success-text" style={{ fontWeight: 500 }}>
                            Explanation:
                          </span>{' '}
                          <span className="text-muted">{memo.acknowledgment}</span>
                        </>
                      ) : (
                        <span className="warning-text">
                          <Hourglass style={{ width: 12, display: 'inline', verticalAlign: 'middle' }} /> Awaiting
                          response
                        </span>
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
