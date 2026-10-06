# Ergonomie UI — standards et références

> Référence lue avant tout design d'interface. Complétée par [`frontend-workflow.md`](./frontend-workflow.md).

### Lois cognitives
| Loi | Règle pratique |
|-----|----------------|
| **Fitts** | Actions fréquentes = grandes et proches. Min 28px (souris), 44px (tactile). |
| **Hick-Hyman** | Max 5-7 options par groupe. Au-delà : sous-menus / recherche. |
| **Miller** | Groupes de 4-5 éléments max. Séparateurs visuels entre groupes. |
| **Tesler** | Absorber la complexité côté UI. Ne jamais la déporter sur l'utilisateur. |
| **Jakob** | Respecter les patterns de la plateforme cible. Ne pas réinventer les standards. |

### Composition visuelle
- **φ = 1.618** : split panel 62/38%, proportions card, header/contenu.
- **Grille 8px** : toutes dimensions multiples de 8. Micro-espacements = 4px. Jamais de valeurs arbitraires.
- **Hiérarchie visuelle** : 3 niveaux max (primaire/secondaire/tertiaire). Différencier par taille, graisse ou couleur — jamais les trois ensemble.

### Principes de Gestalt
**Proximité** : éléments liés → rapprochés. **Similarité** : même style = même fonction. **Continuité** : aligner les champs sur un axe vertical. **Fermeture** : délimiter par fonds/bordures. **Figure/fond** : contraste ≥ 4.5:1.

### Heuristiques de Nielsen (résumé)
1. Visibilité de l'état 2. Vocabulaire métier 3. Annuler disponible 4. Cohérence & standards 5. Prévention des erreurs 6. Reconnaissance > rappel 7. Flexibilité (raccourcis) 8. Design minimaliste 9. Messages d'erreur utiles 10. Aide contextuelle

### Ergonomie métier
- **Workflow-first** : l'interface suit le flux réel, pas la structure DB.
- **Progressive disclosure** : essentiel par défaut, avancé accessible.
- **Feedback immédiat** : réponse visible < 200ms. Boutons désactivés pendant traitement.
- **1 CTA par écran**. Navigation à gauche. Administration/config à droite.
- **Placement entités config** : bouton ⚙ à droite du bandeau concerné (Fitts — position prévisible).
