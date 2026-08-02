"""
Lightweight sqlite3 helpers for the attendance/schedule/memo API.
Kept as raw SQL (same approach as the original server.py) rather than
SQLAlchemy ORM, so the exact query logic already tested there carries over
directly and the frontend's response shapes stay identical.
"""
import sqlite3
from datetime import datetime

DB_FILE = "attendance.db"


def query_db(query, args=(), one=False):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    conn.close()
    return (rv[0] if rv else None) if one else rv


def execute_db(query, args=()):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    cur = conn.cursor()
    cur.execute(query, args)
    conn.commit()
    lastrowid = cur.lastrowid
    conn.close()
    return lastrowid


def submit_attendance(date, period_no, teacher_id, attendance):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    cur = conn.cursor()
    success = False
    try:
        cur.execute("BEGIN IMMEDIATE TRANSACTION")
        cur.execute(
            "DELETE FROM attendance_records WHERE date = ? AND period_no = ? AND teacher_id = ?",
            (date, period_no, teacher_id),
        )
        for record in attendance:
            cur.execute(
                "INSERT INTO attendance_records (date, period_no, teacher_id, student_id, status) VALUES (?, ?, ?, ?, ?)",
                (date, period_no, teacher_id, record["student_id"], record["status"]),
            )
        cur.execute(
            "SELECT id FROM attendance_submissions WHERE date = ? AND period_no = ? AND teacher_id = ?",
            (date, period_no, teacher_id),
        )
        row = cur.fetchone()
        if row:
            cur.execute(
                "UPDATE attendance_submissions SET marked_at = ? WHERE id = ?",
                (datetime.now().isoformat(), row[0]),
            )
        else:
            cur.execute(
                "INSERT INTO attendance_submissions (date, period_no, teacher_id, marked_at) VALUES (?, ?, ?, ?)",
                (date, period_no, teacher_id, datetime.now().isoformat()),
            )
        conn.commit()
        success = True
    except Exception as e:
        conn.rollback()
        print("Database transaction error:", e)
        success = False
    finally:
        conn.close()
    return success


