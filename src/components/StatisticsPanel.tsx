import React from 'react';
import { SimulationStats } from '../types/protocol';

interface StatisticsPanelProps {
  stats: SimulationStats;
  totalFrames: number;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ stats, totalFrames }) => {
  const metrics = [
    {
      label: 'Delivered',
      value: `${stats.framesDelivered} / ${totalFrames}`,
      color: 'text-emerald-400',
    },
    {
      label: 'Total Sent',
      value: stats.framesSent,
      color: 'text-slate-100',
    },
    {
      label: 'Packets Lost',
      value: stats.framesLost,
      color: stats.framesLost > 0 ? 'text-rose-400' : 'text-slate-400',
    },
    {
      label: 'Retransmissions',
      value: stats.retransmissions,
      color: stats.retransmissions > 0 ? 'text-amber-400' : 'text-slate-400',
    },
    {
      label: 'Channel Efficiency',
      value: `${stats.efficiency}%`,
      color: stats.efficiency >= 80 ? 'text-emerald-400' : stats.efficiency >= 50 ? 'text-blue-400' : 'text-amber-400',
    },
  ];

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-200">
          Transmission Statistics
        </h3>
        <span className="text-xs font-mono text-slate-500">
          Steps: <span className="tabular-nums text-slate-300">{stats.totalSteps}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80"
          >
            <div className="text-[11px] text-slate-400 font-medium">{m.label}</div>
            <div className={`text-lg font-bold font-mono tabular-nums mt-1 ${m.color}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
