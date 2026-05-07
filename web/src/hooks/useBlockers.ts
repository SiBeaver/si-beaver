import useSWR from 'swr';
import { fetchBlockers } from '../api/client';

export function useBlockers() {
  return useSWR('blockers', fetchBlockers, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}
