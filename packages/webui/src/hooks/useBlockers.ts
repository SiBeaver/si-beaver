import useSWR from 'swr';
import { fetchBlockers } from '../api/client';

export function useBlockers(slug: string) {
  return useSWR(`${slug}/blockers`, () => fetchBlockers(slug), {
    refreshInterval: 30_000,
  });
}
