import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { submitMemoRequest } from '../api.js';

export default function MemoModal({ open, target, simulatedDate, onClose, onSubmitted }) {
  // target: { teacherId, periodNo, teacherName, subject }
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open && target) {
      setReason(
        `Unmarked attendance for Period ${target.periodNo} (${target.subject}) on date ${simulatedDate} past the required deadline.`
      );
    }
  }, [open, target, simulatedDate]);

  if (!open || !target) return null;

  async function submitMemo(e) {
    e.preventDefault();

    if (!reason.trim()) {
      alert('Please enter a reason for the memo.');
      return;
    }

    try {
      const data = await submitMemoRequest({
        date: simulatedDate,
        period_no: target.periodNo,
        teacher_id: target.teacherId,
        reason,
      });
      if (data.success) {
        onSubmitted();
      }
    } catch (error) {
      console.error('Error issuing memo:', error);
    }
  }

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} id="memo-modal">
      <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3>Issue Official Reprimand Memo</h3>
            <p id="memo-teacher-details">
              To: {target.teacherName} • Period {target.periodNo} ({target.subject})
            </p>
          </div>
          <button className="close-btn" id="btn-close-memo-modal" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="modal-body">
          <form id="memo-form" onSubmit={submitMemo}>
            <div className="form-group">
              <label htmlFor="memo-reason">Reason for Memo</label>
              <textarea
                id="memo-reason"
                rows="4"
                placeholder="Enter formal reason (e.g., Unmarked attendance for Period 2 operating systems without notice)..."
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              ></textarea>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" id="btn-cancel-memo" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" id="btn-submit-memo" onClick={submitMemo}>
            Issue Memo
          </button>
        </div>
      </div>
    </div>
  );
}
