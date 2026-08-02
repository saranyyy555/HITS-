import { useEffect, useState, useCallback } from 'react';
import { Users, GraduationCap, CalendarClock, FileWarning, Plus } from 'lucide-react';
import {
  fetchAdminOverview,
  fetchAdminTeachers,
  addTeacherRequest,
  fetchAdminSchedule,
  addScheduleRequest,
  fetchAdminStudents,
  addStudentRequest,
} from '../api.js';

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className="stat-card glass-panel">
      <Icon style={{ width: 18, marginBottom: 4 }} />
      <span className="stat-num">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function AddTeacherForm({ onAdded }) {
  const [form, setForm] = useState({ username: '', password: '', name: '', department: 'Computer Science' });
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await addTeacherRequest(form);
    if (result.success) {
      setMessage('Teacher added successfully.');
      setForm({ username: '', password: '', name: '', department: 'Computer Science' });
      onAdded();
    } else {
      setMessage(result.message || 'Failed to add teacher.');
    }
  }

  return (
    <form className="admin-add-form" onSubmit={handleSubmit}>
      <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      <input placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
      <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
      <button className="btn btn-primary btn-sm" type="submit"><Plus style={{ width: 14 }} /> Add Teacher</button>
      {message && <span className="admin-form-msg">{message}</span>}
    </form>
  );
}

function AddStudentForm({ onAdded }) {
  const [form, setForm] = useState({ name: '', roll_no: '', department: 'Computer Science' });
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await addStudentRequest(form);
    if (result.success) {
      setMessage('Student added successfully.');
      setForm({ name: '', roll_no: '', department: 'Computer Science' });
      onAdded();
    } else {
      setMessage(result.message || 'Failed to add student.');
    }
  }

  return (
    <form className="admin-add-form" onSubmit={handleSubmit}>
      <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input placeholder="Roll No" value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} required />
      <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
      <button className="btn btn-primary btn-sm" type="submit"><Plus style={{ width: 14 }} /> Add Student</button>
      {message && <span className="admin-form-msg">{message}</span>}
    </form>
  );
}

function AddScheduleForm({ teachers, onAdded }) {
  const [form, setForm] = useState({ period_no: '', subject: '', teacher_id: '' });
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await addScheduleRequest({
      period_no: Number(form.period_no),
      subject: form.subject,
      teacher_id: Number(form.teacher_id),
    });
    if (result.success) {
      setMessage('Schedule entry added.');
      setForm({ period_no: '', subject: '', teacher_id: '' });
      onAdded();
    } else {
      setMessage(result.message || 'Failed to add schedule entry.');
    }
  }

  return (
    <form className="admin-add-form" onSubmit={handleSubmit}>
      <input type="number" min="1" max="8" placeholder="Period No" value={form.period_no} onChange={(e) => setForm({ ...form, period_no: e.target.value })} required />
      <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
      <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} required>
        <option value="">Select Teacher</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button className="btn btn-primary btn-sm" type="submit"><Plus style={{ width: 14 }} /> Add Period</button>
      {message && <span className="admin-form-msg">{message}</span>}
    </form>
  );
}

export default function AdminSection({ active, currentUser, refreshToken }) {
  const [overview, setOverview] = useState({ total_teachers: 0, total_students: 0, total_periods: 0, total_memos: 0 });
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [tab, setTab] = useState('teachers');

  const loadAdminDashboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [ov, t, s, sched] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminTeachers(),
        fetchAdminStudents(),
        fetchAdminSchedule(),
      ]);
      setOverview(ov);
      setTeachers(t);
      setStudents(s);
      setSchedule(sched);
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadAdminDashboard();
  }, [loadAdminDashboard, refreshToken]);

  if (!currentUser) return null;

  return (
    <section id="admin-section" className={`view-section ${active ? 'active' : ''}`}>
      <img src="/hits_campus.jpg" alt="HITS Campus" className="dashboard-hero-img" />
      <div className="section-title-area">
        <div>
          <h2>Admin Control Panel</h2>
          <p>{currentUser.name} • System Administration</p>
        </div>
        <div className="hod-stats">
          <StatCard icon={Users} value={overview.total_teachers} label="Teachers" />
          <StatCard icon={GraduationCap} value={overview.total_students} label="Students" />
          <StatCard icon={CalendarClock} value={overview.total_periods} label="Scheduled Periods" />
          <StatCard icon={FileWarning} value={overview.total_memos} label="Memos Issued" />
        </div>
      </div>

      <div className="hod-monitor-container glass-panel">
        <div className="monitor-header admin-tabs">
          <button className={`btn btn-sm ${tab === 'teachers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('teachers')}>Teachers</button>
          <button className={`btn btn-sm ${tab === 'students' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('students')}>Students</button>
          <button className={`btn btn-sm ${tab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('schedule')}>Timetable</button>
        </div>

        {tab === 'teachers' && (
          <>
            <AddTeacherForm onAdded={loadAdminDashboard} />
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Username</th><th>Department</th></tr></thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.id}><td>{t.name}</td><td>{t.username}</td><td>{t.department}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'students' && (
          <>
            <AddStudentForm onAdded={loadAdminDashboard} />
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Roll No</th><th>Department</th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}><td>{s.name}</td><td>{s.roll_no}</td><td>{s.department}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'schedule' && (
          <>
            <AddScheduleForm teachers={teachers} onAdded={loadAdminDashboard} />
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Subject</th><th>Teacher</th></tr></thead>
                <tbody>
                  {schedule.map((s) => (
                    <tr key={s.id}><td>{s.period_no}</td><td>{s.subject}</td><td>{s.teacher_name}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
