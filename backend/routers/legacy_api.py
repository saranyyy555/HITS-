"""
Person B module: attendance / schedule / memo endpoints.

These endpoints intentionally match the exact URL paths, methods, and
response shapes that the existing React frontend (frontend-src/src/api.js)
already calls — so the frontend can point at this FastAPI backend with
ZERO frontend code changes.
"""
from datetime import datetime
from fastapi import APIRouter, Body

from backend.core.legacy_db import (
    query_db, execute_db, submit_attendance, auto_generate_memos,
    get_period_status, PERIODS,
)

router = APIRouter(prefix="/api", tags=["Attendance (frontend-compatible)"])


# ---------- Login ----------
@router.post("/login")
def login(payload: dict = Body(...)):
    username = payload.get("username")
    password = payload.get("password")
    row = query_db(
        "SELECT id, username, name, role, department FROM users WHERE username = ? AND password = ?",
        (username, password), one=True,
    )
    if row:
        return {"success": True, "user": dict(row)}
    return {"success": False, "message": "Invalid credentials"}


# ---------- Students ----------
@router.get("/students")
def get_students():
    rows = query_db("SELECT * FROM students ORDER BY name ASC")
    return [dict(r) for r in rows]


# ---------- Full schedule ----------
@router.get("/schedule")
def get_schedule():
    rows = query_db("""
        SELECT s.*, u.name as teacher_name, u.username as teacher_username
        FROM schedule s JOIN users u ON s.teacher_id = u.id
        ORDER BY s.period_no ASC
    """)
    return [dict(r) for r in rows]


# ---------- Teacher's own schedule/day view ----------
@router.get("/teacher/{teacher_id}/schedule")
def get_teacher_schedule(teacher_id: int, date: str = None, simTime: str = "17:00"):
    date = date or datetime.now().strftime("%Y-%m-%d")
    auto_generate_memos(date, simTime)

    rows = query_db("SELECT * FROM schedule WHERE teacher_id = ? ORDER BY period_no ASC", (teacher_id,))
    schedule = [dict(r) for r in rows]

    sub_rows = query_db(
        "SELECT period_no, marked_at FROM attendance_submissions WHERE teacher_id = ? AND date = ?",
        (teacher_id, date),
    )
    submission_map = {r["period_no"]: r["marked_at"] for r in sub_rows}

    memo_rows = query_db(
        "SELECT period_no, id as memo_id, status as memo_status FROM memos WHERE teacher_id = ? AND date = ?",
        (teacher_id, date),
    )
    memo_map = {r["period_no"]: {"id": r["memo_id"], "status": r["memo_status"]} for r in memo_rows}

    result = []
    for sched in schedule:
        period_no = sched["period_no"]
        period_info = next((p for p in PERIODS if p["no"] == period_no), None)
        is_submitted = period_no in submission_map

        status = "upcoming"
        present_count = absent_count = present_percentage = absent_percentage = None

        if is_submitted:
            status = "marked"
            att_row = query_db("""
                SELECT SUM(case when status='Present' then 1 else 0 end) as present,
                       SUM(case when status='Absent' then 1 else 0 end) as absent,
                       COUNT(*) as total
                FROM attendance_records WHERE date = ? AND period_no = ?
            """, (date, period_no), one=True)
            if att_row and att_row["total"] > 0:
                present_count = att_row["present"] or 0
                absent_count = att_row["absent"] or 0
                total = att_row["total"]
                present_percentage = int((present_count / total) * 100)
                absent_percentage = 100 - present_percentage
        elif period_info:
            status = get_period_status(period_info["start"], period_info["end"], simTime)

        result.append({
            "id": sched["id"],
            "period_no": period_no,
            "subject": sched["subject"],
            "teacher_id": sched["teacher_id"],
            "start_time": period_info["start"] if period_info else "",
            "end_time": period_info["end"] if period_info else "",
            "session": period_info["session"] if period_info else "FN",
            "status": status,
            "marked_at": submission_map.get(period_no),
            "memo": memo_map.get(period_no),
            "present_count": present_count,
            "absent_count": absent_count,
            "present_percentage": present_percentage,
            "absent_percentage": absent_percentage,
            "attendance_percentage": present_percentage,
        })
    return result


# ---------- Reminders ----------
@router.get("/reminders")
def get_reminders(teacherId: int, date: str = None, simTime: str = "17:00"):
    date = date or datetime.now().strftime("%Y-%m-%d")
    rows = query_db("SELECT * FROM schedule WHERE teacher_id = ?", (teacherId,))
    sub_rows = query_db(
        "SELECT period_no FROM attendance_submissions WHERE teacher_id = ? AND date = ?", (teacherId, date)
    )
    submitted = {r["period_no"] for r in sub_rows}

    reminders = []
    for sched in rows:
        p_no = sched["period_no"]
        if p_no in submitted:
            continue
        period_info = next((p for p in PERIODS if p["no"] == p_no), None)
        if not period_info:
            continue
        status = get_period_status(period_info["start"], period_info["end"], simTime)
        if status in ("pending", "overdue"):
            end_min = int(period_info["end"].split(":")[0]) * 60 + int(period_info["end"].split(":")[1])
            curr_min = int(simTime.split(":")[0]) * 60 + int(simTime.split(":")[1])
            minutes_late = curr_min - end_min
            level = 1 if minutes_late < 20 else (2 if minutes_late < 40 else 3)
            reminders.append({
                "period_no": p_no,
                "subject": sched["subject"],
                "level": level,
                "message": f"Reminder {level}: Attendance pending for Period {p_no} ({sched['subject']})",
            })
    return reminders


