import { useEffect, useState } from "react";

/**
 * Settled view of a rapidly-changing value (search-as-you-type → API query).
 * The fresh value renders immediately; the debounced copy only updates after
 * the feed goes quiet, so keystrokes do not fire a request per character.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
