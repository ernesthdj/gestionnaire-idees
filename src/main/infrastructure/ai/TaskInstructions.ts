import type { TaskKind } from '../../domain/ai/types'

const SYNTHESIS_RULES = [
  'Tu organises une idée développée (un « neurone » et son arbre de réponses) en un résultat exploitable.',
  '- N’utilise que ce que contient l’arbre : n’invente ni fait, ni montant, ni date.',
  '- sourceRefs : alias [sN] des nœuds de l’arbre qui justifient chaque élément.',
  'Plan d’action :',
  '- ref : identifiant court en minuscules (t1, c1…). Une condition (« J’ai l’argent ? ») a 2 à 4 enfants,',
  '  chacun avec branchLabel (Oui / Non…) ; au plus 5 niveaux de parentRef.',
  '- dependencies : fromRef doit être fait avant toRef (after_done) ou toRef attend un déclencheur (on_trigger).',
  '- Montants : reprends exactement ceux de l’utilisateur. S’ils apparaissent en fourchette ([montant …]), mets',
  '  amountCents au milieu de la fourchette et cite la réponse dans sourceRefs : l’application remettra la valeur.',
  '- Date non donnée par l’utilisateur : pas de dueDate, mets toSchedule. Info manquante : investigation + gaps.',
  'Synthèse de réflexion :',
  '- keyPoints (au moins 1) = pistes retenues ; decisions ; pros / cons ; openQuestions = ce qui reste à trancher.',
  '- C’est une fiche qu’on a plaisir à relire, pas un procès-verbal : overview = « En bref », 2 à 3 phrases',
  '  fluides qui disent où en est l’idée ; chaque point a un headline (2 à 5 mots, sans point final) et un text',
  '  (une phrase qui explique, sans répéter le headline) ; nextStep = LA prochaine étape concrète, une phrase à',
  '  l’infinitif. Tout reste tiré de l’arbre.',
  '- Phrases courtes, tutoiement, dans la langue de l’utilisateur.'
].join('\n')

const SEED_RULES = [
  'Graine (facultative, au plus une par lien) : une idée NOUVELLE qui naît de la rencontre des deux idées reliées',
  '  et qu’aucune des deux ne contient seule (ex. « acompte du mariage » × « écran photo » → « Faire financer',
  '  l’écran par la prochaine mission »). Pas de reformulation ni de simple fusion ; aucune graine vaut mieux',
  '  qu’une graine banale.',
  '- seed.title = l’idée en une phrase courte, à l’infinitif ou nominale ; seed.why = une phrase qui dit ce que',
  '  chacune des deux idées apporte.'
].join('\n')

/**
 * Consignes propres à chaque type de tâche, ajoutées après le cadre système (bloc stable, mis en cache).
 * Les tâches de raisonnement (etendre, synthetiser, reviser) reçoivent les leurs avec la spec 002.
 */
