import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { NAV_ITEMS } from './layout/navigation';
import { AuthGuard } from './routes/AuthGuard';
import { isAuthenticated } from './routes/auth';
import { LoginPage } from './routes/pages/LoginPage';
import { SectionPage } from './routes/pages/SectionPage';
import { TasksPage } from './features/tasks/TasksPage';
import { NotesPage } from './features/notes/NotesPage';
import { TeamPage } from './features/team/TeamPage';
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { ThemeProvider } from './theme/ThemeProvider';
import { ErrorDialogProvider } from './errorDialog/ErrorDialogProvider';

function App() {
  return (
    <ThemeProvider>
      <ErrorDialogProvider>
        <AppRoutes />
      </ErrorDialogProvider>
    </ThemeProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          {NAV_ITEMS.map((item) => {
            if (item.path === '/dashboard') {
              return <Route key={item.path} path={item.path} element={<Dashboard />} />;
            }
            if (item.path === '/tasks') {
              return <Route key={item.path} path={item.path} element={<TasksPage />} />;
            }
            if (item.path === '/notes') {
              return <Route key={item.path} path={item.path} element={<NotesPage />} />;
            }
            if (item.path === '/settings') {
              return <Route key={item.path} path={item.path} element={<SettingsPage />} />;
            }
            if (item.path === '/team') {
              return <Route key={item.path} path={item.path} element={<TeamPage />} />;
            }
            if (item.path === '/announcements') {
              return <Route key={item.path} path={item.path} element={<AnnouncementsPage />} />;
            }
            return <Route key={item.path} path={item.path} element={<SectionPage item={item} />} />;
          })}
        </Route>
      </Route>
      <Route
        path="/"
        element={<Navigate to={isAuthenticated() ? '/dashboard' : '/login'} replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated() ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}

export default App;
