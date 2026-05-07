import useSWR from 'swr';
import { fetchProjectState } from '../api/client';

export function useProjectState() {
  return useSWR('project-state', fetchProjectState, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}
