# Validation locale 0.12.1 — 14 octobre 2026

## Données réellement collectées et publiées

Collecte explicite dans une copie SQLite du dossier local, avec réutilisation du cache HTTP et des patchs archivés. Le scraping a terminé sans erreur. Aucun brouillon, compte, pool OP.GG ni journal de l’utilisateur n’a été écrasé ou inclus dans le lot partagé.

- Lolalytics Master+ : 16.20/16.19/16.18, 2 558 lignes de champions/rôles et 1 008 382 interactions.
- gol.gg : 16.20/16.18/16.17, les trois derniers patchs disponibles, 465 lignes et 92 924 interactions.
- 953 matchs pro : 20 sur 16.20, 369 sur 16.18, 564 sur 16.17. Les matchs de 16.16 sortent de cette fenêtre.
- L’indicateur « First Pick » révèle le vrai côté : les couleurs des panneaux ne le garantissent pas. 390 côtés ont été corrigés après vérification des mêmes lineups et résultats. 934 ordres ont été récupérés dans les rubans, 19 restent inconnus.
- Publication Supabase demandée par l’utilisateur, 76 blocs validés, 16 500 740 octets compressés. Les blocs historiques identiques ont été réutilisés.
- Révision stable : `f48f570ba3450cf1dbfcf487adbe963f0a65ca8d3c67a9650b7dc233fa529cb7`.

## Moteur

La méta additionne les picks d’un champion et compte ses bans une fois. Le score d’un rôle utilise sa propre présence ; la priorité acquise ailleurs ne certifie pas un rôle rare. Les premiers choix pro et la phase 1 utilisent les ordres connus avec lissage et seuil d’échantillon. Leur fréquence n’est pas un winrate de blind.

Les branches ajustent le score initial sans effacer ses critères de blind, de méta et de pool. Chaque rôle admissible d’un champion présélectionné est exploré ; les rôles occupés et les pools connus limitent la valeur de flex. Les budgets par racine évitent de consacrer toute la recherche au premier candidat. L’exploration reste limitée à 2–4 actions ; les rôles confirmés ne sont jamais déplacés automatiquement.

Une prudence explicite limite les ouvertures peu étayées en pro. Le confort renseigné réduit ce coût, sans inventer un matchup négatif. Un ou deux matchs ne donnent pas de bonus statistique ni de certification de flex.

## Vérifications

- 170 tests unitaires passent ; compilation TypeScript et build de production passent.
- Test sur le vrai Supabase : refus anonyme/non invité, comptes séparés, admin autorisé, écritures privées, scores invalides refusés. Les 3 023 lignes, 953 matchs et 934 ordres sont lus depuis la révision publiée.
- La requête élargie monolithique a échoué pendant le test réel. La migration 12 et `draft_context_slice` traitent au maximum six champions sources par requête. Les consultations suivantes envoient uniquement les nouvelles interactions. Les anciennes fonctions restent disponibles pour les clients précédents.
- Un test vérifie le refus des slices trop grandes et l’absence de renvoi des paires déjà connues. Le nouveau contexte n’est appliqué qu’une fois toutes les slices reçues avec la même révision. Les comptes temporaires, y compris ceux du test interrompu, ont été supprimés.
- Windows Electron empaqueté : connexion à Supabase, comparaison puis choix natif d’un rôle alternatif, réaction au pick et lecture des fréquences pro vérifiées. FR/sombre et EN/clair à 1104×721, aucun débordement horizontal ni texte inférieur à 14 px ; aucune erreur renderer.
- Préparation avant la draft : 16,7 s sur le poste de test ; passage aux six bans puis au premier pick : 2,6 s ; lecture de l’analyse déjà calculée : 218 ms. Ces mesures dépendent du réseau et ne constituent pas une garantie de latence.
- Nouveautés FR/EN : affichage une fois, acquittement persistant, historique, versions sautées et absence de popup dans l’overlay vérifiés sur l’exécutable empaqueté.
- Installeur local `release/0.12.1/Tchim-Draft-0.12.1-win-x64.exe`, 149 493 699 octets. SHA-256 : `c8e3a0488b3aad4c5f902e141dd3fa6acaca0ff42ce52a913144fe850c9d3fe6`.
- Inspection du paquet : 173 icônes, aucun fichier privé ni valeur réelle de jeton d’administration.

## Limites et publication

L’installateur a été construit ; le test a utilisé l’exécutable Windows empaqueté, sans lancer l’installation NSIS sur ce poste. Le code et l’application ne sont pas publiés sur GitHub. Les données statistiques et la migration nécessaire à leur consultation sont publiées sur Supabase, comme demandé.

Un nouvel entraînement local sur 933 matchs avec 20 matchs de test reste inéligible, non publié et inactif. Le benchmark de qualité avec un coach reste à constituer. Les tests fonctionnels ne démontrent pas une supériorité des drafts ni une probabilité de victoire calibrée.
