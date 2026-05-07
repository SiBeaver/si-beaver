import useSWR from 'swr';
import { fetchStale } from '../api/client';

export function useStale(days = 7) {
  return useSWR(`stale-${days}`, () => fetchStale(days), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}
