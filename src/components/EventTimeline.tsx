import React from 'react';
import { SimulationEvent } from '../types/protocol';

interface EventTimelineProps {
  events: SimulationEvent[];
  onSelectEvent?: (event: SimulationEvent) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  onSelectEvent,
}) => {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3 flex flex-col h-[320px]">
      <div className="flex items-center justify-between shrink-0 pb-2 border-b border-slate-800">
        <h3 className="text-xs font-semibold text-slate-200">Activity History</h3>
        <span className="text-[11px] font-mono text-slate-500">
          {events.length} events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {events.map((evt, idx) => {
          const isLatest = idx === 0;
          return (
            <div
              key={evt.id}
              onClick={() => onSelectEvent?.(evt)}
              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                isLatest
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-200">{evt.title}</span>
                <span className="font-mono text-slate-500">Step {evt.step}</span>
              </div>
              <p className="text-[11px] mt-0.5 text-slate-300">
                {evt.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
