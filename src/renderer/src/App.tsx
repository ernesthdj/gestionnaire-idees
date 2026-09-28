import { useEffect, useState } from 'react'

export function App(): React.JSX.Element {
  const [status, setStatus] = useState('Connexion au processus principal…')

  useEffect(() => {
    void window.api.invoke<{ version: string }>('app:ping').then((result) => {
      setStatus(result.success ? `Canal IPC opérationnel — v${result.data.version}` : `Erreur : ${result.error.code}`)
    })
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-8 text-content">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Gestionnaire d&apos;idées</h1>
        <p className="text-content-muted" role="status">
          {status}
        </p>
      </div>
    </main>
  )
}
