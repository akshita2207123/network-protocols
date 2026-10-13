/**
 * Network Protocol Simulator
 * Clean, interactive educational visualizer for Stop-and-Wait, Go-Back-N, and Selective Repeat.
 */

import React, { useState, useEffect } from 'react';
import {
  ProtocolType,
  SimulationConfig,
  ProtocolState,
  Frame,
} from './types/protocol';
import { createInitialState, stepSimulation } from './engine/protocolEngine';
import { Header } from './components/Header';
import { NetworkCanvas } from './components/NetworkCanvas';
import { SlidingWindowBar } from './components/SlidingWindowBar';
import { ControlsBar } from './components/ControlsBar';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import { EventTimeline } from './components/EventTimeline';
import { PacketInspector } from './components/PacketInspector';
import { ComparisonView } from './components/ComparisonView';
import { ProtocolGuideModal } from './components/ProtocolGuideModal';
import { CompletionSummary } from './components/CompletionSummary';
import { LadderDiagram } from './components/LadderDiagram';
import { TestRunnerModal } from './components/TestRunnerModal';

export default function App() {
  const [activeView, setActiveView] = useState<'simulator' | 'comparison' | 'guide'>('simulator');
  const [diagramView, setDiagramView] = useState<'channel' | 'ladder' | 'both'>('both');
  const [speed, setSpeed] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);

  // Configuration state
  const [config, setConfig] = useState<SimulationConfig>({
    protocol: 'go-back-n',
    message: 'HELLO NETWORK',
    frameChunkSize: 2,
    mBits: 3,
    windowSize: 4,
    lossProbability: 0.15,
    corruptionProbability: 0.0,
    ackLossProbability: 0.0,
    timeoutTicks: 3,
    channelDelayTicks: 1,
    seed: 12345,
    ackConvention: 'acknowledged-frame',
  });

  // Simulation State & History for step rewind
  const [simulationState, setSimulationState] = useState<ProtocolState>(() =>
    createInitialState(config)
  );
  const [history, setHistory] = useState<ProtocolState[]>([]);

  // Reset simulation
  const handleReset = (newConfig?: SimulationConfig) => {
    setIsPlaying(false);
    const activeCfg = newConfig || config;
    const freshState = createInitialState(activeCfg);
    setSimulationState(freshState);
    setHistory([]);
  };

  const handleConfigChange = (changes: Partial<SimulationConfig>) => {
    const updated = { ...config, ...changes };
    if (updated.protocol === 'stop-and-wait') {
      updated.windowSize = 1;
    } else if (updated.protocol === 'selective-repeat') {
      const maxSR = 1 << ((updated.mBits || 3) - 1);
      if (updated.windowSize > maxSR) updated.windowSize = maxSR;
    } else if (updated.protocol === 'go-back-n') {
      const maxGBN = (1 << (updated.mBits || 3)) - 1;
      if (updated.windowSize > maxGBN) updated.windowSize = maxGBN;
    }
    setConfig(updated);
    handleReset(updated);
  };

  // Pre-configured Scenario Loader
  const handleLoadScenario = (scenarioId: number) => {
    let scenarioConfig: Partial<SimulationConfig> = {};
    if (scenarioId === 1) {
      scenarioConfig = {
        message: 'NETWORKS',
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [],
        forcedCorruptFrameIndices: [],
        forcedLossAckSeqs: [],
      };
    } else if (scenarioId === 2) {
      scenarioConfig = {
        message: 'ABCDEFGH',
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [1], // Frame 1 lost
        forcedCorruptFrameIndices: [],
        forcedLossAckSeqs: [],
      };
    } else if (scenarioId === 3) {
      scenarioConfig = {
        message: 'ABCDEF',
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [],
        forcedCorruptFrameIndices: [],
        forcedLossAckSeqs: [1], // ACK 1 lost
      };
    } else if (scenarioId === 4) {
      scenarioConfig = {
        message: 'ABCDEF',
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [],
        forcedCorruptFrameIndices: [0], // Frame 0 corrupted
        forcedLossAckSeqs: [],
      };
    } else if (scenarioId === 5) {
      scenarioConfig = {
        message: 'ABCDEFGHIJKL',
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [1, 2], // Consecutive losses
        forcedCorruptFrameIndices: [],
        forcedLossAckSeqs: [],
      };
    } else if (scenarioId === 6) {
      scenarioConfig = {
        message: 'ABCDEFGH',
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [0], // Frame 0 lost -> frame 1 is out of order
        forcedCorruptFrameIndices: [],
        forcedLossAckSeqs: [],
      };
    } else if (scenarioId === 7) {
      scenarioConfig = {
        message: '1234567890ABCDEF',
        mBits: 2, // modulo 4 (0, 1, 2, 3)
        windowSize: 2,
        lossProbability: 0,
        corruptionProbability: 0,
        ackLossProbability: 0,
        forcedLossFrameIndices: [],
        forcedCorruptFrameIndices: [],
        forcedLossAckSeqs: [],
      };
    } else if (scenarioId === 8) {
      scenarioConfig = {
        message: '1234567890',
        windowSize: 2,
        timeoutTicks: 5,
        channelDelayTicks: 2,
        lossProbability: 0,
        forcedLossFrameIndices: [],
      };
    }

    handleConfigChange(scenarioConfig);
  };

  // Step Forward
  const handleStepForward = () => {
    if (simulationState.isCompleted) return;

    setSimulationState((prev) => {
      setHistory((h) => [...h, prev]);
      return stepSimulation(prev);
    });
  };

  // Step Backward
  const handleStepBackward = () => {
    if (history.length === 0) return;

    setHistory((prev) => {
      const copy = [...prev];
      const lastState = copy.pop();
      if (lastState) {
        setSimulationState(lastState);
      }
      return copy;
    });
  };

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying) return;

    if (simulationState.isCompleted) {
      setIsPlaying(false);
      return;
    }

    const intervalTime = Math.max(500, 1400 / speed);
    const timer = setInterval(() => {
      setSimulationState((prev) => {
        if (prev.isCompleted) {
          setIsPlaying(false);
          return prev;
        }
        setHistory((h) => [...h, prev]);
        return stepSimulation(prev);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, speed, simulationState.isCompleted]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!simulationState.isCompleted) {
          setIsPlaying((p) => !p);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!isPlaying) handleStepForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!isPlaying) handleStepBackward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, simulationState.isCompleted, history.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onReset={() => handleReset()}
        onOpenTests={() => setIsTestModalOpen(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* VIEW 1: COMPARISON */}
        {activeView === 'comparison' && <ComparisonView />}

        {/* VIEW 2: GUIDE */}
        {activeView === 'guide' && (
          <ProtocolGuideModal
            onSelectProtocol={(p) => {
              handleConfigChange({ protocol: p });
              setActiveView('simulator');
            }}
            onClose={() => setActiveView('simulator')}
          />
        )}

        {/* VIEW 3: SIMULATOR */}
        {activeView === 'simulator' && (
          <div className="space-y-6">
            
            {/* Top Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Configuration Controls (4 cols) */}
              <div className="lg:col-span-4">
                <ConfigurationPanel
                  config={config}
                  onChangeConfig={handleConfigChange}
                  onLoadScenario={handleLoadScenario}
                  disabled={isPlaying || simulationState.step > 0}
                />
              </div>

              {/* Right Column: Interactive Visual Stage & Playback (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                
                {/* View Switcher: Physical Wire vs Textbook Timeline Ladder */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setDiagramView('both')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        diagramView === 'both'
                          ? 'bg-blue-600 text-white font-medium shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Split View (Both)
                    </button>
                    <button
                      onClick={() => setDiagramView('channel')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        diagramView === 'channel'
                          ? 'bg-blue-600 text-white font-medium shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Physical Channel
                    </button>
                    <button
                      onClick={() => setDiagramView('ladder')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        diagramView === 'ladder'
                          ? 'bg-blue-600 text-white font-medium shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Textbook Timeline
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                    {config.protocol === 'go-back-n'
                      ? 'Go-Back-N Mode'
                      : config.protocol === 'selective-repeat'
                      ? 'Selective Repeat Mode'
                      : 'Stop-and-Wait Mode'}
                  </span>
                </div>

                {/* Visual Network Canvas (Physical Wire) */}
                {(diagramView === 'channel' || diagramView === 'both') && (
                  <NetworkCanvas
                    state={simulationState}
                    onSelectFrame={(f) => setSelectedFrame(f)}
                  />
                )}

                {/* Textbook Sequence Ladder Diagram (Space-Time Timeline matching uploaded textbook images) */}
                {(diagramView === 'ladder' || diagramView === 'both') && (
                  <LadderDiagram state={simulationState} />
                )}

                {/* Sliding Window Sequence Strip */}
                <SlidingWindowBar
                  state={simulationState}
                  onSelectFrame={(f) => setSelectedFrame(f)}
                />

                {/* Playback Controls & Event Explanation */}
                <ControlsBar
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying(!isPlaying)}
                  onStepForward={handleStepForward}
                  onStepBackward={handleStepBackward}
                  canStepBackward={history.length > 0}
                  isCompleted={simulationState.isCompleted}
                  speed={speed}
                  setSpeed={setSpeed}
                  currentEvent={simulationState.currentEvent}
                />

                {/* Completion Summary (shows when finished) */}
                {simulationState.isCompleted && (
                  <CompletionSummary
                    state={simulationState}
                    onReset={() => handleReset()}
                    onSwitchProtocol={(p) => handleConfigChange({ protocol: p })}
                    onOpenComparison={() => setActiveView('comparison')}
                  />
                )}

              </div>
            </div>

            {/* Bottom Row: Key Statistics & Activity Log */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <StatisticsPanel
                  stats={simulationState.stats}
                  totalFrames={simulationState.totalFramesCount}
                />
              </div>
              <div className="lg:col-span-5">
                <EventTimeline
                  events={simulationState.events}
                  onSelectEvent={(evt) => {
                    if (evt.frameIndex !== undefined) {
                      setSelectedFrame(simulationState.allFrames[evt.frameIndex] || null);
                    }
                  }}
                />
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Packet Inspector Drawer */}
      <PacketInspector
        frame={selectedFrame}
        onClose={() => setSelectedFrame(null)}
      />

      {/* In-App Test Suite Verification Modal */}
      <TestRunnerModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </div>
  );
}
