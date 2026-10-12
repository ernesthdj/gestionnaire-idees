import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { eq } from 'drizzle-orm'
import type { AppDatabase } from '../client'
import { neurons } from '../schemaNeurons'
import { codeProjects } from '../schemaReprise'
import { demoId } from './seedDemo'

/**
 * Projet repris FICTIF du profil démo (spec 017 T037) : une petite boutique en TypeScript (API, service, dépôt, outils)
 * et son module de facturation en C# (interface injectée, appel `Save` ambigu entre deux magasins), de quoi montrer
 * l'explorateur à quatre niveaux, les catégories, un lien incertain et le guide. Importé « Local uniquement » : la
 * démo n'envoie rien à Claude. Aucune donnée réelle.
 */
export const DEMO_REPRISE_FOLDER = 'boutique-demo'

const FILES: Readonly<Record<string, string>> = {
  'README.md': `# Boutique démo

Petite boutique fictive : on passe une commande, elle est enregistrée, puis facturée.
Pour démarrer : \`npm start\` (jamais lancé par l'app).
`,
  'package.json': `${JSON.stringify({ name: 'boutique-demo', private: true, main: 'src/main.ts' }, null, 2)}\n`,
  'tsconfig.json': `${JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@core/*': ['src/core/*'] } } }, null, 2)}\n`,
  'src/main.ts': `import { OrderController } from './api/orderController'

const controller = new OrderController()
controller.post({ items: [{ price: 120, quantity: 2 }] })
`,
  'src/api/orderController.ts': `import { OrderService, type OrderInput } from '@core/orderService'
import { log } from '../utils/logger'

export class OrderController {
  private readonly service = new OrderService()

  post(input: OrderInput): number {
    log('commande reçue')
    return this.service.place(input)
  }
}
`,
  'src/core/orderService.ts': `import { OrderRepository } from '../infra/orderRepository'

export interface OrderInput {
  readonly items: readonly { readonly price: number; readonly quantity: number }[]
}

export function calculateDiscount(total: number): number {
  return total > 200 ? total * 0.1 : 0
}

export class OrderService {
  private readonly repository = new OrderRepository()

  place(input: OrderInput): number {
    const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const due = total - calculateDiscount(total)
    this.repository.save({ total: due })
    return due
  }
}
`,
  'src/infra/orderRepository.ts': `import { log } from '../utils/logger'

export class OrderRepository {
  private readonly rows: { readonly total: number }[] = []

  save(order: { readonly total: number }): void {
    this.rows.push(order)
    log('commande enregistrée')
  }
}
`,
  'src/utils/logger.ts': `export function log(message: string): void {
  console.info(\`[boutique] \${message}\`)
}
`,
  'billing/Billing.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
</Project>
`,
  'billing/Program.cs': `using Billing.Domain;
using Billing.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<IInvoiceStore, SqlInvoiceStore>();
builder.Services.AddScoped<InvoiceService>();
var app = builder.Build();
app.Run();
`,
  'billing/Domain/InvoiceService.cs': `namespace Billing.Domain
{
    public interface IInvoiceStore
    {
        void Save(decimal total);
    }

    public class InvoiceService
    {
        private readonly IInvoiceStore _store;

        public InvoiceService(IInvoiceStore store)
        {
            _store = store;
        }

        public void Bill(decimal total, dynamic archive)
        {
            _store.Save(total);
            archive.Save(total);
        }
    }
}
`,
  'billing/Infrastructure/SqlInvoiceStore.cs': `using Billing.Domain;

namespace Billing.Infrastructure
{
    public class SqlInvoiceStore : IInvoiceStore
    {
        public void Save(decimal total)
        {
        }
    }
}
`,
  'billing/Infrastructure/ArchiveStore.cs': `namespace Billing.Infrastructure
{
    public class ArchiveStore
    {
        public void Save(decimal total)
        {
        }
    }
}
`
}

/** Écrit le projet fictif s'il n'existe pas encore (jamais d'écrasement) ; renvoie son chemin. */
export function writeDemoRepriseFolder(dir: string): string {
  if (existsSync(dir)) return dir
  for (const [path, content] of Object.entries(FILES)) {
    const target = join(dir, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, 'utf8')
  }
  return dir
}

/** Genesis du projet repris fictif. */
export const DEMO_REPRISE_ID = demoId('root', 900)

/**
 * Genesis du projet repris fictif, à droite des deux autres, lié à son dossier, « Local uniquement ». Inséré une seule
 * fois (y compris dans un profil démo déjà rempli) ; `seeded` : il vient d'être créé, son analyse est à lancer.
 */
export function seedDemoReprise(
  db: AppDatabase,
  dir: string
): { readonly genesisId: string; readonly seeded: boolean } {
  const genesisId = DEMO_REPRISE_ID
  const existing = db.select({ id: neurons.id }).from(neurons).where(eq(neurons.id, genesisId)).get()
  if (existing !== undefined) return { genesisId, seeded: false }
  db.transaction((tx) => {
    tx.insert(neurons)
      .values({
        id: genesisId,
        rootId: genesisId,
        kind: 'root',
        title: DEMO_REPRISE_FOLDER,
        posX: 2800,
        posY: 0,
        pinned: true,
        content: null,
        origin: 'user',
        nature: 'reflection',
        state: 'raw',
        version: 0,
        projectDir: dir
      })
      .run()
    tx.insert(codeProjects)
      .values({
        genesisId,
        rootDir: dir,
        source: 'folder',
        remoteUrl: null,
        confidentiality: 'local',
        confidentialityChangedAt: '2026-10-12T08:00:00.000Z'
      })
      .run()
  })
  return { genesisId, seeded: true }
}
