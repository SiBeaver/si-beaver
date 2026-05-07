import useSWR from 'swr';
import { fetchGoalProgress } from '../api/client';

export function useGoalProgress() {
  return useSWR('goal-progress', fetchGoalProgress, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}
