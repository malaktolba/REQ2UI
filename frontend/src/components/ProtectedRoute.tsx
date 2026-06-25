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
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}

export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return <RouteSpinner />;

  // Authenticated users have no business on login/register.
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
