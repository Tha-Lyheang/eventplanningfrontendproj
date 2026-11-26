import { useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';
import { isTaskOverdue } from '../utils/eventHelpers';
import ThemeToggle from './ThemeToggle';
import AccountSwitcher from './AccountSwitcher';

/** Site header: brand, primary navigation, theme toggle and the mock user switcher. */
export default function Navbar() {
  const { currentUser, isAuthenticated } = useAuth();
  const { tasks } = useEvents();
  const location = useLocation();
  const publicPage = ['/', '/welcome', '/login', '/signup'].includes(location.pathname);

  const overdueCount = useMemo(
    () => (currentUser ? tasks.filter((t) => t.assigneeId === currentUser.id && isTaskOverdue(t)).length : 0),
    [tasks, currentUser],
  );

  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`;
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="Gather home">
          <span aria-hidden="true">🎉</span> Gather
        </Link>

        {!publicPage && isAuthenticated && (
          <nav aria-label="Main" className="main-nav">
            <NavLink to="/dashboard" end className={linkClass}>Dashboard</NavLink>
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
          {publicPage && !isAuthenticated && (
            <>
              <Link className="btn btn--ghost btn--sm" to="/login">Log in</Link>
              <Link className="btn btn--primary btn--sm" to="/signup">Sign up</Link>
            </>
          )}
          {publicPage && isAuthenticated && (
            <Link className="btn btn--primary btn--sm" to="/dashboard">Go to dashboard</Link>
          )}
          {isAuthenticated && !publicPage && <AccountSwitcher />}
        </div>
      </div>
    </header>
  );
}
