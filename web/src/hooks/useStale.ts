import useSWR from 'swr';
import { fetchStale } from '../api/client';

export function useStale(slug: string, days = 7) {
  return useSWR(`${slug}/stale-${days}`, () => fetchStale(slug, days), {
    refreshInterval: 30_000,
  });
}
