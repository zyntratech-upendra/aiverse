import React from "react";
import { 
  Trophy, 
  FileSpreadsheet
} from "lucide-react";
import JuryResultsView from "../../components/jury/JuryResultsView";
import SEO from "../../components/layout/SEO";

const FacResultsPage: React.FC = () => {

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans text-left">
      <SEO
        title="Admin Portal - Hackathon & Event Results"
        description="View official hackathon results, jury evaluation scores, and track standings."
      />

      {/* Top Banner Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Trophy className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Event & Jury Results
            </h1>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Oversee jury scorecards, track standings, and finalized rankings across all hackathons.
          </p>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => alert("Downloading complete hackathon evaluation matrix (CSV)...")}
            className="px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/15 transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Final Scores CSV
          </button>
        </div>
      </div>

      {/* Embedded Results & Standings Grid */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <JuryResultsView />
      </div>
    </div>
  );
};

export default FacResultsPage;
