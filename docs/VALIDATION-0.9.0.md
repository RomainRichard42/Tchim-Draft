# Validation 0.9.0 — 9 octobre 2026

Le [design Face-à-face validé](../design/approved/face-a-face.png) est intégré dans Electron : équipes alignées par rôle, liste complète au centre, jauge en haut et explications regroupées en bas. Le vert désigne le plan, l’ambre le matchup / duo / ban, le violet le pool. L’ordre complet, les plans détaillés et la gestion Fearless disposent de fenêtres dédiées.

Les scores, champions, icônes et recommandations viennent du moteur et de la base locale. Les chiffres de la maquette ne sont pas injectés dans l’application. Aucune modification du scoring, des sources ou de la base personnelle. Les actualisations statistiques restent manuelles.

## Build et vérification

- Les 105 tests du moteur passent dans 11 fichiers ; TypeScript et Vite compilent.
- Packaging NSIS x64 réussi : `release/0.9.0/Tchim-Draft-0.9.0-win-x64.exe`.
- `scripts/face-ui-test.mjs` passe sur le binaire empaqueté avec une copie isolée de la base réelle et des icônes : 60 picks TOP, scores exacts, dix champions Fearless exclus, comparaison sans mutation, recherche / effacement, défilement et choix du treizième pick, détails par rôle, confirmation manuelle, raccourcis et annulation.
- Les cinq rôles des deux équipes sont sur les mêmes lignes. Géométrie vérifiée en 1672×941 et à la taille **native Windows 1120×760**, soit un renderer de 1104×721. Textes essentiels d’au moins 14 px ; portraits dans leurs lignes, bans sous les cinq rôles, validation visible et aucune barre de défilement de page. La liste intérieure mesure 294,3 et 183 pixels dans la fixture. À la taille minimale, les résumés sont condensés ; les infobulles et Détails des données donnent le texte complet.
- Les trois blocs colorés suivent le champion sélectionné. Ordre de vingt étapes, historique Fearless et plans des deux équipes accessibles depuis leurs fenêtres.
- FR/EN, côté rouge, signe de la jauge et synchronisation de l’overlay vérifiés. Une draft complète s’archive vers la manche 3/5 avec vingt champions bloqués. Une série BO3 gagnée en deux manches indique « Série terminée » et deux manches archivées, avec préparation désactivée.
- `scripts/coach-ui-test.mjs` passe également sur le binaire final : archivage / réouverture, historique manuel, blocage IPC et sélecteur, sessions et redémarrage, deux plans, conséquences des bans, raccourcis, FR/EN et overlay. Une fixture à **deux parties** reste à fiabilité 0 %, winrate nul et priorité méta neutralisée ; le pool du joueur est affiché. La même fixture est vérifiée à la taille native minimale, sans chevauchement des rôles et bans.
- `scripts/ui-test.mjs` passe sur le binaire 0.9.0 : deux champs multi OP.GG, navigation, ban / annulation, double pick de deux rôles distincts, sessions, trois simulations complètes, pool, import d’une démo et FR/EN. L’overlay natif est always-on-top après affichage ; `contextIsolation` et `sandbox` sont actifs, sans `window.require` ni `window.process` dans le renderer. Ce contrôle natif est exécuté sans autre test GUI concurrent.

Captures réelles inspectées : `artifacts/face-desktop-wide.png`, `artifacts/face-desktop-small.png` et `artifacts/coach-small-sample-minimum.png`. Rapports locaux : `artifacts/face-ui-report.json` et `artifacts/coach-ui-report.json`. Première analyse explicite de la fixture réelle : 431 ms, hors chargement initial de SQLite. Aucune erreur renderer ni collecte statistique pendant les tests.

## Portée

Les instances de test utilisent des dossiers isolés. Les données personnelles et l’installation existante restent intactes. Aucun nouveau scraping gol.gg, Lolalytics ou OP.GG n’est exécuté pour cette modification d’interface. Les scores restent des indices heuristiques de draft ; la validation ne mesure pas une probabilité de victoire ni l’efficacité en match professionnel.

## Publication et mise à jour

La [release 0.9.0](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.9.0) est publique. Le [workflow Windows](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/37869729472) a réussi sur `b1f9938b53a1d4b4ccf77571acdaf068cbd22f79` : tests, build, packaging et publication de l’installeur, du blockmap et de `latest.yml`.

L’installeur officiel a été téléchargé sans compte, cookie ni Authorization : **126 000 573 octets**, SHA-256 `d4a67c5fc579c8202c67a60f660c0c873c80424ae0d29cad5901ace58ea38cc2`. Son SHA-512 correspond aux métadonnées publiques. Rapport local : `artifacts/public-release-report.json` ; copie officielle : `release/0.9.0/github/`.

`scripts/update-download-test.mjs` confirme le téléchargement natif **0.8.0 → 0.9.0** via `electron-updater`, l’intégrité du fichier et l’affichage de « Mise à jour prête ». Les snapshots de la draft, des équipes, des paramètres et des statistiques restent identiques pendant le téléchargement, sans collecte ni erreur renderer. L’installation à la fermeture est activée par défaut ; son exécution est désactivée uniquement dans le test pour préserver l’installation personnelle. L’installation effective NSIS n’a pas été exécutée. Rapport local : `artifacts/update-download-report.json`.
