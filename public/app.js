// State Management
let currentUser = null;
let simulatedDate = '2026-07-18';
let simulatedTime = '10:30';
let allStudents = [];
let activePeriod = null; // Used when marking attendance

// DOM Elements
const loginSection = document.getElementById('login-section');
const loginForm = document.getElementById('login-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorMsg = document.getElementById('login-error');
const loginErrorText = document.getElementById('login-error-text');

const simulatorWidget = document.getElementById('simulator-widget');
const headerUserCard = document.getElementById('header-user-card');
const headerUserName = document.getElementById('header-user-name');
const headerUserRole = document.getElementById('header-user-role');
const btnLogout = document.getElementById('btn-logout');

const simDateInput = document.getElementById('sim-date');
const simTimeInput = document.getElementById('sim-time');
const btnFastForward = document.getElementById('btn-fast-forward');

// Sections
const teacherSection = document.getElementById('teacher-section');
const hodSection = document.getElementById('hod-section');

// Teacher Dashboard Elements
const teacherNameTitle = document.getElementById('teacher-name-title');
const teacherDeptTitle = document.getElementById('teacher-dept-title');
const fnPeriodsContainer = document.getElementById('fn-periods');
const anPeriodsContainer = document.getElementById('an-periods');
const teacherAlertsContainer = document.getElementById('teacher-alerts');
const memoAlertsContainer = document.getElementById('memo-alerts');
const teacherMemosList = document.getElementById('teacher-memos-list');

// HOD Dashboard Elements
const statAttendanceRate = document.getElementById('stat-attendance-rate');
const statMissingHours = document.getElementById('stat-missing-hours');
const statActiveMemos = document.getElementById('stat-active-memos');
const hodTeachersList = document.getElementById('hod-teachers-list');
const hodMemosList = document.getElementById('hod-memos-list');
const eodWarningBadge = document.getElementById('eod-warning');

// Modals
const attendanceModal = document.getElementById('attendance-modal');
const modalSubjectTitle = document.getElementById('modal-subject-title');
const modalPeriodDetails = document.getElementById('modal-period-details');
const studentsRosterBody = document.getElementById('students-roster-body');
const btnSubmitAttendance = document.getElementById('btn-submit-attendance');

const memoModal = document.getElementById('memo-modal');
const memoTeacherDetails = document.getElementById('memo-teacher-details');
const memoTeacherIdInput = document.getElementById('memo-teacher-id');
const memoPeriodNoInput = document.getElementById('memo-period-no');
const memoReasonInput = document.getElementById('memo-reason');

const ackModal = document.getElementById('ack-modal');
const ackMemoDetails = document.getElementById('ack-memo-details');
const ackOriginalReason = document.getElementById('ack-original-reason');
const ackMemoIdInput = document.getElementById('ack-memo-id');
const ackExplanationInput = document.getElementById('ack-explanation');

const timetableModal = document.getElementById('timetable-modal');
const timetableRosterBody = document.getElementById('timetable-roster-body');
const timetableTeacherName = document.getElementById('timetable-teacher-name');

// --- Event Listeners ---
window.addEventListener('DOMContentLoaded', () => {
  // Sync inputs with state
  simDateInput.value = simulatedDate;
  simTimeInput.value = simulatedTime;

  // Initial fetch of students
  fetchStudents();

  // Login handler
  if (loginForm) {
    loginForm.addEventListener('submit', submitLogin);
  }

  // Logout handler
  if (btnLogout) {
    btnLogout.addEventListener('click', processLogout);
  }

  // Bind change events
  simDateInput.addEventListener('change', (e) => {
    simulatedDate = e.target.value;
    loadDashboard();
  });
  simTimeInput.addEventListener('change', (e) => {
    simulatedTime = e.target.value;
    loadDashboard();
  });

  btnFastForward.addEventListener('click', () => {
    simTimeInput.value = '16:30'; // Past 4:05 PM EOD
    simulatedTime = '16:30';
    loadDashboard();
  });

  // Modal Closures
  document.getElementById('btn-close-modal').addEventListener('click', closeAttendanceModal);
  document.getElementById('btn-cancel-attendance').addEventListener('click', closeAttendanceModal);
  document.getElementById('btn-close-memo-modal').addEventListener('click', closeMemoModal);
  document.getElementById('btn-cancel-memo').addEventListener('click', closeMemoModal);
  document.getElementById('btn-close-ack-modal').addEventListener('click', closeAckModal);
  document.getElementById('btn-cancel-ack').addEventListener('click', closeAckModal);

  // Quick Marks
  document.getElementById('btn-mark-all-present').addEventListener('click', () => markAllRoster('Present'));
  document.getElementById('btn-mark-all-absent').addEventListener('click', () => markAllRoster('Absent'));

  // Submit Forms
  btnSubmitAttendance.addEventListener('click', submitAttendance);
  document.getElementById('btn-submit-memo').addEventListener('click', submitMemo);
  document.getElementById('btn-submit-ack').addEventListener('click', submitAck);

  // Edit button inside View modal
  document.getElementById('btn-edit-attendance').addEventListener('click', () => {
    document.getElementById('btn-edit-attendance').style.display = 'none';
    btnSubmitAttendance.style.display = 'inline-flex';
    document.querySelector('.quick-selectors').style.display = 'flex';
    renderStudentsRoster(activePeriod.period_no, false);
  });

  // View Timetable Modal trigger
  const btnViewTimetable = document.getElementById('btn-view-timetable');
  if (btnViewTimetable) {
    btnViewTimetable.addEventListener('click', openTimetableModal);
  }
  document.getElementById('btn-close-timetable').addEventListener('click', closeTimetableModal);
});

// --- Login Processing ---
async function submitLogin(e) {
  e.preventDefault();
  
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;
  
  loginErrorMsg.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      currentUser = data.user;
      
      // Update UI panels based on role
      loginSection.classList.remove('active');
      
      if (currentUser.role === 'teacher') {
        teacherSection.classList.add('active');
        hodSection.classList.remove('active');
        teacherNameTitle.textContent = currentUser.name;
        teacherDeptTitle.textContent = `Department of ${currentUser.department} • Today's Schedule`;
      } else {
        teacherSection.classList.remove('active');
        hodSection.classList.add('active');
      }

      // Populate user info in header and show controls
      headerUserName.textContent = currentUser.name;
      headerUserRole.textContent = currentUser.role.toUpperCase();
      headerUserCard.style.display = 'flex';
      simulatorWidget.style.display = 'flex';

      loadDashboard();
    } else {
      loginErrorText.textContent = data.message || 'Invalid username or password';
      loginErrorMsg.style.display = 'flex';
    }
  } catch (error) {
    console.error('Login error:', error);
    loginErrorText.textContent = 'Server error. Please try again.';
    loginErrorMsg.style.display = 'flex';
  }
}

