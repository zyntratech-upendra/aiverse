import React, { useState } from "react";
import { User, Bell, Save, CheckCircle2 } from "lucide-react";

const JurySettingsView: React.FC = () => {
  const [name, setName] = useState("Dr. Sarah Chen");
  const [email, setEmail] = useState("sarah.chen@uni.edu");
  const [expertise, setExpertise] = useState("LLMs, Computer Vision, Ethics");
  const [notifyDeadline, setNotifyDeadline] = useState(true);
  const [notifySubmissions, setNotifySubmissions] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200 text-left font-sans">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Juror Profile & Evaluation Settings
        </h1>
        <p className="text-xs font-medium text-slate-500 mt-1">
          Manage your panel preferences, notification thresholds, and security parameters.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Personal Info */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Juror Credentials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Academic Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Primary Research Expertise
            </label>
            <input
              type="text"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            Evaluation Alerts & Reminders
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-slate-700">Receive email reminders 2 hours before submission deadline</span>
              <input
                type="checkbox"
                checked={notifyDeadline}
                onChange={(e) => setNotifyDeadline(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-medium text-slate-700">Notify when new assigned hackathon projects are published</span>
              <input
                type="checkbox"
                checked={notifySubmissions}
                onChange={(e) => setNotifySubmissions(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/15 transition-all flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Profile Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default JurySettingsView;
