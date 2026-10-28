import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectList } from "./pages/ProjectList";
import { ProjectSettings } from "./pages/ProjectSettings";
import { Register } from "./pages/Register";
import { ReviewDetail } from "./pages/ReviewDetail";
import { ReviewHistory } from "./pages/ReviewHistory";
import { Settings } from "./pages/Settings";
import { Help } from "./pages/Help";
import { RecentlyDeleted } from "./pages/RecentlyDeleted";
import { VerifyEmail } from "./pages/VerifyEmail";
import { GitHubCallback } from "./pages/GitHubCallback";

export default function App() {
  const location = useLocation();

  // No mode="wait" here: that used to delay the new page's mount until the old one's
  // 300ms exit finished, so a browser back/forward press changed the URL instantly but
  // left the old page on screen for that whole window — looking like the press did
  // nothing, which is exactly what made people press back twice. Without "wait" the
  // new page mounts and enters immediately, overlapping the old one's exit.
  return (
    <AnimatePresence>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/github/callback" element={<GitHubCallback />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/settings" element={<ProjectSettings />} />
          <Route path="/projects/:projectId/reviews" element={<ReviewHistory />} />
          <Route path="/projects/:projectId/reviews/:reviewId" element={<ReviewDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/recently-deleted" element={<RecentlyDeleted />} />
          <Route path="/help" element={<Help />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