// --- Logout Processing ---
function processLogout() {
  currentUser = null;
  
  // Hide portals, show login screen
  teacherSection.classList.remove('active');
  hodSection.classList.remove('active');
  loginSection.classList.add('active');
  
  // Hide header controls
  headerUserCard.style.display = 'none';
  simulatorWidget.style.display = 'none';
  
  // Clear inputs
  loginUsernameInput.value = '';
  loginPasswordInput.value = '';
  loginErrorMsg.style.display = 'none';
  
  // Re-render icons
  setTimeout(() => lucide.createIcons(), 50);
}

// --- Load Dashboards ---
function loadDashboard() {
  if (!currentUser) return;

  if (currentUser.role === 'teacher') {
    loadTeacherDashboard();
  } else if (currentUser.role === 'hod') {
    loadHODDashboard();
  }
  
  // Re-render icons
  setTimeout(() => lucide.createIcons(), 50);
}

// --- Teacher Dashboard Functions ---
async function loadTeacherDashboard() {
  try {
    const date = simulatedDate;
    const time = simulatedTime;

    // 1. Get schedule
    const res = await fetch(`/api/teacher/${currentUser.id}/schedule?date=${date}&simTime=${time}`);
    const schedule = await res.json();

    // Clear lists
    fnPeriodsContainer.innerHTML = '';
    anPeriodsContainer.innerHTML = '';

    schedule.forEach(period => {
      const card = createPeriodCard(period);
      if (period.session === 'FN') {
        fnPeriodsContainer.appendChild(card);
      } else {
        anPeriodsContainer.appendChild(card);
      }
    });

    // Calculate and render statistics for the logged-in teacher
    const totalAssigned = schedule.length;
    const completedSubmissions = schedule.filter(p => p.status === 'marked').length;
    
    // Average attendance rate across marked classes
    const markedPeriods = schedule.filter(p => p.status === 'marked' && p.attendance_percentage !== null);
    const avgAttendance = markedPeriods.length > 0 
      ? Math.round(markedPeriods.reduce((acc, p) => acc + p.attendance_percentage, 0) / markedPeriods.length) 
      : 0;
      
    const submissionRate = totalAssigned > 0 
      ? Math.round((completedSubmissions / totalAssigned) * 100) 
      : 100;

    document.getElementById('teacher-stat-assigned').textContent = totalAssigned;
    document.getElementById('teacher-stat-completed').textContent = `${submissionRate}%`;
    document.getElementById('teacher-stat-average').textContent = `${avgAttendance}%`;

    // 2. Get Reminders
    const remRes = await fetch(`/api/reminders?teacherId=${currentUser.id}&date=${date}&simTime=${time}`);
    const reminders = await remRes.json();
    renderTeacherReminders(reminders);

    // 3. Get Memos
    const memoRes = await fetch(`/api/memos?teacherId=${currentUser.id}&date=${date}`);
    const memos = await memoRes.json();
    renderTeacherMemos(memos);

  } catch (error) {
    console.error('Error loading teacher dashboard:', error);
  }
}

