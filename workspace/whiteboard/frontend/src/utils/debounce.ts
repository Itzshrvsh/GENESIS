/**
 * Returns a debounced version of the provided function.
 * The debounced function postpones its execution until after `delay` milliseconds
 * have elapsed since the last time it was invoked.
 *
 * @param fn - Function to debounce.
 * @param delay - Wait time in milliseconds.
 * @returns A new debounced function.
 */
export default function debounce<F extends (...args: any[]) => any>(fn: F, delay: number): (...args: Parameters<F>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}