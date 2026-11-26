import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Loading…
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

PublicOnlyRoute.propTypes = { children: PropTypes.node.isRequired };