function createPeriodCard(period) {
  const card = document.createElement('div');
  card.className = `period-card glass-panel ${period.status} ${period.memo ? 'memo-issued' : ''}`;
  
  let statusText = period.status;
  if (period.memo) {
    statusText = 'Memo Issued';
  }

  let attendanceInfoHtml = '';
  if (period.status === 'marked' && period.present_percentage !== null) {
    attendanceInfoHtml = `
      <div class="period-attendance-details" style="margin-top: 6px; display: flex; flex-direction: column; gap: 2px; font-size: 0.8rem;">
        <div style="color: var(--success); display: flex; align-items: center; gap: 6px;">
          <i data-lucide="check" style="width: 14px; height: 14px;"></i>
          <span style="font-weight: 600;">Present: ${period.present_count} / ${period.present_count + period.absent_count} (${period.present_percentage}%)</span>
        </div>
        <div style="color: var(--danger); display: flex; align-items: center; gap: 6px;">
          <i data-lucide="x" style="width: 14px; height: 14px;"></i>
          <span style="font-weight: 600;">Absent: ${period.absent_count} / ${period.present_count + period.absent_count} (${period.absent_percentage}%)</span>
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="period-info">
      <span class="period-number">Period ${period.period_no} • ${period.session}</span>
      <h4 class="period-subject">${period.subject}</h4>
      <div class="period-time">
        <i data-lucide="clock" style="width: 14px;"></i>
        <span>${formatTime(period.start_time)} - ${formatTime(period.end_time)}</span>
      </div>
      ${attendanceInfoHtml}
    </div>
    <div class="period-status">
      <span class="status-badge ${period.memo ? 'memo-issued' : period.status}">${statusText}</span>
      ${getPeriodActionButton(period)}
    </div>
  `;

  return card;
}

function getPeriodActionButton(period) {
  if (period.status === 'marked') {
    return `<button class="btn btn-secondary btn-sm" onclick="openMarkAttendanceModal(${period.period_no}, '${period.subject}', '${period.start_time}', '${period.end_time}', '${period.session}')">
      <i data-lucide="edit-3"></i> Edit Attendance
    </button>`;
  } else if (period.status === 'upcoming') {
    return `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.5;">
      Upcoming
    </button>`;
  } else {
    // ongoing, pending, overdue
    const icon = period.status === 'overdue' ? 'alert-triangle' : 'edit-2';
    const btnClass = period.status === 'overdue' ? 'btn-danger' : 'btn-primary';
    return `<button class="btn ${btnClass} btn-sm" onclick="openMarkAttendanceModal(${period.period_no}, '${period.subject}', '${period.start_time}', '${period.end_time}', '${period.session}')">
      <i data-lucide="${icon}"></i> Mark Attendance
    </button>`;
  }
}

function renderTeacherReminders(reminders) {
  teacherAlertsContainer.innerHTML = '';
  
  if (reminders.length === 0) return;

  reminders.forEach(rem => {
    const alert = document.createElement('div');
    alert.className = 'alert-banner warning';
    alert.innerHTML = `
      <div class="alert-content">
        <i data-lucide="alert-circle" style="width: 24px; height: 24px;"></i>
        <div>
          <p>Urgent Reminder: Unmarked Attendance</p>
          <span>Attendance for <strong>Period ${rem.period_no} (${rem.subject})</strong> has not been marked. This class ended at ${formatTime(rem.end_time)} and is now overdue by over 1 hour.</span>
        </div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="openMarkAttendanceModal(${rem.period_no}, '${rem.subject}', '', '', '${rem.session}')">
        Mark Now
      </button>
    `;
    teacherAlertsContainer.appendChild(alert);
  });
}

function renderTeacherMemos(memos) {
  memoAlertsContainer.innerHTML = '';
  teacherMemosList.innerHTML = '';

  const activeMemos = memos.filter(m => m.status === 'Issued');
  
  // Render crimson notification banner
  activeMemos.forEach(memo => {
    const alert = document.createElement('div');
    alert.className = 'alert-banner danger';
    alert.innerHTML = `
      <div class="alert-content">
        <i data-lucide="mail-warning" style="width: 24px; height: 24px;"></i>
        <div>
          <p>Official Memo Issued by HOD</p>
          <span>A disciplinary memo was issued for missing attendance marking on Period ${memo.period_no} (${memo.subject}). Reason: "${memo.reason}"</span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAcknowledgeModal(${memo.id}, ${memo.period_no}, '${memo.subject}', '${memo.reason.replace(/'/g, "\\'")}')">
        Acknowledge
      </button>
    `;
    memoAlertsContainer.appendChild(alert);
  });

  // Populate history table
  if (memos.length === 0) {
    teacherMemosList.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No memos issued for this date.</td></tr>`;
    return;
  }

  memos.forEach(memo => {
    const row = document.createElement('tr');
    
    let badgeClass = 'status-badge upcoming';
    if (memo.status === 'Issued') badgeClass = 'status-badge memo-issued';
    if (memo.status === 'Acknowledged') badgeClass = 'status-badge marked';

    row.innerHTML = `
      <td>${memo.date}</td>
      <td>Period ${memo.period_no} (${memo.subject})</td>
      <td>${memo.reason}</td>
      <td>${new Date(memo.issued_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
      <td><span class="${badgeClass}">${memo.status}</span></td>
      <td>
        ${memo.status === 'Acknowledged' 
          ? `<span class="text-muted">${memo.acknowledgment}</span>` 
          : `<button class="btn btn-secondary btn-sm" onclick="openAcknowledgeModal(${memo.id}, ${memo.period_no}, '${memo.subject}', '${memo.reason.replace(/'/g, "\\'")}')">Submit Explanation</button>`
        }
      </td>
    `;
    teacherMemosList.appendChild(row);
  });
}

// --- HOD Dashboard Functions ---
async function loadHODDashboard() {
  try {
    const date = simulatedDate;
    const time = simulatedTime;

    // Show/hide end-of-day alert
    const isEOD = timeToMinutes(time) >= timeToMinutes('16:05');
    eodWarningBadge.style.display = isEOD ? 'inline-flex' : 'none';

    // 1. Fetch department summary
    const res = await fetch(`/api/hod/summary?date=${date}&simTime=${time}`);
    const reports = await res.json();

    // 2. Calculate header cards statistics
    let totalClasses = 0;
    let markedClasses = 0;
    let overdueCount = 0;
    
    reports.forEach(t => {
      totalClasses += t.total_assigned;
      markedClasses += t.marked_count;
      t.periods.forEach(p => {
        if (p.is_overdue) overdueCount++;
      });
    });

    const completionRate = totalClasses > 0 ? Math.round((markedClasses / totalClasses) * 100) : 100;
    statAttendanceRate.textContent = `${completionRate}%`;
    statMissingHours.textContent = overdueCount;

    // 3. Render teacher rows
    hodTeachersList.innerHTML = '';
    
    reports.forEach(report => {
      const row = createHODTeacherRow(report, isEOD);
      hodTeachersList.appendChild(row);
    });

    // 4. Fetch Department Memos
    const memoRes = await fetch(`/api/memos?date=${date}`);
    const memos = await memoRes.json();
    renderHODMemos(memos);

    statActiveMemos.textContent = memos.filter(m => m.status === 'Issued').length;

  } catch (error) {
    console.error('Error loading HOD dashboard:', error);
  }
}

function createHODTeacherRow(report, isEOD) {
  const row = document.createElement('div');
  row.className = 'teacher-row glass-panel';

  // Build pill elements
  let pillsHtml = '';
  report.periods.forEach(p => {
    let pillClass = '';
    let statusIcon = 'circle';
    
    if (p.is_marked) {
      pillClass = 'is-marked';
      statusIcon = 'check-circle';
    } else if (p.memo) {
      pillClass = 'has-memo';
      statusIcon = 'mail-warning';
    } else if (p.is_overdue) {
      pillClass = 'is-overdue';
      statusIcon = 'alert-triangle';
    }

    // Determine HOD Action
    let pillActionBtn = '';
    if (!p.is_marked && !p.memo && (p.is_overdue || isEOD)) {
      pillActionBtn = `<button class="btn btn-danger btn-sm" style="margin-left: 8px; padding: 2px 6px; font-size: 0.65rem;" onclick="openIssueMemoModal(${report.teacher_id}, ${p.period_no}, '${report.teacher_name.replace(/'/g, "\\'")}', '${p.subject.replace(/'/g, "\\'")}')">Issue Memo</button>`;
    } else if (p.is_marked) {
      pillActionBtn = `<button class="btn btn-secondary btn-sm" style="margin-left: 8px; padding: 2px 6px; font-size: 0.65rem; background: transparent;" onclick="openViewAttendanceModal(${p.period_no}, '${p.subject}', '${report.teacher_name}', ${report.teacher_id})"><i data-lucide="eye" style="width: 10px;"></i> Roster</button>`;
    }

    let attendanceText = p.is_marked ? 'Marked' : (p.memo ? 'Memoed' : 'Pending');
    if (p.is_marked && p.present_percentage !== null) {
      attendanceText = `${p.present_count}P (${p.present_percentage}%) | ${p.absent_count}A (${p.absent_percentage}%)`;
    }

    pillsHtml += `
      <div class="period-pill ${pillClass}">
        <span class="pill-dot"></span>
        <span>P${p.period_no} (${p.session}): ${attendanceText}</span>
        ${pillActionBtn}
      </div>
    `;
  });

  row.innerHTML = `
    <div class="teacher-meta">
      <div class="teacher-info">
        <h4>${report.teacher_name}</h4>
        <span>${report.department} • Assigned classes: ${report.total_assigned}</span>
      </div>
      <div class="teacher-progress">
        <div class="progress-track">
          <div class="progress-fill" style="width: ${report.percentage}%;"></div>
        </div>
        <span style="font-size: 0.85rem; font-weight: 600;">${report.percentage}% completed</span>
      </div>
    </div>
    <div class="teacher-periods-row">
      ${pillsHtml}
    </div>
  `;

  return row;
}

