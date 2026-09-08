import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Square, 
  Play, 
  RotateCcw, 
  HelpCircle, 
  Info, 
  X,
  Sparkles
} from "lucide-react";

export type ModalType = "danger" | "warning" | "info" | "success" | "primary";
export type ModalIcon = "alert" | "danger" | "trash" | "stop" | "play" | "check" | "rotate" | "info" | "help" | "sparkles";

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ModalType;
  icon?: ModalIcon;
  confirmButtonVariant?: "danger" | "warning" | "primary" | "dark" | "emerald";
}

export interface AlertModalOptions {
  title?: string;
  message: string;
  buttonText?: string;
  type?: ModalType;
  icon?: ModalIcon;
}

interface ModalContextType {
  showConfirm: (options: ConfirmModalOptions) => Promise<boolean>;
  showAlert: (options: AlertModalOptions | string) => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmModalOptions;
  } | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  // Alert modal state
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertModalOptions;
  } | null>(null);
  const alertResolveRef = useRef<(() => void) | null>(null);

  const showConfirm = useCallback((options: ConfirmModalOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({
        isOpen: true,
        options: {
          confirmText: "Confirm",
          cancelText: "Cancel",
          type: "primary",
          ...options
        }
      });
    });
  }, []);

  const showAlert = useCallback((options: AlertModalOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      alertResolveRef.current = resolve;
      const opts: AlertModalOptions = typeof options === "string" 
        ? { message: options, title: "Notification", type: "info", buttonText: "Got it" }
        : { buttonText: "Dismiss", type: "info", title: "Notification", ...options };

      setAlertState({
        isOpen: true,
        options: opts
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result);
      confirmResolveRef.current = null;
    }
    setConfirmState(null);
  };

  const handleAlertClose = () => {
    if (alertResolveRef.current) {
      alertResolveRef.current();
      alertResolveRef.current = null;
    }
    setAlertState(null);
  };

  // Keyboard handler for Enter / Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmState?.isOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleConfirmClose(false);
        }
      } else if (alertState?.isOpen) {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          handleAlertClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmState, alertState]);

  const renderIcon = (type: ModalType = "primary", customIcon?: ModalIcon) => {
    const iconType = customIcon || (
      type === "danger" ? "danger" : 
      type === "warning" ? "alert" : 
      type === "success" ? "check" : 
      "info"
    );

    let bgClass = "bg-blue-50 text-blue-600 ring-blue-500/10";
    if (type === "danger") bgClass = "bg-red-50 text-red-600 ring-red-500/15";
    else if (type === "warning") bgClass = "bg-amber-50 text-amber-600 ring-amber-500/15";
    else if (type === "success") bgClass = "bg-emerald-50 text-emerald-600 ring-emerald-500/15";

    let IconComp = Info;
    if (iconType === "danger" || iconType === "alert") IconComp = AlertTriangle;
    else if (iconType === "trash") IconComp = Trash2;
    else if (iconType === "stop") IconComp = Square;
    else if (iconType === "play") IconComp = Play;
    else if (iconType === "rotate") IconComp = RotateCcw;
    else if (iconType === "check") IconComp = CheckCircle2;
    else if (iconType === "help") IconComp = HelpCircle;
    else if (iconType === "sparkles") IconComp = Sparkles;

    return (
      <div className={`w-14 h-14 rounded-2xl ${bgClass} ring-8 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75 duration-200 shadow-2xs`}>
        <IconComp className="w-7 h-7" />
      </div>
    );
  };

  const getConfirmButtonClasses = (type: ModalType = "primary", variant?: string) => {
    const chosenVariant = variant || type;
    if (chosenVariant === "danger") {
      return "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md shadow-red-500/20";
    }
    if (chosenVariant === "warning") {
      return "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20";
    }
    if (chosenVariant === "emerald" || chosenVariant === "success") {
      return "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20";
    }
    if (chosenVariant === "dark") {
      return "bg-[#0F172A] hover:bg-slate-800 text-white shadow-md shadow-slate-900/20";
    }
    return "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20";
  };

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert }}>
      {children}

      {/* Branded AI Verse Confirm Modal */}
      {confirmState?.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[999999999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0" 
            onClick={() => handleConfirmClose(false)} 
          />
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center space-y-4">
            
            {/* Close Button */}
            <button
              onClick={() => handleConfirmClose(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon Banner */}
            {renderIcon(confirmState.options.type, confirmState.options.icon)}

            {/* Title & Message */}
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                {confirmState.options.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto whitespace-pre-line">
                {confirmState.options.message}
              </p>
            </div>

            {/* Actions Button Group */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer"
              >
                {confirmState.options.cancelText || "Cancel"}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`w-full font-extrabold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer ${getConfirmButtonClasses(
                  confirmState.options.type,
                  confirmState.options.confirmButtonVariant
                )}`}
              >
                {confirmState.options.confirmText || "Confirm"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Branded AI Verse Alert Modal */}
      {alertState?.isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[999999999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0" 
            onClick={handleAlertClose} 
          />
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative z-10 animate-in fade-in zoom-in-95 duration-200 text-center space-y-4">
            
            {/* Close Button */}
            <button
              onClick={handleAlertClose}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon Banner */}
            {renderIcon(alertState.options.type, alertState.options.icon)}

            {/* Title & Message */}
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                {alertState.options.title || "Notice"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto whitespace-pre-line">
                {alertState.options.message}
              </p>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAlertClose}
                className={`w-full font-extrabold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer ${getConfirmButtonClasses(
                  alertState.options.type
                )}`}
              >
                {alertState.options.buttonText || "Got it"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

export default ModalContext;
