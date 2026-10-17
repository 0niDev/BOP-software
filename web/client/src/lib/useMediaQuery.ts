import { useEffect, useState } from "react";

/**
 * Subscribe to a media query.
 *
 * Used to *not render* controls that only make sense in the compact layout: the
 * sidebar toggle (below 1024px) is absent from the DOM on desktop rather than
 * hidden with CSS, so there is no unreachable button to trip over — for a
 * keyboard user, a screen reader or the button sweep in `web/e2e-sweep`.
 */
export default function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(query);
    const listener = (): void => setMatches(media.matches);
    listener();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