function renderHODMemos(memos) {
  hodMemosList.innerHTML = '';
  
  if (memos.length === 0) {
    hodMemosList.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No memos issued on this date.</td></tr>`;
    return;
  }

  memos.forEach(memo => {
    const row = document.createElement('tr');
    
    let badgeClass = 'status-badge upcoming';
    if (memo.status === 'Issued') badgeClass = 'status-badge memo-issued';
    if (memo.status === 'Acknowledged') badgeClass = 'status-badge marked';

    row.innerHTML = `
      <td><strong>${memo.teacher_name}</strong></td>
      <td>Period ${memo.period_no} (${memo.subject})</td>
      <td>${memo.reason}</td>
      <td>${new Date(memo.issued_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
      <td><span class="${badgeClass}">${memo.status}</span></td>
      <td>
        ${memo.status === 'Acknowledged' 
          ? `<span class="success-text" style="font-weight: 500;">Explanation:</span> <span class="text-muted">${memo.acknowledgment}</span>` 
          : `<span class="warning-text"><i data-lucide="hourglass" style="width: 12px; display: inline; vertical-align: middle;"></i> Awaiting response</span>`
        }
      </td>
    `;
    hodMemosList.appendChild(row);
  });
}

// --- Attendance Roster Modal ---
async function openMarkAttendanceModal(periodNo, subject, start, end, session) {
  activePeriod = { period_no: periodNo, date: simulatedDate, subject, start, end, session, teacher_id: currentUser.id };
  
  modalSubjectTitle.textContent = subject;
  modalPeriodDetails.textContent = `Period ${periodNo} (${session}) • Mark attendance`;
  
  // Show submit button, enable quick buttons, hide edit button
  btnSubmitAttendance.style.display = 'inline-flex';
  document.getElementById('btn-edit-attendance').style.display = 'none';
  document.querySelector('.quick-selectors').style.display = 'flex';

  await renderStudentsRoster(periodNo, false);
  attendanceModal.classList.add('active');
}

async function openViewAttendanceModal(periodNo, subject, teacherName = '', teacherId = null) {
  activePeriod = { period_no: periodNo, date: simulatedDate, subject, teacher_id: teacherId };

  modalSubjectTitle.textContent = subject;
  modalPeriodDetails.textContent = `Period ${periodNo} • Roster View ${teacherName ? `(${teacherName})` : ''}`;
  
  // Hide submit button, hide quick selectors, show edit button
  btnSubmitAttendance.style.display = 'none';
  document.querySelector('.quick-selectors').style.display = 'none';
  document.getElementById('btn-edit-attendance').style.display = 'inline-flex';

  await renderStudentsRoster(periodNo, true);
  attendanceModal.classList.add('active');
}

async function renderStudentsRoster(periodNo, isReadOnly) {
  studentsRosterBody.innerHTML = '';
  
  let attendanceMap = new Map();
  if (isReadOnly || true) {
    // Attempt to pull submitted attendance
    try {
      const res = await fetch(`/api/attendance/period/${periodNo}?date=${simulatedDate}`);
      const records = await res.json();
      records.forEach(r => attendanceMap.set(r.student_id, r.status));
    } catch(e) {
      console.log('Error pulling attendance roster:', e);
    }
  }

  allStudents.forEach(student => {
    const row = document.createElement('tr');
    
    // Status Selection HTML
    const initialStatus = attendanceMap.get(student.id) || 'Present';
    let switchHtml = '';
    
    if (isReadOnly) {
      // Show simple badges in read-only mode
      const badgeClass = initialStatus === 'Present' ? 'status-badge marked' : 'status-badge memo-issued';
      switchHtml = `<span class="${badgeClass}">${initialStatus}</span>`;
    } else {
      // Interactive Switch/Toggle
      const presentClass = initialStatus === 'Present' ? 'present-selected' : '';
      const absentClass = initialStatus === 'Absent' ? 'absent-selected' : '';
      const selectedClass = initialStatus === 'Present' ? 'present-selected' : 'absent-selected';

      switchHtml = `
        <div class="attendance-switch ${selectedClass}" data-student-id="${student.id}">
          <span class="switch-option present-opt" onclick="setRosterStatus(${student.id}, 'Present')">P</span>
          <span class="switch-option absent-opt" onclick="setRosterStatus(${student.id}, 'Absent')">A</span>
        </div>
      `;
    }

    row.innerHTML = `
      <td>${student.roll_no}</td>
      <td><strong>${student.name}</strong></td>
      <td class="text-center">${switchHtml}</td>
    `;
    studentsRosterBody.appendChild(row);
  });
}

function setRosterStatus(studentId, status) {
  const el = document.querySelector(`.attendance-switch[data-student-id="${studentId}"]`);
  if (el) {
    if (status === 'Present') {
      el.className = 'attendance-switch present-selected';
    } else {
      el.className = 'attendance-switch absent-selected';
    }
  }
}

function markAllRoster(status) {
  allStudents.forEach(student => {
    setRosterStatus(student.id, status);
  });
}

async function submitAttendance() {
  if (!activePeriod || !currentUser) return;

  const attendanceRecords = [];
  const switches = document.querySelectorAll('.attendance-switch');
  
  switches.forEach(sw => {
    const studentId = parseInt(sw.getAttribute('data-student-id'));
    const status = sw.classList.contains('present-selected') ? 'Present' : 'Absent';
    attendanceRecords.push({ student_id: studentId, status });
  });

  try {
    const payload = {
      date: activePeriod.date,
      period_no: activePeriod.period_no,
      teacher_id: activePeriod.teacher_id || currentUser.id,
      attendance: attendanceRecords
    };

    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.success) {
      closeAttendanceModal();
      loadDashboard();
    } else {
      alert('Error submitting attendance: ' + data.message);
    }
  } catch (error) {
    console.error('Error submitting attendance:', error);
  }
}

function closeAttendanceModal() {
  attendanceModal.classList.remove('active');
  activePeriod = null;
}

// --- HOD Issue Memo Modal ---
function openIssueMemoModal(teacherId, periodNo, teacherName, subject) {
  memoTeacherDetails.textContent = `To: ${teacherName} • Period ${periodNo} (${subject})`;
  memoTeacherIdInput.value = teacherId;
  memoPeriodNoInput.value = periodNo;
  memoReasonInput.value = `Unmarked attendance for Period ${periodNo} (${subject}) on date ${simulatedDate} past the required deadline.`;
  memoModal.classList.add('active');
}

async function submitMemo(e) {
  e.preventDefault();
  
  const teacher_id = parseInt(memoTeacherIdInput.value);
  const period_no = parseInt(memoPeriodNoInput.value);
  const reason = memoReasonInput.value;
  const date = simulatedDate;

  if (!reason.trim()) {
    alert('Please enter a reason for the memo.');
    return;
  }

  try {
    const res = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, period_no, teacher_id, reason })
    });
    
    const data = await res.json();
    if (data.success) {
      closeMemoModal();
      loadDashboard();
    }
  } catch (error) {
    console.error('Error issuing memo:', error);
  }
}

function closeMemoModal() {
  memoModal.classList.remove('active');
  memoReasonInput.value = '';
}

// --- Teacher Acknowledge Memo Modal ---
function openAcknowledgeModal(memoId, periodNo, subject, reason) {
  ackMemoDetails.textContent = `Ref: Period ${periodNo} (${subject})`;
  ackOriginalReason.textContent = reason;
  ackMemoIdInput.value = memoId;
  ackExplanationInput.value = '';
  ackModal.classList.add('active');
}

async function submitAck(e) {
  e.preventDefault();

  const memoId = ackMemoIdInput.value;
  const explanation = ackExplanationInput.value;

  if (!explanation.trim()) {
    alert('Please provide an explanation.');
    return;
  }

  try {
    const res = await fetch(`/api/memos/${memoId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgment: explanation })
    });
    
    const data = await res.json();
    if (data.success) {
      closeAckModal();
      loadDashboard();
    }
  } catch (error) {
    console.error('Error acknowledging memo:', error);
  }
}

