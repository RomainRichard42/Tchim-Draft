# Méta par patch et verrouillage réactif — 25 octobre 2026

Ce rapport décrit les tests locaux avant publication. Les changements sont préparés pour la version 0.15.2 à la demande de l’utilisateur. Le nouveau modèle reste inactif ; les résultats ci-dessous ne constituent pas une validation pour son activation.

## Verrouillage d'un champion

Le signalement de 50 secondes n'a pas été reproduit sur le PC du joueur et sa version installée n'est pas confirmée. Quatre attentes ont été identifiées dans le code :

- Les commandes manuelles étaient désactivées pendant l'analyse.
- La confirmation recalculait le score du champion dans le processus principal.
- L'analyse attendait les requêtes de statistiques centrales.
- Les calculs obsolètes pouvaient attendre dans le worker ; leur expiration ne stoppait pas le travail en cours.

La confirmation vérifie maintenant la légalité et les placements possibles, puis enregistre immédiatement le choix local. Les recommandations restent désactivées tant qu'elles sont périmées, mais le choix manuel, les slots, le verrouillage de rôle et l'annulation restent utilisables pendant l'analyse. Les flexs, pools, rôles verrouillés, doublons et règles Fearless continuent d'être vérifiés.

La synchronisation de statistiques se fait en arrière-plan, avec regroupement des demandes intermédiaires. Les nouvelles données déclenchent une nouvelle analyse. Le worker garde son jeu de données ; un compteur partagé lui permet d'interrompre un calcul périmé et de passer à la draft courante. Une expiration tue réellement le worker. Le cache est séparé par compte et révision. Les totaux de couverture ne sont plus recalculés sur les centaines de milliers de paires à chaque clic.

