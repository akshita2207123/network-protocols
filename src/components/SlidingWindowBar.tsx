import React from 'react';
import { ProtocolState, Frame } from '../types/protocol';
import { isInWindow } from '../engine/protocolEngine';

interface SlidingWindowBarProps {
  state: ProtocolState;
  onSelectFrame: (frame: Frame) => void;
}

export const SlidingWindowBar: React.FC<SlidingWindowBarProps> = ({ state, onSelectFrame }) => {
  const {
    config,
    sendBase,
    sendBaseSeq,
    nextSeqNumIndex,
    rcvBase,
    rcvBaseSeq,
    allFrames,
    deliveredFrames,
    receiverBuffer,
    seqSpace,
  } = state;

  const windowSize = config.windowSize;
  const isGBN = config.protocol === 'go-back-n';
  const isSR = config.protocol === 'selective-repeat';

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-3">
      {/* Title & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <h4 className="font-semibold text-slate-200">Sliding Windows & Sequence Number Space</h4>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Modulo {seqSpace} ({config.mBits}-bit seq space). Window size N = {windowSize}
            {isGBN && ` (GBN constraint: N ≤ ${seqSpace - 1})`}
            {isSR && ` (SR constraint: N ≤ ${seqSpace / 2})`}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/80" />
            Delivered / ACKed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-500/80" />
            In Sender Window
          </span>
          {isSR && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500/80" />
              Buffered at Rx
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700" />
            Outside Window
          </span>
        </div>
      </div>

      {/* Frame Sequence Visual Strip */}
      <div className="relative pt-5 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {allFrames.map((frame, index) => {
            const isAcked = frame.status === 'acked';
            const isDelivered = Boolean(deliveredFrames[index]);
            const isBuffered = Boolean(receiverBuffer[index]);
            const inSenderWindow = index >= sendBase && index < sendBase + windowSize;
            const isSent = frame.attempt > 0 && !isAcked;

            let bgClass = 'bg-slate-950 border-slate-800 text-slate-500';
            if (isAcked || isDelivered) {
              bgClass = 'bg-emerald-950/80 border-emerald-600/80 text-emerald-200 font-semibold';
            } else if (isBuffered) {
              bgClass = 'bg-amber-950/80 border-amber-600/80 text-amber-200 font-semibold';
            } else if (isSent) {
              bgClass = 'bg-blue-950/80 border-blue-500/80 text-blue-200 font-semibold';
            } else if (inSenderWindow) {
              bgClass = 'bg-slate-900 border-slate-700 text-slate-200';
            }

            return (
              <div key={frame.id} className="flex-1 min-w-[76px] relative">
                {/* Send Base marker */}
                {index === sendBase && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-blue-400 font-semibold whitespace-nowrap">
                    ▲ SendBase
                  </div>
                )}

                {/* Frame Box */}
                <button
                  onClick={() => onSelectFrame(frame)}
                  className={`w-full py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${bgClass} ${
                    inSenderWindow ? 'ring-1 ring-blue-500/40' : ''
                  }`}
                >
                  <div className="text-[11px] font-mono font-bold">
                    Seq #{frame.seq}
                  </div>
                  <div className="text-[10px] truncate opacity-90 mt-0.5 font-mono">
                    "{frame.payload}"
                  </div>
                  <div className="text-[9px] font-mono opacity-70 mt-1">
                    {isAcked || isDelivered
                      ? '✓ Confirmed'
                      : isBuffered
                      ? '★ Buffered'
                      : frame.attempt > 0
                      ? `Try #${frame.attempt}`
                      : 'Queued'}
                  </div>
                </button>

                {/* Receiver Base Marker below */}
                {index === rcvBase && (
                  <div className="text-center text-[10px] font-mono text-emerald-400 font-semibold mt-1 whitespace-nowrap">
                    ▼ RcvBase
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
