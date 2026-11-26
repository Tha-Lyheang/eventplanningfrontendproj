import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import CalendarPage from './pages/CalendarPage';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import MyTasks from './pages/MyTasks';
import NotFound from './pages/NotFound';
import PublicEvent from './pages/PublicEvent';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import NewEventPage from './pages/NewEventPage';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';

/** Moves focus to <main> and scrolls to top on navigation (screen-reader & keyboard friendly). */
function RouteAnnouncer() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

/**
 * Routes
 *   /              Dashboard (search, filters, create)
 *   /events/:id    Event workspace (role-aware: attendees, tasks, comments, edit)
 *   /event/:id     Public guest page - the shareable URL
 *   /calendar      Month / week / agenda
 *   /tasks         My Tasks across all events
 */
export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Navbar />
      <RouteAnnouncer />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/welcome" element={<PublicOnlyRoute><WelcomePage /></PublicOnlyRoute>} />
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/events/new" element={<ProtectedRoute><NewEventPage /></ProtectedRoute>} />
          <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
          <Route path="/event/:id" element={<PublicEvent />} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        Gather · demo data is stored in your browser&apos;s localStorage.
      </footer>
    </>
  );
}
