# Feature Specification: Neurone conversationnel — brainstormer avec Claude Code dans chaque neurone

**Feature Branch**: `008-neurone-conversationnel`

**Created**: 2026-10-04

**Status**: Validée par mentalyas (2026-10-04) — livraison en 3 lots (A, B, C)

**Input**: « Toile vide, clic droit, nouvelle idée avec un titre. Double-clic : le panneau latéral ouvre un chat qui est
en réalité le CLI Claude, qui sait qu'on est dans le Brainstormer sur un nœud genesis. On brainstorme et le nœud
s'alimente. Un neurone qui naît de cette idée a sa propre conversation, avec son contexte et le contexte général du
genesis. On garde la structure de /brainstorm en couches, appliquée au visuel. »

**Cadre** : constitution 2.0.0 (I : seul `claude` lancé, arguments fixes, données par stdin ; II : écritures de Claude
annulables, remontée et naissances validées ; III : sorties d'outils validées ; IV : Claude via le CLI officiel
uniquement). Détail validé : `docs/brainstorm/L1d-neurone-conversation.md`, `L2-` et `L3-neurone-conversationnel.md`.
S'appuie sur la spec 007 (pont MCP).

**Amendement (2026-10-09, spec 022 « Nœuds vivants », D5, D10, D15)** : il n'y a plus de panneau latéral. Un clic sur
une idée, une étape ou un élément ouvre sa **carte de détails**, posée à droite du nœud ; « Discuter » y ouvre ce même
chat en l'étirant sur le côté. Le **double-clic** ouvre la carte directement sur le chat (FR-001 garde son geste, seule
la place change). Plusieurs cartes, donc plusieurs chats, peuvent être ouverts à la fois ; Entrée sur un nœud ouvre sa
carte. Le contenu du chat (fil, fiche, permissions, modes, modèle, dossier lié) est inchangé.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Brainstormer un genesis dans un chat (Priority: P1) — lot A

mentalyas crée une idée sur une toile vide, puis double-clique dessus : le panneau latéral affiche un chat. Claude sait
qu'il est dans le Brainstormer, sur un genesis ; il pose ses questions, la réponse s'écrit au fur et à mesure, et ses
actions apparaissent en pastilles. Au fil des réponses, Claude tient à jour la **fiche** du neurone (résumé, points
clés, décisions, questions ouvertes, manques) et évalue sa **maturité** : le neurone grossit sur la carte et montre son
résumé. Fermer puis rouvrir (même après redémarrage) reprend la même conversation.

**Why this priority**: c'est le cœur du nouveau neurone ; sans lui, rien d'autre n'a de sens.

**Independent Test**: toile vide → nouvelle idée « Ouvrir un studio photo » → double-clic → trois échanges → la fiche
affiche les décisions dites, le neurone a grossi ; redémarrer l'app → rouvrir → l'historique est là et Claude s'en souvient.

**Acceptance Scenarios**:

1. **Given** une idée, **When** mentalyas double-clique dessus, **Then** le chat s'ouvre et Claude commence par une
   question liée au titre, en sachant qu'il est sur un genesis du Brainstormer.
2. **Given** une conversation, **When** mentalyas répond, **Then** le texte de Claude s'affiche en flux, et la fiche
   du neurone se met à jour (pastille « fiche mise à jour »), visible dans le panneau et résumée sur la carte.
3. **Given** une conversation passée, **When** mentalyas rouvre le neurone (même après redémarrage), **Then**
   l'historique s'affiche et Claude poursuit sans redemander ce qui est acquis.
4. **Given** Claude Code introuvable ou non connecté, **When** le chat s'ouvre, **Then** un message explique quoi faire.
5. **Given** un tour en cours, **When** mentalyas clique « Arrêter », **Then** le tour s'interrompt ; ce qui a déjà
   été écrit dans la fiche reste (annulable).
6. **Given** la limite d'usage de l'abonnement atteinte, **When** mentalyas écrit, **Then** le chat l'indique avec
   l'heure de reprise ; un bandeau prévient à l'approche de la limite.

---

### User Story 2 - L'entonnoir en couches (Priority: P1) — lot B

Quand un neurone est mûr, Claude affiche le signal de complexité et propose les neurones de la couche suivante, qui
apparaissent en fantômes ; mentalyas valide en bloc et ils naissent, reliés. Chaque neurone enfant a sa conversation,
qui hérite de la fiche du genesis et de celles de son chemin. Quand une découverte change le contexte général, Claude
propose une remontée vers le genesis, que mentalyas accepte d'un clic. Le genesis porte un type d'entonnoir (projet,
achat, événement, décision, apprentissage, général) qui adapte les couches. L'éclosion du genesis exporte les fiches
au format `/brainstorm`.

**Why this priority**: c'est ce qui fait de la carte un brainstorm structuré et visuel.

**Independent Test**: un genesis mûr → « Valider la couche » → 3 fantômes → validation → 3 enfants ; ouvrir un enfant →
Claude cite le contexte du genesis ; une remontée acceptée apparaît dans la fiche du genesis ; export → dossier
`docs/brainstorm` + `FOUNDATION.md`.

**Acceptance Scenarios**:

1. **Given** un neurone mûr, **When** la couche est validée, **Then** des fantômes apparaissent ; validés, ils naissent
   (couche + 1), reliés au parent ; refusés, ils disparaissent.
