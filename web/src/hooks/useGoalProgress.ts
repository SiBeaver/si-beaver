import useSWR from 'swr';
import { fetchGoalProgress } from '../api/client';

export function useGoalProgress(slug: string) {
  return useSWR(`${slug}/goal-progress`, () => fetchGoalProgress(slug), {
    refreshInterval: 30_000,
  });
}
