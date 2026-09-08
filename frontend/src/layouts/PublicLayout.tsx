import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import NeuralCursor from "../components/ui/NeuralCursor";

const PublicLayout: React.FC = () => {
  const location = useLocation();
  const isRegistrationPage = location.pathname.endsWith("/register") || location.pathname.includes("/register");

  return (
    <div className="flex flex-col min-h-screen">
      {!isRegistrationPage && <NeuralCursor />}
      <Navbar />
      <main className="flex-grow pt-20">
        <Outlet />
      </main>
      {!isRegistrationPage && <Footer />}
    </div>
  );
};

export default PublicLayout;
