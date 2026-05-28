import useSWR from 'swr';
import { fetchActivity } from '../api/client';

export function useActivity(slug: string, limit = 50) {
  return useSWR(`${slug}/activity`, () => fetchActivity(slug, limit), {
    refreshInterval: 30_000,
  });
}
