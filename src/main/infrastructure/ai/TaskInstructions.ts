import type { TaskKind } from '../../domain/ai/types'

/**
 * Consignes propres à chaque type de tâche, ajoutées après le cadre système (bloc stable, mis en cache).
 * Les tâches de raisonnement (etendre, synthetiser…) reçoivent les leurs avec leur feature (spec 002).
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
  etendre: [
    "Tu fais grandir une idée (un « neurone ») en posant des questions qui aident l'utilisateur à la préciser.",
    '- Respecte la consigne du message : nombre de questions attendu et neurone ciblé.',
    '- Une question = une seule dimension, courte (une phrase), formulée pour l’utilisateur (tutoiement).',
    '- Oriente-toi sur les dimensions de référence de la nature (Action : exécution ; Réflexion : exploration).',
    '- Propose 0 à 4 réponses rapides quand elles sont évidentes (ex. Oui / Non / En partie).',
    '- answerKind : « condition » si la réponse ouvre des branches (oui/non), « opportunity » si elle révèle une',
    '  ressource (argent, contact, occasion), sinon « answer ».',
    '- Ne repropose jamais une question déjà posée, même reformulée.',
    '- Évalue le contexte de TOUTE l’idée : covered = dimensions renseignées, missing = dimensions utiles manquantes ;',
    '  level = insufficient, sufficient (on peut organiser l’idée) ou complete (rien d’important ne manque).',
    '- Si une réponse mentionne une ressource datée ou chiffrée, renseigne detectedOpportunity (valeurs de l’utilisateur).',
    '- Demande d’œuvre finie (poème, image, code…) : kind = out_of_scope et propose d’aider à y réfléchir.'
  ].join('\n'),
  anonymiser: [
    'Liste les noms de personnes (prénoms, noms) et de lieux (villes, quartiers, pays, établissements nommés)',
    'présents dans le texte, recopiés exactement comme ils apparaissent. Ne modifie pas le texte.',
    'Ignore les marques, les produits, les noms communs et les éléments déjà remplacés entre crochets.',
    'Si le texte n’en contient aucun, renvoie des listes vides.'
  ].join('\n')
}
