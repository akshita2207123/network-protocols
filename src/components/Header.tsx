import React from 'react';
import { RotateCcw, GitCompare, BookOpen, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  activeView: 'simulator' | 'comparison' | 'guide';
  setActiveView: (view: 'simulator' | 'comparison' | 'guide') => void;
  onReset: () => void;
  onOpenTests?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  onReset,
  onOpenTests,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
          ARQ
        </div>
        <span className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
          Network Protocol Simulator
        </span>
      </div>

      {/* Zone 2: Navigation */}
      <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveView('simulator')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeView === 'simulator'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Simulator
        </button>
        <button
          onClick={() => setActiveView('comparison')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'comparison'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          Compare All 3
        </button>
        <button
          onClick={() => setActiveView('guide')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'guide'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Protocol Guide
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onOpenTests && (
          <button
            onClick={onOpenTests}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-100 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Open Automated Scenario Verification Suite"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Verification Suite</span>
          </button>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          title="Restart simulation"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};
