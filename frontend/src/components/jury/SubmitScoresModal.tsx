import React, { useState } from "react";
import { X, CheckCircle2, ShieldCheck, AlertCircle, Send } from "lucide-react";

interface SubmitScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubmitScoresModal: React.FC<SubmitScoresModalProps> = ({
  isOpen,
  onClose
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmitFinal = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 text-left font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Submit Final Jury Scores
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Scores Locked & Submitted!</h4>
              <p className="text-xs text-slate-500 font-medium">
                Your final evaluation sheet for Neural Hackathon 2024 has been submitted to the head organizing panel.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Irreversible Final Sign-Off
                </div>
                <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                  Submitting will officially lock your 20 completed evaluations. You will not be able to modify score criteria after final lock.
                </p>
              </div>

              <div className="space-y-2 text-xs font-medium text-slate-600">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span>Track:</span>
                  <span className="font-bold text-slate-800">Neural Hackathon 2024</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span>Completed Projects:</span>
                  <span className="font-bold text-emerald-600">20 / 24</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Pending Projects:</span>
                  <span className="font-bold text-amber-600">04</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitFinal}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#0B4AC6] hover:bg-[#093EB0] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/15 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    "Signing & Locking..."
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Confirm & Submit Scores
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitScoresModal;
