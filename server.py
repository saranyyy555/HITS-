import os
import sqlite3
import json
import http.server
import socketserver
import urllib.parse
from datetime import datetime

DB_FILE = 'attendance.db'
PORT = 3000

# Helper to convert HH:MM string to minutes since midnight
def time_to_minutes(time_str):
    try:
        h, m = map(int, time_str.split(':'))
        return h * 60 + m
    except ValueError:
        return 0

# Helper to check period status based on time
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

# Auto generate memos at 5:00 PM (17:00) for teachers who haven't marked attendance
def auto_generate_memos(date, sim_time):
    curr_min = time_to_minutes(sim_time)
    limit_min = time_to_minutes("17:00")
    
    if curr_min >= limit_min:
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
                print(f"Auto-issued memo to teacher {teacher_id} for period {p_no} on {date}")

# Database query helpers
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
    # busy_timeout so concurrent writers wait instead of failing immediately with "database is locked"
    conn = sqlite3.connect(DB_FILE, timeout=10)
    cur = conn.cursor()
    success = False
    try:
        # Start transaction (IMMEDIATE grabs the write lock right away, avoiding
        # a race where two teachers both pass the SELECT check below at the same time)
        cur.execute("BEGIN IMMEDIATE TRANSACTION")

        # Remove existing records for THIS teacher's own submission only
        # (previously matched only date+period_no, so a second teacher on the
        # same period would silently wipe out the first teacher's records)
        cur.execute("DELETE FROM attendance_records WHERE date = ? AND period_no = ? AND teacher_id = ?",
                    (date, period_no, teacher_id))

        # Insert records
        for record in attendance:
            cur.execute("INSERT INTO attendance_records (date, period_no, teacher_id, student_id, status) VALUES (?, ?, ?, ?, ?)",
                        (date, period_no, teacher_id, record['student_id'], record['status']))

        # Upsert submission tracker, now scoped per teacher too
        cur.execute("SELECT id FROM attendance_submissions WHERE date = ? AND period_no = ? AND teacher_id = ?",
                    (date, period_no, teacher_id))
        row = cur.fetchone()
        if row:
            cur.execute("UPDATE attendance_submissions SET marked_at = ? WHERE id = ?",
                        (datetime.now().isoformat(), row[0]))
        else:
            cur.execute("INSERT INTO attendance_submissions (date, period_no, teacher_id, marked_at) VALUES (?, ?, ?, ?)",
                        (date, period_no, teacher_id, datetime.now().isoformat()))

        conn.commit()
        success = True
    except Exception as e:
        conn.rollback()
        print("Database transaction error:", e)
        success = False
    finally:
        conn.close()
    return success

