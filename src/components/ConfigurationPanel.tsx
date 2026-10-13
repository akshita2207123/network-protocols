import React from 'react';
import { SimulationConfig, ProtocolType } from '../types/protocol';
import { validateAndClampWindowSize } from '../engine/protocolEngine';
import { ShieldCheck, Sliders, Dna, Play } from 'lucide-react';

interface ConfigurationPanelProps {
  config: SimulationConfig;
  onChangeConfig: (newConfig: Partial<SimulationConfig>) => void;
  onLoadScenario?: (scenarioId: number) => void;
  disabled: boolean;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onChangeConfig,
  onLoadScenario,
  disabled,
}) => {
  const protocols: { type: ProtocolType; label: string; desc: string }[] = [
    {
      type: 'stop-and-wait',
      label: 'Stop-and-Wait',
      desc: 'Sender window N = 1, Receiver window = 1. Strictly alternating frame transmission.',
    },
    {
      type: 'go-back-n',
      label: 'Go-Back-N',
      desc: 'Sender window N ≤ 2^m - 1, Receiver window = 1. Discards out-of-order; on timeout retransmits all unACKed frames.',
    },
    {
      type: 'selective-repeat',
      label: 'Selective Repeat',
      desc: 'Sender & Receiver window N ≤ 2^(m-1). Buffers out-of-order; retransmits only the missing frame.',
    },
  ];

  const mBits = config.mBits || 3;
  const seqSpace = 1 << mBits;
  const maxAllowedWindow =
    config.protocol === 'selective-repeat'
      ? 1 << (mBits - 1)
      : config.protocol === 'go-back-n'
      ? seqSpace - 1
      : 1;

  // Window options within valid mathematical bounds
  const availableWindows = [2, 3, 4, 6, 7].filter((w) => w <= maxAllowedWindow);

  const testScenarios = [
    { id: 1, label: 'Scenario 1: Clean Link (No Loss)' },
    { id: 2, label: 'Scenario 2: Single Data Frame Lost' },
    { id: 3, label: 'Scenario 3: Single ACK Lost' },
    { id: 4, label: 'Scenario 4: One Frame Corrupted (CRC Fail)' },
    { id: 5, label: 'Scenario 5: Multiple Consecutive Frames Lost' },
    { id: 6, label: 'Scenario 6: Out-of-Order Frame Arrival' },
    { id: 7, label: 'Scenario 7: Sequence Wraparound (Modulo 4)' },
    { id: 8, label: 'Scenario 8: Full Window Flow Control' },
  ];

  const handleProtocolChange = (proto: ProtocolType) => {
    const clampedWindow = validateAndClampWindowSize(proto, config.windowSize, mBits);
    onChangeConfig({ protocol: proto, windowSize: clampedWindow });
  };

  const handleMBitsChange = (bits: number) => {
    const clampedWindow = validateAndClampWindowSize(config.protocol, config.windowSize, bits);
    onChangeConfig({ mBits: bits, windowSize: clampedWindow });
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-5">
      {/* Protocol Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-200 block">
          Protocol Architecture
        </label>
        <div className="space-y-2">
          {protocols.map((p) => {
            const isSelected = config.protocol === p.type;
            return (
              <button
                key={p.type}
                onClick={() => handleProtocolChange(p.type)}
                disabled={disabled}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-950/40 border-blue-500/80 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{p.label}</span>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sequence Number Space (m bits) */}
      <div className="space-y-2 pt-1 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">Sequence Bits (m)</span>
          <span className="font-mono text-slate-400">
            {mBits} bits ({seqSpace} seqs, 0..{seqSpace - 1})
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[2, 3, 4].map((bits) => (
            <button
              key={bits}
              type="button"
              disabled={disabled}
              onClick={() => handleMBitsChange(bits)}
              className={`py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                mBits === bits
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              } disabled:opacity-50`}
            >
              m = {bits} ({1 << bits} seqs)
            </button>
          ))}
        </div>
      </div>

      {/* Window Size (N) with mathematical enforcement */}
      {config.protocol !== 'stop-and-wait' && (
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">Window Size (N)</span>
            <span className="font-mono text-blue-400 font-semibold">
              N = {config.windowSize} (Max: {maxAllowedWindow})
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {availableWindows.map((w) => (
              <button
                key={w}
                type="button"
                disabled={disabled}
                onClick={() => onChangeConfig({ windowSize: w })}
                className={`py-1.5 px-3 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                  config.windowSize === w
                    ? 'bg-blue-600 border-blue-500 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                } disabled:opacity-50`}
              >
                N = {w}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            {config.protocol === 'selective-repeat'
              ? `* Enforcing N ≤ 2^(m-1) = ${maxAllowedWindow} to prevent wraparound ambiguity.`
              : `* Enforcing N ≤ 2^m - 1 = ${maxAllowedWindow} for cumulative ACK correctness.`}
          </p>
        </div>
      )}

      {/* ACK Numbering Convention */}
      <div className="space-y-2 pt-1 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">ACK Numbering Mode</span>
          <span className="text-[10px] text-blue-400 font-mono">
            {config.ackConvention === 'next-expected' ? 'Next Expected' : 'Frame Confirmed'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChangeConfig({ ackConvention: 'acknowledged-frame' })}
            className={`py-1.5 px-2 text-[11px] rounded-lg border transition-colors cursor-pointer text-center ${
              (config.ackConvention ?? 'acknowledged-frame') === 'acknowledged-frame'
                ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            } disabled:opacity-50`}
            title="ACK n confirms Frame n (Standard: Kurose & Ross / Tanenbaum / Forouzan)"
          >
            <span>ACK n (Frame n)</span>
            <div className="text-[9px] opacity-80 font-normal">Textbook Standard</div>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChangeConfig({ ackConvention: 'next-expected' })}
            className={`py-1.5 px-2 text-[11px] rounded-lg border transition-colors cursor-pointer text-center ${
              config.ackConvention === 'next-expected'
                ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            } disabled:opacity-50`}
            title="ACK n+1 requests Frame n+1 (TCP convention)"
          >
            <span>ACK n+1 (Next Seq)</span>
            <div className="text-[9px] opacity-80 font-normal">TCP Request Style</div>
          </button>
        </div>
      </div>

      {/* Message Input */}
      <div className="space-y-2 pt-1 border-t border-slate-800/80">
        <label className="text-xs font-semibold text-slate-200 block">
          Message Payload
        </label>
        <input
          type="text"
          value={config.message}
          onChange={(e) => onChangeConfig({ message: e.target.value.toUpperCase() })}
          disabled={disabled}
          maxLength={24}
          placeholder="HELLO NETWORK"
          className="w-full px-3 py-2 text-xs font-mono font-medium bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 uppercase disabled:opacity-50"
        />
      </div>

      {/* Pre-Configured Test Scenarios */}
      {onLoadScenario && (
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">Load Test Scenario</span>
            <span className="text-[10px] text-slate-400 font-mono">1-click test</span>
          </div>
          <select
            disabled={disabled}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 0) onLoadScenario(val);
            }}
            defaultValue=""
            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
          >
            <option value="" disabled>Select Scenario to Test...</option>
            {testScenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Seed for Reproducibility */}
      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>PRNG Seed:</span>
        <input
          type="number"
          value={config.seed}
          onChange={(e) => onChangeConfig({ seed: Number(e.target.value) || 12345 })}
          disabled={disabled}
          className="w-20 px-2 py-0.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-right text-slate-200 disabled:opacity-50"
        />
      </div>
    </div>
  );
};
