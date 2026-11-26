import PropTypes from 'prop-types';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const [searchParams] = useSearchParams();
  if (loading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Loading…
      </div>
    );
  }
  if (searchParams.get('add') === '1') return children;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

PublicOnlyRoute.propTypes = { children: PropTypes.node.isRequired };
