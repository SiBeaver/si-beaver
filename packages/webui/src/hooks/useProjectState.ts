import useSWR from 'swr';
import { fetchProjectState } from '../api/client';

export function useProjectState(slug: string) {
  return useSWR(`${slug}/project-state`, () => fetchProjectState(slug), {
    refreshInterval: 30_000,
  });
}
