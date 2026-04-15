import { useQuery } from '@tanstack/react-query'
import { fetchResults } from '../api/results'

export function useResults() {
  return useQuery({
    queryKey: ['results'],
    queryFn: fetchResults,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
