import { QueryClient } from '@tanstack/vue-query'

/** One cache for the whole app; emptied whenever the logged-in person changes. */
export const queryClient = new QueryClient()
