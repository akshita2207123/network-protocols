import React from 'react';
import { Play, Pause, SkipForward, ArrowLeft } from 'lucide-react';
import { SimulationEvent } from '../types/protocol';

interface ControlsBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  canStepBackward: boolean;
  isCompleted: boolean;
  speed: number;
  setSpeed: (speed: number) => void;
  currentEvent: SimulationEvent | null;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isPlaying,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  canStepBackward,
  isCompleted,
  speed,
  setSpeed,
  currentEvent,
}) => {
  const speeds = [1.0, 1.5, 2.0];

  return (
    <div className="space-y-3">
      {/* Event Note Banner */}
      {currentEvent && (
        <div className={`p-4 rounded-2xl border transition-colors ${
          currentEvent.severity === 'error'
            ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
            : currentEvent.severity === 'warning'
            ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
            : currentEvent.severity === 'success'
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
            : 'bg-slate-900 border-slate-800 text-slate-200'
        }`}>
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold tracking-tight text-white">
              {currentEvent.title}
            </h4>
            <span className="text-xs font-mono text-slate-400 shrink-0">
              Step {currentEvent.step}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {currentEvent.description}
          </p>
          {currentEvent.explanation && (
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {currentEvent.explanation}
            </p>
          )}
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-900 rounded-2xl border border-slate-800">
        
        {/* Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <button
            onClick={onStepBackward}
            disabled={!canStepBackward || isPlaying}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors border border-slate-700 cursor-pointer"
            title="Step Back to previous state"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Step Back</span>
          </button>

          <button
            onClick={onTogglePlay}
            disabled={isCompleted}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>{isCompleted ? 'Finished' : 'Auto Play'}</span>
              </>
            )}
          </button>

          <button
            onClick={onStepForward}
            disabled={isPlaying || isCompleted}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors border border-slate-700 cursor-pointer"
            title="Advance one step"
          >
            <span>Next Step</span>
            <SkipForward className="w-3.5 h-3.5 text-blue-400" />
          </button>
        </div>

        {/* Speed Adjustment & Keyboard Helper */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Speed:</span>
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 text-[11px] font-mono rounded-md transition-colors cursor-pointer ${
                    speed === s
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <span className="hidden md:inline text-[11px] text-slate-500">
            Space to toggle · Arrow keys to step
          </span>
        </div>

      </div>
    </div>
  );
};
