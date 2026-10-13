import React from 'react';
import { ProtocolState, Frame, AckPacket } from '../types/protocol';
import { Server, Laptop, XCircle, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle, Clock } from 'lucide-react';

interface NetworkCanvasProps {
  state: ProtocolState;
  onSelectFrame?: (frame: Frame) => void;
  onSelectAck?: (ack: AckPacket) => void;
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  state,
  onSelectFrame,
}) => {
  const {
    config,
    sendBase,
    sendBaseSeq,
    nextSeqNumIndex,
    nextSeqNum,
    rcvBase,
    rcvBaseSeq,
    allFrames,
    deliveredFrames,
    receiverBuffer,
    seqSpace,
    senderTimer,
    senderTimerRunning,
  } = state;

  const inFlightFrames = state.inFlightFrames || [];
  const inFlightAcks = state.inFlightAcks || [];
  const isGBN = config.protocol === 'go-back-n';
  const isSR = config.protocol === 'selective-repeat';

  return (
    <div className="relative w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-sm overflow-hidden flex flex-col justify-between min-h-[350px]">
      
      {/* Top Protocol Status Stripe */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">
            {config.protocol === 'stop-and-wait' && 'Stop-and-Wait ARQ'}
            {config.protocol === 'go-back-n' && `Go-Back-N ARQ (Window N = ${config.windowSize}, Modulo ${seqSpace})`}
            {config.protocol === 'selective-repeat' && `Selective Repeat ARQ (Window N = ${config.windowSize}, Modulo ${seqSpace})`}
          </span>
          <span className="text-slate-600">·</span>
          <span>Step {state.step}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Data Link
          </span>
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ACK Link
          </span>
        </div>
      </div>

      {/* Main Transmission Stage: Sender <--> Channel <--> Receiver */}
      <div className="my-auto py-6 flex items-center justify-between gap-4 md:gap-8">
        
        {/* SENDER NODE */}
        <div className="flex-1 max-w-[170px] flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shadow-sm relative">
            <Server className="w-7 h-7 text-blue-400" />
            {isGBN && senderTimerRunning && (
              <div
                className="absolute -top-1.5 -right-1.5 bg-amber-500/20 border border-amber-500/80 text-amber-300 rounded-full px-1.5 py-0.5 text-[9px] font-mono flex items-center gap-0.5"
                title={`Base Timer: ${senderTimer} ticks remaining`}
              >
                <Clock className="w-2.5 h-2.5" />
                <span>{senderTimer}t</span>
              </div>
            )}
          </div>
          <div className="mt-2.5">
            <h3 className="text-sm font-semibold text-white">Sender</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Base: <span className="text-blue-400 font-bold">{sendBaseSeq}</span> (idx {sendBase})
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              NextSeq: <span className="text-slate-300">{nextSeqNum}</span> (idx {nextSeqNumIndex})
            </p>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
            Win: [{sendBaseSeq}..{(sendBaseSeq + config.windowSize - 1) % seqSpace}]
          </div>
        </div>

        {/* NETWORK CHANNEL */}
        <div className="flex-[3] relative h-36 flex flex-col justify-center px-2">
          
          {/* FORWARD DATA WIRE (Sender -> Receiver) */}
          <div className="relative w-full h-12 flex items-center">
            <div className="w-full h-1 rounded-full bg-slate-800 relative" />
            
            <div className="absolute inset-0 flex items-center justify-around pointer-events-none opacity-20 text-blue-400">
              <ArrowRight className="w-3.5 h-3.5" />
              <ArrowRight className="w-3.5 h-3.5" />
            </div>

            {/* In-flight Data Packets */}
            {inFlightFrames.map((inFlight, index) => {
              const frame = inFlight.frame;
              const count = inFlightFrames.length;
              const verticalOffset = count > 1 ? (index % 2 === 0 ? -18 : 18) : 0;
              const horizontalStagger = count > 1 ? (index - (count - 1) / 2) * 32 : 0;
              return (
                <div
                  key={inFlight.id}
                  onClick={() => onSelectFrame?.(frame)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-all duration-300 z-20"
                  style={{
                    left: `calc(${Math.max(8, Math.min(92, inFlight.progress * 100))}% + ${horizontalStagger}px)`,
                    marginTop: `${verticalOffset}px`,
                  }}
                >
                  <div
                    className={`px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 border text-xs font-mono font-medium ${
                      inFlight.isLost
                        ? 'bg-rose-950 text-rose-300 border-rose-600'
                        : inFlight.isCorrupted
                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                        : frame.attempt > 1
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-blue-600 text-white border-blue-400'
                    }`}
                  >
                    {inFlight.isLost ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>LOST F{frame.index} [seq {frame.seq}]</span>
                      </>
                    ) : inFlight.isCorrupted ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>CORRUPT [seq {frame.seq}]</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold">F{frame.index} [seq {frame.seq}]</span>
                        <span className="text-[10px] text-blue-100 bg-blue-700/60 px-1 py-0.5 rounded">
                          "{frame.payload}"
                        </span>
                        {frame.attempt > 1 && (
                          <span className="text-[9px] bg-indigo-900/80 px-1 py-0.5 rounded text-indigo-200">
                            #{frame.attempt}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RETURN ACK WIRE (Receiver -> Sender) */}
          <div className="relative w-full h-12 flex items-center mt-2">
            <div className="w-full h-1 rounded-full bg-slate-800 relative" />
            
            <div className="absolute inset-0 flex items-center justify-around pointer-events-none opacity-20 text-emerald-400">
              <ArrowLeft className="w-3.5 h-3.5" />
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>

            {/* In-flight ACKs */}
            {inFlightAcks.map((inFlight, index) => {
              const ack = inFlight.ack;
              const count = inFlightAcks.length;
              const verticalOffset = count > 1 ? (index % 2 === 0 ? -14 : 14) : 0;
              const horizontalStagger = count > 1 ? (index - (count - 1) / 2) * 28 : 0;
              return (
                <div
                  key={inFlight.id}
                  className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 transition-all duration-300 z-20"
                  style={{
                    right: `calc(${Math.max(8, Math.min(92, inFlight.progress * 100))}% + ${horizontalStagger}px)`,
                    marginTop: `${verticalOffset}px`,
                  }}
                >
                  <div
                    className={`px-2.5 py-1 rounded-lg border shadow-md text-xs font-mono font-medium flex items-center gap-1.5 ${
                      inFlight.isLost
                        ? 'bg-rose-950 text-rose-300 border-rose-600'
                        : inFlight.isCorrupted
                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                        : 'bg-emerald-600 text-white border-emerald-400'
                    }`}
                  >
                    {inFlight.isLost ? (
                      <>
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>LOST ACK {ack.ackNum}</span>
                      </>
                    ) : inFlight.isCorrupted ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>BAD ACK</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-100" />
                        <span className="font-bold">ACK {ack.ackNum}</span>
                        {ack.frameIndex !== undefined && (
                          <span className="text-[10px] text-emerald-100 bg-emerald-700/60 px-1 py-0.5 rounded font-normal">
                            {ack.isCumulative ? `≤F${ack.frameIndex}` : `F${ack.frameIndex}`}
                          </span>
                        )}
                        {ack.isCumulative && <span className="text-[9px] opacity-80">(cumul)</span>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* RECEIVER NODE */}
        <div className="flex-1 max-w-[170px] flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shadow-sm relative">
            <Laptop className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-sm font-semibold text-white">Receiver</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Expected: <span className="text-emerald-400 font-bold">{rcvBaseSeq}</span> (idx {rcvBase})
            </p>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
            {isGBN && `Rx Win: [${rcvBaseSeq}] (size 1)`}
            {isSR && `Rx Win: [${rcvBaseSeq}..${(rcvBaseSeq + config.windowSize - 1) % seqSpace}]`}
            {config.protocol === 'stop-and-wait' && `Rx Win: [${rcvBaseSeq}]`}
          </div>
        </div>

      </div>

      {/* Receiver Assembled Message & Buffer Strip */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 text-xs">Receiver In-Order Delivery:</span>
          <div className="flex items-center gap-1 font-mono flex-wrap">
            {allFrames.map((f, i) => {
              const isDelivered = Boolean(deliveredFrames[i]);
              const isBuffered = Boolean(receiverBuffer[i]);
              return (
                <span
                  key={f.id}
                  onClick={() => onSelectFrame?.(f)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
                    isDelivered
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-semibold'
                      : isBuffered
                      ? 'bg-amber-950 text-amber-300 border border-amber-800/80 font-medium'
                      : 'bg-slate-950 text-slate-600 border border-slate-800'
                  }`}
                  title={`Frame ${i} [seq ${f.seq}]: "${f.payload}" (${isDelivered ? 'Delivered to App' : isBuffered ? 'Buffered at Receiver' : 'Not received yet'})`}
                >
                  {isDelivered ? f.payload : isBuffered ? `${f.payload}*` : '···'}
                </span>
              );
            })}
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
          Delivered: {deliveredFrames.filter(Boolean).length} / {allFrames.length}
        </span>
      </div>

    </div>
  );
};
