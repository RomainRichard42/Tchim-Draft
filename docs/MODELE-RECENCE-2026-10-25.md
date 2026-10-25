# Modèle pondéré par récence, patch et compétition — 25 octobre 2026

Le changement demandé est implémenté et le candidat a été réentraîné sur 444 matchs, dont 38 matchs des Worlds (22 Play-In, 16 Main Event), avec des données allant jusqu'au 24 octobre. **Ce candidat ne montre pas d'amélioration sur les matchs récents et reste inactif.** Cette expérience est locale : aucun modèle, code ou installateur n'a été publié.

## Pondération appliquée

Le poids relatif d'un match est :

`coefficient_compétition × 2^(-âge_en_jours / 30) × 2^(-écart_au_patch_live / 2)`

Un match perd donc la moitié de son poids de date après 30 jours et la moitié de son poids de patch après deux patchs d'écart. Ces deux effets se multiplient. Le calcul compte aussi les patchs absents du jeu de données : 16.18 vers 16.20 représente deux patchs. Les poids sont normalisés par leur somme lors de l'apprentissage.

| Compétition | Coefficient |
| --- | ---: |
| Worlds Main Event | 1,50 |
| Worlds Play-In | 1,25 |
| LCK, LPL, LEC, LCS | 1,00 |
| EMEA Masters | 0,60 |
| LFL | 0,45 |
| Compétition inconnue | 0,40 |
| Scrim local | 0,25 |

Ce barème traduit une préférence de modélisation ; il ne constitue pas une mesure empirique du niveau des ligues. Il a été fixé avant cette comparaison. L'entraînement partagé réalisé ici ne contient aucun scrim privé. Les matchs sans date exploitable, futurs, sur un patch futur ou d'une autre saison sont exclus ; aucun des 444 matchs de cette expérience n'a dû être exclu.

