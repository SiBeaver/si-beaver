import useSWR from 'swr';
import { fetchNodeContext } from '../api/client';

export function useNodeContext(slug: string, nodeId: string | null) {
  return useSWR(
    nodeId ? `${slug}/nodes/${nodeId}` : null,
    () => fetchNodeContext(slug, nodeId!),
  );
}
