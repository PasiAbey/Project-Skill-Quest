import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import InitialQuizPage from './pages/InitialQuizPage';
import LearningPage from './pages/LearningPage';
import StepQuizPage from './pages/StepQuizPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { authService, BACKEND_URL } from './services/api';

// Protected Route component - checks authentication and quiz completion status
const ProtectedRoute = ({ children, requireQuizComplete = true }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const user = authService.getCurrentUser();

  // If quiz is required and user hasn't completed it (status = 0), redirect to quiz
  if (requireQuizComplete && user?.status == 0) {
    return <Navigate to="/initial-quiz" replace />;
  }

  return children;
};

// Quiz Route - only for users who haven't completed the quiz
const QuizRoute = ({ children }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const user = authService.getCurrentUser();

  // If user has already completed quiz (status = 1), redirect to dashboard
  if (user?.status == 1) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  // Track when user exits/closes the browser or tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only log exit if user is authenticated
      if (authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        const studentId = user?.id;

        if (studentId) {
          const data = JSON.stringify({
            student_ID: studentId,
            timestamp: new Date().toISOString()
          });

          // Use sendBeacon with Blob for reliable delivery even when page is closing
          // Blob with application/json ensures proper parsing on backend
          const blob = new Blob([data], { type: 'application/json' });
          navigator.sendBeacon(`${BACKEND_URL}/api/auth/log-exit`, blob);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // P20: 5-hour inactivity timer — auto-logout if no user interaction
  useEffect(() => {
    let timeout;
    const INACTIVITY_LIMIT = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (authService.isAuthenticated()) {
          authService.logout();
          window.location.href = '/';
        }
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer(); // Start the timer on mount

    return () => {
      clearTimeout(timeout);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route
          path="/initial-quiz"
          element={
            <QuizRoute>
              <InitialQuizPage />
            </QuizRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/learn/:weekNumber"
          element={
            <ProtectedRoute>
              <LearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/:weekNumber/:stepId"
          element={
            <ProtectedRoute>
              <StepQuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