# Initialize DB Tables and seed data
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # 1. Users Table
    c.execute('''
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT,
        role TEXT,
        department TEXT
      )
    ''')
    
    # 2. Students Table
    c.execute('''
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        roll_no TEXT UNIQUE,
        department TEXT
      )
    ''')
    
    # 3. Schedule Table
    c.execute('''
      CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_no INTEGER,
        subject TEXT,
        teacher_id INTEGER,
        FOREIGN KEY (teacher_id) REFERENCES users(id)
      )
    ''')
    
    # 4. Attendance Records Table (student level)
    c.execute('''
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        period_no INTEGER,
        teacher_id INTEGER,
        student_id INTEGER,
        status TEXT,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (teacher_id) REFERENCES users(id)
      )
    ''')
    # Migration: add teacher_id to attendance_records if the DB already existed without it
    c.execute("PRAGMA table_info(attendance_records)")
    existing_cols = [row[1] for row in c.fetchall()]
    if 'teacher_id' not in existing_cols:
        c.execute("ALTER TABLE attendance_records ADD COLUMN teacher_id INTEGER")
    
    # 5. Attendance Submissions Table (period submission log)
    c.execute('''
      CREATE TABLE IF NOT EXISTS attendance_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        period_no INTEGER,
        teacher_id INTEGER,
        marked_at TEXT,
        FOREIGN KEY (teacher_id) REFERENCES users(id),
        UNIQUE(date, period_no, teacher_id)
      )
    ''')
    
    # 6. Memos Table
    c.execute('''
      CREATE TABLE IF NOT EXISTS memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        period_no INTEGER,
        teacher_id INTEGER,
        reason TEXT,
        issued_at TEXT,
        status TEXT,
        acknowledgment TEXT,
        acknowledged_at TEXT,
        FOREIGN KEY (teacher_id) REFERENCES users(id)
      )
    ''')
    
    conn.commit()
    
    # Seed users
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                  ('teacher1', 'password', 'Prof. Grace Hopper', 'teacher', 'Computer Science'))
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                  ('teacher2', 'password', 'Prof. Alan Turing', 'teacher', 'Computer Science'))
        c.execute("INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)",
                  ('hod1', 'password', 'Dr. Richard Feynman', 'hod', 'Computer Science'))
        conn.commit()
        print("Seeded users.")
        
    # Seed students
    c.execute("SELECT COUNT(*) FROM students")
    if c.fetchone()[0] == 0:
        mock_students = [
            ('Alice Smith', 'CS2026-001', 'Computer Science'),
            ('Bob Johnson', 'CS2026-002', 'Computer Science'),
            ('Charlie Brown', 'CS2026-003', 'Computer Science'),
            ('Diana Prince', 'CS2026-004', 'Computer Science'),
            ('Ethan Hunt', 'CS2026-005', 'Computer Science'),
            ('Fiona Gallagher', 'CS2026-006', 'Computer Science'),
            ('George Clark', 'CS2026-007', 'Computer Science')
        ]
        c.executemany("INSERT INTO students (name, roll_no, department) VALUES (?, ?, ?)", mock_students)
        conn.commit()
        print("Seeded students.")
        
    # Seed schedule
    c.execute("SELECT COUNT(*) FROM schedule")
    if c.fetchone()[0] == 0:
        # Get teacher IDs
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
            (7, 'Artificial Intelligence', t2_id)
        ]
        c.executemany("INSERT INTO schedule (period_no, subject, teacher_id) VALUES (?, ?, ?)", schedule_data)
        conn.commit()
        print("Seeded schedule.")
        
    conn.close()
    print("Database tables initialized successfully.")

