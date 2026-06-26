import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LoadingScreen } from "./LoadingScreen";

function RouteSpinner() {
  return <LoadingScreen label="Authenticating" />;
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteSpinner />;

  // Send unauthenticated users to login, remembering where they meant to go.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // Admin accounts are analytics-only — keep them out of the normal-user
  // surface (dashboard, projects) and on the admin dashboard instead.
  if (user.isAdmin) return <Navigate to="/admin" replace />;

  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return <RouteSpinner />;

  // Authenticated users have no business on login/register.
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export function AdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteSpinner />;

  // Unauthenticated → login; authenticated-but-not-admin → dashboard.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return user.isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
