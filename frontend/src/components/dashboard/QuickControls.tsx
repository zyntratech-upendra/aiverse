import React, { useState } from "react";
import { Zap } from "lucide-react";

export const QuickControls: React.FC = () => {
  const [registrationOn, setRegistrationOn] = useState(true);
  const [eventSubmissionsOn, setEventSubmissionsOn] = useState(true);
  const [maintenanceModeOn, setMaintenanceModeOn] = useState(false);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
          <Zap className="h-4.5 w-4.5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Quick Controls</h3>
        </div>

        <div className="space-y-4 pt-3.5">
          {/* Control 1: Registration System */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-slate-800">Registration System</h4>
              <p className="text-xs text-slate-400">On/Off public joining</p>
            </div>
            <button
              onClick={() => setRegistrationOn(!registrationOn)}
              className={`w-11 h-6 rounded-full transition-all duration-300 relative focus:outline-none shadow-inner
                ${registrationOn ? "bg-[#2563EB]" : "bg-slate-200"}`}
              aria-label="Toggle Registration System"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300
                  ${registrationOn ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>

          {/* Control 2: Event Submissions */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-slate-800">Event Submissions</h4>
              <p className="text-xs text-slate-400">Allow organizer listings</p>
            </div>
            <button
              onClick={() => setEventSubmissionsOn(!eventSubmissionsOn)}
              className={`w-11 h-6 rounded-full transition-all duration-300 relative focus:outline-none shadow-inner
                ${eventSubmissionsOn ? "bg-[#2563EB]" : "bg-slate-200"}`}
              aria-label="Toggle Event Submissions"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300
                  ${eventSubmissionsOn ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>

          {/* Control 3: Maintenance Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-slate-800">Maintenance Mode</h4>
              <p className="text-xs text-slate-400">Freeze public updates</p>
            </div>
            <button
              onClick={() => setMaintenanceModeOn(!maintenanceModeOn)}
              className={`w-11 h-6 rounded-full transition-all duration-300 relative focus:outline-none shadow-inner
                ${maintenanceModeOn ? "bg-[#2563EB]" : "bg-slate-200"}`}
              aria-label="Toggle Maintenance Mode"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300
                  ${maintenanceModeOn ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickControls;
