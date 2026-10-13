import React, { useState } from 'react';
import { ProtocolType, SimulationConfig, ProtocolState } from '../types/protocol';
import { createInitialState, stepSimulation } from '../engine/simulationEngine';
import { Play } from 'lucide-react';

export const ComparisonView: React.FC = () => {
  const [message, setMessage] = useState('HELLO WORLD');
  const [lossRate, setLossRate] = useState(0.2); // 20%
  const [windowSize, setWindowSize] = useState(4);
  const [isSimulating, setIsSimulating] = useState(false);

  const [results, setResults] = useState<{
    stopAndWait: { steps: number; sent: number; retransmissions: number; efficiency: number } | null;
    goBackN: { steps: number; sent: number; retransmissions: number; efficiency: number } | null;
    selectiveRepeat: { steps: number; sent: number; retransmissions: number; efficiency: number } | null;
  }>({
    stopAndWait: null,
    goBackN: null,
    selectiveRepeat: null,
  });

  const runBenchmark = () => {
    setIsSimulating(true);

    const protocols: ProtocolType[] = ['stop-and-wait', 'go-back-n', 'selective-repeat'];
    const outcomes: any = {};

    protocols.forEach((proto) => {
      const config: SimulationConfig = {
        protocol: proto,
        message,
        frameChunkSize: 3,
        windowSize: proto === 'stop-and-wait' ? 1 : windowSize,
        lossProbability: lossRate,
        timeoutTicks: 3,
        channelDelayTicks: 1,
        mBits: 3,
        seed: 12345,
        corruptionProbability: 0,
        ackLossProbability: 0,
      };

      let state: ProtocolState = createInitialState(config);
      let guard = 0;
      while (!state.isCompleted && guard < 200) {
        state = stepSimulation(state);
        guard++;
      }

      outcomes[proto] = {
        steps: state.step,
        sent: state.stats.framesSent,
        retransmissions: state.stats.retransmissions,
        efficiency: state.stats.efficiency,
      };
    });

    setResults({
      stopAndWait: outcomes['stop-and-wait'],
      goBackN: outcomes['go-back-n'],
      selectiveRepeat: outcomes['selective-repeat'],
    });

    setIsSimulating(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Compare All Three Protocols</h2>
        <p className="text-xs text-slate-400">
          Run the exact same message and packet loss through each protocol to see differences in retransmissions and efficiency.
        </p>
      </div>

      {/* Inputs */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[160px] space-y-1">
          <label className="text-xs font-medium text-slate-300">Message</label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value.toUpperCase())}
            maxLength={18}
            className="w-full px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 uppercase"
          />
        </div>

        <div className="w-36 space-y-1">
          <label className="text-xs font-medium text-slate-300 flex justify-between">
            <span>Packet Loss</span>
            <span className="font-mono text-slate-400">{Math.round(lossRate * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.1"
            value={lossRate}
            onChange={(e) => setLossRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg accent-rose-500 cursor-pointer"
          />
        </div>

        <div className="w-28 space-y-1">
          <label className="text-xs font-medium text-slate-300">Window (N)</label>
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
          >
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} packets</option>
            ))}
          </select>
        </div>

        <button
          onClick={runBenchmark}
          disabled={isSimulating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 mt-auto"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Run Test</span>
        </button>
      </div>

      {/* Protocol Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Stop and Wait */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-white">Stop-and-Wait</h3>
            <span className="text-[11px] text-slate-400">Window = 1</span>
          </div>
          {results.stopAndWait ? (
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Steps Taken</span>
                <span className="text-white">{results.stopAndWait.steps}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Packets Sent</span>
                <span className="text-blue-400">{results.stopAndWait.sent}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Retransmissions</span>
                <span className="text-rose-400">{results.stopAndWait.retransmissions}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Efficiency</span>
                <span className="text-emerald-400">{results.stopAndWait.efficiency}%</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">Click "Run Test"</p>
          )}
        </div>

        {/* Go Back N */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-white">Go-Back-N</h3>
            <span className="text-[11px] text-slate-400">Window = {windowSize}</span>
          </div>
          {results.goBackN ? (
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Steps Taken</span>
                <span className="text-white">{results.goBackN.steps}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Packets Sent</span>
                <span className="text-blue-400">{results.goBackN.sent}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Retransmissions</span>
                <span className="text-rose-400">{results.goBackN.retransmissions}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Efficiency</span>
                <span className="text-emerald-400">{results.goBackN.efficiency}%</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">Click "Run Test"</p>
          )}
        </div>

        {/* Selective Repeat */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-white">Selective Repeat</h3>
            <span className="text-[11px] text-slate-400">Window = {windowSize}</span>
          </div>
          {results.selectiveRepeat ? (
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Steps Taken</span>
                <span className="text-white">{results.selectiveRepeat.steps}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Packets Sent</span>
                <span className="text-blue-400">{results.selectiveRepeat.sent}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Retransmissions</span>
                <span className="text-rose-400">{results.selectiveRepeat.retransmissions}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Efficiency</span>
                <span className="text-emerald-400">{results.selectiveRepeat.efficiency}%</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">Click "Run Test"</p>
          )}
        </div>

      </div>

      {/* Clean Comparison Summary Table */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-semibold text-slate-200">Protocol Summary</h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2">Feature</th>
              <th className="py-2">Stop-and-Wait</th>
              <th className="py-2">Go-Back-N</th>
              <th className="py-2">Selective Repeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            <tr>
              <td className="py-2 font-medium">Window Size</td>
              <td className="py-2">1</td>
              <td className="py-2">N</td>
              <td className="py-2">N</td>
            </tr>
            <tr>
              <td className="py-2 font-medium">When a Packet is Lost</td>
              <td className="py-2">Resends that packet</td>
              <td className="py-2">Resends all N unACKed packets</td>
              <td className="py-2">Resends only the missing packet</td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Receiver Buffer</td>
              <td className="py-2">None</td>
              <td className="py-2">None (drops out of order)</td>
              <td className="py-2">Buffers out of order packets</td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Efficiency</td>
              <td className="py-2">Lowest</td>
              <td className="py-2">Moderate</td>
              <td className="py-2">Highest</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
