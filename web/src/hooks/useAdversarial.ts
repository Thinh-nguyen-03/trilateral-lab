import { useQuery } from '@tanstack/react-query'
import { fetchAdversarial } from '../api/adversarial'

export function useAdversarial() {
  return useQuery({
    queryKey: ['adversarial'],
    queryFn: fetchAdversarial,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
