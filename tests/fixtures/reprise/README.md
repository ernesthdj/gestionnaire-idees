# Projets de démonstration — spec 017 « Reprise — Voir »

Projets **fictifs**, écrits pour les tests de l'analyse statique (aucune donnée réelle). Ils ne sont jamais exécutés :
l'app les lit seulement.

| Dossier | Langage | Ce qu'il permet de vérifier |
|---|---|---|
| `ts-app` | TypeScript | imports relatifs et alias `tsconfig` (`@core/*`), modules par dossier, catégories (contrôleur, service, dépôt, logger), fichier cassé |
| `cs-app` | C# / .NET | `using` + namespaces, interface injectée (`AddScoped<IOrderRepository, SqlOrderRepository>`) → implémentation, appel `Save()` ambigu entre trois classes |
| `laravel-app` | PHP / Laravel | PSR-4 (`composer.json`), routes → méthodes de contrôleur, modèle Eloquent, service |
| `hostile-app` | JavaScript | script `postinstall`, sous-module déclaré, README et commentaire porteurs de consignes, fichier de réglages avec un faux secret |

Les fichiers que le dépôt ne peut pas porter (`.env`, hooks dans `.git/hooks`, `node_modules/`) sont créés par les
tests dans une copie temporaire du projet.
