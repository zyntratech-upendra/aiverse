import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ModalProvider } from "./context/ModalContext";
import AppRoutes from "./routes/AppRoutes";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

import { LaunchSplash } from "./components/common/LaunchSplash";

function App() {
  return (
    <ErrorBoundary>
      <LaunchSplash />
      <BrowserRouter>
        <AuthProvider>
          <ModalProvider>
            <AppRoutes />
          </ModalProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
