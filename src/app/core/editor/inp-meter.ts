import { Injectable, OnDestroy, computed, signal } from '@angular/core';

/**
 * Live Interaction to Next Paint, measured in the browser with the Event Timing API.
 *
 * Every click, tap or key press gets an interactionId; its duration runs from the
 * input until the next frame is painted. Like Chrome's INP, the reported value is
 * the worst interaction, ignoring one outlier per 50 interactions.
 * Thresholds (web.dev): good ≤ 200 ms, needs improvement ≤ 500 ms, poor above.
 */
/** The part of an Event Timing entry we use (interactionId is missing from TypeScript's DOM types). */
export interface InteractionEntry {
  interactionId?: number;
  duration: number;
}

@Injectable()
export class InpMeter implements OnDestroy {
  private readonly durations = new Map<number, number>();
  private observer: PerformanceObserver | null = null;

  readonly supported =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('event');
  readonly latest = signal<number | null>(null);
  readonly inp = signal<number | null>(null);
  readonly rating = computed(() => rate(this.inp()));

  start(): void {
    if (!this.supported || this.observer) return;
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as InteractionEntry[]) this.record(entry);
    });
    this.observer.observe({
      type: 'event',
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit);
  }

  record(entry: InteractionEntry): void {
    if (!entry.interactionId) return; // scrolls and hovers are not interactions
    const previous = this.durations.get(entry.interactionId) ?? 0;
    if (entry.duration <= previous) return;
    this.durations.set(entry.interactionId, entry.duration);
    this.latest.set(Math.round(entry.duration));
    this.inp.set(estimateInp([...this.durations.values()]));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

export function estimateInp(durations: number[]): number | null {
  if (durations.length === 0) return null;
  const sorted = [...durations].sort((a, b) => b - a);
  const skip = Math.min(sorted.length - 1, Math.floor(sorted.length / 50));
  return Math.round(sorted[skip]);
}

export type InpRating = 'good' | 'needs-improvement' | 'poor' | 'none';

export function rate(value: number | null): InpRating {
  if (value === null) return 'none';
  if (value <= 200) return 'good';
  return value <= 500 ? 'needs-improvement' : 'poor';
}
