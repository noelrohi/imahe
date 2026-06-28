import { useInfiniteQuery } from '@tanstack/react-query';

import { ima2Client } from '@/lib/ima2/client';
import type { HistoryCursor } from '@/lib/ima2/schemas';

export const historyQueryKey = ['history'] as const;

export type UseHistoryOptions = {
  limit?: number;
};

export function useHistory({ limit = 24 }: UseHistoryOptions = {}) {
  return useInfiniteQuery({
    queryKey: [...historyQueryKey, { limit }] as const,
    initialPageParam: undefined as HistoryCursor | undefined,
    queryFn: ({ pageParam }) =>
      ima2Client.history({
        limit,
        before: pageParam?.before,
        beforeFilename: pageParam?.beforeFilename,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
