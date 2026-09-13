/**
 * 404 — friendly, with the four places people actually meant to go.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, FileText, House, Kanban, Search } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

const DESTINATIONS = [
  { to: '/resume', label: 'Resume builder', icon: <FileText size={14} aria-hidden="true" /> },
  { to: '/jobs', label: 'Job finder', icon: <Search size={14} aria-hidden="true" /> },
  { to: '/tracker', label: 'Application tracker', icon: <Kanban size={14} aria-hidden="true" /> },
  { to: '/settings', label: 'Settings', icon: <Compass size={14} aria-hidden="true" /> },
];

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="stack-6" style={{ display: 'flex', flexDirection: 'column', paddingTop: 'var(--space-8)' }}>
      <EmptyState
        icon={<Compass size={22} aria-hidden="true" />}
        title="That page does not exist"
        description={
          <>
            Nothing is served at <code>{location.pathname}</code>. It may have been renamed, or the link was
            mistyped.
          </>
        }
        actions={
          <>
            <Button variant="primary" leftIcon={<House size={15} />} onClick={() => navigate('/')}>
              Back to dashboard
            </Button>
            <Button onClick={() => navigate(-1)}>Go back</Button>
          </>
        }
      />

      <nav aria-label="Main destinations" className="row row-wrap" style={{ justifyContent: 'center' }}>
        {DESTINATIONS.map((item) => (
          <Link key={item.to} className="row small" to={item.to} style={{ padding: 'var(--space-2) var(--space-3)' }}>
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
