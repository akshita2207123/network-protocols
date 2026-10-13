/**
 * Standard Computer Networks ARQ Protocol Engine
 * Standard-compliant implementations for:
 * 1. Go-Back-N ARQ (GBN)
 * 2. Selective Repeat ARQ (SR)
 * 3. Stop-and-Wait ARQ (SW)
 */

import {
  SimulationConfig,
  ProtocolState,
  Frame,
  InFlightFrame,
  AckPacket,
  InFlightAck,
  SimulationEvent,
  TransmissionRecord,
  AckConvention,
} from '../types/protocol';
import { PRNG } from './prng';

/**
 * Split text message into chunks
 */
export function chunkMessage(message: string, chunkSize: number): string[] {
  const clean = message.trim() || 'HELLO NETWORK';
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : ['DATA'];
}

/**
 * Modulo Sequence Number Arithmetic Helper Functions
 */

/**
 * Circular distance in sequence number space: (seq - base) mod 2^m
 * Returns integer in [0, seqSpace - 1]
 */
export function circularDistance(seq: number, base: number, seqSpace: number): number {
  return ((seq - base) % seqSpace + seqSpace) % seqSpace;
}

/**
 * Checks if seq falls within circular window [base, (base + windowSize - 1) mod seqSpace]
 */
export function isInWindow(seq: number, base: number, windowSize: number, seqSpace: number): boolean {
  if (windowSize <= 0) return false;
  const dist = circularDistance(seq, base, seqSpace);
  return dist < windowSize;
}

/**
 * Validates and clamps window size according to standard protocol constraints:
 * - Stop-and-Wait: N = 1
 * - Go-Back-N: 1 <= N <= 2^m - 1
 * - Selective Repeat: 1 <= N <= 2^(m-1)
 */
export function validateAndClampWindowSize(
  protocol: 'stop-and-wait' | 'go-back-n' | 'selective-repeat',
  requestedWindow: number,
  mBits: number
): number {
  const seqSpace = 1 << mBits;
  if (protocol === 'stop-and-wait') {
    return 1;
  }
  if (protocol === 'go-back-n') {
    const maxN = seqSpace - 1;
    return Math.max(1, Math.min(requestedWindow, maxN));
  }
  if (protocol === 'selective-repeat') {
    const maxN = 1 << (mBits - 1); // 2^(m-1)
    return Math.max(1, Math.min(requestedWindow, maxN));
  }
  return 1;
}

/**
 * Creates initial protocol state
 */
export function createInitialState(
  config: Partial<SimulationConfig> & {
    protocol: SimulationConfig['protocol'];
    message: string;
    frameChunkSize: number;
    windowSize: number;
  }
): ProtocolState {
  const mBits = config.mBits || 3;
  const seqSpace = 1 << mBits; // 2^m
  const windowSize = validateAndClampWindowSize(config.protocol, config.windowSize, mBits);
  const effectiveConfig: SimulationConfig = {
    ...config,
    mBits,
    windowSize,
    channelDelayTicks: config.channelDelayTicks ?? 1,
    timeoutTicks: config.timeoutTicks ?? 3,
    lossProbability: config.lossProbability ?? 0,
    corruptionProbability: config.corruptionProbability ?? 0,
    ackLossProbability: config.ackLossProbability ?? 0,
    seed: config.seed ?? 12345,
    ackConvention: config.ackConvention ?? 'acknowledged-frame',
  };

  const chunks = chunkMessage(effectiveConfig.message, effectiveConfig.frameChunkSize);
  const totalFramesCount = chunks.length;

  const allFrames: Frame[] = chunks.map((chunk, index) => ({
    id: `f-${index}-${Date.now()}`,
    index,
    seq: index % seqSpace,
    payload: chunk,
    attempt: 0,
    status: 'queued',
    isCorrupted: false,
    timer: effectiveConfig.timeoutTicks,
    maxTimer: effectiveConfig.timeoutTicks,
  }));

  const initialEvent: SimulationEvent = {
    id: `evt-init`,
    step: 0,
    timestamp: Date.now(),
    type: 'FRAME_CREATED',
    title: 'Simulation Ready',
    description: `Initialized ${effectiveConfig.protocol.toUpperCase()} with ${totalFramesCount} frames (m = ${mBits} bits, seqSpace = ${seqSpace}, Window N = ${windowSize}, ACK Mode: ${effectiveConfig.ackConvention === 'next-expected' ? 'Next Expected' : 'Frame Received'}).`,
    explanation:
      effectiveConfig.protocol === 'go-back-n'
        ? `Go-Back-N ARQ: Sender window N = ${windowSize} (N ≤ 2^m - 1 = ${seqSpace - 1}), Receiver window = 1. Sender transmits multiple packets up to window capacity without waiting for ACKs; on timeout, rewinds and retransmits all unacknowledged packets.`
        : effectiveConfig.protocol === 'selective-repeat'
        ? `Selective Repeat ARQ: Sender & Receiver window N = ${windowSize} (N ≤ 2^(m-1) = ${seqSpace / 2}). Sender transmits multiple packets in window; receiver buffers out-of-order packets; on timeout, only the specific missing packet is resent.`
        : `Stop-and-Wait ARQ: Window N = 1. Strictly alternating frame transmission and ACK receipt.`,
    severity: 'info',
  };

  return {
    config: effectiveConfig,
    step: 0,
    isCompleted: false,
    seqSpace,
    totalFramesCount,
    allFrames,
    sendBase: 0,
    sendBaseSeq: 0,
    nextSeqNumIndex: 0,
    nextSeqNum: 0,
    senderTimer: effectiveConfig.timeoutTicks,
    senderTimerRunning: false,
    rcvBase: 0,
    rcvBaseSeq: 0,
    deliveredFrames: new Array(totalFramesCount).fill(null),
    receiverBuffer: {},
    inFlightFrames: [],
    inFlightAcks: [],
    transmissionsHistory: [],
    events: [initialEvent],
    stats: {
      framesSent: 0,
      framesDelivered: 0,
      framesLost: 0,
      framesCorrupted: 0,
      acksSent: 0,
      acksReceived: 0,
      acksLost: 0,
      retransmissions: 0,
      timeouts: 0,
      totalSteps: 0,
      efficiency: 100,
    },
    currentEvent: initialEvent,
  };
}

