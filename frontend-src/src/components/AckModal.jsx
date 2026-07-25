import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { submitAckRequest } from '../api.js';

export default function AckModal({ open, target, onClose, onSubmitted }) {
  // target: { memoId, periodNo, subject, reason }
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    if (open && target) {
      setExplanation('');
    }
  }, [open, target]);

  if (!open || !target) return null;

  async function submitAck(e) {
    e.preventDefault();

    if (!explanation.trim()) {
      alert('Please provide an explanation.');
      return;
    }

    try {
      const data = await submitAckRequest(target.memoId, explanation);
      if (data.success) {
        onSubmitted();
      }
    } catch (error) {
      console.error('Error acknowledging memo:', error);
    }
  }

  return (
    <div className={`modal-overlay ${open ? 'active' : ''}`} id="ack-modal">
      <div className="modal-content glass-panel animate-slide-up" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3>Acknowledge Official Memo</h3>
            <p id="ack-memo-details">
              Ref: Period {target.periodNo} ({target.subject})
            </p>
          </div>
          <button className="close-btn" id="btn-close-ack-modal" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="modal-body">
          <div className="memo-original-reason glass-panel">
            <strong>Memo Reason:</strong>
            <p id="ack-original-reason">{target.reason}</p>
          </div>
          <form id="ack-form" onSubmit={submitAck}>
            <div className="form-group">
              <label htmlFor="ack-explanation">Your Explanation / Reason for Delay</label>
              <textarea
                id="ack-explanation"
                rows="4"
                placeholder="Enter explanation for missing the attendance window (e.g. system issue, delayed class exit)..."
                required
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              ></textarea>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" id="btn-cancel-ack" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" id="btn-submit-ack" onClick={submitAck}>
            Submit Acknowledgment
          </button>
        </div>
      </div>
    </div>
  );
}
