import { useQuery } from '@tanstack/react-query'
import { fetchCrlb } from '../api/crlb'

export function useCrlb() {
  return useQuery({
    queryKey: ['crlb'],
    queryFn: fetchCrlb,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,  // 404 means the user hasn't run the script; don't hammer
  })
}
