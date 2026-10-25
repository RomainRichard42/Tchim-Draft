# Validation 0.15.1 — 25 octobre 2026

Actualisation et publication demandées explicitement par l’utilisateur : données, modèle, Supabase et GitHub. Les collectes restent des actions administratives, sans scraping au démarrage des clients.

## Données vérifiées

Révision : `2bad61d9910df876fa1eb19aee08a06d90516c02314f3f970d4d745b20e4ae2f`. Révision remplacée : `0ff207db31d782a25ea85dc899642c6be76608d5d7a786a7a237c04ce4300c61`.

| Source | Patchs | Agrégats | Interactions | Matchs |
| --- | --- | ---: | ---: | ---: |
| Lolalytics Master+ | 16.21 / 16.20 / 16.19 | 2541 | 841825 | 0 |
| gol.gg | 16.20 / 16.18 / 16.17 | 1068 | 45366 | 444 |

62 archives compressées, 13541400 octets. Catalogue Data Dragon 16.21.1. Les trois patchs sont sélectionnés séparément pour chaque source.

Le jeu pro passe de 409 à 444 matchs : 35 ajouts, aucun ancien match perdu sur les patchs conservés. Répartition : 240 EMEA Masters, 38 Worlds, 57 LCS, 48 LEC et 61 LPL. Les Worlds comprennent 22 Play-In et 16 Main Event, avec les résultats disponibles jusqu’au 24 octobre. Les cinq autres ajouts sont des EMEA Masters.

Les 444 matchs ont une date et des équipes identifiées. L’ordre des picks/bans est vérifié pour 427 matchs ; les 17 autres restent marqués inconnus. Les 444 contextes de série sont documentés Fearless depuis le champ explicite des pages de tournoi. Les jeux bruts et leur cache restent locaux ; seules les statistiques, les matchs publics et leurs contextes sont publiés. Les paramètres, comptes, préparations et résultats privés ne sont pas exportés.

## Fiches et notes de patch

Révision des connaissances : `7825bb9400c8c2824da200dc6c1245cfb54c5dd083a717f40d0456fbd7b244bd`.

173 fiches bilingues par patch sur 16.21, 16.20 et 16.19. Respectivement 57, 34 et 36 changements de patch interprétés depuis les pages Riot. Les 173 fiches du patch 16.21 disposent des paramètres CommunityDragon ; aucune erreur de collecte signalée. Les textes ambigus conservent leurs limites d’interprétation.

## Modèle candidat

Empreinte : `d7ecf079ff424307db2ddabc5c954b1c326340f8ad59601b172f79c108fd85f3`. Révision liée : `2bad61d9910df876fa1eb19aee08a06d90516c02314f3f970d4d745b20e4ae2f`.

Les deux patchs pro antérieurs servent à apprendre (380 matchs) ; le patch 16.20 reste entièrement réservé au test (64 matchs). Couverture des dates et équipes : 100 %. Aucun scrim privé n’est ajouté au modèle global et aucun coefficient d’équipe n’est exporté. Les statistiques de fin de partie ne servent pas de variables prédictives.

| Mesure sur le test | Candidat | Meilleure référence (side) |
| --- | ---: | ---: |
| Log loss | 0.697857 | 0.691406 |
| Brier | 0.251667 | 0.249130 |
| Exactitude | 53.125 % | 53.125 % |

**Candidat publié, inactif et non éligible.** Motifs : échantillon de test inférieur à 100 matchs et absence d’amélioration suffisante face à la référence. Les seuils et hyperparamètres n’ont pas été ajustés sur le test. Le moteur statistique reste utilisé ; les scores ne sont pas des probabilités de victoire calibrées.

Reproduction locale après compilation :

`node scripts/initialize-shared-model.mjs --dataset=data/shared-20261025 --output=artifacts/model-20261025`

Le script vérifie le manifeste, les tailles, SHA-256 et doublons des archives d’entraînement. Il sauvegarde le candidat complet et le rapport sans publication par défaut. L’option explicite `--publish` exige que la révision stable Supabase corresponde aux données entraînées, puis relit et compare le candidat enregistré. L’activation reste une opération distincte.

## Vérification de la livraison

- 222 tests dans 25 fichiers passent, ainsi que TypeScript et le build Windows. Les scénarios de régression du patch 16.20 utilisent un extrait fixe de dix champions ; le catalogue courant fait l’objet d’un contrôle séparé.
- La fenêtre de nouveautés FR/EN est testée dans l’exécutable Windows, avec affichage unique, retour depuis les paramètres, sauts de version et petit écran. 346 images de 173 champions sont vérifiées dans le paquet.
- Les archives et le contexte de série sont publiés ensemble. Le candidat et les fiches sont relus et comparés après envoi.
- Un compte coach approuvé reçoit 3609 agrégats et 444 matchs. Les accès anonymes et non approuvés sont refusés. Les contextes et fiches distants correspondent aux documents validés.
- Dans l’exécutable 0.15.1 connecté, le worker reçoit 444 contextes, 444 matchs dont 38 Worlds, les connaissances actualisées et aucun modèle appris actif. Aucune erreur du renderer. Les comptes de contrôle sont déconnectés et supprimés.
- Les clés serveur et fichiers privés sont exclus de Git et du paquet. Aucune migration de schéma ou règle d’accès n’a été modifiée.

La publication GitHub utilise le workflow manuel et le tag `v0.15.1`. Les futurs pushes ne publient pas automatiquement d’installeur. [Release 0.15.1](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.15.1).
