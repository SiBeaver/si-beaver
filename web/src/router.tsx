import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/projects" replace />,
  },
  {
    path: '/projects',
    element: <ProjectsPage />,
  },
  {
    path: '/projects/:slug',
    element: <Navigate to="overview" replace />,
  },
  {
    path: '/projects/:slug/:tab',
    element: <ProjectDetailPage />,
  },
]);
