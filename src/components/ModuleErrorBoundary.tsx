import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMsg: string;
}

export class ModuleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ModuleErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMsg: error?.message || 'Error al cargar este módulo.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-8 max-w-md mx-auto bg-[#111827] border border-amber-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <TriangleAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-white">
              Se interrumpió la carga del módulo
            </h3>
            <p className="text-xs text-gray-400">
              Tus datos están seguros en Firebase y respaldo local. Recarga para sincronizar la última versión.
            </p>
            <p className="text-[11px] font-mono text-amber-300/90 pt-1">{this.state.errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs inline-flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recargar Aplicación</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
