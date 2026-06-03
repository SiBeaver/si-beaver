import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import LoginPage from './pages/LoginPage';
import AuthGuard from './components/AuthGuard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AuthGuard><ProjectsPage /></AuthGuard>,
  },
  {
    path: '/:slug',
    element: <Navigate to="cockpit" replace />,
  },
  {
    path: '/:slug/:tab',
    element: <AuthGuard><ProjectDetailPage /></AuthGuard>,
  },
]);
