import { CheckSquare, FastForward, LogOut } from 'lucide-react';

export default function Header({
  currentUser,
  simulatedDate,
  simulatedTime,
  onDateChange,
  onTimeChange,
  onFastForward,
  onLogout,
}) {
  return (
    <header className="main-header glass-panel">
      <div className="logo-area">
        <div className="logo-icon">
          <CheckSquare />
        </div>
        <div className="logo-text">
          <h1>HITS Attendance</h1>
          <span>Hindustan Institute of Technology &amp; Science</span>
        </div>
      </div>

      <div className="header-controls">
        {/* Time Simulator Widget */}
        <div
          id="simulator-widget"
          className="simulator-card glass-panel"
          style={{ display: currentUser ? 'flex' : 'none' }}
        >
          <div className="sim-header">
            <span className="pulse-indicator"></span>
            <span className="sim-title">TIME SIMULATOR</span>
          </div>
          <div className="sim-inputs">
            <div className="input-group">
              <label htmlFor="sim-date">Date</label>
              <input
                type="date"
                id="sim-date"
                value={simulatedDate}
                onChange={(e) => onDateChange(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="sim-time">Time</label>
              <input
                type="time"
                id="sim-time"
                value={simulatedTime}
                onChange={(e) => onTimeChange(e.target.value)}
              />
            </div>
            <button
              id="btn-fast-forward"
              className="icon-btn"
              title="Jump to End of Day (4:30 PM)"
              onClick={onFastForward}
            >
              <FastForward />
            </button>
          </div>
        </div>

        {/* User Info & Logout */}
        <div
          id="header-user-card"
          className="user-role-card glass-panel"
          style={{ display: currentUser ? 'flex' : 'none' }}
        >
          <div className="user-profile-info">
            <span className="user-profile-name" id="header-user-name">
              {currentUser?.name}
            </span>
            <span className="user-profile-role" id="header-user-role">
              {currentUser?.role?.toUpperCase()}
            </span>
          </div>
          <button id="btn-logout" className="btn btn-secondary btn-sm" title="Log Out" onClick={onLogout}>
            <LogOut style={{ width: 14 }} /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}
