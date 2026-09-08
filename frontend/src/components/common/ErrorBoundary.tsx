import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from "lucide-react";
import { validateEnvironment } from "../../config/env";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary caught an unhandled error]:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const envValidation = validateEnvironment();
      const isMissingEnv = !envValidation.isValid;
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen w-full bg-[#080d1a] text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans select-none relative overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)] pointer-events-none transform-gpu" />
          <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none transform-gpu" />

          <div className="relative max-w-xl w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 text-center space-y-6">
            {/* Header Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              {isMissingEnv ? <ShieldAlert className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>

            <div className="space-y-2">
              <span className="inline-block text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {isMissingEnv ? "Environment Configuration Notice" : "Application Notice"}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {isMissingEnv ? "Build Configuration Required" : "Something encountered an unexpected issue"}
              </h1>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                {isMissingEnv
                  ? "The application was loaded without required build-time environment variables."
                  : "An unexpected runtime condition occurred. You can reload the application or return to the main dashboard."}
              </p>
            </div>

            {/* Missing Env Details (if any) */}
            {isMissingEnv && (
              <div className="text-left bg-slate-950/70 border border-amber-500/20 rounded-2xl p-4 space-y-2 text-xs">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Missing Cloudflare Build Variables:</span>
                </div>
                <div className="space-y-1 pl-1">
                  {envValidation.missingVariables.map((v) => (
                    <div key={v} className="font-mono text-[11px] text-amber-200/90 bg-amber-950/30 px-2 py-1 rounded border border-amber-900/40">
                      • {v}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Add these variables under <strong>Cloudflare Pages &gt; Settings &gt; Environment variables &gt; Build</strong> and redeploy.
                </p>
              </div>
            )}

            {/* Error Message Details (if dev or specific error) */}
            {this.state.error && (isDev || !isMissingEnv) && (
              <div className="text-left bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-1.5 text-xs">
                <span className="font-mono text-slate-400 block font-semibold text-[11px] uppercase tracking-wider">
                  Diagnostic Message:
                </span>
                <p className="font-mono text-red-400/90 break-words leading-relaxed text-[11px]">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
