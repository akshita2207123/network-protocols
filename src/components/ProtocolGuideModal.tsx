import React from 'react';
import { ProtocolType } from '../types/protocol';
import { ArrowRight } from 'lucide-react';

interface ProtocolGuideModalProps {
  onSelectProtocol: (protocol: ProtocolType) => void;
  onClose: () => void;
}

export const ProtocolGuideModal: React.FC<ProtocolGuideModalProps> = ({
  onSelectProtocol,
  onClose,
}) => {
  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">
          Understanding ARQ Protocols
        </h2>
        <p className="text-xs text-slate-400">
          How network protocols make sure all data packets arrive safely, even when packets get dropped along the way.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Stop and Wait */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Stop-and-Wait ARQ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send one frame and wait for an acknowledgement before sending the next.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-center text-blue-400">
              DATA → WAIT → ACK
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Simple and needs no buffer on the receiver, but slower because the sender spends time waiting.
            </p>
          </div>

          <button
            onClick={() => {
              onSelectProtocol('stop-and-wait');
              onClose();
            }}
            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Try Stop-and-Wait</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Go Back N */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Go-Back-N ARQ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send multiple frames. If one is lost, retransmit that frame and all following unacknowledged frames.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-center space-y-1">
              <div className="text-blue-400">1 → 2 → 3 ✕ → 4</div>
              <div className="text-amber-400 text-[10px]">↳ retransmit 3, 4</div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Much faster than Stop-and-Wait, but can waste bandwidth by re-sending packets the receiver already received.
            </p>
          </div>

          <button
            onClick={() => {
              onSelectProtocol('go-back-n');
              onClose();
            }}
            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Try Go-Back-N</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Selective Repeat */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Selective Repeat ARQ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send multiple frames, but retransmit only the specific frames that were lost.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-center space-y-1">
              <div className="text-emerald-400">1 ✓ · 2 ✓ · 3 ✕ · 4 ✓</div>
              <div className="text-indigo-400 text-[10px]">↳ retransmit only 3</div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Most efficient. The receiver buffers out-of-order packets so only the missing piece needs to be resent.
            </p>
          </div>

          <button
            onClick={() => {
              onSelectProtocol('selective-repeat');
              onClose();
            }}
            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Try Selective Repeat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