def init_legacy_db():
    """Creates tables + seed data. Safe to call every startup (IF NOT EXISTS)."""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT,
        name TEXT, role TEXT, department TEXT)''')

    c.execute('''CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, roll_no TEXT UNIQUE, department TEXT)''')

    c.execute('''CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT, period_no INTEGER, subject TEXT,
        teacher_id INTEGER, FOREIGN KEY (teacher_id) REFERENCES users(id))''')

    c.execute('''CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, period_no INTEGER, teacher_id INTEGER,
        student_id INTEGER, status TEXT,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (teacher_id) REFERENCES users(id))''')

    c.execute('''CREATE TABLE IF NOT EXISTS attendance_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, period_no INTEGER, teacher_id INTEGER,
        marked_at TEXT, FOREIGN KEY (teacher_id) REFERENCES users(id),
        UNIQUE(date, period_no, teacher_id))''')

    c.execute('''CREATE TABLE IF NOT EXISTS memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, period_no INTEGER, teacher_id INTEGER,
        reason TEXT, issued_at TEXT, status TEXT, acknowledgment TEXT, acknowledged_at TEXT,
        FOREIGN KEY (teacher_id) REFERENCES users(id))''')

    conn.commit()

    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                   ('teacher1', 'password', 'Prof. Grace Hopper', 'teacher', 'Computer Science'))
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                   ('teacher2', 'password', 'Prof. Alan Turing', 'teacher', 'Computer Science'))
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                   ('hod1', 'password', 'Dr. Richard Feynman', 'hod', 'Computer Science'))
        conn.commit()

    # Ensure an admin account exists too, so the same frontend login form works for admin
    # (separate from the JWT /auth/login system used by the newer /admin/* endpoints)
    c.execute("SELECT COUNT(*) FROM users WHERE username = 'admin@hits.edu'")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                   ('admin@hits.edu', 'admin123', 'System Admin', 'admin', 'Administration'))
        conn.commit()

    c.execute("SELECT COUNT(*) FROM students")
    if c.fetchone()[0] == 0:
        mock_students = [
            ('Alice Smith', 'CS2026-001', 'Computer Science'),
            ('Bob Johnson', 'CS2026-002', 'Computer Science'),
            ('Charlie Brown', 'CS2026-003', 'Computer Science'),
            ('Diana Prince', 'CS2026-004', 'Computer Science'),
            ('Ethan Hunt', 'CS2026-005', 'Computer Science'),
            ('Fiona Gallagher', 'CS2026-006', 'Computer Science'),
            ('George Clark', 'CS2026-007', 'Computer Science'),
        ]
        c.executemany("INSERT INTO students (name, roll_no, department) VALUES (?, ?, ?)", mock_students)
        conn.commit()

    c.execute("SELECT COUNT(*) FROM schedule")
    if c.fetchone()[0] == 0:
        c.execute("SELECT id FROM users WHERE username = 'teacher1'")
        t1_id = c.fetchone()[0]
        c.execute("SELECT id FROM users WHERE username = 'teacher2'")
        t2_id = c.fetchone()[0]
        schedule_data = [
            (1, 'Data Structures & Algorithms', t1_id),
            (2, 'Operating Systems', t2_id),
            (3, 'Computer Networks', t1_id),
            (4, 'Database Management Systems', t2_id),
            (5, 'Software Engineering', t1_id),
            (6, 'Theory of Computation', t2_id),
            (7, 'Artificial Intelligence', t2_id),
        ]
        c.executemany("INSERT INTO schedule (period_no, subject, teacher_id) VALUES (?, ?, ?)", schedule_data)
        conn.commit()

    conn.close()


PERIODS = [
    {'no': 1, 'start': '08:30', 'end': '09:25', 'session': 'FN'},
    {'no': 2, 'start': '09:25', 'end': '10:20', 'session': 'FN'},
    {'no': 3, 'start': '10:40', 'end': '11:35', 'session': 'FN'},
    {'no': 4, 'start': '11:35', 'end': '12:30', 'session': 'FN'},
    {'no': 5, 'start': '13:25', 'end': '14:15', 'session': 'AN'},
    {'no': 6, 'start': '14:15', 'end': '15:05', 'session': 'AN'},
    {'no': 7, 'start': '15:15', 'end': '16:05', 'session': 'AN'},
]


def time_to_minutes(time_str):
    try:
        h, m = map(int, time_str.split(':'))
        return h * 60 + m
    except ValueError:
        return 0


def get_period_status(start, end, current_sim_time):
    curr = time_to_minutes(current_sim_time)
    start_m = time_to_minutes(start)
    end_m = time_to_minutes(end)
    if curr < start_m:
        return 'upcoming'
    elif start_m <= curr <= end_m:
        return 'ongoing'
    elif end_m < curr <= end_m + 60:
        return 'pending'
    else:
        return 'overdue'


def auto_generate_memos(date, sim_time):
    curr_min = time_to_minutes(sim_time)
    limit_min = time_to_minutes("17:00")
    if curr_min < limit_min:
        return

    schedules = query_db("SELECT * FROM schedule")
    submissions = query_db("SELECT period_no, teacher_id FROM attendance_submissions WHERE date = ?", (date,))
    submitted_keys = {f"{s['teacher_id']}_{s['period_no']}" for s in submissions}

    existing_memos = query_db("SELECT period_no, teacher_id FROM memos WHERE date = ?", (date,))
    memo_keys = {f"{m['teacher_id']}_{m['period_no']}" for m in existing_memos}

    for sched in schedules:
        teacher_id = sched['teacher_id']
        p_no = sched['period_no']
        key = f"{teacher_id}_{p_no}"
        if key not in submitted_keys and key not in memo_keys:
            reason = f"System Generated: Unmarked attendance for Period {p_no} ({sched['subject']}) by the 5:00 PM deadline."
            execute_db("""
                INSERT INTO memos (date, period_no, teacher_id, reason, issued_at, status)
                VALUES (?, ?, ?, ?, ?, 'Issued')
            """, (date, p_no, teacher_id, reason, datetime.now().isoformat()))
