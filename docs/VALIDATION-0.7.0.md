# Validation 0.7.0 — 8 octobre 2026

## Moteur et build

- 93 tests passent dans 10 fichiers, dont 12 tests de régression du contexte par rôle.
- Profils complets vérifiés : top 40/10/15/35, jungle 10/20/30/40, mid 25/15/25/35, ADC 10/25/30/35 ; support 40/40/20.
- Le même counter direct a davantage d'effet au top qu'au mid, jungle ou ADC. Sa valeur propre n'est pas diluée par les autres rôles révélés.
- Les quatre paires adverses du duo botlane participent à son évaluation. La synergie statistique ADC/support intervient uniquement dans ce bloc pour le support.
- Synergies prioritaires mid/jungle, jungle/support et ADC/support, poids adaptés aux picks connus, curseurs utilisateur et désactivation des critères vérifiés.
- Des paires pro sur un ou deux matchs n'ajoutent aucun bonus dans le classement réel. Les données absentes et paires inutilisables restent neutres.
- Les changements de paires sont pris en compte même si l'array des statistiques individuelles reste le même. Le cache suit les références et tailles des paires et matchs historiques.
- Classement modifié par le duo adverse, jauge réactive et symétrie bleu/rouge vérifiés. Solo Queue conserve son chemin de scoring.
- TypeScript, Vite et packaging NSIS x64 réussis : `release/0.7.0/Tchim-Draft-0.7.0-win-x64.exe`.

## Electron empaqueté

`scripts/role-context-ui-test.mjs` a été exécuté sur `release/0.7.0/win-unpacked/Tchim Draft.exe`, avec une copie isolée de la base réelle et des icônes. Aucun fichier personnel original n'a été modifié.

- 42 supports proposés ; première analyse explicite mesurée à 1 267 ms après préparation de la draft. Cette mesure ne représente pas le coût du premier chargement de la base.
- Les scores changent quand la botlane Ashe/Nautilus devient Ashe/Karma.
- Les trois blocs, sous-scores, poids effectifs et bases 40/40/20 sont visibles dans « Pourquoi » en FR/EN. Aucune erreur renderer.
- Rapport local : `artifacts/role-context-report.json` ; capture native : `artifacts/role-context-support.png`.

`scripts/coach-ui-test.mjs` passe également sur cette version : Fearless archive/réouverture/historique manuel, sessions et redémarrage, exclusions IPC et sélecteur, plans, conséquences de ban, raccourcis, faibles échantillons, FR/EN et overlay. Rapport local : `artifacts/coach-ui-report.json`.

La capture Playwright du nouveau panneau a rencontré un blocage de rendu dans la fenêtre masquée de test. Le test utilise une capture native Electron et active le rendu de fond uniquement dans cette instance de test. Les assertions fonctionnelles restent exécutées contre le vrai renderer et l'IPC de l'app empaquetée.

## Limites

Ces coefficients sont des hypothèses de coaching, sans calibration prédictive. Le 2v2 est approximé à partir de statistiques de paires et de profils qualitatifs, sans mesure individuelle de gold/CS/XP à 15 minutes. Les scores ne sont pas des probabilités de victoire. Les rôles ennemis doivent être attribués manuellement ; l'incertitude des flex n'est pas modélisée.

Le test utilise le binaire empaqueté ; il n'exécute pas l'installation NSIS ni une mise à jour dans l'installation personnelle. La collecte des statistiques reste manuelle ; aucun scraping ni republication de données n'a été nécessaire pour cette version.

## Publication et mise à jour

La [release 0.7.0](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.7.0) est publique. Le [workflow Windows](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/37839649442) a terminé avec succès sur le commit `f436138` : 93 tests, build et packaging, puis publication de l'installeur, du blockmap et de `latest.yml`.

L'installeur officiel a été téléchargé sans compte, cookie ni en-tête Authorization : **125 988 860 octets**, SHA-256 `59669e2e2d9496192975195fecb72c2ce08dc48ba01ece294d2ffdb764f1be16`. Son SHA-512 correspond à `latest.yml`. Rapport local : `artifacts/public-release-report.json` ; copie du binaire officiel : `release/0.7.0/github/`.

`scripts/update-download-test.mjs` a aussi vérifié le téléchargement natif **0.6.2 → 0.7.0** via `electron-updater`, dans une instance isolée avec le cache de téléchargement dans le répertoire de test. Le même fichier et son checksum ont été contrôlés ; le bouton « Mise à jour prête » et le message d'installation à la fermeture sont visibles. Les paramètres, draft, équipes et données sont conservés ; aucune collecte statistique ni erreur renderer. La politique normale d'installation à la fermeture est activée ; son exécution a été désactivée uniquement dans le test pour ne pas installer le binaire sur l'ordinateur personnel. Rapport local : `artifacts/update-download-report.json`.
