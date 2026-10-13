import React from 'react';
import { ProtocolState } from '../types/protocol';
import { Clock, AlertCircle } from 'lucide-react';

interface LadderDiagramProps {
  state: ProtocolState;
}

export const LadderDiagram: React.FC<LadderDiagramProps> = ({ state }) => {
  const { config, transmissionsHistory, sendBase } = state;
  const isGBN = config.protocol === 'go-back-n';
  const isSR = config.protocol === 'selective-repeat';

  // If no transmissions yet, show placeholder
  if (transmissionsHistory.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-xs text-slate-400 space-y-2">
        <Clock className="w-8 h-8 text-blue-400 mx-auto opacity-60" />
        <p className="font-semibold text-slate-200">Packet Sequence Timeline (Textbook View)</p>
        <p className="text-slate-500">
          Click "Next Step" or "Auto Play" to generate the live space-time ladder diagram.
        </p>
      </div>
    );
  }

  // Draw timeline events vertically
  const rowHeight = 44;
  const svgHeight = Math.max(320, transmissionsHistory.length * rowHeight + 80);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
        <div>
          <h3 className="font-semibold text-white">
            {isGBN ? 'Go-Back-N Timeline Diagram' : isSR ? 'Selective Repeat Timeline Diagram' : 'Stop-and-Wait Timeline Diagram'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Space-Time Sequence Diagram matching textbook evaluation models
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            Window Size = {config.windowSize}
          </span>
        </div>
      </div>

      {/* Interactive SVG Diagram */}
      <div className="relative overflow-x-auto max-h-[480px] overflow-y-auto pr-2">
        <svg
          className="w-full min-w-[540px]"
          height={svgHeight}
          viewBox={`0 0 600 ${svgHeight}`}
        >
          {/* SENDER vertical timeline axis (Left: x = 160) */}
          <line
            x1="160"
            y1="40"
            x2="160"
            y2={svgHeight - 20}
            stroke="#475569"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Sender Host Header */}
          <rect x="110" y="8" width="100" height="28" rx="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="160" y="26" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="bold">
            Sender
          </text>

          {/* RECEIVER vertical timeline axis (Right: x = 460) */}
          <line
            x1="460"
            y1="40"
            x2="460"
            y2={svgHeight - 20}
            stroke="#475569"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Receiver Host Header */}
          <rect x="410" y="8" width="100" height="28" rx="8" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
          <text x="460" y="26" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="bold">
            Receiver
          </text>

          {/* Draw each transmission arrow slanting down */}
          {transmissionsHistory.map((tx, idx) => {
            const startY = 60 + idx * rowHeight;
            const endY = startY + 36;

            if (tx.fromSender) {
              // DATA Packet (Sender -> Receiver)
              if (tx.isLost) {
                // LOST PACKET (red arrow with midway cross)
                const midX = 160 + (460 - 160) * 0.55;
                const midY = startY + (endY - startY) * 0.55;
                return (
                  <g key={tx.id}>
                    {/* Sliding window box indicator on the left if available */}
                    {tx.windowSnapshot && (
                      <g>
                        <rect x="10" y={startY - 10} width="85" height="20" rx="4" fill="#0f172a" stroke="#3b82f6" strokeWidth="1" />
                        <text x="52" y={startY + 4} textAnchor="middle" fill="#93c5fd" fontSize="10" fontFamily="monospace">
                          [{tx.windowSnapshot.sendBaseSeq}..{(tx.windowSnapshot.sendBaseSeq + tx.windowSnapshot.windowSize - 1) % (state.seqSpace || 8)}]
                        </text>
                      </g>
                    )}

                    {/* Red arrow dropped midway */}
                    <line
                      x1="160"
                      y1={startY}
                      x2={midX}
                      y2={midY}
                      stroke="#ef4444"
                      strokeWidth="2.5"
                    />
                    {/* Red X Cross */}
                    <line x1={midX - 7} y1={midY - 7} x2={midX + 7} y2={midY + 7} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                    <line x1={midX + 7} y1={midY - 7} x2={midX - 7} y2={midY + 7} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />

                    <text x="180" y={startY + 12} fill="#f87171" fontSize="11" fontWeight="600">
                      {tx.label}
                    </text>
                  </g>
                );
              } else if (tx.isDiscarded) {
                // DISCARDED PACKET (reaches receiver, but receiver discards with red X in GBN!)
                return (
                  <g key={tx.id}>
                    <line
                      x1="160"
                      y1={startY}
                      x2="460"
                      y2={endY}
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                    <polygon points={`460,${endY} 450,${endY - 6} 452,${endY}`} fill="#f59e0b" />
                    
                    {/* Red X at Receiver line */}
                    <line x1="465" y1={endY - 6} x2="477" y2={endY + 6} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                    <line x1="477" y1={endY - 6} x2="465" y2={endY + 6} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />

                    <text x="260" y={startY + 14} fill="#fbbf24" fontSize="11" fontWeight="600">
                      {tx.label}
                    </text>
                    <text x="484" y={endY + 4} fill="#f87171" fontSize="10" fontWeight="bold">
                      Discarded ✕
                    </text>
                  </g>
                );
              } else {
                // NORMAL PACKET (successfully delivered)
                return (
                  <g key={tx.id}>
                    {/* Window marker */}
                    {tx.windowSnapshot && (
                      <g>
                        <rect x="10" y={startY - 10} width="85" height="20" rx="4" fill="#0f172a" stroke="#3b82f6" strokeWidth="1" />
                        <text x="52" y={startY + 4} textAnchor="middle" fill="#93c5fd" fontSize="10" fontFamily="monospace">
                          [{tx.windowSnapshot.sendBaseSeq}..{(tx.windowSnapshot.sendBaseSeq + tx.windowSnapshot.windowSize - 1) % (state.seqSpace || 8)}]
                        </text>
                      </g>
                    )}

                    <line
                      x1="160"
                      y1={startY}
                      x2="460"
                      y2={endY}
                      stroke={tx.attempt > 1 ? '#38bdf8' : '#60a5fa'}
                      strokeWidth="2"
                    />
                    <polygon points={`460,${endY} 450,${endY - 5} 452,${endY}`} fill="#60a5fa" />

                    <text x="240" y={startY + 14} fill="#e2e8f0" fontSize="11" fontWeight="500">
                      {tx.label}
                    </text>
                  </g>
                );
              }
            } else {
              // RETURN SIGNAL (ACK or NAK, Receiver -> Sender)
              const isNak = tx.type === 'nak';
              return (
                <g key={tx.id}>
                  <line
                    x1="460"
                    y1={startY}
                    x2="160"
                    y2={endY}
                    stroke={isNak ? '#f43f5e' : '#10b981'}
                    strokeWidth="2"
                    strokeDasharray="5,4"
                  />
                  <polygon points={`160,${endY} 170,${endY - 5} 168,${endY}`} fill={isNak ? '#f43f5e' : '#10b981'} />

                  <text
                    x="300"
                    y={startY + 14}
                    fill={isNak ? '#fb7185' : '#34d399'}
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {tx.label}
                  </text>
                </g>
              );
            }
          })}
        </svg>
      </div>

      {/* Explanatory Key for Textbook Evaluation */}
      <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400" /> Frame
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-rose-500" /> Lost Frame (✕)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-400 border-dashed border-b" /> ACK
          </span>
          {isSR && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-rose-400 border-dashed border-b" /> NAK
            </span>
          )}
          {isGBN && (
            <span className="flex items-center gap-1 text-amber-300">
              ✕ Discarded at Rx
            </span>
          )}
        </div>
        <span className="text-slate-500 font-mono">
          {transmissionsHistory.length} transmissions recorded
        </span>
      </div>
    </div>
  );
};