function closeAckModal() {
  ackModal.classList.remove('active');
  ackExplanationInput.value = '';
}

// --- Timetable Modal Reference ---
async function openTimetableModal() {
  if (!currentUser) return;
  timetableTeacherName.textContent = `${currentUser.name} • Department of ${currentUser.department}`;
  timetableRosterBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading timetable...</td></tr>';
  timetableModal.classList.add('active');

  try {
    const res = await fetch('/api/schedule');
    const schedule = await res.json();
    
    // Filter schedule for this teacher
    const myClasses = schedule.filter(s => s.teacher_id === currentUser.id);
    const classMap = new Map();
    myClasses.forEach(c => classMap.set(c.period_no, c.subject));

    const PERIODS = [
      { no: 1, start: '08:30', end: '09:25', session: 'FN' },
      { no: 2, start: '09:25', end: '10:20', session: 'FN' },
      { no: 3, start: '10:40', end: '11:35', session: 'FN' },
      { no: 4, start: '11:35', end: '12:30', session: 'FN' },
      { no: 5, start: '13:25', end: '14:15', session: 'AN' },
      { no: 6, start: '14:15', end: '15:05', session: 'AN' },
      { no: 7, start: '15:15', end: '16:05', session: 'AN' }
    ];

    timetableRosterBody.innerHTML = '';
    PERIODS.forEach(p => {
      const subject = classMap.get(p.no);
      const row = document.createElement('tr');
      
      let subjectHtml = `<span class="text-muted" style="font-style: italic;">Free Period</span>`;
      let rowStyle = '';
      if (subject) {
        subjectHtml = `<strong>${subject}</strong>`;
        rowStyle = `background: rgba(16, 185, 129, 0.05);`;
      }

      row.innerHTML = `
        <td><strong>Period ${p.no}</strong></td>
        <td>${formatTime(p.start)} - ${formatTime(p.end)}</td>
        <td><span class="badge ${p.session === 'FN' ? 'fn-badge' : 'an-badge'}">${p.session}</span></td>
        <td style="${rowStyle}">${subjectHtml}</td>
      `;
      timetableRosterBody.appendChild(row);
    });

    setTimeout(() => lucide.createIcons(), 50);
  } catch (error) {
    console.error('Error generating timetable reference:', error);
    timetableRosterBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading timetable.</td></tr>';
  }
}

function closeTimetableModal() {
  timetableModal.classList.remove('active');
}

// --- Helper Functions ---
async function fetchStudents() {
  try {
    const res = await fetch('/api/students');
    allStudents = await res.json();
  } catch (error) {
    console.error('Error fetching students:', error);
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
