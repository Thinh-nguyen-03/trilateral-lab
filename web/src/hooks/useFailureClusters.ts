import { useQuery } from '@tanstack/react-query'
import { fetchFailureClusters } from '../api/failureClusters'

export function useFailureClusters() {
  return useQuery({
    queryKey: ['failure-clusters'],
    queryFn:  fetchFailureClusters,
    staleTime: Infinity,
    gcTime:    Infinity,
    retry:     false,
  })
}
