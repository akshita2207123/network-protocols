/**
 * Network Protocol Simulator - Type Definitions
 * Fully compliant with standard Computer Networks ARQ specifications.
 */

export type ProtocolType = 'stop-and-wait' | 'go-back-n' | 'selective-repeat';

export type FrameStatus =
  | 'queued'        // In sender queue, waiting to be transmitted
  | 'in_transit'     // On the physical wire towards receiver
  | 'lost'          // Dropped by network loss
  | 'corrupted'     // Damaged by transmission noise (checksum fail)
  | 'discarded'     // Dropped at receiver because out-of-order in GBN
  | 'buffered'      // Stored out-of-order at receiver buffer in SR
  | 'delivered'     // Successfully accepted and delivered to application
  | 'acked';        // Sender received valid ACK for this frame

export type AckStatus =
  | 'in_transit'    // On the return wire towards sender
  | 'lost'          // Dropped by return link loss
  | 'corrupted'     // Damaged by noise on return link
  | 'received';     // Arrived at sender

export interface Frame {
  id: string;
  index: number;          // Absolute message chunk index: 0, 1, 2, ...
  seq: number;            // Modulo sequence number: index % (2^m)
  payload: string;
  attempt: number;        // Transmission attempt count (1 = initial, 2+ = retransmit)
  status: FrameStatus;
  isCorrupted: boolean;   // Bit errors during transmission
  timer: number;          // Countdown ticks before timeout
  maxTimer: number;
}

export interface InFlightFrame {
  id: string;
  frame: Frame;
  progress: number;       // 0 (Sender) -> 1 (Receiver) for animation
  ticksRemaining: number; // Discrete channel propagation ticks
  isLost: boolean;
  isCorrupted: boolean;
}

export interface AckPacket {
  id: string;
  ackNum: number;         // Sequence number: GBN = next expected seq; SR = individual acknowledged seq
  frameIndex?: number;    // Frame index acknowledged
  isCumulative: boolean;  // True for Go-Back-N cumulative ACKs
  isNak: boolean;         // True for Selective Repeat Negative Acknowledgement
  status: AckStatus;
  isCorrupted: boolean;
}

export interface InFlightAck {
  id: string;
  ack: AckPacket;
  progress: number;       // 0 (Receiver) -> 1 (Sender) for animation
  ticksRemaining: number;
  isLost: boolean;
  isCorrupted: boolean;
}

export type EventType =
  | 'FRAME_CREATED'
  | 'FRAME_SENT'
  | 'FRAME_IN_TRANSIT'
  | 'FRAME_LOST'
  | 'FRAME_CORRUPTED'
  | 'FRAME_DISCARDED'
  | 'FRAME_BUFFERED'
  | 'FRAME_DELIVERED'
  | 'ACK_SENT'
  | 'ACK_IN_TRANSIT'
  | 'ACK_LOST'
  | 'ACK_CORRUPTED'
  | 'ACK_RECEIVED'
  | 'TIMEOUT'
  | 'RETRANSMISSION'
  | 'WINDOW_ADVANCED'
  | 'SIMULATION_COMPLETE';

export interface TransmissionRecord {
  id: string;
  step: number;
  type: 'data' | 'ack' | 'nak';
  seq: number;
  attempt: number;
  isLost: boolean;
  isCorrupted: boolean;
  isDiscarded?: boolean;
  isBuffered?: boolean;
  fromSender: boolean;
  label: string;
  windowSnapshot?: {
    sendBaseSeq: number;
    windowSize: number;
  };
}

export interface SimulationEvent {
  id: string;
  step: number;
  timestamp: number;
  type: EventType;
  title: string;
  description: string;
  explanation: string;
  frameIndex?: number;
  frameSeq?: number;
  ackNum?: number;
  severity?: 'normal' | 'success' | 'warning' | 'error' | 'info';
}

export type AckConvention = 'acknowledged-frame' | 'next-expected';

export interface SimulationConfig {
  protocol: ProtocolType;
  message: string;
  frameChunkSize: number;
  mBits: number;           // Sequence number bits (default 3 -> seqSpace = 8)
  windowSize: number;      // Sliding window size N
  lossProbability: number; // 0.0 to 0.6
  corruptionProbability: number; // 0.0 to 0.4
  ackLossProbability: number;    // 0.0 to 0.4
  timeoutTicks: number;    // Number of steps before timeout
  channelDelayTicks: number; // Channel propagation delay in ticks (default 2)
  seed: number;            // PRNG seed for reproducible simulations
  ackConvention?: AckConvention; // 'acknowledged-frame' (ACK n confirms Frame n) vs 'next-expected' (ACK n+1 requests Frame n+1)
  
  // Deterministic fault overrides for testing specific scenarios
  forcedLossFrameIndices?: number[];
  forcedCorruptFrameIndices?: number[];
  forcedLossAckSeqs?: number[];
}

export interface SimulationStats {
  framesSent: number;
  framesDelivered: number;
  framesLost: number;
  framesCorrupted: number;
  acksSent: number;
  acksReceived: number;
  acksLost: number;
  retransmissions: number;
  timeouts: number;
  totalSteps: number;
  efficiency: number;      // (Unique Delivered / Total Transmissions) * 100
}

export interface ProtocolState {
  config: SimulationConfig;
  step: number;
  isCompleted: boolean;
  seqSpace: number;        // 2^m

  // SENDER STATE
  totalFramesCount: number;
  allFrames: Frame[];             // All message chunks partitioned
  sendBase: number;               // Absolute index of earliest unacknowledged frame
  sendBaseSeq: number;            // Modulo sequence number of sendBase
  nextSeqNumIndex: number;        // Absolute index of next frame to transmit
  nextSeqNum: number;             // Modulo sequence number of nextSeqNumIndex
  senderTimer: number;            // Single timer for oldest unacked frame in GBN
  senderTimerRunning: boolean;    // GBN timer running state

  // RECEIVER STATE
  rcvBase: number;                // Absolute index of next in-order frame expected
  rcvBaseSeq: number;             // Modulo sequence number of rcvBase
  deliveredFrames: (Frame | null)[]; // In-order delivered frames array
  receiverBuffer: Record<number, Frame>; // Receiver buffer indexed by absolute frame index (for SR)

  // CHANNEL STATE (Decoupled from animation)
  inFlightFrames: InFlightFrame[];
  inFlightAcks: InFlightAck[];

  // HISTORY & TELEMETRY
  transmissionsHistory: TransmissionRecord[];
  events: SimulationEvent[];
  stats: SimulationStats;
  currentEvent: SimulationEvent | null;
}
