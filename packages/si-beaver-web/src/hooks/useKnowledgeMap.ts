import useSWR from 'swr';
import { fetchKnowledgeMap } from '../api/client';

export function useKnowledgeMap(slug: string) {
  return useSWR(`${slug}/knowledge`, () => fetchKnowledgeMap(slug), {
    refreshInterval: 30_000,
  });
}
