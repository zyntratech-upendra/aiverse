import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import ProtectedRoute from "./ProtectedRoute";

// ─── Loading Fallback ────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium text-slate-500">Loading...</span>
    </div>
  </div>
);

// ─── Lazy-loaded Pages (Code Splitting) ──────────────────────────────────────
// Heavy admin pages (133KB-467KB) are NOT bundled for participants.
// Critical participant pages load in separate chunks for faster initial paint.

// Public Pages (light, loaded eagerly for SEO)
import HomePage from "../pages/public/HomePage";
import LoginPage from "../pages/auth/LoginPage";
import NotFoundPage from "../pages/errors/NotFoundPage";

// Public Pages (lazy-loaded, not needed on first paint)
const EventsPage = React.lazy(() => import("../pages/public/EventsPage"));
const EventDetailsPage = React.lazy(() => import("../pages/public/EventDetailsPage"));
const GalleryPage = React.lazy(() => import("../pages/public/GalleryPage"));
const TeamPage = React.lazy(() => import("../pages/public/TeamPage"));
const ContactPage = React.lazy(() => import("../pages/public/ContactPage"));
const RegistrationPage = React.lazy(() => import("../pages/public/RegistrationPage"));
const TicketPage = React.lazy(() => import("../pages/public/TicketPage"));
const JuryPage = React.lazy(() => import("../pages/public/JuryPage"));
const AdminSetupPage = React.lazy(() => import("../pages/auth/AdminSetupPage"));

// Faculty/Organizer Dashboards (heavy, only for admins)
const OrgAttendancePage = React.lazy(() => import("../pages/organizer/OrgAttendancePage"));
const FacDashboardPage = React.lazy(() => import("../pages/faculty/FacDashboardPage"));
const UserManagementPage = React.lazy(() => import("../pages/faculty/UserManagementPage"));
const EventManagementPage = React.lazy(() => import("../pages/faculty/EventManagementPage"));
const GalleryManagementPage = React.lazy(() => import("../pages/faculty/GalleryManagementPage"));
const SettingsPage = React.lazy(() => import("../pages/faculty/SettingsPage"));
const RegistrationsManagementPage = React.lazy(() => import("../pages/faculty/RegistrationsManagementPage"));
const AttendanceManagementPage = React.lazy(() => import("../pages/faculty/AttendanceManagementPage"));
const ProfilePage = React.lazy(() => import("../pages/faculty/ProfilePage"));
const FacResultsPage = React.lazy(() => import("../pages/faculty/FacResultsPage"));
const QuizManagementPage = React.lazy(() => import("../pages/faculty/QuizManagementPage"));
const ContactInquiriesPage = React.lazy(() => import("../pages/faculty/ContactInquiriesPage"));
const OrganizerManagementPage = React.lazy(() => import("../pages/faculty/OrganizerManagementPage"));

// Participant & Quiz Pages (separate chunk for quiz takers)
const ParticipantSetPasswordPage = React.lazy(() => import("../pages/auth/ParticipantSetPasswordPage"));
const ParticipantDashboardPage = React.lazy(() => import("../pages/participant/ParticipantDashboardPage"));
const TeamReviewPage = React.lazy(() => import("../pages/participant/TeamReviewPage"));
const QuizLobbyPage = React.lazy(() => import("../pages/participant/QuizLobbyPage"));
const QuizTakingPage = React.lazy(() => import("../pages/participant/QuizTakingPage"));
const QuizCompletionPage = React.lazy(() => import("../pages/participant/QuizCompletionPage"));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<Navigate to="/" replace />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id" element={<EventDetailsPage />} />
          <Route path="events/:id/register" element={<RegistrationPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="admin-setup" element={<AdminSetupPage />} />
          <Route path="404" element={<NotFoundPage />} />
        </Route>

        <Route path="/ticket/:registrationId" element={<TicketPage />} />
        <Route
          path="/jury"
          element={
            <ProtectedRoute allowedRoles={["jury", "faculty", "organizer"]}>
              <JuryPage />
            </ProtectedRoute>
          }
        />

        {/* Organizer Routes */}
        <Route
          path="/organizer"
          element={
            <ProtectedRoute allowedRoles={["organizer"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="attendance" element={<OrgAttendancePage />} />
          <Route path="events" element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="dashboard" element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="jury" element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="results" element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="gallery" element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="registrations" element={<Navigate to="/organizer/attendance" replace />} />
          <Route path="profile" element={<Navigate to="/organizer/attendance" replace />} />
        </Route>

        {/* Faculty Routes */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="dashboard" element={<FacDashboardPage />} />
          <Route path="events" element={<EventManagementPage />} />
          <Route path="registrations" element={<RegistrationsManagementPage />} />
          <Route path="organizers" element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="jury" element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="results" element={<FacResultsPage />} />
          <Route path="team" element={<Navigate to="/faculty/dashboard" replace />} />
          <Route
            path="users"
            element={
              <ProtectedRoute disallowEmails={["facultycoordinator@aiverse.in"]}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="contacts" element={<ContactInquiriesPage />} />
          <Route path="attendance" element={<AttendanceManagementPage />} />
          <Route path="analytics" element={<div className="p-6 bg-white rounded-card shadow-card border border-slate-100"><h2 className="text-xl font-bold mb-2">Analytics</h2><p className="text-sm text-slate-500">Detailed overview of attendance trends.</p></div>} />
          <Route
            path="settings"
            element={
              <ProtectedRoute disallowEmails={["facultycoordinator@aiverse.in"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="gallery"
            element={
              <ProtectedRoute disallowEmails={["facultycoordinator@aiverse.in"]}>
                <GalleryManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Standalone Full-Page Quiz Management (No sidebar) */}
        <Route
          path="/faculty/quizzes"
          element={
            <ProtectedRoute allowedRoles={["faculty", "organizer"]}>
              <QuizManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/quizzes"
          element={
            <ProtectedRoute allowedRoles={["faculty", "organizer"]}>
              <QuizManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Participant Routes */}
        <Route path="/participant/set-password" element={<ParticipantSetPasswordPage />} />
        <Route path="/set-password" element={<ParticipantSetPasswordPage />} />
        <Route
          path="/participant/review-team"
          element={
            <ProtectedRoute allowedRoles={["participant", "faculty", "organizer"]}>
              <TeamReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/dashboard"
          element={
            <ProtectedRoute allowedRoles={["participant", "faculty", "organizer"]}>
              <ParticipantDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* High-Concurrency Quiz Assessment Routes */}
        <Route
          path="/participant/quiz/:quizId/lobby"
          element={
            <ProtectedRoute allowedRoles={["participant", "faculty", "organizer"]}>
              <QuizLobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/quiz/:quizId/take"
          element={
            <ProtectedRoute allowedRoles={["participant", "faculty", "organizer"]}>
              <QuizTakingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/quiz/:quizId/completed"
          element={
            <ProtectedRoute allowedRoles={["participant", "faculty", "organizer"]}>
              <QuizCompletionPage />
            </ProtectedRoute>
          }
        />

        <Route path="/participant" element={<Navigate to="/participant/dashboard" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
