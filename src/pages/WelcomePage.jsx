import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function WelcomePage() {
  useDocumentTitle('Welcome to Gather');
  const navigate = useNavigate();
  const { loginDemo } = useAuth();

  useEffect(() => {
    try {
      localStorage.setItem('hasVisited', 'true');
    } catch {
      // Welcome will still render if storage is unavailable.
    }
  }, []);

  async function handleDemo() {
    await loginDemo(true);
    navigate('/', { replace: true });
  }

  const features = [
    ['🎟️', 'RSVPs and waitlists', 'Track going, maybe and declined responses with automatic waitlist promotion.'],
    ['🗓️', 'Calendar views', 'Switch between month, week and agenda views, then export events as .ics.'],
    ['✅', 'Shared task lists', 'Assign work to co-hosts and keep launch plans moving together.'],
    ['🔒', 'Private events', 'Keep planning private while sharing a public link with selected guests.'],
  ];

  return (
    <div className="welcome-page">
      <section className="welcome-hero">
        <span className="welcome-logo" aria-hidden="true">🎉</span>
        <h1>Plan events. Share tasks. Gather people.</h1>
        <p>One place to organize guests, schedules and every detail that makes an event memorable.</p>
        <div className="welcome-actions">
          <Link className="btn btn--primary" to="/signup">Sign up</Link>
          <Link className="btn" to="/login">Log in</Link>
          <button className="btn btn--ghost" type="button" onClick={handleDemo}>Try the demo</button>
        </div>
      </section>
      <section className="welcome-features" aria-label="Gather features">
        {features.map(([icon, title, text]) => (
          <article className="feature-card" key={title}>
            <span aria-hidden="true">{icon}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer className="welcome-footer">Gather · Your next event starts here.</footer>
    </div>
  );
}
