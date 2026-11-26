import PropTypes from 'prop-types';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Restoring your session…
      </div>
    );
  }
  if (!isAuthenticated) {
    let hasVisited = false;
    try {
      hasVisited = localStorage.getItem('hasVisited') === 'true';
    } catch {
      hasVisited = false;
    }
    return (
      <Navigate
        to={hasVisited ? '/login' : '/welcome'}
        replace
        state={{ from: location }}
      />
    );
  }
  return children;
}

ProtectedRoute.propTypes = { children: PropTypes.node.isRequired };