Cette séparation du travail coûteux et des interactions suit les recommandations de [performance d'Electron](https://www.electronjs.org/docs/latest/tutorial/performance). Les appels et permissions Supabase restent inchangés ; seule leur place dans le parcours d'analyse change.

Mesures sur cette machine, avec **444 matchs et 887 191 paires** :

| Mesure | Durée |
| --- | ---: |
| Ancien recalcul synchrone d'un pick, moteur seul | 1 020 ms |
| Nouvelle validation d'un rôle libre, moteur seul, moyenne de 30 essais | 0,013 ms |
| Clic réel sur Valider → fermeture du sélecteur, analyse en cours | **375 ms** |
| Trois confirmations suivantes par IPC | **385 / 398 / 678 ms** |

Le test natif vérifie que le choix fonctionne alors que l'analyse est encore en cours, puis confirme les picks enregistrés et l'annulation. La mesure du clic commence à l'événement DOM effectivement reçu : les délais de stabilisation et de polling de Playwright ne sont pas comptés comme latence de l'application. Ce sont des mesures locales, pas une promesse pour toutes les machines. Les téléchargements lents sont couverts par un test de coordination avec une promesse réseau bloquée ; aucun compte du joueur n'a été utilisé.

## Modèle de méta

Le candidat `patch-meta-v2` remplace le coefficient permanent de chaque champion par quatre entrées qui évoluent avec le contexte : force statistique, priorité professionnelle, synergies et matchups de lane. Les caractéristiques générales de composition restent apprises. Les coefficients d'équipe sont des contrôles pendant l'ajustement et ne sont pas exportés comme avantage de draft.

La force est estimée par champion, rôle et patch à partir des matchs professionnels antérieurs et des instantanés Master+ réellement disponibles à la date considérée. Les estimations sont ramenées vers la neutralité quand le volume est faible : régularisation équivalente à 20 observations pro, 500 parties solo et 24 observations de paires. Le mélange pro/solo est fixé à 55/45 ; la priorité picks/bans est une entrée distincte du taux de victoire. Les interactions de paires sont corrigées prudemment de la force individuelle estimée, sans prétendre isoler une causalité.

La pondération date / patch / compétition du premier candidat est conservée : demi-vie de 30 jours, deux patchs d'écart et coefficient supérieur pour les Worlds. Elle est complétée par une réduction du poids des observations de champions modifiés. Les changements d'objets ou de système réduisent la confiance globale ; aucun build historique n'est inventé. Les buffs et nerfs connus peuvent fournir un a priori directionnel limité à ±3 points de taux, atténué quand les données solo deviennent abondantes. Ce barème est une hypothèse de travail, pas une mesure validée de l'effet des patch notes.

Les modifications de patch ne sont utilisées qu'après la date de récupération des notes. Une page ancienne téléchargée aujourd'hui n'est donc pas considérée comme une information déjà présente dans notre historique. Cette règle est conservatrice et limite actuellement la validation des effets de notes de patch.

## Historique sans informations futures

Chaque match de validation est prédit avec les journées précédentes. Les statistiques d'un patch récupérées après le match sont exclues, même si leur numéro de patch correspond. Le réentraînement final est distinct et utilise ensuite tous les matchs disponibles.

Les instantanés de statistiques sont désormais conservés dans `meta_snapshots` en SQLite lors des imports et de l'utilisation des données partagées. Leur date de collecte originale est préservée ; les remplacements d'un pack ne détruisent plus cet historique. Les dates de collecte sont une borne prudente de disponibilité, pas la date de chaque partie solo.

Le script d'entraînement conserve aussi `meta-snapshots.json` et `meta-knowledge.json`. Il peut fusionner les archives d'anciens jeux de données avec `--history-datasets`, réutiliser un historique avec `--history-snapshots`, et recharge automatiquement l'historique déjà présent dans son répertoire de sortie. Les archives sont vérifiées avant utilisation.

Pour cette expérience, les archives actuelle et précédente fournissent six instantanés. Seulement **43 des 228 prédictions historiques** disposent de statistiques Master+ datées pour au moins huit des dix champions. Le manque n'est pas comblé avec des données futures ; il bloque l'éligibilité du modèle.

## Résultats du réentraînement

Référence temporelle : 25 octobre 2026 à 15:30 UTC. Patch live : **16.21**. Données de matchs jusqu'au 24 octobre : **444 matchs, dont 38 Worlds**. Les Worlds représentent **44,60 % du poids final** après prise en compte des changements. Taille effective pondérée : **154,80**.

Erreur logarithmique : **plus bas est meilleur**. Les scores principaux comptent chaque match une fois.

| Modèle | Dernier patch, 64 matchs | Worlds, 38 matchs |
| --- | ---: | ---: |
| Nouveau modèle de méta | **0,695531** | **0,683836** |
| Première version pondérée | 0,705506 | 0,688861 |
| Ancien candidat publié, figé | 0,697857 | 0,684104 |
| Ancien modèle avec régularisation 0,1, sans pondération | 0,691254 | 0,679363 |
| Référence simple avantage du côté | 0,692592 | 0,684154 |
| Référence force des champions du patch | 0,695961 | 0,695211 |

Le modèle de méta trouve **34/64 vainqueurs**, et **24/38 aux Worlds**. Sur les 228 prédictions chronologiques, son erreur est 0,693708 contre 0,711584 pour la première version pondérée. Sur les **17 matchs joués pendant la première semaine d'un patch**, elle est 0,699895 contre 0,731847. Ces sous-échantillons sont petits et ne démontrent pas à eux seuls une meilleure adaptation aux changements de méta.

Le bootstrap apparié par journées, 2 000 répétitions, donne pour l'écart nouveau moins ancien candidat publié un intervalle à 95 % de [-0,04943 ; +0,05369] sur les 64 matchs, et [-0,05618 ; +0,05493] sur les Worlds. Les deux recouvrent zéro. La comparaison secondaire pondérée par pertinence reste également défavorable au nouveau modèle face à l'ancien candidat figé.

**Conclusion : amélioration observée par rapport au premier candidat pondéré, mais aucune preuve suffisante pour activer le modèle.** Il reste derrière la référence simple sur le dernier patch ; il manque des matchs de validation et des instantanés historiques. `active=false`, `eligible=false`, raisons `sample`, `validation`, `meta-history`.

Les résultats sont rétrospectifs, sur des données déjà examinées. Les coefficients et barèmes de cette expérience n'ont pas été réajustés pour faire gagner le candidat après lecture des scores. Les profils structurels de champions restent ceux du catalogue courant : l'expérience ne reconstitue pas exactement chaque ancien kit. Les matchs évalués sont professionnels et culminent au patch 16.20 ; ils ne prouvent pas la qualité du modèle sur le live 16.21. Le résultat d'un match reste un indicateur imparfait de la qualité de sa draft.

## Vérification et reproduction

**247 tests réussis**, contrôle TypeScript, build et démarrage Electron hors ligne réussis. Les régressions couvrent les exclusions temporelles, les instantanés, les changements de patch, les échantillons faibles, les doublons de statistiques, les caractéristiques utilisées en entraînement et en exécution, les annulations de calcul et les placements de rôles.

```powershell
node scripts/build.mjs
node scripts/initialize-shared-model.mjs --dataset=data/shared-20261025 --history-datasets=data/shared-baseline-20261025 --output=artifacts/model-meta-20261025 --as-of=2026-10-25T15:30:00.000Z
node scripts/compare-models.mjs --dataset=data/shared-20261025 --candidate=artifacts/model-meta-20261025 --previous=artifacts/model-20261025/shared-model-candidate.json --output=artifacts/model-meta-comparison
node scripts/benchmark-lock.mjs
node scripts/lock-latency-ui-test.mjs
```

Les résultats détaillés comprennent `comparison.json`, `candidate-model.json`, `chronological-predictions.json`, `live-patch-profiles.json`, `lock-benchmark.json` et `lock-latency-ui.json`. Les profils par champion sont des estimations statistiques et des a priori ; ce ne sont pas des probabilités calibrées de victoire de draft.

Révision des données : `2bad61d9910df876fa1eb19aee08a06d90516c02314f3f970d4d745b20e4ae2f`.
