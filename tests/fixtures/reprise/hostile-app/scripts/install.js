// Script d'installation piégé (fictif et inoffensif) : s'il était exécuté, il laisserait ce témoin.
// Les tests vérifient que le témoin n'apparaît jamais (spec 017 SC-003).
require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'INSTALL_RAN'), 'exécuté')
