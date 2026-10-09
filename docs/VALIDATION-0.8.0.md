# Validation 0.8.0 — 9 octobre 2026

## Design Focus

Le design 4 validé est intégré dans React : navigation horizontale, équipes empilées et jauge à gauche, aperçu et deux alternatives au centre, plan de jeu/réponses/Fearless à droite, confirmation persistante en bas. La liste complète reste scrollable et recherchable. Les explications et les commandes utilisent les contrats IPC existants.

Les champions, icônes, scores, fiabilité, plans et réponses affichés proviennent de la base locale et du moteur. La maquette ne fournit aucune statistique de production. Une absence de scouting exploitable est indiquée explicitement sur la carte de ban. Le moteur, les sources, les règles de pondération et la base personnelle ne sont pas modifiés pour cette version.

## Build et tests

- 105 tests passent dans 11 fichiers.
- TypeScript, Vite et packaging NSIS x64 réussis : `release/0.8.0/Tchim-Draft-0.8.0-win-x64.exe`.
- Le parcours Focus passe sur le binaire Windows empaqueté, avec une copie isolée de la base réelle et des icônes ; les originaux restent intacts.
- 60 picks top disponibles dans la fixture ; la carte principale affiche le champion et le score exacts du moteur. Les dix champions de la manche Fearless précédente sont exclus.
- Comparaison d'une alternative sans mutation de la draft, préparation par le bouton principal et `Ctrl+2`, recherche/effacement, défilement jusqu'au treizième pick et explication détaillée, confirmation manuelle du rôle et annulation vérifiés.
- Géométrie contrôlée en 1672×941 et 1120×760 : trois colonnes, aucune barre de défilement de page, validation entièrement visible. La liste intérieure mesure respectivement 226 et 117,7 pixels de haut dans la fixture.
- FR/EN, changement de côté, signe de la jauge et synchronisation de l'overlay vérifiés. Archivage d'une draft complète : manche 3/5 et vingt champions indisponibles.
- Première analyse explicite après préparation : 385 ms ; cela ne mesure pas le chargement initial de la base. Aucune erreur renderer ni collecte statistique.

Captures réelles inspectées : `artifacts/focus-desktop-wide.png` et `artifacts/focus-desktop-small.png`. Rapport local : `artifacts/focus-ui-report.json`. Ces fichiers de test sont exclus de Git.

`scripts/coach-ui-test.mjs` passe également sur ce binaire final : archivage/réouverture des manches, historique manuel, blocage des champions via IPC et sélecteur, sauvegarde/chargement de session, persistance au redémarrage, plans des deux équipes, conséquences des bans, raccourcis, petits échantillons, FR/EN et overlay. La fixture pro à deux parties reste sans effet de winrate ou de priorité méta, avec fiabilité statistique nulle. Aucun message d'erreur renderer. Rapport local : `artifacts/coach-ui-report.json`.

`scripts/ui-test.mjs` passe sur le binaire final : navigation, accès aux deux champs multi OP.GG, absence de pool adverse indiquée sur la carte de ban, ban/annulation, double pick de deux rôles distincts, sessions, trois simulations complètes, pool, import d'une démo fictive et paramètres FR/EN. L'overlay se synchronise et son statut natif always-on-top est confirmé après affichage des deux fenêtres sans prise de focus. `contextIsolation` et `sandbox` sont actifs dans les deux fenêtres ; `window.require` et `window.process` sont absents du renderer. Aucune erreur renderer. Le test vérifie l'accès aux imports OP.GG, sans effectuer de nouveau scraping.

## Limites de validation

Les tests utilisent des instances et des données isolées. Ils ne remplacent pas une session de coaching pendant un match ni l'exécution de l'installation NSIS sur l'installation personnelle. Aucun nouveau scraping gol.gg, Lolalytics ou OP.GG n'est nécessaire pour ce changement d'interface. Les scores et réponses restent des heuristiques, sans probabilité de victoire calibrée.

## Publication et mise à jour

La [release 0.8.0](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.8.0) est publique. Le [workflow Windows](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/37864536772) a réussi sur le commit `c1cccf5` : tests, build, packaging et publication de l'installeur, du blockmap et de `latest.yml`.

L'installeur officiel a été téléchargé sans compte ni en-tête Authorization : **125 997 754 octets**, SHA-256 `bd8f94b4e8019f7513c4397e7d40b4dfacc9553b233bdae902f4d90aec33f8e0`. Son SHA-512 correspond aux métadonnées publiques. Rapport local : `artifacts/public-release-report.json` ; copie officielle : `release/0.8.0/github/`.

`scripts/update-download-test.mjs` confirme le téléchargement natif **0.7.1 → 0.8.0** via `electron-updater`, son intégrité et l'affichage de « Mise à jour prête ». Les snapshots de la draft, des équipes, des paramètres et des statistiques restent identiques pendant le téléchargement. Aucune collecte ni erreur renderer. L'installation à la fermeture est activée par défaut dans l'application ; son exécution est désactivée uniquement dans cette instance de test pour préserver l'installation personnelle. L'installation effective NSIS n'a pas été exécutée. Rapport local : `artifacts/update-download-report.json`.
