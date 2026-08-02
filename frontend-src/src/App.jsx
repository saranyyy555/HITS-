import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import LoginSection from './components/LoginSection.jsx';
import TeacherSection from './components/TeacherSection.jsx';
import HODSection from './components/HODSection.jsx';
import AdminSection from './components/AdminSection.jsx';
import AttendanceModal from './components/AttendanceModal.jsx';
import MemoModal from './components/MemoModal.jsx';
import AckModal from './components/AckModal.jsx';
import TimetableModal from './components/TimetableModal.jsx';
import { fetchStudents } from './api.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [simulatedDate, setSimulatedDate] = useState('2026-07-18');
  const [simulatedTime, setSimulatedTime] = useState('10:30');
  const [allStudents, setAllStudents] = useState([]);

  // Bumped after any write (attendance submit, memo issue/ack) to force the
  // teacher/HOD dashboards to refetch, same as the original loadDashboard() call.
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken((n) => n + 1);

  const [attendanceModal, setAttendanceModal] = useState({ open: false, period: null });
  const [memoModal, setMemoModal] = useState({ open: false, target: null });
  const [ackModal, setAckModal] = useState({ open: false, target: null });
  const [timetableOpen, setTimetableOpen] = useState(false);

  // Initial fetch of students, same as the DOMContentLoaded handler in app.js.
  useEffect(() => {
    fetchStudents().then(setAllStudents).catch((error) => console.error('Error fetching students:', error));
  }, []);

  function handleLoginSuccess(user) {
    setCurrentUser(user);
  }

  function handleLogout() {
    setCurrentUser(null);
    setAttendanceModal({ open: false, period: null });
    setMemoModal({ open: false, target: null });
    setAckModal({ open: false, target: null });
    setTimetableOpen(false);
  }

  function openMarkAttendance(periodNo, subject, start, end, session) {
    setAttendanceModal({
      open: true,
      period: {
        period_no: periodNo,
        date: simulatedDate,
        subject,
        start,
        end,
        session,
        teacher_id: currentUser.id,
        mode: 'mark',
      },
    });
  }

  function openViewAttendance(periodNo, subject, teacherName, teacherId) {
    setAttendanceModal({
      open: true,
      period: {
        period_no: periodNo,
        date: simulatedDate,
        subject,
        teacher_id: teacherId,
        teacherName,
        mode: 'view',
      },
    });
  }

  function closeAttendanceModal() {
    setAttendanceModal({ open: false, period: null });
  }

  function handleAttendanceSubmitted() {
    closeAttendanceModal();
    refresh();
  }

  function openIssueMemo(teacherId, periodNo, teacherName, subject) {
    setMemoModal({ open: true, target: { teacherId, periodNo, teacherName, subject } });
  }

  function closeMemoModal() {
    setMemoModal({ open: false, target: null });
  }

  function handleMemoSubmitted() {
    closeMemoModal();
    refresh();
  }

  function openAcknowledge(memoId, periodNo, subject, reason) {
    setAckModal({ open: true, target: { memoId, periodNo, subject, reason } });
  }

  function closeAckModal() {
    setAckModal({ open: false, target: null });
  }

  function handleAckSubmitted() {
    closeAckModal();
    refresh();
  }

  const isTeacher = currentUser?.role === 'teacher';
  const isHOD = currentUser?.role === 'hod';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      <div className="bg-glow circle-1"></div>
      <div className="bg-glow circle-2"></div>
      <div className="bg-glow circle-3"></div>

      <div className="app-container">
        <Header
          currentUser={currentUser}
          simulatedDate={simulatedDate}
          simulatedTime={simulatedTime}
          onDateChange={setSimulatedDate}
          onTimeChange={setSimulatedTime}
          onFastForward={() => setSimulatedTime('16:30')}
          onLogout={handleLogout}
        />

        <main className="main-content">
          <LoginSection active={!currentUser} onLoginSuccess={handleLoginSuccess} />

          <TeacherSection
            active={isTeacher}
            currentUser={isTeacher ? currentUser : null}
            simulatedDate={simulatedDate}
            simulatedTime={simulatedTime}
            refreshToken={refreshToken}
            onOpenMarkAttendance={openMarkAttendance}
            onOpenAcknowledge={openAcknowledge}
            onOpenTimetable={() => setTimetableOpen(true)}
          />

          <HODSection
            active={isHOD}
            currentUser={isHOD ? currentUser : null}
            simulatedDate={simulatedDate}
            simulatedTime={simulatedTime}
            refreshToken={refreshToken}
            onOpenIssueMemo={openIssueMemo}
            onOpenViewAttendance={openViewAttendance}
          />

          <AdminSection
            active={isAdmin}
            currentUser={isAdmin ? currentUser : null}
            refreshToken={refreshToken}
          />
        </main>
      </div>

      <AttendanceModal
        open={attendanceModal.open}
        period={attendanceModal.period}
        allStudents={allStudents}
        onClose={closeAttendanceModal}
        onSubmitted={handleAttendanceSubmitted}
      />

      <MemoModal
        open={memoModal.open}
        target={memoModal.target}
        simulatedDate={simulatedDate}
        onClose={closeMemoModal}
        onSubmitted={handleMemoSubmitted}
      />

      <AckModal open={ackModal.open} target={ackModal.target} onClose={closeAckModal} onSubmitted={handleAckSubmitted} />

      <TimetableModal open={timetableOpen} currentUser={currentUser} onClose={() => setTimetableOpen(false)} />
    </>
  );
}
