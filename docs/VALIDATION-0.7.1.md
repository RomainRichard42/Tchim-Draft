# Validation 0.7.1 — 9 octobre 2026

## Moteur et build

- 105 tests passent dans 11 fichiers, dont 12 tests de régression du blind.
- Le budget du vis-à-vis reste présent avant sa révélation, y compris après deux picks alliés. Les réponses disponibles influencent le score plutôt qu'un unique pire counter.
- Picks, bans, Fearless, rôle réellement observé, côté adverse et pools explicitement restreints filtrent les réponses.
- La familiarité adverse utilise le score de maîtrise multiplié par sa confiance. Un champion absent du pool ne reçoit pas un bonus de familiarité parce que le profil du joueur est fiable.
- Les paires pro sur un ou deux matchs ne produisent aucun effet de matchup. Le manque de couverture a un coût d'incertitude distinct, sans inventer de perte statistique. Le coût de développement des tops est qualitatif, borné et séparé.
- Le matchup révélé remplace toute l'évaluation de blind. Solo Queue et le contexte support conservent leurs chemins de calcul.
- TypeScript, Vite et packaging NSIS x64 réussis : `release/0.7.1/Tchim-Draft-0.7.1-win-x64.exe`.

## Comparaison sur les données locales

Le moteur utilise les données déjà collectées, Master+ et gol.gg, sans nouvelle collecte. Les comparaisons gardent les mêmes drafts, sources et poids par défaut entre 0.7.0 et 0.7.1.

- Premier pick avec filtre top : Camille était deuxième à **51,6**, puis passe à **45,3**, hors du top 5.
- Top encore blind après Sejuani jungle et Ahri mid alliés, contre Ashe/Nautilus : Camille passe de **56,4** à **49,8**. Elle reste une option selon le contexte, sans exclusion nominative.
- Les scores sont des indices de draft. Ils ne représentent ni des winrates ni des probabilités de victoire.

Les résultats locaux de comparaison sont dans `artifacts/blind-before.json` et `artifacts/blind-after.json`. Les statistiques sources n'ont pas été validées par une nouvelle visite des sites pour cette version.

## Electron empaqueté

`scripts/blind-ui-test.mjs` passe sur `release/0.7.1/win-unpacked/Tchim Draft.exe`, avec une copie isolée de la base réelle et des icônes. Aucun fichier personnel original n'est modifié.

- Première analyse explicite : **819 ms** après préparation de la draft ; ce n'est pas le coût du premier chargement de la base.
- Camille : **45,3** en blind ; **44,1** si le top adverse possède un pool de test avec 300 parties de Jax ; **46,1** après ban de Jax sans scouting. Cette fixture vérifie le poids du pool, sans collecte OP.GG.
- Après révélation de Renekton top adverse, l'évaluation spéculative est retirée et le contexte affiche le matchup connu.
- Les badges, réponses à surveiller, couverture, incertitude et coût de développement sont visibles dans « Pourquoi » en FR/EN.
- Aucune erreur renderer ni collecte statistique. Rapport local : `artifacts/blind-ui-report.json`.

`scripts/role-context-ui-test.mjs` passe également sur ce binaire : 42 supports proposés, scores modifiés par le passage d'Ashe/Nautilus à Ashe/Karma, détail des trois blocs et bases 40/40/20 visible en FR/EN, sans erreur renderer. Première analyse explicite : 2 583 ms après préparation. Le test attend la fin du recalcul avant d'inspecter les recommandations après changement de langue. Rapport local : `artifacts/role-context-report.json`.

## Limites

Les coefficients du risque, de l'incertitude et du développement sont des hypothèses de coaching, sans calibration prédictive. Les statistiques de paire mesurent des résultats de partie ; elles ne décrivent pas directement les vagues, le gold, les CS ou les ressources nécessaires à la lane. Les rôles ennemis doivent être attribués manuellement ; les flex non résolus ne sont pas modélisés.

Le test utilise le binaire empaqueté. Il n'exécute pas l'installation NSIS sur l'installation personnelle. Aucun scraping ni republication de données n'est nécessaire pour cette version.
