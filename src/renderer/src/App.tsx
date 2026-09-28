export function App(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-8 text-content">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Gestionnaire d&apos;idées</h1>
        <p className="text-content-muted">Squelette prêt. Plateforme : {window.api.platform}</p>
      </div>
    </main>
  )
}
