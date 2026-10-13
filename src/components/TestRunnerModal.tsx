import React, { useState } from 'react';
import { runAllTests } from '../../test/protocol.test';
import { CheckCircle2, XCircle, Play, X, ShieldCheck } from 'lucide-react';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<{ passed: number; total: number; logs: string[] } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runAllTests();
      setTestResults(res);
      setIsRunning(false);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Automated Protocol Verification Suite</h3>
              <p className="text-[11px] text-slate-400">
                Executes all 10 standard ARQ scenarios for Go-Back-N and Selective Repeat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{isRunning ? 'Running Tests...' : 'Execute All 10 Test Scenarios'}</span>
          </button>

          {testResults && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={testResults.passed === testResults.total ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {testResults.passed} / {testResults.total} PASSED
              </span>
            </div>
          )}
        </div>

        {/* Test Logs / Results */}
        <div className="flex-1 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs space-y-2 min-h-[260px]">
          {testResults ? (
            testResults.logs.map((log, i) => {
              const isPass = log.includes('[PASS]');
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${isPass ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {isPass ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{log}</span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-500 text-center py-12 space-y-2">
              <p>Click "Execute All 10 Test Scenarios" to run verification.</p>
              <p className="text-[11px] text-slate-600">
                Tests clean links, data loss, ACK loss, corruption, multi-frame loss, out-of-order discarding/buffering, sequence wraparound, full windows, and reset during transit.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          Close Test Suite
        </button>

      </div>
    </div>
  );
};
