import React from 'react';
import { ProtocolState, ProtocolType } from '../types/protocol';
import { RotateCcw, ArrowRight } from 'lucide-react';

interface CompletionSummaryProps {
  state: ProtocolState;
  onReset: () => void;
  onSwitchProtocol: (proto: ProtocolType) => void;
  onOpenComparison: () => void;
}

export const CompletionSummary: React.FC<CompletionSummaryProps> = ({
  state,
  onReset,
  onSwitchProtocol,
  onOpenComparison,
}) => {
  const { config, stats, totalFramesCount } = state;

  const generateNarrative = () => {
    const lossCount = stats.framesLost;
    const retransmits = stats.retransmissions;

    if (lossCount === 0) {
      return `All ${totalFramesCount} frames were successfully sent and acknowledged on the first attempt with 100% efficiency.`;
    }

    if (config.protocol === 'stop-and-wait') {
      return `${lossCount} packet(s) were dropped by the network. Stop-and-Wait detected the missing ACK via timeout and resent each dropped packet before moving to the next.`;
    } else if (config.protocol === 'go-back-n') {
      return `${lossCount} packet(s) were dropped. Go-Back-N timed out and retransmitted ${retransmits} frame(s) to restore strict order.`;
    } else {
      return `${lossCount} packet(s) were dropped. Selective Repeat buffered the safe packets and resent only the missing ${retransmits} frame(s), keeping efficiency high!`;
    }
  };

  const nextProtocol: ProtocolType =
    config.protocol === 'stop-and-wait'
      ? 'go-back-n'
      : config.protocol === 'go-back-n'
      ? 'selective-repeat'
      : 'stop-and-wait';

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Transmission Finished</h3>
        <span className="text-xs text-emerald-400 font-mono font-medium">100% Delivered</span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        {generateNarrative()}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-xs font-mono py-1">
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <span className="text-slate-400 font-sans text-[10px] block">Delivered</span>
          <span className="text-emerald-400 font-bold">{totalFramesCount} / {totalFramesCount}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <span className="text-slate-400 font-sans text-[10px] block">Retransmissions</span>
          <span className="text-amber-400 font-bold">{stats.retransmissions}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
          <span className="text-slate-400 font-sans text-[10px] block">Efficiency</span>
          <span className="text-blue-400 font-bold">{stats.efficiency}%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Run Again</span>
        </button>

        <button
          onClick={() => onSwitchProtocol(nextProtocol)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
        >
          <span>Switch to {nextProtocol === 'go-back-n' ? 'Go-Back-N' : nextProtocol === 'selective-repeat' ? 'Selective Repeat' : 'Stop-and-Wait'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
