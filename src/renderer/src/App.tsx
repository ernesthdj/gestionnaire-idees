import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from './app/AppShell'

/** Racine de la fenêtre principale : données IPC via TanStack Query, puis la coquille. */
export function App(): React.JSX.Element {
  // Données locales (IPC) : pas de rafraîchissement au retour du focus, une seule nouvelle tentative.
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })
  )
  return (
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>
  )
}
