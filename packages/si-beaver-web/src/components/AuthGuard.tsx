import { Navigate } from 'react-router-dom';
import { hasToken } from '../lib/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
