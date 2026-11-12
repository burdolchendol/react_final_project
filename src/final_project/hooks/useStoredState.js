import { useEffect, useState } from "react";

// useState that survives reloads via localStorage (falls back to memory if unavailable).
export default function useStoredState(storageKey, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Private mode or storage full: keep working in memory.
    }
  }, [storageKey, value]);

  return [value, setValue];
}
