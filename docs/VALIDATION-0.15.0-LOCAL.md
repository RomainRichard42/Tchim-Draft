# Tchim Draft 0.15.0 — essai local

Statut : changements locaux, aucune publication GitHub ou Supabase. La version partagée reste 0.14.0 et les utilisateurs gardent les données précédemment publiées.

## Lancer l’essai

Double-cliquer sur `Tester Tchim Draft.cmd` à la racine du projet. Il ouvre `release/0.15.0-local/win-unpacked/Tchim Draft.exe` avec le profil séparé `data/local-preview-0.15.0`. Le badge **TEST LOCAL · Worlds / LPL** identifie cette fenêtre. La synchronisation Supabase et les mises à jour de l’application sont désactivées dans ce lancement. Les liens OP.GG peuvent toujours être importés à la demande.

`Lancer Tchim Draft.cmd` et le profil habituel `data/local` ne sont pas modifiés. Les résultats saisis dans le profil de test restent locaux.

## Changements à éprouver en coaching

1. **Calculs** : la part inconnue de la composition reste neutre ; un blind ne remplace plus tout le budget de synergie et de composition. L’incertitude du blind est distincte du matchup mesuré. Une composition hypothétique utilise les mêmes champions pour ses statistiques, compétences et effets de patch. La couverture des changements est vérifiée par champion et rôle, dans le contexte statistique sélectionné.
2. **Données pro** : collecte locale gol.gg, cache brut conservé, accès espacés, anciennes parties réutilisées. Ajout de la LPL au périmètre de collecte et d’export. Lolalytics Master+ est conservé, sans nouvelle collecte.
3. **Flexs** : réaffectation des picks précédents sur les rôles observés et les pools compatibles. La place actuelle d’un choix manuel reste valide. Un rôle alternatif rare nécessite au moins trois apparitions pro pondérées sur un champion déjà documenté, ou une déclaration de pool ; cela ne donne aucun bonus de winrate ni une confiance statistique entière. Un flex adverse déjà révélé reste une possibilité de réponse dans les rôles compatibles ; son matchup et le duo bot ne sont pas présentés comme certains. Les paires de contexte sont moyennées entre ses placements possibles. Les verrous explicites et les choix imposés dans une branche sont respectés. L’annulation restaure les rôles avant le choix annulé.
4. **Bans** : les recommandations intègrent des continuations jusqu’aux picks des deux camps et à notre réponse, en terminant les doubles picks. Le ciblage OP.GG et le coût de retirer notre propre option sont conservés. Les rôles possibles d’une réponse flex restent plusieurs branches. Le risque ne pénalise plus une mauvaise décision que notre équipe peut simplement refuser.
5. **Réactivité** : les doubles picks réutilisent l’arbre calculé. Les simulations complètes se demandent dans l’atelier ; les trois anciennes continuations invisibles ne sont plus calculées à chaque décision. La recherche bornée conserve des options de chaque rôle, des flexs et des réponses probables, et réintroduit des counters documentés après une révélation. Les lots utilisent également une sélection diversifiée par rôle et plan, avec élargissement pour les counters et les rôles manquants ; leur avertissement indique cette limite. La liste interactive des choix reste complète.

## Jeu de données préparé

Collecte du 16 octobre 2026, uniquement dans `data/refresh-20261016-worlds` ; export préparé dans `data/shared-worlds-20261016`.

| Compétition | Patch | Parties |
| --- | --- | ---: |
| Worlds 2026 Play-In | 16.20 | 8 |
| EMEA Masters | 16.20 | 21 |
| EMEA Masters | 16.18 | 214 |
| LPL | 16.17 | 61 |
| LCS | 16.17 | 57 |
| LEC | 16.17 | 48 |
| **Total** | **3 patchs pro disponibles** | **409** |

Les huit parties Worlds sont datées du 15 octobre. Les pages de tournoi et les séries identifient les 409 contextes comme Fearless. Les matchs LCK/LFL hors de cette fenêtre ne sont pas ajoutés artificiellement. La fenêtre pro disponible est 16.20 / 16.18 / 16.17 ; celle de Lolalytics reste 16.20 / 16.19 / 16.18, exclusivement Master+.

- Pro : 995 agrégats et 41 002 paires, reconstruits sur cette population.
- Solo : 2 558 agrégats et 1 008 382 paires, inchangés.
- Export : 74 blocs, révision `0ff207db31d782a25ea85dc899642c6be76608d5d7a786a7a237c04ce4300c61`.
- Sources : [Worlds Play-In sur gol.gg](https://gol.gg/tournament/tournament-matchlist/Worlds%202026%20Play-In/), [LPL Grand Finals](https://gol.gg/tournament/tournament-matchlist/LPL%202026%20Grand%20Finals/), [LPL Regional Finals](https://gol.gg/tournament/tournament-matchlist/LPL%202026%20Regional%20Finals/).

## Vérifications

Le build TypeScript et Electron passe. Les **222 tests dans 25 fichiers** passent sur le code final (`artifacts/tests-015.json`). Les contrôles des lots de simulations couvrent notamment 24 branches distinctes, leur légalité, les verrous futurs, les pools, le Fearless, la reproductibilité et la restauration des rôles.

Les rapports détaillés sont locaux dans `artifacts/` : tests, scénarios de moteur, contrôles Electron et captures. `scripts/competitive-ui-test.mjs --packaged` vérifie la version construite avec les vrais 409 matchs, deux pools de cinq joueurs, la libération du top par Gragas jungle, le verrouillage et l’annulation, puis les thèmes sombre/clair en petite fenêtre. Le test utilise une copie du profil d’essai.

Le contrôle sur l’exécutable Windows final passe : 409 matchs utilisés, filtre TOP visible même si ce rôle peut être libéré par un flex, réaffectation/annulation et verrous corrects, thèmes sombre/clair sans débordement horizontal et aucune erreur de l’interface. `artifacts/final-local-015-report.json` conserve les empreintes de l’installeur et de l’application, ainsi que les résultats des tests. Les anciennes copies de test sont conservées : leur suppression a été refusée par le contrôle automatique d’autorisation.

## Limites à garder visibles

Huit matchs Worlds ne définissent pas à eux seuls une méta fiable. La présence pick/ban est évaluée séparément des victoires, avec une couverture minimale ; les winrates et interactions trop peu documentés restent neutralisés. L’exploration est une recherche limitée, avec une politique gloutonne pour les bans suivants, pas une résolution exhaustive du BO. Plusieurs bans d’ouverture peuvent aboutir à la même suite si les bans suivants convergent. Les fréquences de réponse restent heuristiques et l’indice n’est pas une probabilité de victoire validée.

L’apprentissage ML et la qualité des profils de champions non documentés restent ceux de la version précédente. Aucun modèle non validé n’a été activé. L’étape suivante est ton jugement sur des positions réelles de draft ; la publication attend ta demande explicite.