export const TASK_INSTRUCTIONS: Partial<Readonly<Record<TaskKind, string>>> = {
  categoriser: [
    "Classe l'idée de l'utilisateur : une catégorie et une nature.",
    'Catégories :',
    '- achat : acheter, commander, remplacer, offrir un objet ou un service (même lié à la photo ou à l’informatique).',
    '- sortie : restaurant, spectacle, exposition, voyage, week-end, loisir à l’extérieur.',
    '- photo : prise de vue, shooting, retouche, Lightroom, portfolio, matériel de photo à utiliser, style photographique.',
    '- it : informatique, code, logiciel, matériel informatique à configurer, architecture, sauvegarde, serveur.',
    '- projet : création ou lancement d’un projet personnel d’envergure (site, chaîne, exposition, guide, entreprise).',
    '- general : tout le reste (vie quotidienne, administratif, santé, organisation, réflexion personnelle).',
    'En cas de doute entre « achat » et un domaine, choisis « achat » si l’idée consiste à acheter quelque chose.',
    'Nature :',
    '- action : quelque chose de concret à réaliser (verbe d’action : acheter, réserver, appeler, configurer…).',
    '- reflection : une question à explorer, un choix à faire, un concept à définir (pourquoi, comment, faut-il, quel…).',
    'Exemples : « Remplacer la batterie de l’appareil photo » → achat, action. « Faut-il passer au 35 mm fixe ? » → photo,',
    'reflection. « Mettre à jour Node sur le PC » → it, action. « Comment mieux organiser mes semaines ? » → general, reflection.'
  ].join('\n'),
  resumer: [
    "Résume l'idée de l'utilisateur en 2 à 3 phrases courtes, dans sa langue, en le tutoyant :",
    'ce qu’il veut, où en est sa réflexion, ce qui reste à trancher.',
    '- N’utilise que ce qui est écrit : n’invente rien ; reprends montants et dates tels quels.',
    '- Un seul paragraphe : pas de liste, pas de titre, pas de formule d’introduction.'
  ].join('\n'),
  etendre: [
    "Tu fais grandir une idée (un « neurone ») en posant des questions qui aident l'utilisateur à la préciser.",
    '- Respecte la consigne du message : nombre de questions attendu et neurone ciblé.',
    '- Une question = une seule dimension, courte (une phrase), formulée pour l’utilisateur (tutoiement).',
    '- Oriente-toi sur les dimensions de référence de la nature (Action : exécution ; Réflexion : exploration) ;',
    '  dimension = le nom exact d’une dimension de référence quand la question en relève, sinon un mot court.',
    '- Propose 0 à 4 réponses rapides quand elles sont évidentes (ex. Oui / Non / En partie).',
    '- answerKind : « condition » si la réponse ouvre des branches (oui/non), « opportunity » si elle révèle une',
    '  ressource (argent, contact, occasion), sinon « answer ».',
    '- Ne repropose jamais une question déjà posée, même reformulée.',
    '- Évalue le contexte de TOUTE l’idée : covered = dimensions renseignées, missing = dimensions utiles manquantes ;',
    '  level = insufficient, sufficient (on peut organiser l’idée) ou complete (rien d’important ne manque).',
    '- Si une réponse mentionne une ressource datée ou chiffrée, renseigne detectedOpportunity (valeurs de l’utilisateur).',
    '- Demande d’œuvre finie (poème, image, code…) : kind = out_of_scope et propose d’aider à y réfléchir.',
    '- suggestions (0 à 2, seulement si elles apportent vraiment) : une piste concrète que l’utilisateur n’a pas',
    '  envisagée, ou une réponse possible à un « À trouver ». neuronRef = alias [sN] du neurone concerné. C’est une',
    '  PROPOSITION : l’utilisateur l’accepte ou l’ignore. Ne répète aucune suggestion déjà faite.',
    '- Si la suggestion dépend d’informations actuelles (prix, disponibilité, horaires, adresses de commerces),',
    '  renseigne webQuery : requête de recherche courte, sans aucune donnée personnelle ; l’application vérifiera.'
  ].join('\n'),
  synthetiser: SYNTHESIS_RULES,
  reviser: [
    SYNTHESIS_RULES,
    '- Correction : repars de la proposition précédente, applique la consigne de l’utilisateur, garde le reste.'
  ].join('\n'),
  suggerer_liens: [
    'Tu relies des idées de l’utilisateur : l’une vient d’aboutir, les autres [N1…] sont des idées déjà abouties.',
    '- Propose 0 à 3 liens, seulement s’ils sont réellement utiles (ressource commune, dépendance, même objectif,',
    '  l’une finance ou débloque l’autre). Aucun lien vaut mieux qu’un lien forcé.',
    '- targetAlias = alias de la candidate ; label = 1 à 3 mots (ex. « financement », « photo ») ;',
    '  justification = une phrase qui explique le lien avec les éléments des fiches.',
    SEED_RULES
  ].join('\n'),
  germer: [
    'Deux idées de l’utilisateur viennent d’être reliées (fiches A et B, et le libellé du lien).',
    SEED_RULES
  ].join('\n'),
  rechercher: [
    'Tu vérifies sur le web une suggestion faite à l’utilisateur (2 recherches au plus).',
    '- Réponds en 2 à 3 phrases factuelles, en français, sans préambule : ordres de grandeur de prix en euros,',
    '  options concrètes, conditions utiles. Appuie-toi uniquement sur ce que tu as trouvé.',
    '- Rien de fiable trouvé : dis-le en une phrase.'
  ].join('\n'),
  anonymiser: [
    'Liste les noms de personnes (prénoms, noms) et de lieux (villes, quartiers, pays, établissements nommés)',
    'présents dans le texte, recopiés exactement comme ils apparaissent. Ne modifie pas le texte.',
    'Ignore les marques, les produits, les noms communs et les éléments déjà remplacés entre crochets.',
    'Si le texte n’en contient aucun, renvoie des listes vides.'
  ].join('\n')
}
