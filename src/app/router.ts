import { useEffect, useState } from 'react';

export const go = (path: string) => {
  window.location.hash = '#' + path;
};

export function useRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, '') || 'today').split('?')[0]!.split('/');
  const [r, setR] = useState(read);
  useEffect(() => {
    const h = () => setR(read());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}
