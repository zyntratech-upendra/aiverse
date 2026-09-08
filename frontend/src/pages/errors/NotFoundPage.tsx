import React from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/layout/SEO";

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 text-center">
      <SEO 
        title="404 - Page Not Found" 
        description="The page you are looking for does not exist on AI Verse."
      />
      <div className="relative mb-6">
        <h1 className="text-9xl font-black text-slate-100 select-none">404</h1>
        <h2 className="text-3xl font-extrabold text-aether-dark absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full">
          Lost in AI Verse?
        </h2>
      </div>
      <p className="text-slate-500 max-w-md mb-8">
        The page you are looking for does not exist or has been moved to another location. Let's get you back.
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-gradient-to-r from-aether-blue-600 to-aether-blue-500 hover:from-aether-blue-700 hover:to-aether-blue-600 text-white font-semibold rounded-xl shadow-button hover:shadow-lg transition-all text-sm"
      >
        Return Home
      </Link>
    </div>
  );
};

export default NotFoundPage;
