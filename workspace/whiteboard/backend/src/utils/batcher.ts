import type { Socket } from "socket.io";

/**
 * Represents a point captured from mouse/touch input.
 */
export interface MousePoint {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Optional timestamp (ms) */
  t?: number;
}

/**
 * Batcher buffers items (e.g., mouse points) and flushes them either when a
 * maximum batch size is reached or after a configurable time interval.
 *
 * The flushed batch is passed to the provided callback. The class is
 * deliberately lightweight – suitable for a collaborative whiteboard where
 * frequent cursor updates must be coalesced before emitting over Socket.IO.
 */
export class Batcher<T> {
  private buffer: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  /**
   * @param onFlush Called with the buffered items when the batch is flushed.
   * @param options.maxSize Flush immediately when this many items are buffered.
   * @param options.flushIntervalMs Flush after this amount of idle time (ms).
   */
  constructor(
    private readonly onFlush: (batch: T[]) => void,
    private readonly options: {
      maxSize?: number;
      flushIntervalMs?: number;
    } = {}
  ) {}

  /**
   * Adds a new item to the buffer and schedules a flush if needed.
   * @param item Item to buffer.
   */
  add(item: T): void {
    this.buffer.push(item);

    if (this.options.maxSize && this.buffer.length >= this.options.maxSize) {
      this.flush();
      return;
    }

    this.scheduleFlush();
  }

  /**
   * Immediately flushes the current buffer (if any) and clears the timer.
   */
  flush(): void {
    if (this.buffer.length === 0) {
      this.clearTimer();
      return;
    }

    const batch = this.buffer;
    this.buffer = [];
    this.clearTimer();
    this.onFlush(batch);
  }

  /**
   * Disposes the batcher, flushing pending items and clearing timers.
   */
  dispose(): void {
    this.flush();
    this.clearTimer();
  }

  private scheduleFlush(): void {
    if (!this.options.flushIntervalMs) {
      return;
    }

    this.clearTimer();
    this.timer = setTimeout(() => this.flush(), this.options.flushIntervalMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Convenience factory that creates a batcher suitable for Socket.IO board
 * namespaces. It emits the buffered points using the provided socket event.
 *
 * @param socket Socket.IO client connected to a board namespace.
 * @param eventName Name of the Socket.IO event to emit.
 * @param maxSize Maximum number of points before immediate emission.
 * @param flushIntervalMs Maximum idle time before emission.
 */
export function createSocketPointBatcher(
  socket: Socket,
  eventName: string,
  maxSize = 20,
  flushIntervalMs = 50
): Batcher<MousePoint> {
  return new Batcher<MousePoint>((batch) => {
    if (batch.length > 0) {
      socket.emit(eventName, batch);
    }
  }, { maxSize, flushIntervalMs });
}