# ---------- Memos: list ----------
@router.get("/memos")
def get_memos(teacherId: int = None, date: str = None):
    query = "SELECT * FROM memos WHERE 1=1"
    args = []
    if teacherId is not None:
        query += " AND teacher_id = ?"
        args.append(teacherId)
    if date:
        query += " AND date = ?"
        args.append(date)
    query += " ORDER BY issued_at DESC"
    rows = query_db(query, tuple(args))
    return [dict(r) for r in rows]


# ---------- Memos: issue ----------
@router.post("/memos")
def create_memo(payload: dict = Body(...)):
    date = payload.get("date")
    period_no = payload.get("period_no")
    teacher_id = payload.get("teacher_id")
    reason = payload.get("reason")

    if not date or not period_no or not teacher_id or not reason:
        return {"success": False, "message": "Missing parameters"}

    memo_id = execute_db("""
        INSERT INTO memos (date, period_no, teacher_id, reason, issued_at, status)
        VALUES (?, ?, ?, ?, ?, 'Issued')
    """, (date, period_no, teacher_id, reason, datetime.now().isoformat()))
    return {"success": True, "memo_id": memo_id, "message": "Memo issued successfully"}


# ---------- Memos: acknowledge ----------
@router.post("/memos/{memo_id}/acknowledge")
def acknowledge_memo(memo_id: int, payload: dict = Body(...)):
    acknowledgment = payload.get("acknowledgment")
    if not acknowledgment:
        return {"success": False, "message": "Acknowledgment is required"}

    execute_db("""
        UPDATE memos SET status = 'Acknowledged', acknowledgment = ?, acknowledged_at = ?
        WHERE id = ?
    """, (acknowledgment, datetime.now().isoformat(), memo_id))
    return {"success": True, "message": "Memo acknowledged successfully"}


# ---------- Attendance: single period detail ----------
@router.get("/attendance/period/{period_no}")
def get_attendance_period(period_no: int, date: str):
    rows = query_db(
        "SELECT * FROM attendance_records WHERE date = ? AND period_no = ?", (date, period_no)
    )
    return [dict(r) for r in rows]


# ---------- Attendance: submit ----------
@router.post("/attendance")
def post_attendance(payload: dict = Body(...)):
    date = payload.get("date")
    period_no = payload.get("period_no")
    teacher_id = payload.get("teacher_id")
    attendance = payload.get("attendance", [])

    if not date or not period_no or not teacher_id:
        return {"success": False, "message": "Missing parameters"}

    success = submit_attendance(date, period_no, teacher_id, attendance)
    if success:
        return {"success": True, "message": "Attendance submitted successfully"}
    return {"success": False, "message": "Database error during submission"}


# ---------- HOD summary ----------
@router.get("/hod/summary")
def hod_summary(date: str = None, simTime: str = "17:00"):
    date = date or datetime.now().strftime("%Y-%m-%d")
    auto_generate_memos(date, simTime)

    teachers = query_db("SELECT * FROM users WHERE role = 'teacher'")
    schedule = [dict(r) for r in query_db("""
        SELECT s.*, u.name as teacher_name FROM schedule s JOIN users u ON s.teacher_id = u.id
    """)]
    submissions = [dict(r) for r in query_db(
        "SELECT period_no, teacher_id, marked_at FROM attendance_submissions WHERE date = ?", (date,)
    )]
    memos = [dict(r) for r in query_db(
        "SELECT period_no, teacher_id, id as memo_id, status as memo_status FROM memos WHERE date = ?", (date,)
    )]

    submission_set = {f"{s['teacher_id']}_{s['period_no']}" for s in submissions}
    memo_map = {f"{m['teacher_id']}_{m['period_no']}": m for m in memos}

    report = []
    for teacher in teachers:
        teacher_sched = [s for s in schedule if s["teacher_id"] == teacher["id"]]
        marked_count = 0
        total_assigned = len(teacher_sched)
        periods_list = []

        for sched in teacher_sched:
            p_no = sched["period_no"]
            p_info = next((p for p in PERIODS if p["no"] == p_no), None)
            key = f"{teacher['id']}_{p_no}"
            is_marked = key in submission_set
            is_overdue = (not is_marked and p_info
                          and get_period_status(p_info["start"], p_info["end"], simTime) == "overdue")
            memo = memo_map.get(key)

            present_count = absent_count = present_percentage = absent_percentage = None
            if is_marked:
                marked_count += 1
                att_row = query_db("""
                    SELECT SUM(case when status='Present' then 1 else 0 end) as present,
                           SUM(case when status='Absent' then 1 else 0 end) as absent,
                           COUNT(*) as total
                    FROM attendance_records WHERE date = ? AND period_no = ?
                """, (date, p_no), one=True)
                if att_row and att_row["total"] > 0:
                    present_count = att_row["present"] or 0
                    absent_count = att_row["absent"] or 0
                    total = att_row["total"]
                    present_percentage = int((present_count / total) * 100)
                    absent_percentage = 100 - present_percentage

            periods_list.append({
                "period_no": p_no,
                "subject": sched["subject"],
                "start_time": p_info["start"] if p_info else "",
                "end_time": p_info["end"] if p_info else "",
                "session": p_info["session"] if p_info else "FN",
                "is_marked": is_marked,
                "is_overdue": is_overdue,
                "memo": {"id": memo["memo_id"], "status": memo["memo_status"]} if memo else None,
                "present_count": present_count,
                "absent_count": absent_count,
                "present_percentage": present_percentage,
                "absent_percentage": absent_percentage,
                "attendance_percentage": present_percentage,
            })

        percentage = int((marked_count / total_assigned) * 100) if total_assigned > 0 else 100
        report.append({
            "teacher_id": teacher["id"],
            "teacher_name": teacher["name"],
            "department": teacher["department"],
            "periods": periods_list,
            "marked_count": marked_count,
            "total_assigned": total_assigned,
            "percentage": percentage,
        })


