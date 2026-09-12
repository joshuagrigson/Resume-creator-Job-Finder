/**
 * Route table. Pages live in src/pages; the shell (nav, theme, toasts) in src/components/layout.
 * Keep this file small — add a route here, build the page in src/pages.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import DashboardPage from '@/pages/Dashboard';
import ResumeBuilderPage from '@/pages/ResumeBuilder';
import JobFinderPage from '@/pages/JobFinder';
import TrackerPage from '@/pages/Tracker';
import TailorPage from '@/pages/Tailor';
import SettingsPage from '@/pages/Settings';
import NotFoundPage from '@/pages/NotFound';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/resume" element={<ResumeBuilderPage />} />
        <Route path="/resume/:resumeId" element={<ResumeBuilderPage />} />
        <Route path="/jobs" element={<JobFinderPage />} />
        <Route path="/jobs/:jobId" element={<JobFinderPage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/tailor" element={<TailorPage />} />
        <Route path="/tailor/:jobId" element={<TailorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
