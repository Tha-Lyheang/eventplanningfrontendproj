import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function LoginPage() {
  useDocumentTitle('Log in');
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginDemo } = useAuth();
  const [values, setValues] = useState({ email: '', password: '', remember: true });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (name) => (event) =>
    setValues((current) => ({ ...current, [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(values);
      const requested = location.state?.from;
      navigate(requested ? `${requested.pathname}${requested.search || ''}${requested.hash || ''}` : '/', { replace: true });
    } catch {
      setError('Incorrect email or password');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemo() {
    setSubmitting(true);
    try {
      await loginDemo(true);
      navigate('/', { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">Log in to Gather</h1>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" autoComplete="email" value={values.email} onChange={set('email')} aria-invalid={!!error} />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={values.password} onChange={set('password')} aria-invalid={!!error} />
          </div>
          <label className="auth-check">
            <input type="checkbox" checked={values.remember} onChange={set('remember')} />
            Remember me
          </label>
          <button className="btn btn--primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? <><span className="spinner spinner--sm" aria-hidden="true" /> Logging in…</> : 'Log in'}
          </button>
        </form>
        <button className="btn auth-demo" type="button" onClick={handleDemo} disabled={submitting}>Try the demo</button>
        <p className="auth-link">New here? <Link to="/signup">Create an account</Link></p>
      </section>
    </div>
  );
}