# ---------- Admin: overview stats ----------
@router.get("/admin/overview")
def admin_overview():
    total_teachers = query_db("SELECT COUNT(*) as c FROM users WHERE role = 'teacher'", one=True)["c"]
    total_students = query_db("SELECT COUNT(*) as c FROM students", one=True)["c"]
    total_periods = query_db("SELECT COUNT(*) as c FROM schedule", one=True)["c"]
    total_memos = query_db("SELECT COUNT(*) as c FROM memos", one=True)["c"]
    return {
        "total_teachers": total_teachers,
        "total_students": total_students,
        "total_periods": total_periods,
        "total_memos": total_memos,
    }


# ---------- Admin: list teachers ----------
@router.get("/admin/teachers")
def admin_list_teachers():
    rows = query_db("SELECT id, username, name, role, department FROM users WHERE role = 'teacher' ORDER BY name")
    return [dict(r) for r in rows]


# ---------- Admin: add teacher ----------
@router.post("/admin/teachers")
def admin_add_teacher(payload: dict = Body(...)):
    username = payload.get("username")
    password = payload.get("password")
    name = payload.get("name")
    department = payload.get("department", "Computer Science")

    if not username or not password or not name:
        return {"success": False, "message": "username, password and name are required"}

    existing = query_db("SELECT id FROM users WHERE username = ?", (username,), one=True)
    if existing:
        return {"success": False, "message": "Username already exists"}

    user_id = execute_db(
        "INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, 'teacher', ?)",
        (username, password, name, department),
    )
    return {"success": True, "id": user_id, "message": "Teacher added successfully"}


# ---------- Admin: list schedule/timetable entries ----------
@router.get("/admin/schedule")
def admin_list_schedule():
    rows = query_db("""
        SELECT s.*, u.name as teacher_name FROM schedule s JOIN users u ON s.teacher_id = u.id
        ORDER BY s.period_no ASC
    """)
    return [dict(r) for r in rows]


# ---------- Admin: add schedule/timetable entry ----------
@router.post("/admin/schedule")
def admin_add_schedule(payload: dict = Body(...)):
    period_no = payload.get("period_no")
    subject = payload.get("subject")
    teacher_id = payload.get("teacher_id")

    if not period_no or not subject or not teacher_id:
        return {"success": False, "message": "period_no, subject and teacher_id are required"}

    schedule_id = execute_db(
        "INSERT INTO schedule (period_no, subject, teacher_id) VALUES (?, ?, ?)",
        (period_no, subject, teacher_id),
    )
    return {"success": True, "id": schedule_id, "message": "Schedule entry added successfully"}


# ---------- Admin: list students ----------
@router.get("/admin/students")
def admin_list_students():
    rows = query_db("SELECT * FROM students ORDER BY name ASC")
    return [dict(r) for r in rows]


# ---------- Admin: add student ----------
@router.post("/admin/students")
def admin_add_student(payload: dict = Body(...)):
    name = payload.get("name")
    roll_no = payload.get("roll_no")
    department = payload.get("department", "Computer Science")

    if not name or not roll_no:
        return {"success": False, "message": "name and roll_no are required"}

    existing = query_db("SELECT id FROM students WHERE roll_no = ?", (roll_no,), one=True)
    if existing:
        return {"success": False, "message": "Roll number already exists"}

    student_id = execute_db(
        "INSERT INTO students (name, roll_no, department) VALUES (?, ?, ?)",
        (name, roll_no, department),
    )
    return {"success": True, "id": student_id, "message": "Student added successfully"}
