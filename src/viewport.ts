import { useEffect, useState } from 'react';

export const NARROW_QUERY = '(max-width: 767px)';

export function isNarrow() {
  return typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches;
}

export function useNarrow() {
  const [narrow, setNarrow] = useState(isNarrow);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
