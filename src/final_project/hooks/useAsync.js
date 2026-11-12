import { useEffect, useState } from "react";

// Runs an async loader whenever its key changes; returns { data, error, loading }.
export default function useAsync(loader, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true, key: null });

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((data) => !cancelled && setState({ data, error: null, loading: false, key }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false, key }));
    return () => {
      cancelled = true;
    };
    // `key` identifies what `loader` fetches, so it is the only dependency we need.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // While a new key loads, don't show the previous key's data.
  return state.key === key ? state : { data: null, error: null, loading: true };
}
