import useSWR from 'swr';
import { fetchRoadmap } from '../api/client';

export function useRoadmap(slug: string) {
  return useSWR(`${slug}/roadmap`, () => fetchRoadmap(slug, true, 5), {
    refreshInterval: 30_000,
  });
}