# Custom HTTP Request Handler
class AttendanceHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Clean query strings and anchors
        parsed_path = urllib.parse.urlparse(path).path
        if not parsed_path.startswith('/api'):
            if parsed_path == '/' or parsed_path == '':
                parsed_path = '/index.html'
            return os.path.join(os.getcwd(), 'public', parsed_path.lstrip('/'))
        return super().translate_path(path)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if not path.startswith('/api'):
            super().do_GET()
            return

        # API: Students list
        if path == '/api/students':
            rows = query_db("SELECT * FROM students ORDER BY name ASC")
            students = [dict(r) for r in rows]
            self.send_json(students)
            
        # API: Full schedule list
        elif path == '/api/schedule':
            rows = query_db("""
                SELECT s.*, u.name as teacher_name, u.username as teacher_username
                FROM schedule s
                JOIN users u ON s.teacher_id = u.id
                ORDER BY s.period_no ASC
            """)
            schedule = [dict(r) for r in rows]
            self.send_json(schedule)

        # API: Specific teacher schedule
        elif path.startswith('/api/teacher/') and path.endswith('/schedule'):
            try:
                parts = path.split('/')
                teacher_id = int(parts[3])
            except (ValueError, IndexError):
                self.send_json({'error': 'Invalid teacher ID'}, 400)
                return
                
            date = query_params.get('date', [datetime.now().strftime('%Y-%m-%d')])[0]
            sim_time = query_params.get('simTime', ['17:00'])[0]

            # Auto-check and generate memos if past 5:00 PM
            auto_generate_memos(date, sim_time)

            rows = query_db("SELECT * FROM schedule WHERE teacher_id = ? ORDER BY period_no ASC", (teacher_id,))
            schedule = [dict(r) for r in rows]
            
            sub_rows = query_db("SELECT period_no, marked_at FROM attendance_submissions WHERE teacher_id = ? AND date = ?", (teacher_id, date))
            submission_map = {r['period_no']: r['marked_at'] for r in sub_rows}
            
            memo_rows = query_db("SELECT period_no, id as memo_id, status as memo_status FROM memos WHERE teacher_id = ? AND date = ?", (teacher_id, date))
            memo_map = {r['period_no']: {'id': r['memo_id'], 'status': r['memo_status']} for r in memo_rows}

            PERIODS = [
              { 'no': 1, 'start': '08:30', 'end': '09:25', 'session': 'FN' },
              { 'no': 2, 'start': '09:25', 'end': '10:20', 'session': 'FN' },
              { 'no': 3, 'start': '10:40', 'end': '11:35', 'session': 'FN' },
              { 'no': 4, 'start': '11:35', 'end': '12:30', 'session': 'FN' },
              { 'no': 5, 'start': '13:25', 'end': '14:15', 'session': 'AN' },
              { 'no': 6, 'start': '14:15', 'end': '15:05', 'session': 'AN' },
              { 'no': 7, 'start': '15:15', 'end': '16:05', 'session': 'AN' }
            ]

            schedule_with_status = []
            for sched in schedule:
                period_no = sched['period_no']
                period_info = next((p for p in PERIODS if p['no'] == period_no), None)
                is_submed = period_no in submission_map
                memo = memo_map.get(period_no, None)

                status = 'upcoming'
                present_count = None
                absent_count = None
                present_percentage = None
                absent_percentage = None

                if is_submed:
                    status = 'marked'
                    att_row = query_db("""
                        SELECT 
                            SUM(case when status='Present' then 1 else 0 end) as present,
                            SUM(case when status='Absent' then 1 else 0 end) as absent,
                            COUNT(*) as total
                        FROM attendance_records 
                        WHERE date = ? AND period_no = ?
                    """, (date, period_no), one=True)
                    if att_row and att_row['total'] > 0:
                        present_count = att_row['present'] or 0
                        absent_count = att_row['absent'] or 0
                        total = att_row['total']
                        present_percentage = int((present_count / total) * 100)
                        absent_percentage = 100 - present_percentage
                elif period_info:
                    status = get_period_status(period_info['start'], period_info['end'], sim_time)

                schedule_with_status.append({
                    'id': sched['id'],
                    'period_no': period_no,
                    'subject': sched['subject'],
                    'teacher_id': sched['teacher_id'],
                    'start_time': period_info['start'] if period_info else '',
                    'end_time': period_info['end'] if period_info else '',
                    'session': period_info['session'] if period_info else 'FN',
                    'status': status,
                    'marked_at': submission_map.get(period_no, None),
                    'memo': memo,
                    'present_count': present_count,
                    'absent_count': absent_count,
                    'present_percentage': present_percentage,
                    'absent_percentage': absent_percentage,
                    'attendance_percentage': present_percentage
                })
            
            self.send_json(schedule_with_status)

        # API: Attendance record detail for a specific period & date
        elif path.startswith('/api/attendance/period/'):
            try:
                period_no = int(path.split('/')[-1])
            except (ValueError, IndexError):
                self.send_json({'error': 'Invalid period number'}, 400)
                return
            date = query_params.get('date', [None])[0]
            
            rows = query_db("""
                SELECT r.student_id, s.name, s.roll_no, r.status
                FROM attendance_records r
                JOIN students s ON r.student_id = s.id
                WHERE r.date = ? AND r.period_no = ?
            """, (date, period_no))
            records = [dict(r) for r in rows]
            self.send_json(records)

        # API: Get active overdue reminders
        elif path == '/api/reminders':
            teacher_id = int(query_params.get('teacherId', [0])[0])
            date = query_params.get('date', [None])[0]
            sim_time = query_params.get('simTime', ['17:00'])[0]

            schedule_rows = query_db("SELECT * FROM schedule WHERE teacher_id = ?", (teacher_id,))
            sub_rows = query_db("SELECT period_no FROM attendance_submissions WHERE teacher_id = ? AND date = ?", (teacher_id, date))
            marked_periods = {r['period_no'] for r in sub_rows}

            PERIODS = [
              { 'no': 1, 'start': '08:30', 'end': '09:25', 'session': 'FN' },
              { 'no': 2, 'start': '09:25', 'end': '10:20', 'session': 'FN' },
              { 'no': 3, 'start': '10:40', 'end': '11:35', 'session': 'FN' },
              { 'no': 4, 'start': '11:35', 'end': '12:30', 'session': 'FN' },
              { 'no': 5, 'start': '13:25', 'end': '14:15', 'session': 'AN' },
              { 'no': 6, 'start': '14:15', 'end': '15:05', 'session': 'AN' },
              { 'no': 7, 'start': '15:15', 'end': '16:05', 'session': 'AN' }
            ]

            reminders = []
            for sched in schedule_rows:
                p_no = sched['period_no']
                if p_no not in marked_periods:
                    p_info = next((p for p in PERIODS if p['no'] == p_no), None)
                    if p_info:
                        status = get_period_status(p_info['start'], p_info['end'], sim_time)
                        if status == 'overdue':
                            reminders.append({
                                'period_no': p_no,
                                'subject': sched['subject'],
                                'end_time': p_info['end'],
                                'session': p_info['session']
                            })
            self.send_json(reminders)

        # API: Get Memos
        elif path == '/api/memos':
            teacher_id = query_params.get('teacherId', [None])[0]
            date = query_params.get('date', [None])[0]

            query = """
                SELECT m.*, u.name as teacher_name, s.subject
                FROM memos m
                JOIN users u ON m.teacher_id = u.id
                JOIN schedule s ON m.period_no = s.period_no AND m.teacher_id = s.teacher_id
            """
            params = []
            if teacher_id and date:
                query += " WHERE m.teacher_id = ? AND m.date = ?"
                params.extend([int(teacher_id), date])
            elif teacher_id:
                query += " WHERE m.teacher_id = ?"
                params.append(int(teacher_id))
            elif date:
                query += " WHERE m.date = ?"
                params.append(date)

            query += " ORDER BY m.issued_at DESC"
            rows = query_db(query, tuple(params))
            memos = [dict(r) for r in rows]
            self.send_json(memos)

        # API: HOD Summary
        elif path == '/api/hod/summary':
            date = query_params.get('date', [None])[0]
            sim_time = query_params.get('simTime', ['17:00'])[0]

            # Auto-check and generate memos if past 5:00 PM
            auto_generate_memos(date, sim_time)

            teachers = [dict(r) for r in query_db('SELECT id, name, username, department FROM users WHERE role = "teacher"')]
            schedule = [dict(r) for r in query_db("""
                SELECT s.*, u.name as teacher_name
                FROM schedule s
                JOIN users u ON s.teacher_id = u.id
            """)]
            submissions = [dict(r) for r in query_db('SELECT period_no, teacher_id, marked_at FROM attendance_submissions WHERE date = ?', (date,))]
            memos = [dict(r) for r in query_db('SELECT period_no, teacher_id, id as memo_id, status as memo_status FROM memos WHERE date = ?', (date,))]

            submission_set = {f"{s['teacher_id']}_{s['period_no']}" for s in submissions}
            memo_map = {f"{m['teacher_id']}_{m['period_no']}": m for m in memos}

            PERIODS = [
              { 'no': 1, 'start': '08:30', 'end': '09:25', 'session': 'FN' },
              { 'no': 2, 'start': '09:25', 'end': '10:20', 'session': 'FN' },
              { 'no': 3, 'start': '10:40', 'end': '11:35', 'session': 'FN' },
              { 'no': 4, 'start': '11:35', 'end': '12:30', 'session': 'FN' },
              { 'no': 5, 'start': '13:25', 'end': '14:15', 'session': 'AN' },
              { 'no': 6, 'start': '14:15', 'end': '15:05', 'session': 'AN' },
              { 'no': 7, 'start': '15:15', 'end': '16:05', 'session': 'AN' }
            ]

            report = []
            for teacher in teachers:
                teacher_sched = [s for s in schedule if s['teacher_id'] == teacher['id']]
                marked_count = 0
                total_assigned = len(teacher_sched)
                periods_list = []

                for sched in teacher_sched:
                    p_no = sched['period_no']
                    p_info = next((p for p in PERIODS if p['no'] == p_no), None)
                    key = f"{teacher['id']}_{p_no}"
                    is_marked = key in submission_set
                    is_overdue = not is_marked and p_info and get_period_status(p_info['start'], p_info['end'], sim_time) == 'overdue'
                    memo = memo_map.get(key, None)

                    present_count = None
                    absent_count = None
                    present_percentage = None
                    absent_percentage = None

                    if is_marked:
                        marked_count += 1
                        att_row = query_db("""
                            SELECT 
                                SUM(case when status='Present' then 1 else 0 end) as present,
                                SUM(case when status='Absent' then 1 else 0 end) as absent,
                                COUNT(*) as total
                            FROM attendance_records 
                            WHERE date = ? AND period_no = ?
                        """, (date, p_no), one=True)
                        if att_row and att_row['total'] > 0:
                            present_count = att_row['present'] or 0
                            absent_count = att_row['absent'] or 0
                            total = att_row['total']
                            present_percentage = int((present_count / total) * 100)
                            absent_percentage = 100 - present_percentage

                    periods_list.append({
                        'period_no': p_no,
                        'subject': sched['subject'],
                        'start_time': p_info['start'] if p_info else '',
                        'end_time': p_info['end'] if p_info else '',
                        'session': p_info['session'] if p_info else 'FN',
                        'is_marked': is_marked,
                        'is_overdue': is_overdue,
                        'memo': {'id': memo['memo_id'], 'status': memo['memo_status']} if memo else None,
                        'present_count': present_count,
                        'absent_count': absent_count,
                        'present_percentage': present_percentage,
                        'absent_percentage': absent_percentage,
                        'attendance_percentage': present_percentage
                    })

                percentage = int((marked_count / total_assigned) * 100) if total_assigned > 0 else 100
                report.append({
                    'teacher_id': teacher['id'],
                    'teacher_name': teacher['name'],
                    'department': teacher['department'],
                    'periods': periods_list,
                    'marked_count': marked_count,
                    'total_assigned': total_assigned,
                    'percentage': percentage
                })

            self.send_json(report)

        else:
            self.send_json({'error': 'Not Found'}, 404)

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Read JSON body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        # API: Login
        if path == '/api/login':
            username = data.get('username')
            password = data.get('password')
            
            row = query_db("SELECT id, username, name, role, department FROM users WHERE username = ? AND password = ?", 
                           (username, password), one=True)
            if row:
                self.send_json({'success': True, 'user': dict(row)})
            else:
                self.send_json({'success': False, 'message': 'Invalid credentials'}, 401)

        # API: Record Attendance
        elif path == '/api/attendance':
            date = data.get('date')
            period_no = data.get('period_no')
            teacher_id = data.get('teacher_id')
            attendance = data.get('attendance', [])

            if not date or not period_no or not teacher_id:
                self.send_json({'success': False, 'message': 'Missing parameters'}, 400)
                return

            success = submit_attendance(date, period_no, teacher_id, attendance)
            if success:
                self.send_json({'success': True, 'message': 'Attendance submitted successfully'})
            else:
                self.send_json({'success': False, 'message': 'Database error during submission'}, 500)

        # API: Issue Memo
        elif path == '/api/memos':
            date = data.get('date')
            period_no = data.get('period_no')
            teacher_id = data.get('teacher_id')
            reason = data.get('reason')

            if not date or not period_no or not teacher_id or not reason:
                self.send_json({'success': False, 'message': 'Missing parameters'}, 400)
                return

            memo_id = execute_db("""
                INSERT INTO memos (date, period_no, teacher_id, reason, issued_at, status)
                VALUES (?, ?, ?, ?, ?, 'Issued')
            """, (date, period_no, teacher_id, reason, datetime.now().isoformat()))

            self.send_json({'success': True, 'memo_id': memo_id, 'message': 'Memo issued successfully'})

        # API: Acknowledge Memo
        elif path.startswith('/api/memos/') and path.endswith('/acknowledge'):
            try:
                parts = path.split('/')
                memo_id = int(parts[3])
            except (ValueError, IndexError):
                self.send_json({'error': 'Invalid memo ID'}, 400)
                return
            acknowledgment = data.get('acknowledgment')

            if not acknowledgment:
                self.send_json({'success': False, 'message': 'Acknowledgment is required'}, 400)
                return

            execute_db("""
                UPDATE memos
                SET status = 'Acknowledged',
                    acknowledgment = ?,
                    acknowledged_at = ?
                WHERE id = ?
            """, (acknowledgment, datetime.now().isoformat(), memo_id))

            self.send_json({'success': True, 'message': 'Memo acknowledged successfully'})

        else:
            self.send_json({'error': 'Not Found'}, 404)

# Run server
if __name__ == '__main__':
    init_db()
    class MyTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True
        daemon_threads = True
        
    try:
        with MyTCPServer(("", PORT), AttendanceHandler) as httpd:
            print(f"College Attendance Web Server running at http://127.0.0.1:{PORT}")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down server.")
    except OSError:
        print("\n==================================================================")
        print(f" WARNING: Port {PORT} is already in use!")
        print(" The server is already running. You can open the application at:")
        print(f" http://127.0.0.1:{PORT}")
        print("==================================================================\n")