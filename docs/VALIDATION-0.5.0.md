# Validation locale 0.5.0 — 8 octobre 2026

## Livraison

- Installeur Windows x64 : `release/0.5.0/Tchim-Draft-0.5.0-win-x64.exe`.
- Taille : 125 950 296 octets.
- SHA-256 : `2D1D6E3E3D57DE76396395B12E137F7E23C0C62A0CAF9445CD1CE7C8844C6691`.
- Le lanceur `Lancer Tchim Draft.cmd` ouvre `release/0.5.0/win-unpacked/Tchim Draft.exe` avec les données du projet dans `data/local`.
- Aucun site ni release distante publié. Installeur local non signé ; le binaire empaqueté a été exécuté, pas l’installation NSIS sur le profil utilisateur.

## Moteur et construction

`npm.cmd test` : **71 tests passés, 8 fichiers**. TypeScript et build de production passent. Packaging electron-builder/NSIS terminé.

Nouveaux cas : archivage des dix picks des deux équipes ; bans ordinaires non reportés ; exclusions dans recommandations, prédictions, duos et simulations ; restauration de la manche précédente et de son côté ; anciens JSON compatibles ; victoires suivies par équipe malgré un changement de côté ; rejet d’une manche après une série gagnée, des doublons, champions inconnus et historiques falsifiés. Sources pro de 1, 2, 5 ou 9 matchs sans pool connu non proposées ; champion déclaré encore proposable qualitativement avec 1 ou 2 matchs et fiabilité nulle ; priorité méta non dominée par une ligne pro isolée ; paires de 1 ou 2 matchs sans bonus. Plans de poke, protection des carries et pression latérale contextualisés ; conséquences de bans avec remplacement, coût allié et couverture inconnue.

## Exécutable final

Les suites suivantes passent sur `release/0.5.0/win-unpacked/Tchim Draft.exe`, avec dossiers de test isolés et sans changer la base utilisateur :

- `scripts/coach-ui-test.mjs` : BO3/BO5, résultat, archivage et retour de manche, saisie manuelle d’un historique, sessions, redémarrage, champion Fearless refusé par IPC et absent du sélecteur, plans de jeu, détail d’impact des bans, Ctrl+1, FR/EN et overlay. Import réel d’une fixture de deux victoires en deux matchs : facteur winrate 50, méta 35, winrate affiché absent, fiabilité 0. Rapport `artifacts/coach-ui-report.json` ; captures `coach-plan.png` et `coach-small-sample.png`.
- `scripts/draft-ux-test.mjs` : 173 options de picks au premier tour ; recherche et sélection au rang 13 ; défilement, annulation, deux côtés, jauge synchronisée avec overlay, draft complète. À 1440×1000, les deux premières lignes sont visibles (seconde ligne : 958,5 px, hauteur utile : 961 px). Capture inspectée `artifacts/draft-ux-viewport.png` et rapport `draft-ux-report.json`.
- `scripts/scraped-ui-test.mjs` : copie réelle des 1 066 packs, fenêtres Master+ 16.20/16.19/16.18 et pro 16.18/16.17/16.16 ; 53 options MID Solo avec statistiques exploitables ; worker et interface Données ; aucun accès Node dans le renderer et aucune erreur renderer. Analyse mesurée à 4 656 ms dans ce parcours avec d’autres tests en parallèle : mesure indicative, pas un benchmark.

Sur la 0.5.0 avant les derniers ajustements de densité et de filtre des rôles, `scripts/ui-test.mjs` passe également : saisie manuelle, duo, sessions SQLite, pool, démo, langues, overlay et isolation. `scripts/manual-refresh-test.mjs` passe : lancement connecté avec données périmées et ancien réglage de collecte actif sans actualisation ; bouton manuel ; réutilisation catalogue/icônes ; packs, paramètres, équipes, draft et sessions conservés après redémarrage. Les derniers changements concernent l’affichage et le scoring, sans modification de la collecte.

La fixture des petits échantillons est explicitement synthétique. Les tests réels utilisent les packs déjà collectés ; aucune collecte complète nouvelle n’a été lancée pendant cette livraison.

## Limites

Les plans et axes restent des lectures qualitatives de profils de mécanique. La comparaison des bans est limitée au prochain choix adverse dans les filtres et pools connus ; elle ne recherche pas tout un arbre de série. Les scénarios poursuivent encore une continuation gloutonne. Les seuils d’échantillon et coefficients ne sont pas appris sur les résultats d’un tournoi. Scores et jauge ne sont pas des probabilités de victoire calibrées. Le premier/dernier pick et le découplage côté/ordre ne sont pas modifiés dans cette livraison.
