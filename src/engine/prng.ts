/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures reproducible simulations when a fixed seed is provided.
 */

export class PRNG {
  private state: number;

  constructor(seed: number = 12345) {
    this.state = seed ? (seed | 0) : 12345;
  }

  public setSeed(seed: number): void {
    this.state = seed ? (seed | 0) : 12345;
  }

  /**
   * Generates a floating point number in [0, 1)
   */
  public next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns true if a random event occurs with the given probability [0, 1]
   */
  public chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }
}