Le patch live de référence est 16.21 (26.21 dans la communication Riot). Le calendrier historique est vérifié jusqu'au 25 octobre 2026 ; il doit être actualisé pour évaluer des journées ultérieures. Avec des dates de match sans heure fiable, le jour de sortie d'un patch conserve par prudence le patch précédent. Sources : [calendrier Riot](https://support.riotgames.com/en-us/league-of-legends/gameplay/patch-schedule-league-of-legends) et [notes de patch officielles](https://www.leagueoflegends.com/en-gb/news/tags/patch-notes/).

Dans le réentraînement final, les Worlds représentent **39,87 % du poids**, contre **8,56 % des matchs**. La concentration des poids ramène la taille effective de l'échantillon à **184,61**, selon `(somme des poids)² / somme des poids²`. Cette mesure ne prouve pas l'indépendance des parties.

## Vérification chronologique et réentraînement final

Pour chaque journée, les prédictions sont calculées avec les résultats des journées antérieures seulement. Les parties d'une même journée restent ensemble. Le patch live utilisé est celui connu à cette date. Au moins 200 parties antérieures sont nécessaires pour démarrer une validation. Les données disponibles permettent 228 prédictions hors apprentissage sur 21 journées ; 21 journées initiales n'atteignent pas les conditions de validation.

Après cette vérification, un modèle final distinct est ajusté sur les 444 matchs, y compris les derniers Worlds. Ses scores d'apprentissage ne sont pas utilisés pour démontrer sa qualité. Le protocole suit le principe d'une séparation temporelle exposé dans la [documentation de validation croisée de scikit-learn](https://scikit-learn.org/stable/modules/cross_validation.html).

La régularisation passe de 0,025 à 0,1 afin de limiter des coefficients excessifs sur un petit échantillon. Un témoin sans pondération, avec exactement la même régularisation et les mêmes journées, permet d'isoler l'effet des poids. Les coefficients d'identité des équipes servent de contrôles pendant l'ajustement puis sont retirés ; les prédictions de validation utilisent bien les coefficients exportés.

## Résultats

Erreur logarithmique (log loss) : **plus bas est meilleur**. Chaque match compte une fois dans les scores principaux.

| Modèle | Dernier patch, 64 matchs | Worlds, 38 matchs |
| --- | ---: | ---: |
| Ancien candidat publié, figé avant le dernier patch | 0,697857 | 0,684104 |
| Nouveau candidat pondéré, réentraîné chaque journée | 0,705506 | 0,688861 |
| Ancien algorithme réentraîné sur les mêmes journées | 0,705763 | 0,689514 |
| Témoin sans pondération, régularisation identique au nouveau | 0,691254 | 0,679363 |
| Référence avantage moyen du côté | 0,692592 | 0,684154 |

Le score de l'ancien candidat figé est reproduit à partir de ses coefficients enregistrés et contrôlé contre son rapport original. Cette comparaison représente l'évolution par rapport au candidat déjà publié. Les deux témoins réentraînés sur les mêmes journées constituent la comparaison à protocole égal.

Sur les 228 prédictions chronologiques, le nouveau candidat obtient 0,711584, contre 0,740662 pour l'ancien algorithme. Toutefois, le témoin sans pondération avec régularisation 0,1 fait mieux encore : 0,706231. **Le gain global ne peut donc pas être attribué à la préférence pour les matchs récents et de haut niveau.** La régularisation est le changement le plus prometteur dans cette expérience.

Sur le dernier patch, le nouveau candidat trouve 31 vainqueurs sur 64, contre 34 pour l'ancien candidat figé ; sur les Worlds, 21 sur 38 contre 22. Une évaluation secondaire donnant aussi davantage de poids aux matchs récents reste défavorable au nouveau candidat (dernier patch : 0,697245 contre 0,686643).

Un bootstrap apparié par journées, avec 2 000 répétitions, donne pour l'écart d'erreur nouveau moins ancien un intervalle à 95 % de [-0,03054 ; +0,05108] sur le dernier patch (11 journées), et [-0,04901 ; +0,04098] sur les Worlds (6 journées). Les intervalles recouvrent zéro : ces petits échantillons ne permettent pas d'affirmer une différence fiable.

## Décision et limites

Le candidat reste `active: false` et `eligible: false`. Il ne bat pas suffisamment les références et ne satisfait pas les seuils de volume : seulement 64 matchs de validation sur le dernier patch, contre 100 requis, et 184,61 matchs effectifs d'apprentissage, contre 200 requis.

Ces résultats sont rétrospectifs et les données avaient déjà été examinées. Aucun réglage supplémentaire n'a été choisi pour faire gagner le candidat sur ces 64 matchs. Une amélioration future devra être confirmée sur de nouveaux matchs. Les deux méthodes utilisent le même catalogue actuel de champions ; ce n'est pas une reconstitution complète des caractéristiques historiques de chaque patch. Le jeu de données reste limité aux trois patchs professionnels disponibles les plus récents et ne couvre pas uniformément toutes les ligues.

Les tests couvrent notamment les poids, la distance de patch, les niveaux de compétition, les exclusions et l'absence d'utilisation des résultats du même jour ou du futur. Vérification : **232 tests réussis**, contrôle TypeScript, build de développement et démarrage Electron hors ligne réussis.

## Reproduction locale

Depuis la racine du dépôt, avec les archives et l'ancien candidat déjà conservés localement :

```powershell
node scripts/build.mjs
node scripts/initialize-shared-model.mjs --dataset=data/shared-20261025 --output=artifacts/model-weighted-20261025 --as-of=2026-10-25T00:00:00.000Z
node scripts/compare-models.mjs --dataset=data/shared-20261025 --candidate=artifacts/model-weighted-20261025 --previous=artifacts/model-20261025/shared-model-candidate.json --output=artifacts/model-comparison-20261025
```

La comparaison vérifie les empreintes des archives et l'identité de la révision du jeu de données. Elle produit `comparison.json` et `candidate-model.json`. Les prédictions individuelles sont conservées dans `artifacts/model-weighted-20261025/chronological-predictions.json`. L'ancien candidat n'est pas écrasé.

Révision des données : `2bad61d9910df876fa1eb19aee08a06d90516c02314f3f970d4d745b20e4ae2f`.
