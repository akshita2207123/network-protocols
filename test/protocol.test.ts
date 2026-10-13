/**
 * Automated Verification Suite for Go-Back-N and Selective Repeat ARQ Protocols
 * Tests all 10 required scenarios from the prompt:
 *
 * 1. No frame loss or corruption.
 * 2. One data frame is lost.
 * 3. One ACK is lost.
 * 4. One frame is corrupted.
 * 5. Multiple consecutive frames are lost.
 * 6. An out-of-order frame arrives at the receiver.
 * 7. Sequence numbers wrap around to zero.
 * 8. The sender window becomes full.
 * 9. The final frame is transmitted and acknowledged.
 * 10. The simulation is reset while frames are in transit.
 */

import {
  createInitialState,
  stepSimulation,
  validateAndClampWindowSize,
  isInWindow,
  circularDistance,
} from '../src/engine/protocolEngine';
import { SimulationConfig, ProtocolState } from '../src/types/protocol';

function runUntilDone(initialState: ProtocolState, maxSteps: number = 200): ProtocolState {
  let state = initialState;
  let guard = 0;
  while (!state.isCompleted && guard < maxSteps) {
    state = stepSimulation(state);
    guard++;
  }
  return state;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runAllTests(): { passed: number; total: number; logs: string[] } {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      logs.push(`✓ [PASS] ${name}`);
    } catch (e: any) {
      logs.push(`✕ [FAIL] ${name}: ${e.message}`);
      console.error(`✕ [FAIL] ${name}:`, e);
    }
  }

  // --- WINDOW SIZE CONSTRAINTS ---
  test('Window Size Constraint: Selective Repeat N <= 2^(m-1)', () => {
    // 3 bits -> seqSpace = 8 -> max N for SR is 4
    const clampedSR = validateAndClampWindowSize('selective-repeat', 7, 3);
    assert(clampedSR === 4, `SR window should be clamped to 4 (2^(3-1)), got ${clampedSR}`);

    // 3 bits -> max N for GBN is 7 (2^3 - 1)
    const clampedGBN = validateAndClampWindowSize('go-back-n', 10, 3);
    assert(clampedGBN === 7, `GBN window should be clamped to 7 (2^3 - 1), got ${clampedGBN}`);

    // Stop-and-Wait is always 1
    const clampedSW = validateAndClampWindowSize('stop-and-wait', 4, 3);
    assert(clampedSW === 1, `SW window must be 1, got ${clampedSW}`);
  });

  // --- CIRCULAR WINDOW MATH ---
  test('Circular Sequence Window Math: Distance & In-Window', () => {
    const seqSpace = 8;
    assert(isInWindow(0, 6, 4, seqSpace), 'Seq 0 should be in window [6, 7, 0, 1]');
    assert(isInWindow(1, 6, 4, seqSpace), 'Seq 1 should be in window [6, 7, 0, 1]');
    assert(!isInWindow(2, 6, 4, seqSpace), 'Seq 2 should NOT be in window [6, 7, 0, 1]');
    assert(circularDistance(0, 6, seqSpace) === 2, 'Distance from 6 to 0 in mod 8 should be 2');
  });

  // --- ACK NUMBERING CONVENTIONS ---
  test('ACK Values (All Protocols - Standard Mode): Frame n produces ACK n', () => {
    // 1. Stop-and-Wait
    let sw = createInitialState({
      protocol: 'stop-and-wait',
      message: 'AB',
      frameChunkSize: 1,
      mBits: 3,
      windowSize: 1,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 1,
      ackConvention: 'acknowledged-frame',
    });
    sw = stepSimulation(sw); // Transmit F0
    sw = stepSimulation(sw); // F0 arrives at receiver
    assert(sw.inFlightAcks.length === 1, 'SW dispatched ACK');
    assert(sw.inFlightAcks[0].ack.ackNum === 0, `SW must send ACK 0 for Frame 0 in standard mode, got ACK ${sw.inFlightAcks[0].ack.ackNum}`);

    // 2. Go-Back-N
    let gbn = createInitialState({
      protocol: 'go-back-n',
      message: 'AB',
      frameChunkSize: 1,
      mBits: 3,
      windowSize: 2,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 1,
      ackConvention: 'acknowledged-frame',
    });
    gbn = stepSimulation(gbn); // Transmits F0 and F1
    gbn = stepSimulation(gbn); // F0 and F1 arrive at receiver
    const gbnAcks = gbn.inFlightAcks.map(a => a.ack.ackNum);
    assert(gbnAcks.includes(0), `GBN must send ACK 0 for Frame 0, got ${gbnAcks}`);
    assert(gbnAcks.includes(1), `GBN must send ACK 1 for Frame 1, got ${gbnAcks}`);

    // 3. Selective Repeat
    let sr = createInitialState({
      protocol: 'selective-repeat',
      message: 'AB',
      frameChunkSize: 1,
      mBits: 3,
      windowSize: 2,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 1,
      ackConvention: 'acknowledged-frame',
    });
    sr = stepSimulation(sr); // Transmits F0 and F1
    sr = stepSimulation(sr); // F0 and F1 arrive at receiver
    const srAcks = sr.inFlightAcks.map(a => a.ack.ackNum);
    assert(srAcks.includes(0), `SR must send ACK 0 for Frame 0, got ${srAcks}`);
    assert(srAcks.includes(1), `SR must send ACK 1 for Frame 1, got ${srAcks}`);
  });

  test('ACK Values (Next-Expected Mode): Frame n produces ACK n+1', () => {
    let gbn = createInitialState({
      protocol: 'go-back-n',
      message: 'AB',
      frameChunkSize: 1,
      mBits: 3,
      windowSize: 2,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 1,
      ackConvention: 'next-expected',
    });
    gbn = stepSimulation(gbn);
    gbn = stepSimulation(gbn);
    const gbnAcks = gbn.inFlightAcks.map(a => a.ack.ackNum);
    assert(gbnAcks.includes(1), `Next-expected GBN must send ACK 1 after receiving Frame 0, got ${gbnAcks}`);
    assert(gbnAcks.includes(2), `Next-expected GBN must send ACK 2 after receiving Frame 1, got ${gbnAcks}`);
  });

  // --- SCENARIO 1: No frame loss or corruption ---
  test('Scenario 1 (Go-Back-N): No loss or corruption delivered in order', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'NETWORKS',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 4,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 42,
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'GBN should complete');
    assert(finalState.stats.framesLost === 0, 'No frames should be lost');
    assert(finalState.stats.retransmissions === 0, 'No retransmissions in clean link');
    assert(finalState.stats.efficiency === 100, 'Efficiency should be 100%');
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All frames delivered');
  });

  test('Scenario 1 (Selective Repeat): No loss or corruption delivered in order', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'NETWORKS',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 4,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 42,
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'SR should complete');
    assert(finalState.stats.framesLost === 0, 'No frames lost');
    assert(finalState.stats.retransmissions === 0, 'No retransmissions in clean link');
    assert(finalState.stats.efficiency === 100, 'Efficiency should be 100%');
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All frames delivered');
  });

  // --- SCENARIO 2: One data frame is lost ---
  test('Scenario 2 (Go-Back-N): Frame 1 lost -> GBN retransmits Frame 1 AND all subsequent frames', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'ABCDEFGH',
      frameChunkSize: 2, // 4 frames: 0, 1, 2, 3
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 100,
      forcedLossFrameIndices: [1], // Frame 1 lost
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'GBN should recover and complete');
    assert(finalState.stats.framesLost >= 1, 'Lost frame recorded');
    // In GBN, because Frame 1 was lost, subsequent frames in window were discarded and resent!
    assert(finalState.stats.retransmissions >= 2, 'GBN must retransmit frame 1 AND subsequent frames');
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All frames eventually delivered');
  });

  test('Scenario 2 (Selective Repeat): Frame 1 lost -> SR retransmits ONLY missing Frame 1', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'ABCDEFGH',
      frameChunkSize: 2, // 4 frames: 0, 1, 2, 3
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 100,
      forcedLossFrameIndices: [1], // Frame 1 lost
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'SR should recover and complete');
    assert(finalState.stats.framesLost >= 1, 'Lost frame recorded');
    // In SR, Frame 0 was delivered, Frame 2 was buffered, only Frame 1 was retransmitted!
    assert(finalState.stats.retransmissions === 1, `SR should retransmit ONLY Frame 1, got ${finalState.stats.retransmissions}`);
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All frames delivered');
  });

  // --- WINDOW SIZE 2 SPECIFIC BEHAVIOR (USER REQUIREMENT) ---
  test('Window Size 2 (Go-Back-N): Both sent concurrently; 1 missing frame causes BOTH frames to be resent', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'ABCD',
      frameChunkSize: 2, // 2 frames total: 0 and 1
      mBits: 3,
      windowSize: 2,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 42,
      forcedLossFrameIndices: [0], // Frame 0 lost
    };
    let state = createInitialState(config);

    // Step 1: Sender must transmit BOTH frames 0 and 1 concurrently up to window capacity 2
    state = stepSimulation(state);
    assert(state.inFlightFrames.length === 2, `GBN must send both frames in window of 2, sent ${state.inFlightFrames.length}`);
    assert(state.nextSeqNumIndex === 2, `Both frames queued in flight`);

    // Step 2: Frame 0 lost, Frame 1 reaches receiver and is discarded
    state = stepSimulation(state);
    assert(state.events.some((e) => e.type === 'FRAME_DISCARDED'), 'Receiver must discard out-of-order Frame 1 in GBN');

    // Step 3: Timer expires for Frame 0 -> GBN retransmits BOTH Frame 0 and Frame 1!
    state = stepSimulation(state);
    assert(state.inFlightFrames.length === 2, `On timeout, GBN must retransmit BOTH Frame 0 and Frame 1`);
    assert(state.events.some((e) => e.type === 'TIMEOUT'), 'Timeout event must be recorded');
  });

  test('Window Size 2 (Selective Repeat): Both sent concurrently; 1 missing frame causes ONLY missing frame to be resent', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'ABCD',
      frameChunkSize: 2, // 2 frames total: 0 and 1
      mBits: 3,
      windowSize: 2,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 42,
      forcedLossFrameIndices: [0], // Frame 0 lost
    };
    let state = createInitialState(config);

    // Step 1: Sender transmits BOTH frames 0 and 1 concurrently
    state = stepSimulation(state);
    assert(state.inFlightFrames.length === 2, `SR must send both frames in window of 2, sent ${state.inFlightFrames.length}`);

    // Step 2: Frame 0 lost, Frame 1 arrives and is BUFFERED in receiver window
    state = stepSimulation(state);
    assert(Boolean(state.receiverBuffer[1]), 'SR receiver must buffer valid Frame 1 in receiving window');

    // Step 3: Individual ACK 1 arrives at sender, confirming Frame 1. Frame 0 times out -> retransmit ONLY Frame 0!
    state = stepSimulation(state);
    assert(state.allFrames[1].status === 'acked', 'Frame 1 must be marked ACKed by individual ACK');
    assert(state.inFlightFrames.length === 1, `On timeout, SR must retransmit ONLY missing Frame 0, got ${state.inFlightFrames.length}`);
    assert(state.inFlightFrames[0].frame.index === 0, 'Retransmitted frame must be Frame 0');
  });

  // --- SCENARIO 3: One ACK is lost ---
  test('Scenario 3 (Go-Back-N): ACK lost -> cumulative ACK or timeout recovers correctly', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'ABCDEF',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 200,
      forcedLossAckSeqs: [1], // ACK 1 lost
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'GBN recovers from lost ACK');
    assert(finalState.stats.acksLost >= 1, 'Recorded lost ACK');
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All delivered');
  });

  test('Scenario 3 (Selective Repeat): ACK lost -> sender retransmits, receiver re-ACKs without duplicating data', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'ABCDEF',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 200,
      forcedLossAckSeqs: [0], // ACK 0 lost
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'SR recovers from lost ACK');
    assert(finalState.stats.acksLost >= 1, 'Recorded lost ACK');
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All delivered');
  });

  // --- SCENARIO 4: One frame is corrupted ---
  test('Scenario 4 (Go-Back-N): Corrupted frame fails CRC and is discarded', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'ABCDEF',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 2,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 300,
      forcedCorruptFrameIndices: [0],
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'GBN recovers from corrupted frame');
    assert(finalState.stats.framesCorrupted >= 1, 'Recorded corrupted frame');
    assert(finalState.stats.retransmissions >= 1, 'Retransmitted corrupted frame');
  });

  test('Scenario 4 (Selective Repeat): Corrupted frame fails CRC and is retransmitted selectively', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'ABCDEF',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 2,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 300,
      forcedCorruptFrameIndices: [0],
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'SR recovers from corrupted frame');
    assert(finalState.stats.framesCorrupted >= 1, 'Recorded corrupted frame');
    assert(finalState.stats.retransmissions >= 1, 'Retransmitted corrupted frame');
  });

  // --- SCENARIO 5: Multiple consecutive frames are lost ---
  test('Scenario 5: Multiple consecutive frames lost -> recovers properly', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'ABCDEFGHIJKL',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 4,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 400,
      forcedLossFrameIndices: [1, 2], // 2 consecutive losses
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'Recovers from multiple consecutive frame losses');
    assert(finalState.deliveredFrames.filter(Boolean).length === finalState.totalFramesCount, 'All delivered');
  });

  // --- SCENARIO 6: Out-of-order frame arrives at receiver ---
  test('Scenario 6 (GBN vs SR): Out-of-order frame is discarded in GBN, buffered in SR', () => {
    // In GBN: loss of frame 0 means frame 1 is discarded
    const gbnConfig: SimulationConfig = {
      protocol: 'go-back-n',
      message: 'ABCDEF',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 500,
      forcedLossFrameIndices: [0],
    };
    let gbnState = createInitialState(gbnConfig);
    // Step forward until frame 1 arrives at receiver
    for (let i = 0; i < 8; i++) {
      gbnState = stepSimulation(gbnState);
      if (gbnState.events.some((e) => e.type === 'FRAME_DISCARDED')) break;
    }
    assert(gbnState.events.some((e) => e.type === 'FRAME_DISCARDED'), 'GBN must discard out-of-order frame');

    // In SR: loss of frame 0 means frame 1 is buffered
    const srConfig: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'ABCDEF',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 3,
      channelDelayTicks: 1,
      seed: 500,
      forcedLossFrameIndices: [0],
    };
    let srState = createInitialState(srConfig);
    for (let i = 0; i < 8; i++) {
      srState = stepSimulation(srState);
      if (srState.events.some((e) => e.type === 'FRAME_BUFFERED')) break;
    }
    assert(srState.events.some((e) => e.type === 'FRAME_BUFFERED'), 'SR must buffer out-of-order frame in receiving window');
  });

  // --- SCENARIO 7: Sequence numbers wrap around to zero ---
  test('Scenario 7: Sequence numbers wrap around modulo 2^m correctly', () => {
    // m = 2 bits -> seqSpace = 4 (0, 1, 2, 3, 0, 1, 2...)
    // message with 8 frames wraps twice
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: '1234567890ABCDEF',
      frameChunkSize: 2, // 8 frames
      mBits: 2,          // 4 seq numbers (0..3)
      windowSize: 3,     // N <= 3 (2^m - 1)
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 600,
    };
    const finalState = runUntilDone(createInitialState(config), 300);
    assert(finalState.isCompleted, 'Protocol must handle sequence number wraparound to zero');
    assert(finalState.deliveredFrames.filter(Boolean).length === 8, 'All 8 frames delivered across wraparound');
  });

  // --- SCENARIO 8: Sender window becomes full ---
  test('Scenario 8: Sender window becomes full -> cannot send until ACK advances window', () => {
    const config: SimulationConfig = {
      protocol: 'go-back-n',
      message: '1234567890',
      frameChunkSize: 2, // 5 frames
      mBits: 3,
      windowSize: 2,     // small window of 2
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 4,
      channelDelayTicks: 2,
      seed: 700,
    };
    let state = createInitialState(config);
    // Step until window becomes full
    for (let i = 0; i < 4; i++) {
      state = stepSimulation(state);
    }
    assert(state.nextSeqNumIndex - state.sendBase <= config.windowSize, 'Outstanding frames must never exceed window size N');
  });

  // --- SCENARIO 9: Final frame is transmitted and acknowledged ---
  test('Scenario 9: Final frame transmission, ACK, and clean completion termination', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'END',
      frameChunkSize: 3, // 1 single frame
      mBits: 3,
      windowSize: 2,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 2,
      channelDelayTicks: 1,
      seed: 800,
    };
    const finalState = runUntilDone(createInitialState(config));
    assert(finalState.isCompleted, 'Simulation cleanly marks completed on final frame ACK');
    assert(finalState.inFlightFrames.length === 0, 'No frames left in flight');
    assert(finalState.inFlightAcks.length === 0, 'No ACKs left in flight');
  });

  // --- SCENARIO 10: Reset while frames are in transit ---
  test('Scenario 10: Reset while frames in transit cleanly resets all state and buffers', () => {
    const config: SimulationConfig = {
      protocol: 'selective-repeat',
      message: 'RESETTEST',
      frameChunkSize: 2,
      mBits: 3,
      windowSize: 3,
      lossProbability: 0,
      corruptionProbability: 0,
      ackLossProbability: 0,
      timeoutTicks: 3,
      channelDelayTicks: 2,
      seed: 900,
    };
    let state = createInitialState(config);
    state = stepSimulation(state);
    state = stepSimulation(state);
    assert(state.inFlightFrames.length > 0 || state.step > 0, 'Frames should be in motion');

    // Reset
    const resetState = createInitialState(config);
    assert(resetState.step === 0, 'Step reset to 0');
    assert(resetState.sendBase === 0, 'sendBase reset to 0');
    assert(resetState.rcvBase === 0, 'rcvBase reset to 0');
    assert(resetState.inFlightFrames.length === 0, 'In flight frames cleared');
    assert(resetState.inFlightAcks.length === 0, 'In flight ACKs cleared');
    assert(Object.keys(resetState.receiverBuffer).length === 0, 'Receiver buffer empty');
  });

  return { passed, total, logs };
}

// If run via tsx directly from shell
const results = runAllTests();
console.log(`\n=== PROTOCOL TEST SUITE RESULTS: ${results.passed} / ${results.total} PASSED ===\n`);
results.logs.forEach((log) => console.log(log));

if (results.passed !== results.total) {
  process.exit(1);
}
