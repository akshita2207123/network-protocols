import React from 'react';
import { Frame } from '../types/protocol';
import { X } from 'lucide-react';

interface PacketInspectorProps {
  frame: Frame | null;
  onClose: () => void;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({ frame, onClose }) => {
  if (!frame) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-5 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Packet Details</h3>
            <p className="text-xs text-slate-400 font-mono">Frame #{frame.seq}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Data Fields */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Payload Data</span>
            <span className="font-mono font-semibold text-emerald-400">"{frame.payload}"</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Status</span>
            <span className="font-semibold text-slate-200 capitalize">{frame.status}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Attempts</span>
            <span className="font-mono text-slate-200">{frame.attempt}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Timeout Countdown</span>
            <span className="font-mono text-slate-200">{frame.timer} ticks</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          Close
        </button>

      </div>
    </div>
  );
};
