---
name: selfdoubt
description: "Audit d'incertitude — quantifie la confiance avant tout diagnostic, décision d'architecture ou modification de code non lu, pour éviter la fausse certitude."
---

# /selfdoubt — Audit d'incertitude

## Déclenchement automatique

Faire un audit interne (silencieux par défaut) avant :
- tout diagnostic de bug ;
- toute décision d'architecture ;
- toute modification de code qui n'a pas été lu dans la session.

Si beaucoup d'affirmations ne sont pas vérifiées, **dire l'incertitude explicitement** à l'utilisateur plutôt que de
présenter une conclusion comme certaine, et proposer ce qu'il faut vérifier.

## Format de sortie (quand il est affiché)

```
## SELFDOUBT — Audit d'incertitude
| # | Affirmation | Niveau | Action |
```

Niveaux : ✅ Certain (vérifié) · ⚠️ Probable (non confirmé) · ❌ Hypothèse (supposée sans preuve)

```
Ratio hypothèses / vérifications : X/Y
Actions recommandées avant de continuer : …
```

## Commandes

| Commande | Action |
|----------|--------|
| `/selfdoubt` | Audite la dernière réponse donnée |
| `/selfdoubt <texte>` | Audite un texte ou un plan fourni |
| `/selfdoubt plan` | Audite le plan d'implémentation courant avant de coder |
