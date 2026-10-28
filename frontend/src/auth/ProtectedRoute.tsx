import { Navigate, Outlet } from "react-router-dom";
import { CommandPalette } from "../components/CommandPalette";
import { Navbar } from "../components/Navbar";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Navbar />
      <CommandPalette />
      <div className="app-container">
        <Outlet />
      </div>
    </>
  );
}
