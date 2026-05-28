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
    element: <Navigate to="/projects" replace />,
  },
  {
    path: '/projects',
    element: <AuthGuard><ProjectsPage /></AuthGuard>,
  },
  {
    path: '/projects/:slug',
    element: <Navigate to="what" replace />,
  },
  {
    path: '/projects/:slug/:tab',
    element: <AuthGuard><ProjectDetailPage /></AuthGuard>,
  },
]);
