import { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';
import { isTaskOverdue } from '../utils/eventHelpers';
import ThemeToggle from './ThemeToggle';
import Avatar from './Avatar';

/** Site header: brand, primary navigation, theme toggle and the mock user switcher. */
export default function Navbar() {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { tasks } = useEvents();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const publicPage = ['/welcome', '/login', '/signup'].includes(location.pathname);

  const overdueCount = useMemo(
    () => (currentUser ? tasks.filter((t) => t.assigneeId === currentUser.id && isTaskOverdue(t)).length : 0),
    [tasks, currentUser],
  );

  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`;
  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <span aria-hidden="true">🎉</span> Gather
        </Link>

        {!publicPage && isAuthenticated && (
          <nav aria-label="Main" className="main-nav">
            <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
            <NavLink to="/calendar" className={linkClass}>Calendar</NavLink>
            <NavLink to="/tasks" className={linkClass}>
              My Tasks
              {overdueCount > 0 && (
                <span className="nav-badge" title={`${overdueCount} overdue`}>
                  {overdueCount}
                  <span className="sr-only"> overdue tasks</span>
                </span>
              )}
            </NavLink>
          </nav>
        )}

        <div className="header-tools">
          <ThemeToggle />
          {publicPage && (
            <>
              <Link className="btn btn--ghost btn--sm" to="/login">Log in</Link>
              <Link className="btn btn--primary btn--sm" to="/signup">Sign up</Link>
            </>
          )}
          {isAuthenticated && !publicPage && (
            <div className="user-menu">
              <button
                type="button"
                className="user-menu-trigger"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Avatar name={currentUser.name} color={currentUser.avatarColor} size={32} />
                <span>{currentUser.name}</span>
                <span aria-hidden="true">▾</span>
              </button>
              {menuOpen && (
                <div className="user-menu-popover" role="menu">
                  <button type="button" role="menuitem" onClick={handleLogout}>Log out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