/**
 * Deep clones state for step rollback & immutability
 */
export function cloneState(state: ProtocolState): ProtocolState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Advances simulation state by exactly ONE discrete time unit.
 * Implements pipelining, sliding windows, independent timers, and correct ACK values.
 */
export function stepSimulation(prevState: ProtocolState): ProtocolState {
  if (prevState.isCompleted) {
    return prevState;
  }

  const state = cloneState(prevState);
  state.step += 1;
  state.stats.totalSteps = state.step;

  const prng = new PRNG(state.config.seed + state.step * 17);
  const config = state.config;
  const protocol = config.protocol;
  const seqSpace = state.seqSpace;
  const N = config.windowSize;
  const ackConvention: AckConvention = config.ackConvention ?? 'acknowledged-frame';

  const stepEvents: SimulationEvent[] = [];

  // ===========================================================================
  // PHASE 1: Advance In-Flight ACKs towards Sender
  // ===========================================================================
  if (state.inFlightAcks.length > 0) {
    const survivingAcks: InFlightAck[] = [];
    const arrivedAcks: InFlightAck[] = [];

    for (const inFlight of state.inFlightAcks) {
      inFlight.ticksRemaining -= 1;
      inFlight.progress = Math.min(1.0, 1.0 - inFlight.ticksRemaining / Math.max(1, config.channelDelayTicks));

      if (inFlight.isLost && inFlight.progress >= 0.5) {
        state.stats.acksLost += 1;
        stepEvents.push({
          id: `evt-${state.step}-ack-lost-${inFlight.id}`,
          step: state.step,
          timestamp: Date.now(),
          type: 'ACK_LOST',
          title: `ACK ${inFlight.ack.ackNum} Lost in Return Channel`,
          description: `The ACK signal was dropped on the return path before reaching the sender.`,
          explanation: `Lost ACK: The sender will not receive this acknowledgement and its timer will eventually expire.`,
          ackNum: inFlight.ack.ackNum,
          severity: 'error',
        });
      } else if (inFlight.ticksRemaining <= 0) {
        arrivedAcks.push(inFlight);
      } else {
        survivingAcks.push(inFlight);
      }
    }

    state.inFlightAcks = survivingAcks;

    // Process arrived ACKs at sender
    for (const inFlight of arrivedAcks) {
      const ack = inFlight.ack;

      if (inFlight.isCorrupted) {
        stepEvents.push({
          id: `evt-${state.step}-ack-corrupt-${ack.id}`,
          step: state.step,
          timestamp: Date.now(),
          type: 'ACK_CORRUPTED',
          title: `ACK ${ack.ackNum} Arrived Corrupted`,
          description: `Sender detected bit error in ACK ${ack.ackNum} checksum and discarded it.`,
          explanation: `Corrupted ACK headers fail checksum validation and are ignored by sender logic.`,
          ackNum: ack.ackNum,
          severity: 'warning',
        });
        continue;
      }

      state.stats.acksReceived += 1;

      // 1A. Stop-and-Wait ACK handling
      if (protocol === 'stop-and-wait') {
        const isMatch = ackConvention === 'next-expected'
          ? (ack.ackNum === (state.sendBaseSeq + 1) % seqSpace || ack.ackNum === state.sendBaseSeq)
          : (ack.ackNum === state.sendBaseSeq || (ack.frameIndex !== undefined && ack.frameIndex === state.sendBase));

        if (isMatch) {
          if (state.allFrames[state.sendBase]) {
            state.allFrames[state.sendBase].status = 'acked';
          }
          const confirmedFrameIndex = state.sendBase;
          state.sendBase += 1;
          state.sendBaseSeq = state.sendBase % seqSpace;
          state.nextSeqNumIndex = state.sendBase;
          state.nextSeqNum = state.sendBaseSeq;
          state.senderTimerRunning = false;

          stepEvents.push({
            id: `evt-${state.step}-sw-ack`,
            step: state.step,
            timestamp: Date.now(),
            type: 'ACK_RECEIVED',
            title: `ACK ${ack.ackNum} Received (Frame ${confirmedFrameIndex} Confirmed)`,
            description: `Sender confirmed delivery of Frame ${confirmedFrameIndex}. Sliding window advanced to Frame ${state.sendBase}.`,
            explanation: `Stop-and-Wait: Frame ${confirmedFrameIndex} confirmed by receiver. Sender can now transmit the next frame.`,
            ackNum: ack.ackNum,
            severity: 'success',
          });
        }
      }

      // 1B. Go-Back-N Cumulative ACK handling
      else if (protocol === 'go-back-n') {
        const outstandingFramesCount = state.nextSeqNumIndex - state.sendBase;
        let dist = 0;

        if (ackConvention === 'next-expected') {
          // ackNum is next expected sequence number
          dist = circularDistance(ack.ackNum, state.sendBaseSeq, seqSpace);
        } else {
          // ackNum is sequence number of frame acknowledged (Kurose & Ross / Tanenbaum / Forouzan)
          dist = circularDistance(ack.ackNum, state.sendBaseSeq, seqSpace) + 1;
        }

        // Is this ACK acknowledging outstanding frames?
        if (dist > 0 && dist <= outstandingFramesCount) {
          const oldBaseIndex = state.sendBase;
          for (let i = oldBaseIndex; i < oldBaseIndex + dist; i++) {
            if (state.allFrames[i]) {
              state.allFrames[i].status = 'acked';
            }
          }
          state.sendBase += dist;
          state.sendBaseSeq = state.sendBase % seqSpace;

          // If sendBase == nextSeqNumIndex, no outstanding packets -> stop timer
          // Otherwise there are still outstanding packets -> restart base timer
          if (state.sendBase === state.nextSeqNumIndex) {
            state.senderTimerRunning = false;
          } else {
            state.senderTimer = config.timeoutTicks;
            state.senderTimerRunning = true;
          }

          stepEvents.push({
            id: `evt-${state.step}-gbn-ack`,
            step: state.step,
            timestamp: Date.now(),
            type: 'ACK_RECEIVED',
            title: `Cumulative ACK ${ack.ackNum} Received`,
            description: `Acknowledged ${dist} frame(s) up to seq ${ack.ackNum}. Sender base slid from ${oldBaseIndex} to ${state.sendBase}.`,
            explanation: `Go-Back-N Cumulative ACK: ACK ${ack.ackNum} confirms all frames up to sequence ${ack.ackNum}. Base timer restarted for Frame ${state.sendBase}.`,
            ackNum: ack.ackNum,
            severity: 'success',
          });
        } else {
          // Duplicate cumulative ACK (already acknowledged or duplicate notification)
          stepEvents.push({
            id: `evt-${state.step}-gbn-dup-ack`,
            step: state.step,
            timestamp: Date.now(),
            type: 'ACK_RECEIVED',
            title: `Duplicate ACK ${ack.ackNum} Received`,
            description: `Duplicate acknowledgment: Receiver has confirmed up to seq ${ack.ackNum} and is still waiting for missing frame.`,
            explanation: `Go-Back-N: Out-of-order packets at receiver generate duplicate cumulative ACKs.`,
            ackNum: ack.ackNum,
            severity: 'normal',
          });
        }
      }

      // 1C. Selective Repeat Individual ACK handling
      else if (protocol === 'selective-repeat') {
        // Find which unacknowledged frame in sender's window matches this ackNum or frameIndex
        let matchedIndex: number | null = null;
        for (let i = state.sendBase; i < state.sendBase + N && i < state.totalFramesCount; i++) {
          const f = state.allFrames[i];
          if (f && f.status !== 'acked') {
            if (ack.frameIndex !== undefined && ack.frameIndex === i) {
              matchedIndex = i;
              break;
            } else if (f.seq === ack.ackNum) {
              matchedIndex = i;
              break;
            }
          }
        }

        if (matchedIndex !== null) {
          state.allFrames[matchedIndex].status = 'acked';
          state.allFrames[matchedIndex].timer = 0; // Stop individual timer
          const oldBase = state.sendBase;

          // Slide window forward past all consecutively acknowledged frames
          while (state.sendBase < state.totalFramesCount && state.allFrames[state.sendBase]?.status === 'acked') {
            state.sendBase += 1;
            state.sendBaseSeq = state.sendBase % seqSpace;
          }

          stepEvents.push({
            id: `evt-${state.step}-sr-ack`,
            step: state.step,
            timestamp: Date.now(),
            type: 'ACK_RECEIVED',
            title: `Individual ACK ${ack.ackNum} Received (Frame ${matchedIndex} Confirmed)`,
            description: `Confirmed Frame ${matchedIndex} (seq ${ack.ackNum}). ${state.sendBase > oldBase ? `Window slid from ${oldBase} to ${state.sendBase}.` : 'Base holds.'}`,
            explanation: `Selective Repeat: Individual ACK confirms only Frame ${matchedIndex}. Sender stopped timer for Frame ${matchedIndex} without affecting other packets.`,
            ackNum: ack.ackNum,
            severity: 'success',
          });
        } else {
          stepEvents.push({
            id: `evt-${state.step}-sr-dup-ack`,
            step: state.step,
            timestamp: Date.now(),
            type: 'ACK_RECEIVED',
            title: `ACK ${ack.ackNum} Ignored (Already Acknowledged)`,
            description: `Sequence number ${ack.ackNum} is outside current sender window or was already confirmed.`,
            explanation: `Selective Repeat ignores duplicate ACKs for frames already delivered.`,
            ackNum: ack.ackNum,
            severity: 'normal',
          });
        }
      }
    }
  }

  // ===========================================================================
  // PHASE 2: Advance In-Flight Data Frames towards Receiver
  // ===========================================================================
  if (state.inFlightFrames.length > 0) {
    const survivingFrames: InFlightFrame[] = [];
    const arrivedFrames: InFlightFrame[] = [];

    for (const inFlight of state.inFlightFrames) {
      inFlight.ticksRemaining -= 1;
      inFlight.progress = Math.min(1.0, 1.0 - inFlight.ticksRemaining / Math.max(1, config.channelDelayTicks));

      if (inFlight.isLost && inFlight.progress >= 0.5) {
        inFlight.frame.status = 'lost';
        state.stats.framesLost += 1;

        stepEvents.push({
          id: `evt-${state.step}-f-lost-${inFlight.id}`,
          step: state.step,
          timestamp: Date.now(),
          type: 'FRAME_LOST',
          title: `Frame ${inFlight.frame.index} (seq ${inFlight.frame.seq}) Lost in Network`,
          description: `Packet was dropped by physical transmission loss before reaching receiver.`,
          explanation: `Frame Loss: The data packet failed to reach the receiver. Sender's timer will detect this absence.`,
          frameIndex: inFlight.frame.index,
          frameSeq: inFlight.frame.seq,
          severity: 'error',
        });
      } else if (inFlight.ticksRemaining <= 0) {
        arrivedFrames.push(inFlight);
      } else {
        survivingFrames.push(inFlight);
      }
    }

    state.inFlightFrames = survivingFrames;

    // Process arrived data frames at receiver
    for (const inFlight of arrivedFrames) {
      const frame = inFlight.frame;

      // Bit Error Corruption Check
      if (inFlight.isCorrupted) {
        frame.status = 'corrupted';
        state.stats.framesCorrupted += 1;

        stepEvents.push({
          id: `evt-${state.step}-f-corrupt-${frame.index}`,
          step: state.step,
          timestamp: Date.now(),
          type: 'FRAME_CORRUPTED',
          title: `Frame ${frame.index} Corrupted (CRC Checksum Error)`,
          description: `Checksum verification failed. Receiver discarded damaged packet.`,
          explanation: `Corrupted frames fail integrity validation and are silently discarded by receiver.`,
          frameIndex: frame.index,
          frameSeq: frame.seq,
          severity: 'warning',
        });

        // In GBN, receiver re-sends cumulative ACK for last successfully received in-order frame
        if (protocol === 'go-back-n' && state.rcvBase > 0) {
          const lastInOrderSeq = ackConvention === 'next-expected'
            ? state.rcvBaseSeq
            : (state.rcvBase - 1) % seqSpace;

          state.inFlightAcks.push({
            id: `ack-gbn-corrupt-reack-${state.step}`,
            ack: {
              id: `ack-${lastInOrderSeq}`,
              ackNum: lastInOrderSeq,
              frameIndex: state.rcvBase - 1,
              isCumulative: true,
              isNak: false,
              status: 'in_transit',
              isCorrupted: false,
            },
            progress: 0,
            ticksRemaining: config.channelDelayTicks,
            isLost: false,
            isCorrupted: false,
          });
        }
        continue;
      }

      // 2A. Stop-and-Wait Receiver
      if (protocol === 'stop-and-wait') {
        if (frame.index === state.rcvBase) {
          frame.status = 'delivered';
          state.deliveredFrames[frame.index] = frame;
          const deliveredSeq = frame.seq;
          state.rcvBase += 1;
          state.rcvBaseSeq = state.rcvBase % seqSpace;
          state.stats.framesDelivered += 1;

          // Compute ACK sequence number according to convention
          const ackNum = ackConvention === 'next-expected'
            ? state.rcvBaseSeq
            : deliveredSeq; // Standard: ACK 0 confirms Frame 0

          const ackLoss = (config.forcedLossAckSeqs?.includes(ackNum) || config.forcedLossAckSeqs?.includes(deliveredSeq))
            ?? prng.chance(config.ackLossProbability);

          state.inFlightAcks.push({
            id: `ack-inflight-${state.step}`,
            ack: {
              id: `ack-${ackNum}`,
              ackNum,
              frameIndex: frame.index,
              isCumulative: false,
              isNak: false,
              status: 'in_transit',
              isCorrupted: false,
            },
            progress: 0,
            ticksRemaining: config.channelDelayTicks,
            isLost: ackLoss,
            isCorrupted: false,
          });

          state.transmissionsHistory.push({
            id: `tx-sw-ack-${ackNum}-${state.step}`,
            step: state.step,
            type: 'ack',
            seq: ackNum,
            attempt: 1,
            isLost: ackLoss,
            isCorrupted: false,
            fromSender: false,
            label: `ACK ${ackNum}`,
          });

          stepEvents.push({
            id: `evt-${state.step}-sw-rx`,
            step: state.step,
            timestamp: Date.now(),
            type: 'FRAME_DELIVERED',
            title: `Frame ${frame.index} (seq ${deliveredSeq}) Delivered`,
            description: `Receiver accepted payload "${frame.payload}" and dispatched ACK ${ackNum} (confirming Frame ${frame.index}).`,
            explanation: `Stop-and-Wait: Frame ${frame.index} delivered in order. Receiver confirmed receipt with ACK ${ackNum}.`,
            frameIndex: frame.index,
            frameSeq: frame.seq,
            severity: 'success',
          });
        } else {
          // Duplicate frame arrived -> re-send ACK for this frame
          const ackNum = ackConvention === 'next-expected'
            ? state.rcvBaseSeq
            : frame.seq;

          state.inFlightAcks.push({
            id: `ack-dup-${state.step}`,
            ack: {
              id: `ack-${ackNum}`,
              ackNum,
              frameIndex: frame.index,
              isCumulative: false,
              isNak: false,
              status: 'in_transit',
              isCorrupted: false,
            },
            progress: 0,
            ticksRemaining: config.channelDelayTicks,
            isLost: false,
            isCorrupted: false,
          });
        }
      }

      // 2B. Go-Back-N Receiver (Window = 1, cumulative ACK)
      else if (protocol === 'go-back-n') {
        if (frame.index === state.rcvBase) {
          frame.status = 'delivered';
          state.deliveredFrames[frame.index] = frame;
          const deliveredSeq = frame.seq;
          state.rcvBase += 1;
          state.rcvBaseSeq = state.rcvBase % seqSpace;
          state.stats.framesDelivered += 1;

          // In standard Kurose & Ross / Tanenbaum / Forouzan:
          // ACK n confirms all packets up to and including sequence number n!
          // In next-expected mode: ACK n indicates next expected sequence number.
          const ackNum = ackConvention === 'next-expected'
            ? state.rcvBaseSeq
            : deliveredSeq;

          const ackLoss = (config.forcedLossAckSeqs?.includes(ackNum) || config.forcedLossAckSeqs?.includes(deliveredSeq))
            ?? prng.chance(config.ackLossProbability);

          state.inFlightAcks.push({
            id: `ack-gbn-${state.step}-${frame.index}`,
            ack: {
              id: `ack-${ackNum}`,
              ackNum,
              frameIndex: frame.index,
              isCumulative: true,
              isNak: false,
              status: 'in_transit',
              isCorrupted: false,
            },
            progress: 0,
            ticksRemaining: config.channelDelayTicks,
            isLost: ackLoss,
            isCorrupted: false,
          });

          state.transmissionsHistory.push({
            id: `tx-ack-${ackNum}-${state.step}`,
            step: state.step,
            type: 'ack',
            seq: ackNum,
            attempt: 1,
            isLost: ackLoss,
            isCorrupted: false,
            fromSender: false,
            label: `ACK ${ackNum}`,
          });

          stepEvents.push({
            id: `evt-${state.step}-gbn-rx-ok`,
            step: state.step,
            timestamp: Date.now(),
            type: 'FRAME_DELIVERED',
            title: `Frame ${frame.index} (seq ${frame.seq}) Accepted In-Order`,
            description: `Receiver delivered Frame ${frame.index} and sent cumulative ACK ${ackNum} (confirming up to Frame ${frame.index}).`,
            explanation: `Go-Back-N: Packet was strictly in-order. Receiver acknowledged receipt with cumulative ACK ${ackNum}.`,
            frameIndex: frame.index,
            frameSeq: frame.seq,
            severity: 'success',
          });
        } else {
          // OUT-OF-ORDER in Go-Back-N: MUST DISCARD
          frame.status = 'discarded';

          // Resend cumulative ACK for the last successfully received in-order frame (if any)
          let ackNum = 0;
          let shouldSendAck = false;
          if (ackConvention === 'next-expected') {
            ackNum = state.rcvBaseSeq;
            shouldSendAck = true;
          } else if (state.rcvBase > 0) {
            ackNum = (state.rcvBase - 1) % seqSpace;
            shouldSendAck = true;
          }

          if (shouldSendAck) {
            state.inFlightAcks.push({
              id: `ack-gbn-dup-${state.step}-${frame.index}`,
              ack: {
                id: `ack-${ackNum}`,
                ackNum,
                frameIndex: state.rcvBase > 0 ? state.rcvBase - 1 : 0,
                isCumulative: true,
                isNak: false,
                status: 'in_transit',
                isCorrupted: false,
              },
              progress: 0,
              ticksRemaining: config.channelDelayTicks,
              isLost: false,
              isCorrupted: false,
            });
          }

          state.transmissionsHistory.push({
            id: `tx-discard-${frame.index}-${state.step}`,
            step: state.step,
            type: 'data',
            seq: frame.seq,
            attempt: frame.attempt,
            isLost: false,
            isCorrupted: false,
            isDiscarded: true,
            fromSender: true,
            label: `Packet ${frame.seq} (Discarded ✕)`,
          });

          stepEvents.push({
            id: `evt-${state.step}-gbn-discard`,
            step: state.step,
            timestamp: Date.now(),
            type: 'FRAME_DISCARDED',
            title: `Frame ${frame.index} (seq ${frame.seq}) Discarded by Receiver ✕`,
            description: shouldSendAck
              ? `Expected sequence was ${state.rcvBaseSeq} (Frame ${state.rcvBase}). Out-of-order Frame was dropped! Resent duplicate ACK ${ackNum}.`
              : `Expected sequence was ${state.rcvBaseSeq} (Frame 0). Out-of-order Frame was dropped! Awaiting Frame 0 before sending ACK.`,
            explanation: `Go-Back-N Algorithm: Receiver window is strictly size 1 and cannot buffer out-of-order frames. It discarded Frame ${frame.index}.`,
            frameIndex: frame.index,
            frameSeq: frame.seq,
            severity: 'warning',
          });
        }
      }

      // 2C. Selective Repeat Receiver (Window = N, buffers valid out-of-order frames within window)
      else if (protocol === 'selective-repeat') {
        const frameIndexDiff = frame.index - state.rcvBase;
        const inWindow = frameIndexDiff >= 0 && frameIndexDiff < N;

        if (inWindow) {
          // Buffer frame if not already buffered
          frame.status = frame.index === state.rcvBase ? 'delivered' : 'buffered';
          state.receiverBuffer[frame.index] = frame;

          // Dispatch individual ACK for this frame's sequence number
          // In Selective Repeat, ACK n confirms Frame n directly!
          const ackNum = frame.seq;

          const ackLoss = (config.forcedLossAckSeqs?.includes(ackNum) || config.forcedLossAckSeqs?.includes(frame.index))
            ?? prng.chance(config.ackLossProbability);

          state.inFlightAcks.push({
            id: `ack-sr-${frame.index}-${state.step}`,
            ack: {
              id: `ack-${ackNum}`,
              ackNum,
              frameIndex: frame.index,
              isCumulative: false,
              isNak: false,
              status: 'in_transit',
              isCorrupted: false,
            },
            progress: 0,
            ticksRemaining: config.channelDelayTicks,
            isLost: ackLoss,
            isCorrupted: false,
          });

          state.transmissionsHistory.push({
            id: `tx-sr-ack-${ackNum}-${state.step}`,
            step: state.step,
            type: 'ack',
            seq: ackNum,
            attempt: 1,
            isLost: ackLoss,
            isCorrupted: false,
            fromSender: false,
            label: `ACK ${ackNum}`,
          });

          // If frame is rcvBase, deliver it and all contiguous buffered frames
          if (frame.index === state.rcvBase) {
            const deliveredIndices: number[] = [];
            while (state.receiverBuffer[state.rcvBase]) {
              const delivered = state.receiverBuffer[state.rcvBase];
              delivered.status = 'delivered';
              state.deliveredFrames[state.rcvBase] = delivered;
              state.stats.framesDelivered += 1;
              deliveredIndices.push(state.rcvBase);
              state.rcvBase += 1;
              state.rcvBaseSeq = state.rcvBase % seqSpace;
            }

            stepEvents.push({
              id: `evt-${state.step}-sr-deliver`,
              step: state.step,
              timestamp: Date.now(),
              type: 'FRAME_DELIVERED',
              title: `Delivered Frame(s) [${deliveredIndices.join(', ')}] to Application`,
              description: `Missing Frame ${frame.index} arrived. Sent ACK ${ackNum}. In-order sequence delivered. Receiver window slid to Frame ${state.rcvBase}.`,
              explanation: `Selective Repeat: Arrival of the missing base frame allowed delivering consecutive buffered packets in order.`,
              frameIndex: frame.index,
              frameSeq: frame.seq,
              severity: 'success',
            });
          } else {
            // Out-of-order but inside window: BUFFER IT!
            state.stats.framesDelivered += 1; // Counted towards received packets
            stepEvents.push({
              id: `evt-${state.step}-sr-buffered`,
              step: state.step,
              timestamp: Date.now(),
              type: 'FRAME_BUFFERED',
              title: `Frame ${frame.index} (seq ${frame.seq}) Buffered Out-of-Order`,
              description: `Receiver cached Frame ${frame.index} in buffer and dispatched individual ACK ${ackNum}.`,
              explanation: `Selective Repeat: Packet accepted within receiving window [${state.rcvBaseSeq}..${(state.rcvBaseSeq + N - 1) % seqSpace}]. Sent individual ACK ${ackNum}.`,
              frameIndex: frame.index,
              frameSeq: frame.seq,
              severity: 'success',
            });
          }
        } else if (frameIndexDiff < 0 && frameIndexDiff >= -N) {
          // Frame was already delivered (retransmitted due to lost ACK). Re-ACK it!
          const ackNum = frame.seq;
          state.inFlightAcks.push({
            id: `ack-sr-reack-${frame.index}-${state.step}`,
            ack: {
              id: `ack-${ackNum}`,
              ackNum,
              frameIndex: frame.index,
              isCumulative: false,
              isNak: false,
              status: 'in_transit',
              isCorrupted: false,
            },
            progress: 0,
            ticksRemaining: config.channelDelayTicks,
            isLost: false,
            isCorrupted: false,
          });

          stepEvents.push({
            id: `evt-${state.step}-sr-reack`,
            step: state.step,
            timestamp: Date.now(),
            type: 'ACK_SENT',
            title: `Duplicate Frame ${frame.index} Re-Acknowledged`,
            description: `Receiver previously delivered this frame. Re-sent ACK ${ackNum} to help sender advance window.`,
            explanation: `Selective Repeat: Duplicate frame within previous window is re-acknowledged to stop sender retransmissions.`,
            frameIndex: frame.index,
            frameSeq: frame.seq,
            severity: 'info',
          });
        } else {
          // Outside window -> discard
          stepEvents.push({
            id: `evt-${state.step}-sr-discard`,
            step: state.step,
            timestamp: Date.now(),
            type: 'FRAME_DISCARDED',
            title: `Frame ${frame.index} Discarded (Outside Window)`,
            description: `Sequence number ${frame.seq} falls outside receiving window [${state.rcvBaseSeq} ... ${(state.rcvBaseSeq + N - 1) % seqSpace}].`,
            explanation: `Selective Repeat: Discarding frame falling outside valid window boundaries.`,
            frameIndex: frame.index,
            frameSeq: frame.seq,
            severity: 'warning',
          });
        }
      }
    }
  }

  // ===========================================================================
  // PHASE 3: Timers and Timeouts
  // ===========================================================================
  let triggeredTimeout = false;

  // 3A. Go-Back-N Timeout Handling (Single timer for oldest unacknowledged frame: sendBase)
  if (protocol === 'go-back-n' && state.senderTimerRunning && state.sendBase < state.nextSeqNumIndex) {
    state.senderTimer -= 1;

    if (state.senderTimer <= 0) {
      triggeredTimeout = true;
      state.stats.timeouts += 1;
      state.senderTimer = config.timeoutTicks;
      state.senderTimerRunning = true;

      // Retransmit missing frame AND ALL subsequent unacknowledged frames in current window!
      const retransmitFrames: Frame[] = [];
      for (let i = state.sendBase; i < state.nextSeqNumIndex; i++) {
        const f = state.allFrames[i];
        if (f && f.status !== 'acked') {
          f.attempt += 1;
          f.status = 'in_transit';
          f.timer = config.timeoutTicks;
          retransmitFrames.push(f);
        }
      }

      for (let i = 0; i < retransmitFrames.length; i++) {
        const f = retransmitFrames[i];
        state.inFlightFrames.push({
          id: `inflight-gbn-retransmit-${f.index}-${state.step}-${i}`,
          frame: f,
          progress: 0,
          ticksRemaining: config.channelDelayTicks,
          isLost: false, // Ensure deterministic retransmission succeeds
          isCorrupted: false,
        });

        state.transmissionsHistory.push({
          id: `tx-gbn-retx-${f.index}-${state.step}`,
          step: state.step,
          type: 'data',
          seq: f.seq,
          attempt: f.attempt,
          isLost: false,
          isCorrupted: false,
          fromSender: true,
          label: `Packet ${f.seq} (Retransmit #${f.attempt})`,
          windowSnapshot: {
            sendBaseSeq: state.sendBaseSeq,
            windowSize: N,
          },
        });
      }

      state.stats.framesSent += retransmitFrames.length;
      state.stats.retransmissions += retransmitFrames.length;

      const seqNames = retransmitFrames.map((f) => `F${f.index}(seq ${f.seq})`).join(', ');
      stepEvents.push({
        id: `evt-${state.step}-gbn-timeout`,
        step: state.step,
        timestamp: Date.now(),
        type: 'TIMEOUT',
        title: `Go-Back-N Timeout! Retransmitted [${seqNames}]`,
        description: `Timer expired for Frame ${state.sendBase}. Retransmitted missing frame and ALL subsequent frames in window!`,
        explanation: `Go-Back-N Algorithm: When the base timer expires, sender rewinds and retransmits all unacknowledged packets currently outstanding in the window.`,
        frameIndex: state.sendBase,
        frameSeq: state.sendBaseSeq,
        severity: 'warning',
      });
    }
  }

  // 3B. Selective Repeat Timeout Handling (Individual timer for each unacknowledged frame)
  else if (protocol === 'selective-repeat') {
    const timedOutIndices: number[] = [];

    for (let i = state.sendBase; i < state.nextSeqNumIndex; i++) {
      const f = state.allFrames[i];
      if (f && f.attempt > 0 && f.status !== 'acked') {
        f.timer -= 1;
        if (f.timer <= 0) {
          timedOutIndices.push(i);
        }
      }
    }

    if (timedOutIndices.length > 0) {
      triggeredTimeout = true;
      for (const idx of timedOutIndices) {
        state.stats.timeouts += 1;
        const missingFrame = state.allFrames[idx];
        missingFrame.attempt += 1;
        missingFrame.status = 'in_transit';
        missingFrame.timer = config.timeoutTicks;

        state.inFlightFrames.push({
          id: `inflight-sr-retx-${missingFrame.index}-${state.step}`,
          frame: missingFrame,
          progress: 0,
          ticksRemaining: config.channelDelayTicks,
          isLost: false,
          isCorrupted: false,
        });

        state.stats.framesSent += 1;
        state.stats.retransmissions += 1;

        state.transmissionsHistory.push({
          id: `tx-sr-retx-${missingFrame.index}-${state.step}`,
          step: state.step,
          type: 'data',
          seq: missingFrame.seq,
          attempt: missingFrame.attempt,
          isLost: false,
          isCorrupted: false,
          fromSender: true,
          label: `Packet ${missingFrame.seq} (Retransmit #${missingFrame.attempt})`,
          windowSnapshot: {
            sendBaseSeq: state.sendBaseSeq,
            windowSize: N,
          },
        });
      }

      const resendNames = timedOutIndices.map((i) => `F${state.allFrames[i].index}(seq ${state.allFrames[i].seq})`).join(', ');
      stepEvents.push({
        id: `evt-${state.step}-sr-timeout`,
        step: state.step,
        timestamp: Date.now(),
        type: 'TIMEOUT',
        title: `Selective Repeat Timeout: Resending ONLY [${resendNames}]`,
        description: `Timer expired for unacknowledged frame(s). Retransmitted ONLY missing frame(s); buffered frames are kept safe.`,
        explanation: `Selective Repeat Algorithm: Because other frames are safely buffered at the receiver, only the specific unacknowledged frame whose timer expired is resent.`,
        severity: 'warning',
      });
    }
  }

  // 3C. Stop-and-Wait Timeout Handling
  else if (protocol === 'stop-and-wait') {
    const baseFrame = state.allFrames[state.sendBase];
    if (baseFrame && baseFrame.attempt > 0 && baseFrame.status !== 'acked') {
      baseFrame.timer -= 1;
      if (baseFrame.timer <= 0) {
        triggeredTimeout = true;
        state.stats.timeouts += 1;
        baseFrame.attempt += 1;
        baseFrame.status = 'in_transit';
        baseFrame.timer = config.timeoutTicks;

        state.inFlightFrames.push({
          id: `inflight-sw-retx-${baseFrame.index}-${state.step}`,
          frame: baseFrame,
          progress: 0,
          ticksRemaining: config.channelDelayTicks,
          isLost: false,
          isCorrupted: false,
        });

        state.stats.framesSent += 1;
        state.stats.retransmissions += 1;

        stepEvents.push({
          id: `evt-${state.step}-sw-timeout`,
          step: state.step,
          timestamp: Date.now(),
          type: 'TIMEOUT',
          title: `Timeout on Frame ${baseFrame.index}: Resending`,
          description: `Allowed ACK window elapsed. Retransmitting Frame ${baseFrame.index} (Attempt #${baseFrame.attempt}).`,
          explanation: `Stop-and-Wait: Frame retransmitted after timeout.`,
          frameIndex: baseFrame.index,
          frameSeq: baseFrame.seq,
          severity: 'warning',
        });
      }
    }
  }

  // ===========================================================================
  // PHASE 4: Pipelined Transmission of New Frames into Sliding Window
  // ===========================================================================
  if (!triggeredTimeout) {
    const newlySentFrames: Frame[] = [];

    // Transmit all available frames up to window capacity N
    while (state.nextSeqNumIndex < state.sendBase + N && state.nextSeqNumIndex < state.totalFramesCount) {
      const frameIndex = state.nextSeqNumIndex;
      const frame = state.allFrames[frameIndex];
      frame.attempt = 1;
      frame.status = 'in_transit';
      frame.timer = config.timeoutTicks;

      // Start base timer in GBN if not running
      if (protocol === 'go-back-n' && !state.senderTimerRunning) {
        state.senderTimer = config.timeoutTicks;
        state.senderTimerRunning = true;
      }

      // Determine loss & corruption using PRNG or deterministic test overrides
      const isLost = config.forcedLossFrameIndices?.includes(frameIndex) ?? prng.chance(config.lossProbability);
      const isCorrupted = !isLost && (config.forcedCorruptFrameIndices?.includes(frameIndex) ?? prng.chance(config.corruptionProbability));

      state.inFlightFrames.push({
        id: `inflight-${frameIndex}-${state.step}-${Date.now()}`,
        frame,
        progress: 0,
        ticksRemaining: config.channelDelayTicks,
        isLost,
        isCorrupted,
      });

      state.stats.framesSent += 1;
      state.nextSeqNumIndex += 1;
      state.nextSeqNum = state.nextSeqNumIndex % seqSpace;

      state.transmissionsHistory.push({
        id: `tx-data-${frameIndex}-${state.step}`,
        step: state.step,
        type: 'data',
        seq: frame.seq,
        attempt: 1,
        isLost,
        isCorrupted,
        fromSender: true,
        label: `Packet ${frame.seq}${isLost ? ' (Lost ✕)' : isCorrupted ? ' (Corrupt)' : ''}`,
        windowSnapshot: {
          sendBaseSeq: state.sendBaseSeq,
          windowSize: N,
        },
      });

      newlySentFrames.push(frame);
    }

    if (newlySentFrames.length > 0) {
      const frameNames = newlySentFrames.map((f) => `F${f.index}(seq ${f.seq})`).join(', ');
      stepEvents.push({
        id: `evt-${state.step}-send-burst`,
        step: state.step,
        timestamp: Date.now(),
        type: 'FRAME_SENT',
        title: newlySentFrames.length === 1
          ? `Transmitted Frame ${newlySentFrames[0].index} (seq ${newlySentFrames[0].seq})`
          : `Transmitted Window Burst: [${frameNames}]`,
        description: `Dispatched ${newlySentFrames.length} packet(s) into sliding window [${state.sendBaseSeq} ... ${(state.sendBaseSeq + N - 1) % seqSpace}].`,
        explanation: protocol === 'stop-and-wait'
          ? `Stop-and-Wait: Frame transmitted. Waiting for individual ACK.`
          : `${protocol === 'selective-repeat' ? 'Selective Repeat' : 'Go-Back-N'}: Sender transmitted multiple packets up to window capacity N = ${N} without waiting for individual ACKs.`,
        severity: 'normal',
      });
    } else {
      // Window is full or all frames sent
      const allDelivered = state.sendBase >= state.totalFramesCount;
      if (!allDelivered && state.nextSeqNumIndex >= state.sendBase + N) {
        stepEvents.push({
          id: `evt-${state.step}-win-full`,
          step: state.step,
          timestamp: Date.now(),
          type: 'FRAME_IN_TRANSIT',
          title: `Sender Window Full [${state.sendBaseSeq} ... ${(state.sendBaseSeq + N - 1) % seqSpace}]`,
          description: `Window is occupied with ${state.nextSeqNumIndex - state.sendBase} unacknowledged packets. Waiting for ACKs or timer expiration.`,
          explanation: `Flow control: Sender cannot transmit further packets until current window advances.`,
          severity: 'info',
        });
      }
    }
  }

  // ===========================================================================
  // PHASE 5: Completion Check & Event Aggregation
  // ===========================================================================
  if (state.sendBase >= state.totalFramesCount && state.inFlightFrames.length === 0 && state.inFlightAcks.length === 0) {
    state.isCompleted = true;
    stepEvents.push({
      id: `evt-${state.step}-done`,
      step: state.step,
      timestamp: Date.now(),
      type: 'SIMULATION_COMPLETE',
      title: 'All Data Successfully Delivered & Confirmed',
      description: `All ${state.totalFramesCount} frames reached the destination in order.`,
      explanation: `Simulation complete: End-to-end reliable transmission achieved with zero data loss or corruption.`,
      severity: 'success',
    });
  }

  // Update channel efficiency metrics
  const uniqueDelivered = state.deliveredFrames.filter(Boolean).length;
  state.stats.efficiency = state.stats.framesSent > 0
    ? Math.round((uniqueDelivered / state.stats.framesSent) * 100)
    : 100;

  // Add all generated events to timeline
  for (const evt of stepEvents) {
    state.events.unshift(evt);
  }

  // Pick primary event for current banner display (Timeout > Error > Delivery > Sent)
  if (stepEvents.length > 0) {
    const priorityOrder = ['TIMEOUT', 'FRAME_DISCARDED', 'FRAME_LOST', 'FRAME_CORRUPTED', 'SIMULATION_COMPLETE', 'FRAME_DELIVERED', 'FRAME_BUFFERED', 'ACK_RECEIVED', 'FRAME_SENT', 'FRAME_IN_TRANSIT'];
    stepEvents.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.type);
      const idxB = priorityOrder.indexOf(b.type);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
    state.currentEvent = stepEvents[0];
  }

  return state;
}
