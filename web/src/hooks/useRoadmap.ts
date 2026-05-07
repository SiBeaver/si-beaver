import useSWR from 'swr';
import { fetchRoadmap } from '../api/client';

export function useRoadmap() {
  return useSWR('roadmap', () => fetchRoadmap(true, 5), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}