2. **Given** un enfant, **When** il est ouvert, **Then** sa conversation connaît la fiche du genesis et de son chemin.
3. **Given** une remontée proposée, **When** elle est acceptée, **Then** la fiche du genesis change (annulable).
4. **Given** un genesis éclos, **When** mentalyas exporte, **Then** les fiches sont écrites au format L1–L4 + FOUNDATION.

---

### User Story 3 - Bascule vers le nouveau modèle (Priority: P2) — lot C

Les idées existantes deviennent des genesis (leurs réponses et documents forment leur première fiche) ; Ollama ne fait
plus que des tâches de fond (classer, résumer, signaler des liens) ; l'ancien moteur de questions est retiré.

**Independent Test**: après mise à jour, une ancienne idée s'ouvre en chat avec une fiche déjà remplie ; plus aucune
question générée par Ollama.

---

### Edge Cases

- Deux conversations ouvertes : chacune son processus (3 au plus) ; la plus ancienne inactive se ferme d'abord.
- Reprise impossible (transcription supprimée) : nouvelle session, contexte rejoint, l'app le signale.
- Une conversation tente d'écrire la fiche d'un neurone d'un autre arbre : refusé.
- Fiche trop longue : refusée au-delà de 12 000 caractères ; contexte joint borné à 24 000.
- Réponse de Claude contenant du balisage : affichée comme du texte.
- Fermeture de l'app pendant un tour : processus arrêtés, aucune corruption.

## Requirements *(mandatory)*

### Functional Requirements

**Lot A**
- **FR-001**: Le double-clic sur une idée MUST ouvrir son chat dans le panneau latéral.
- **FR-002**: Chaque neurone MUST avoir sa propre conversation Claude Code, reprise à chaque ouverture (même historique).
- **FR-003**: La conversation MUST être lancée avec le CLI officiel de mentalyas, sans clé API, avec un cadre stable
  (« tu es dans le Brainstormer… »), le pont de la carte branché, ses hooks et réglages personnels désactivés.
- **FR-004**: Le premier message de chaque ouverture MUST joindre le contexte à jour du neurone (titre, couche, type,
  fiche), consultable par mentalyas (« Contexte envoyé ») ; Claude MUST pouvoir le relire par un outil.
- **FR-005**: Claude MUST pouvoir utiliser uniquement : les outils de la carte, la lecture de fichiers du dossier de
  travail, la recherche web ; toute autre action MUST être refusée sans demande.
- **FR-006**: Le texte de Claude MUST s'afficher en flux ; ses actions MUST apparaître en pastilles lisibles.
- **FR-007**: Claude MUST tenir la fiche à jour par un outil dédié (sections : résumé, points clés, décisions, questions
  ouvertes, manques), chaque écriture étant une opération d'Historique « par Claude » annulable.
- **FR-008**: Claude MUST pouvoir évaluer la maturité du neurone (insuffisant, suffisant, complet + manques) ; la taille
  du neurone sur la carte MUST refléter cette maturité.
- **FR-009**: Le neurone MUST afficher sur la carte le résumé de sa fiche ; le panneau MUST afficher la fiche entière.
- **FR-010**: mentalyas MUST pouvoir arrêter un tour ; l'envoi MUST être bloqué pendant un tour.
- **FR-011**: L'app MUST signaler : Claude Code absent, non connecté, limite atteinte (heure de reprise), approche de la limite.
- **FR-012**: L'historique affiché MUST être conservé dans la base chiffrée de l'app.
- **FR-013**: Au plus 3 conversations actives ; arrêt après 10 min d'inactivité ; toutes arrêtées à la fermeture.
- **FR-014**: Une conversation MUST NOT écrire dans un neurone d'un autre arbre que le sien.
- **FR-015**: Aucune donnée de conversation MUST apparaître dans les journaux.

**Lot B** : couches, type d'entonnoir, proposition de la couche suivante (fantômes + validation en bloc), héritage des
fiches du chemin, remontée proposée, éclosion et export (détail : `L2-neurone-conversationnel.md` UC-3 à UC-6).

**Lot C** : conversion des idées, Ollama en tâches de fond, retrait de l'ancien moteur (UC-7, UC-8).

### Key Entities

- **Neurone** : genesis (racine) ou enfant ; couche, type d'entonnoir (genesis), conversation, fiche, maturité.
- **Conversation** : session Claude Code d'un neurone ; messages affichés (rôle, texte, action).
- **Fiche** : résumé, points clés, décisions, questions ouvertes, manques — transmise aux enfants (lot B).
- **Proposition** (lot B) : fantôme de couche ou remontée ; proposée, acceptée, refusée.

## Success Criteria *(mandatory)*

- **SC-001**: Premier texte de Claude visible en moins de 5 s après l'envoi (Haiku/Sonnet), en flux ensuite.
- **SC-002**: 100 % des conversations reprennent avec leur historique après redémarrage.
- **SC-003**: Après 3 échanges, la fiche contient au moins une décision et un manque, sans intervention manuelle.
- **SC-004**: 0 action refusée exécutée (commande, écriture de fichier) — vérifié par tests et en réel.
- **SC-005**: mentalyas juge le brainstorm « au moins aussi bon qu'en CLI » sur un essai réel.

## Assumptions

- Claude Code 2.1.289+ installé (`~/.local/bin/claude.exe`) et connecté par abonnement.
- Le dossier de travail des conversations est `%APPDATA%/gestionnaire-idees/workspace` (espaces liés : spec ultérieure).
- Le lot A ouvre un chat sur les idées existantes (racines) ; les enfants de couche arrivent au lot B.
- Pendant les lots A et B, l'ancien panneau de questions reste accessible (clic simple) ; il disparaît au lot C.
