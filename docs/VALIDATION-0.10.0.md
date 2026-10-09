# Validation 0.10.0 — 9 octobre 2026

L’atelier Simulations utilise un moteur local distinct de l’analyse de draft : continuations pondérées par les scores, orientations qualitatives légères, contexte des deux équipes, réservations de champions/rôles et respect du Fearless. Chaque étape automatique reprend les vrais critères du moteur (matchups, synergies, plan, échantillons, méta et pools). Les bans sont recalculés selon leurs conséquences. Les choix imposés par le coach sont explicites et peuvent dépasser le pool connu. Un manque de picks jouables produit une branche partielle signalée.

Les simulations sont indépendantes de la draft active et disposent d’une table SQLite dédiée. Les données existantes ne sont pas modifiées. Les appels IPC sont limités au preload et aux fenêtres autorisées, avec schémas stricts et validation des contraintes. Un worker séparé traite les simulations ; annuler une génération termine ce worker, puis il est recréé à la demande.

## Vérification locale

- 112 tests passent dans 12 fichiers. Les nouveaux contrôles couvrent la diversité de 24 branches complètes, le préfixe immutable, les rôles des deux équipes, les réservations de picks/bans futurs, le Fearless, les conflits de verrous, les pools impossibles, les séries terminées, la reproductibilité et les bans simultanés de Solo Queue.
- TypeScript et Vite compilent. Les statistiques restent actualisées sur demande, sans scraping pour ce changement.
- Vérification Electron sur une copie isolée de la base réelle : glisser-déposer d’Ahri en R5/MID, douze continuations, comparaison de deux branches, sauvegarde indépendante, duplication, modification, remplissage d’une branche et réouverture. Ctrl+Z dans l’atelier n’annule pas la draft réelle.
- Le binaire empaqueté Windows passe `node scripts/simulation-ui-test.mjs --real --packaged` : comparaison, glisser-déposer, sauvegarde SQLite relue par une connexion indépendante, chargement, duplication, modification, complétion, annulation de calcul et FR/EN. Les contraintes conflictuelles sont rejetées au niveau IPC ; aucune erreur renderer. La draft active reste identique.
- Benchmark final de 48 branches sur les données réelles : 48 drafts complètes et distinctes en **15,3 secondes** (14,0 secondes dans le moteur), avec 12 appels snapshot traités pendant le calcul. Les douze premières branches du test UI sont disponibles en 7,2 secondes, transfert initial compris. Aucune probabilité de victoire n’est présentée ; les scores restent heuristiques.
- Packaging NSIS x64 réussi : `release/0.10.0/Tchim-Draft-0.10.0-win-x64.exe`. Interface inspectée à la taille minimale Windows, soit un renderer de 1104×721 : pas de débordement horizontal, commandes fixes et défilements séparés des branches, de l’édition et du catalogue.
- La régression `scripts/face-ui-test.mjs` passe sur le binaire 0.10.0 avec données réelles : 60 options TOP, classement, prévisualisation, sélection manuelle, raccourcis, disposition minimale, dialogues, Fearless, FR/EN, côté rouge et overlay synchronisé. Aucun changement au classement de la draft active ; aucune erreur renderer. Analyse de la fixture : 486 ms.
- `scripts/ui-test.mjs` passe aussi sur le binaire : ban/annulation, doubles picks, sessions, douze simulations, pool, démo, langue et synchronisation de l’overlay. Fenêtre overlay native always-on-top confirmée ; `contextIsolation` et `sandbox` actifs dans les deux fenêtres.

Les instances de test utilisent `.test-data`, jamais la base personnelle. Captures et rapports : `artifacts/simulations-desktop.png`, `artifacts/simulations-desktop-small.png`, `artifacts/simulations-compare.png` et `artifacts/simulation-ui-report.json`.

## Publication et mise à jour

La [release 0.10.0](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.10.0) est publique. Le [workflow Windows](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/37991630074) construit et publie le commit `3b4e3d97b6baf2f667422fe507bc3c10900470fd` : tests, packaging, installeur, blockmap et `latest.yml`.

L’installeur officiel est accessible sans compte, cookie ni Authorization : **126 023 259 octets**, SHA-256 `53de631d4128d1f42b098957379f67d13939fa69bc896c87bebe44725f364fc7`. Son SHA-512 correspond aux métadonnées publiques. Rapport : `artifacts/public-release-report.json` ; copie officielle dans `release/0.10.0/github/`.

Le test natif `scripts/update-download-test.mjs` confirme **0.9.0 → 0.10.0** : téléchargement par `electron-updater`, contrôle d’intégrité et interface « Mise à jour prête ». Draft, équipes, paramètres et statistiques restent identiques pendant ce contrôle, sans collecte. L’installation à la fermeture est activée en production ; son exécution est désactivée uniquement dans le test pour préserver l’installation personnelle. L’installation effective NSIS n’est pas exécutée. Rapport : `artifacts/update-download-report.json`.
