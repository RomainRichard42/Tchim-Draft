# Données, collecte et modèle

## Architecture recommandée

L’application reste autonome : SQLite, moteur et historique fonctionnent localement. Les scrapers publics gol.gg et Lolalytics sont actifs pour l’analyse locale. La distribution GitHub est implémentée : un export public de la base de l’éditeur publie des packs compressés versionnés ; les clients les importent dans SQLite sur clic. Voir [la procédure GitHub](GITHUB.md). Les droits de redistribution restent distincts de la possibilité technique de télécharger les sources.

| Option | Avantages | Coûts et risques |
| --- | --- | --- |
| Chaque installation scrape | Pas d’infrastructure propriétaire | Charge multipliée sur les sites, blocage IP/CAPTCHA, parsers distribués difficiles à corriger, droits de collecte et de redistribution toujours à vérifier |
| Collecteur central + fichiers versionnés | Une collecte, cache commun, contrôle qualité, correctifs centralisés, client utilisable hors ligne | Exploitation du cron, provenance et licences, indisponibilité du fournisseur, responsabilités de redistribution |

**Recommandation : collecteur central**, une vérification périodique du patch et des exports, publication après validation. Le catalogue Data Dragon est téléchargé directement par chaque application et mis en cache. Un CDN peut distribuer vos propres packs sans backend dynamique.

La CLI fournie accepte des **packs JSON normalisés autorisés** depuis un fichier ou une URL HTTPS. Elle conserve les réponses brutes par hash, un cache ETag et un journal SQLite ; elle espace les requêtes, vérifie les schémas, refuse les données vides et les agrégats en doublon, puis remplace `latest.json` atomiquement. Un échec conserve la dernière publication. Elle ne prétend pas collecter des sites dont les structures ou autorisations n’ont pas été établies.

```powershell
npm.cmd run build
Copy-Item tools/collector.config.example.json tools/collector.config.json
# Modifier URLs, licences et chemins ; fournir les autorisations réelles.
npm.cmd run collect -- tools/collector.config.json
```

Fichier d’autorisation local attendu :

```json
{
  "sourceId": "licensed-provider",
  "allowCollection": true,
  "allowRedistribution": true,
  "validUntil": "2027-01-01T00:00:00Z",
  "reference": "Référence de l'accord écrit conservé par l'éditeur"
}
```

Ce fichier décrit votre accord ; le programme ne peut pas vérifier que vous possédez juridiquement les droits déclarés. Il n’est pas un substitut à l’accord du fournisseur. Ne publiez que les JSON versionnés et `latest.json`, jamais les autorisations, les bruts ou la base du collecteur. Planifier la CLI via le Planificateur de tâches ou un cron ; aucun cron distant n’est créé par ce projet.

## Fournisseurs et droits vérifiés le 8 octobre 2026

- **Data Dragon** : source officielle pour versions, champions et icônes ; ne fournit aucun winrate, matchup, rôle compétitif ou draft historique. [Documentation Riot](https://developer.riotgames.com/docs/lol#data-dragon).
- **DPM** : ses conditions interdisent les requêtes automatisées, scraping et crawling sans autorisation écrite expresse. Aucun adaptateur DPM ne s’exécute dans l’application. [Conditions DPM](https://dpm.lol/tos).
- **gol.gg / Lolalytics** : pages statistiques publiques collectées localement à la demande de l’utilisateur. Les chemins utilisés sont permis par les robots.txt consultés ; le programme revérifie ces fichiers. Cela ne constitue pas une licence de redistribution. La provenance conserve cette distinction et les packs locaux ne sont pas automatiquement publiés. [robots.txt gol.gg](https://gol.gg/robots.txt), [robots.txt Lolalytics](https://lolalytics.com/robots.txt).
- **Riot** : un produit destiné aux joueurs doit être enregistré sur le Developer Portal. Une clé de production ne doit pas être embarquée dans le binaire. Le texte d’indépendance exigé apparaît dans l’application. [Politique Riot](https://developer.riotgames.com/docs/lol).

Les adaptateurs utilisent un User-Agent identifiable et au moins **2,5 secondes** entre requêtes d’un même hôte, davantage si Crawl-delay le demande. Gol.gg et Lolalytics peuvent avancer simultanément sur leurs hôtes distincts. Cache SQLite de 6 h pour les statistiques, 24 h pour robots.txt et 30 jours pour les matchs terminés. Bruts HTML/JSON conservés par SHA-256 avec URL/date. Cookies gol.gg anonymes en mémoire pour le formulaire public, redirections au même hôte HTTPS. Arrêt sur refus d’accès, problème réseau ou challenge ; aucun contournement. Imports validés et atomiques. Un verrou SQLite évite deux collecteurs dans une base. Aucun HTML ou JavaScript distant ne s’exécute dans Electron.

Lolalytics : **trois derniers patchs Data Dragon, Master+ seulement**, cinq rôles. Données Qwik décodées sans exécution. Statistiques champion/rôle complètes publiées avant les détails. Builds pour tous les rôles avec au moins 100 parties, pickrate ≥ 0,5 % et au moins 10 % du volume du champion, ainsi que les pools prioritaires. Matchups complétés par la requête de synergie publique utilisée par Common Teammates (`a1.lolalytics.com/mega/?ep=build-team...`). Delta 2 retire les effets de force moyenne des champions ; référence `baseline = (wr - delta2) / 100`, contrôlée avant import. Victoires : `round(games × wr)`, marquées `rounded_rate`. Un pack par champion/rôle/patch permet la reprise.

gol.gg : formulaire POST public pour **trois derniers patchs disponibles** et cinq rôles, toutes ligues. Victoires/défaites publiées exactes. Dénominateur pickrate : somme des picks du rôle / 2. L’index de tournois fournit toutes les listes ; seules les rencontres de la fenêtre sont suivies, avec les autres games de leur série. Aucun plafond par défaut. Compositions lues dans les tableaux des joueurs, pas dans les bandes de picks parfois incohérentes. Résultat, patch, tournoi, durée, objectifs, gold diff 15 et bans conservés. Ordre connu seulement si phases et compositions concordent. Paires globales et par ligue, avec référence ajustée aux performances individuelles lissées. Sauvegarde chaque 25 games. Aucun chemin exclu par robots.txt.

CLI : `npm.cmd run scrape -- --enable-scraping` pour une collecte complète ; `--source=pro` / `--source=solo` pour un fournisseur. `--details=N` et `--games=N` limitent les diagnostics. L’écran Données affiche la couverture réelle ; une collecte partielle ne devient pas une couverture complète.

## Actualisation manuelle et conservation locale

Aucune collecte de données ne démarre au lancement ou après une mise à jour de l’application. Le bouton Actualiser et la CLI explicite sont les deux points d’entrée. Le mode par défaut télécharge les statistiques partagées GitHub ; le mode Éditeur active la collecte locale. Le réglage de statistiques indique les sources à inclure dans ce clic ; les anciens paramètres avec ce réglage activé ne rétablissent pas une collecte automatique. Les mises à jour du binaire gardent le même userData et ne réinitialisent pas SQLite, les sessions, les équipes ou les caches. Les mises à jour de l’application et la collecte des sites restent indépendantes.

Le bouton vérifie le petit index de versions Data Dragon. Le catalogue JSON validé du même patch et ses PNG présents sont relus localement ; seuls un nouveau catalogue ou des fichiers manquants nécessitent un téléchargement. Les feeds utilisent If-None-Match et les réponses 304. Une actualisation explicite ne subit plus le délai de 30 minutes de l’ancien lancement automatique.

La collecte conserve sa fenêtre de trois patchs par source. Le patch Lolalytics actif est revalidé ; les packs de détails des anciens patchs déjà disponibles sont réutilisés, et les absents sont complétés. Les agrégats pro et listes de tournois sont vérifiés, car les ligues peuvent encore jouer sur des patchs précédents. Les statistiques des games pro valides déjà importées sont réutilisées. L’index compte les games par tournoi : les listes inchangées restent en cache ; les séries des tournois modifiés sont recontrôlées pour découvrir de nouvelles games, y compris si leur ancien HTML n’en contient pas encore le lien. Les compteurs sont mémorisés après une collecte complète réussie, afin qu’une interruption ne masque pas la reprise. Les pages de games nouvelles sont revalidées, même si une ancienne version non jouée existe dans le cache. Un crawl interrompu conserve les données déjà publiées. `--force` en CLI permet une réparation complète volontaire, y compris les anciens détails et matchs.

La collecte du patch actif peut encore être longue. Les corrections tardives des anciens détails de Solo Queue exigent `--force` ; la collecte incrémentale les considère comme stabilisés. Le cache brut n’est pas inclus dans le binaire et reste dans le dossier de données. La configuration NSIS conserve explicitement les données applicatives.

## Format des packs

Schéma exécutable : `src/shared/validation.ts`. Limite d’import des packs : 64 Mio, version `1`, compteurs entiers cohérents, proportions entre 0 et 1, IDs Data Dragon connus. Cette borne permet les synergies pro sur trois patchs et toutes les ligues. Les sources utilisent `solo` ou `pro` ; la provenance identifie le fournisseur réel et la licence. Les agrégats sont séparés par champion, rôle, patch, rang, ligue et side. Une statistique matchup/synergie est orientée : wins est le nombre de victoires du champion principal. Les rôles des deux champions sont obligatoires.

Exemple **fictif**, destiné à documenter le format :

```json
{
  "schemaVersion": 1,
  "id": "format-example",
  "createdAt": "2026-10-08T00:00:00Z",
  "provenance": {
    "name": "Exemple fictif",
    "url": "https://example.org/synthetic-only",
    "license": "Données fictives de documentation ; aucune statistique réelle.",
    "demo": true
  },
  "stats": [{
    "championId": "Ahri", "role": "MID", "patch": "16.20",
    "source": "solo", "rank": "EMERALD_PLUS", "league": "all", "side": "all",
    "games": 1000, "wins": 510, "pickRate": 0.1, "banRate": 0.05, "baseline": 0.5
  }],
  "pairs": [{
    "championId": "Lucian", "role": "ADC", "otherId": "Nami", "otherRole": "SUPPORT",
    "kind": "synergy", "patch": "16.20", "source": "solo",
    "rank": "EMERALD_PLUS", "league": "all", "side": "all",
    "games": 1000, "wins": 540, "baseline": 0.51
  }],
  "games": []
}
```

`baseline` doit venir de la population **du même filtre**, particulièrement pour les rangs élevés dont le winrate agrégé peut dépasser 50 %. La baseline d’une paire doit représenter une référence comparable, pour ne pas présenter le niveau des joueurs comme une synergie. Ne pas mélanger des pourcentages calculés sur des populations différentes. Les probabilités d’un duo ne peuvent pas être calculées en additionnant les winrates individuels.

`games` accepte des matchs professionnels avec `id`, `patch`, `league`, `tournament`, `winner`, et éventuellement `durationSeconds`, `goldDiff15`, `objectives`. Les compositions et rôles viennent des tableaux des joueurs, avec cinq picks et cinq bans par côté dans `lineups.blue/red`. Si les bandes de draft concordent avec les dix champions joués et les phases compétitives, `history` conserve les 20 étapes avec les rôles finaux. Sinon le scraper écrit `draftOrderKnown: false` et `history: []` ; ces matchs ne contribuent **pas** à la priorité historique de premier tour. Durée, gold à 15 et objectifs restent des métadonnées après match, jamais des features de prédiction pré-draft. La reprise conserve les matchs déjà importés dans la fenêtre ; une interruption réseau ne remplace pas leur pack par un simple préfixe du nouveau parcours.

Pas de double comptage : un agrégat spécifique remplace son parent global pour le même champion/source/patch. Les packs importés plus récemment remplacent les anciennes lignes de même clé. Cette règle ne suffit pas à dédupliquer deux fournisseurs aux identifiants distincts : l’éditeur du collecteur doit éviter les populations recouvrantes. Si un pack réel existe, les packs de démonstration sont exclus du moteur.

## Scoring V1 implémenté

Pour chaque source et population compatible :

`p_lissé = (victoires_pondérées + baseline × force_du_prior) / (parties_pondérées + force_du_prior)`

Force du prior : 200 en solo, 50 en pro. Les matchups/synergies utilisent un lift lissé relativement à leur baseline. Les intervalles de Wilson à 95 % sont descriptifs ; pour une mixture de sources, le mélange des bornes est une **approximation**, pas un intervalle bayésien calibré. Les effectifs pondérés sont des effectifs heuristiques : la corrélation des matchs réduit l’information effective.

Depuis 0.5.0, un groupe de source doit avoir au moins **10 matchs pro ou 200 matchs Master+ pondérés** pour contribuer au lift ou à la priorité méta. En dessous, son support vaut zéro, même à 100 % de victoires ; les paires suivent les mêmes minima. Au-dessus, le lift est encore atténué par `n/(n+50)` en pro ou `n/(n+200)` en solo. La priorité pick/ban mélange les groupes selon leurs poids de source et leur support : une ligne pro isolée ne remplace plus la priorité solo. Si aucune source n’atteint le minimum, le winrate et l’intervalle ne sont pas présentés comme statistiques exploitables, et la fiabilité affichée vaut zéro. Ces seuils sont des protections heuristiques, pas des paramètres appris.

`score = somme(poids_k × facteur_k) / somme(poids_k)`

Facteurs bornés de 0 à 100 : winrate corrigé de la baseline, matchup, synergie, priorité pick/ban, flex, ordre, composition, maîtrise déclarée. Une statistique absente produit un facteur neutre à 50 et une fiabilité statistique nulle ; le moteur ne fabrique pas de counters. Les profils de composition sont qualitatifs, écrits à la main, et la composition AD/AP est un potentiel approximatif, pas une mesure des dégâts réellement infligés. Les champions du catalogue sans profil sont sélectionnables manuellement ; ils ne sont recommandés qu’avec un rôle observé dans un pack.

- Mixture visée solo/pro : **90/10 en Solo**, **45/55 en compétitif**, ajustée par `n/(n+800)` pour Solo et `n/(n+80)` pour Pro puis renormalisée. Un match pro extrême ne domine plus des milliers de parties Master+. Chaque source garde son lissage et sa moyenne de référence.
- Solo : pool personnel et rôle personnel. Compétitif : pools des cinq joueurs de chaque équipe ; la synergie et la composition prennent plus de poids après révélation des picks. Flex réduit, fondé sur les rôles réellement joués. Aucun bonus automatique de tank au premier pick.
- Fenêtre indépendante du patch de session : trois derniers patchs disponibles par source, poids `1, decay, decay²`. Decay à 0 garde le dernier patch disponible de chaque source. Les versions pro et Solo peuvent différer.
- Premiers picks : sécurité qualitative du blind pick, flex, priorité historique de premier tour si disponible et pénalité pour les counters statistiques encore accessibles.
- Dernier pick : bonus au matchup déjà révélé. Les rôles sont fixés manuellement dans la V1 ; l’incertitude sur le rôle réel d’un flex ennemi reste une limite.
- Double pick compétitif : shortlist de 10 premiers choix, jusqu’à 4 seconds choix recalculés après chacun, rôles distincts, estimation de la meilleure réponse ennemie, pénalité de réponse et déduplication des paires.
- Bans : retrait d’une option adaptée à la composition et aux rôles ennemis, pondéré par la priorité méta ; le pool personnel ne limite pas les bans. À ce score de base s’ajoute un score de menace OP.GG de l’équipe ciblée, pondéré séparément : maximum 35 % par défaut, configurable de 0 à 100. Volume de parties (30 %), racine de la part du champion dans les parties connues (55 %), résultats lissés par rapport à la moyenne du joueur avec prior de 20 parties (15 %). Le poids est réduit par `total/(total+80) × games/(games+20)`, puis par l’incertitude de rôle (AUTO : 0,6) et l’indisponibilité du profil au dernier import (pool conservé : 0,8). Un champion absent du pool observé reçoit un score de menace nul avec la fiabilité du profil ; sans profil exploitable, le score de base est conservé. Un champion déclaré manuellement sans parties mesurées reçoit un score qualitatif 70 et une fiabilité 0,5. Les données saisonnières restent distinctes des winrates Master+ sur trois patchs. Le poids dédié remplace l’influence indirecte de familiarité des picks pour éviter le double comptage. Les rôles sont évalués avant déduplication des champions ; les rôles déjà remplis ne sont plus ciblés. Le réglage à 0 désactive le score, pas le filtre de pool.
- Réponse adverse : softmax sur les scores des candidats, température 9, une proposition de rôle par champion. Les pourcentages visibles représentent une préférence relative sur **tous** les candidats ; les cinq affichés ne totalisent donc pas forcément 100 %. Aucun apprentissage comportemental n’a été validé.
- Simulations : trois branches, choix initial différent puis continuation gloutonne complète, bans et rôles respectés. Recherche bornée, pas un minimax exhaustif ; un pool impossible peut produire une branche incomplète, identifiable par sa trace. L’indice final compare la qualité qualitative des compositions. `winProbability` reste `null`.

La liste de picks retourne désormais tous les champions éligibles, triés par score et dédupliqués sur leur meilleur rôle libre. Le défilement et la recherche conservent ce classement ; les contraintes de pool, les rôles observés et l’exclusion des champions déjà utilisés continuent de s’appliquer. Les bans restent une liste de cinq options, les doubles picks et simulations gardent leur recherche bornée.

Le plan de jeu (`gameplan.ts`) décrit poke/contrôle de zone, dive, combats prolongés autour des carries, pression latérale ou plan à préciser. Ses axes portent sur la présence précoce estimée en lane, l’accès aux objectifs, le teamfight, les side lanes et la simplicité d’exécution. Les conditions, timings, risques et besoins sont contextualisés aux picks révélés. Les profils de mécanique sont qualitatifs ; les dégâts des items, les builds et les véritables timings de vagues ne sont pas simulés. En Solo Queue, la contribution d’un candidat mélange les règles contextuelles précédentes (65 %) et le changement du score du plan (35 %) dans le facteur composition. En compétition, les règles de réponse aux ennemis sont séparées des besoins alliés dans le contexte par rôle décrit ci-dessous. Les premiers picks sans allié conservent une contribution de plan neutre. Les indices finaux des scénarios comparent ces plans des deux compositions ; leurs continuations restent gloutonnes.

Le contexte compétitif (`role-context.ts`) remplace le budget global matchup + synergie + composition, sans ajout de points ni double budget. Profils de coaching initiaux, non appris :

| Rôle | Vis-à-vis | Autres ennemis | Synergies alliées | Plan allié |
|---|---:|---:|---:|---:|
| Top | 40 | 10 | 15 | 35 |
| Jungle | 10 | 20 | 30 | 40 |
| Mid | 25 | 15 | 25 | 35 |
| ADC | 10 | 25 | 30 | 35 |

Support : **40 % duo botlane / 40 % réponse à leur composition / 20 % plan allié**. Le duo est une approximation par les quatre paires ADC/support contre ADC/support (60 %), la synergie de notre duo (30 %) et ses interactions mécaniques qualitatives (10 %). Les paires absentes ou sous le seuil statistique restent neutres. La synergie ADC/support ne contribue pas à nouveau au bloc du plan support ; les synergies jungle/mid y sont prioritaires. Les matchups statistiques hors botlane et les règles de réponse au dive/poke/frontline constituent la réponse à la composition adverse. Ce calcul ne mesure ni victoire de lane, ni interaction statistique apprise à quatre champions.

Le vis-à-vis est évalué séparément : sa valeur ne diminue pas à chaque révélation d’un autre rôle ennemi. Les synergies privilégient mid/jungle, jungle/support et ADC/support ; l’ADC accorde davantage d’attention au support adverse. Le plan allié est calculé sans adversaires afin de séparer son apport des réponses à leur composition. Les pourcentages initiaux sont modulés par les picks visibles (vis-à-vis connu, autres ennemis sur quatre, alliés sur quatre ; duo support sur trois slots et ennemis sur cinq), puis par les curseurs utilisateur relativement à leurs valeurs par défaut. Avec dix picks et des réglages par défaut, on retrouve exactement les profils ci-dessus. Une information absente reste neutre ; la visibilité n’est pas une mesure de fiabilité statistique. Les poids effectifs et chaque sous-score sont affichés dans « Pourquoi ». Winrate global, méta et maîtrise conservent leurs critères séparés ; Solo Queue conserve son calcul précédent.

Le blind (`blind.ts`) s’applique en compétition aux rôles hors support tant que leur vis-à-vis est inconnu, même après les deux premiers picks. Le support conserve son évaluation 2v2/composition. Le critère de vis-à-vis garde son poids de base, avec l’évaluation des réponses, au lieu de transférer ce budget à la composition alliée. La visibilité reste partielle. Les réponses candidates doivent être disponibles (picks/bans/Fearless), viables dans le rôle sur leur propre côté et respecter un pool adverse explicitement restreint. Les réponses avec des rôles pro/solo minuscules sont exclues ; les déclarations explicites de rôle peuvent conserver une option jouable.

Les effets de paire restent lissés, corrigés de baseline et neutralisés sous les seuils habituels. Les poids de réponse sont `max(0.001, pickrate) × exp(min(3, perte × 30)) × (1 + 3 × familiarité)`, où la perte est `max(0, -delta)` bornée à 0.12 et la familiarité est le score de maîtrise du scouting adverse multiplié par sa confiance (tous deux ramenés entre 0 et 1). Ce ne sont pas des probabilités calibrées. Le risque combine 35 % de perte moyenne pondérée et 65 % du pire quintile pondéré. Le score statistique est `50 − risque × 450 × sensibilité` : top 1, mid 0.625, jungle/ADC 0.25. Une paire absente ou insuffisante a un effet statistique nul ; son manque de couverture reçoit séparément un coût d’incertitude `12 × (1 − couverture) × sensibilité`. Aucun coût de couverture n’est inventé quand il n’existe aucune réponse candidate évaluée ; le résultat n’est alors pas certifié sûr.

Pour un top au profil qualitatif connu, le coût de développement est `clamp((scaling − early) × 6, 0, 12)`, réduit à 15 % pour une frontline ≥ 3 avec engage ≥ 2. C’est une approximation de dépendance aux ressources, sans mesure des vagues/gold/CS et sans exclusion nominative de champion. Le score du blind soustrait explicitement ce coût au score statistique et au coût d’incertitude. Le matchup connu remplace toute cette évaluation dès la révélation du vis-à-vis. Les anciennes pénalités via le facteur ordre restent réservées à la Solo Queue pour éviter de compter deux fois le risque en compétition ; aucune stratégie spéciale de premier/dernier pick n’a été ajoutée.

Le panneau « Pourquoi » sépare réponses connues, couverture et coûts qualitatifs. Les réponses peu documentées ne sont jamais annoncées sûres. La jauge partage ce calcul pendant une draft partielle ; avec les rôles complets, elle revient aux matchups révélés. Les données sources ne sont pas modifiées ou recollectées pour calculer ces critères.

Les conséquences de ban constituent une recherche **limitée au prochain choix adverse**. On compare son meilleur remplacement dans le rôle (70 %) et son meilleur choix global restant (30 %), puis on soustrait le coût de retirer ce champion aux options de notre équipe. La menace tient compte du score de recommandation et de l’amélioration du plan adverse. Une absence d’alternatives dans les données ne donne aucun bonus de ban-out ; seul un pool explicitement restreint et épuisé peut donner ce signal, assorti d’une mention de son éventuelle incomplétude. Le gain net est borné à ±25 points, et ajuste le score via `2 × gain_net × banImpactWeight/100` (40 par défaut), après le ciblage OP.GG. Le réglage désactive cet ajustement à zéro ; il ne représente pas une probabilité.

Fearless est un état de série local (`draft.series`) : format `single/bo3/bo5`, dix IDs de picks par manche, éventuellement son historique complet, côté de notre équipe et résultat relatif `ally/enemy`. Les picks des deux équipes deviennent indisponibles dans recommandations, prédictions, duos, simulations, sélecteur manuel et validation IPC. Les bans ordinaires ne sont pas reportés. Une manche complète peut être archivée, rouverte, ou renseignée manuellement par ses dix picks sans inventer un ordre inconnu. Les résultats renseignés ferment la série à deux victoires en BO3 ou trois en BO5, indépendamment des changements de côté ; sans résultats, la limite est le nombre de manches. Une nouvelle série et les retours de manche sauvegardent l’état précédent dans Sessions. Le reset ordinaire vide uniquement la manche courante. Les sessions JSON antérieures restent compatibles avec un format `single` par défaut. Le premier/dernier pick et le découplage côté/ordre n’ont pas été modifiés dans cette livraison.

La jauge évalue les **picks effectivement choisis**. Chaque champion est recalculé contre les alliés et ennemis révélés, avec son rôle saisi, puis le winrate et le contexte propre au rôle sont combinés en compétition, avec exactement le même calcul contextuel que les recommandations. En Solo Queue, les quatre facteurs winrate, matchup, synergie, composition restent combinés directement. Leurs poids configurés sont renormalisés ; si les quatre sont à zéro, ils reçoivent un poids égal pour cette jauge. La moyenne de ces notes produit le score de chaque équipe sur 100. Le nombre de picks ne procure pas de bonus. L’avantage signé est `score_bleu − score_rouge`, arrondi à un dixième, dans `[-100,100]` ; l’interface l’oriente vers notre équipe et inverse les couleurs côté rouge. Une équipe sans pick commence à 50. Les bans seuls laissent l’indice neutre.

Popularité, ordre de sélection et familiarité individuelle ne participent pas à cet indice de composition. Un pick manuel déjà choisi reste évalué même s’il sort d’un pool ou d’un rôle recommandé ; les facteurs sans données restent neutres. La jauge se recalcule après chaque action et annulation, avec les mêmes fenêtres Master+/pro que les recommandations. La lecture est provisoire avant dix picks et non calibrée ensuite : ni l’écart ni les notes sur 100 ne sont des probabilités de victoire. La disponibilité future des réponses retirées par les bans n’est pas modélisée dans cette jauge.

La V1 est un assistant explicable, pas une garantie d’optimisation de vos chances de victoire. Les compétences, coordination, stratégie, side, contexte tournoi et exécution en jeu influencent le résultat. Les petits effectifs pro, patchs récents, biais de sélection, tiers et mains limitent les conclusions. Le lissage réduit la variance, sans supprimer ces biais.

## V2 et V3 : suite définie, pas de modèle fictivement entraîné

V2 : régression logistique comme baseline, puis LightGBM si la comparaison temporelle le justifie. Features disponibles **avant la partie** : encodage champion-rôle-side, paires, traits de composition, phase/ordre, patch et population. Validation chronologique par patch ; grouper les matchs d’une même série et éviter d’éclater une série entre train et validation. Apprendre séparément pro/solo ou contrôler la population. Évaluer log-loss, Brier, calibration, intervalles et performance face à une baseline side + niveau d’équipes. Réserver un jeu temporel indépendant à la calibration Platt/isotonique. Publier datasheet, licences, date d’entraînement, patchs couverts et limites.

Exporter les coefficients logistiques JSON pour une inférence TypeScript sans dépendance Python, ou ONNX avec `onnxruntime-node` dans le worker pour LightGBM. Vérifier la parité d’inférence et la compatibilité du packaging Windows/macOS. Ne montrer une probabilité de victoire qu’après validation et afficher son contexte/calibration. Un modèle de résultat et un modèle de choix adverses doivent être évalués séparément. L’import de modèle et l’inférence ML ne sont pas actifs dans cette V1.

V3 : embeddings de champions, entraînement sur données autorisées et ablation contre V2 ; utiles si les interactions rares sont mieux généralisées, sans masquer la provenance des explications. Pas d’embeddings générés à partir de winrates fictifs.

Riot mastery/RSO et LCU : réservés à une version ultérieure. La V1 ne lit aucun lockfile, ne contacte pas le client et ne prend aucune action pour le joueur. Une future clé Riot de production passe par un service contrôlé ou un mécanisme autorisé ; aucun secret de l’éditeur dans l’exécutable distribué.


## Scouting OP.GG

Un multi par équipe, 1–5 Riot IDs complets. URL HTTPS et région validées, hôte autorisé `op.gg`. Les profils de champions publics sont décodés en JSON Next sans eval ni référence exécutable. Seul `my_champion_stats` classé est utilisé, avec contrôle des compteurs et de l’identité ; aucun matchup adverse ou champion recommandé par OP.GG n’est importé comme champion joué. Les rôles suggérés doivent être confirmés. Pools saisonniers de familiarité, distincts des winrates Master+ des trois patchs. Modification manuelle possible. Un blocage conserve les identités et données précédentes, sans contournement. Le pool adverse influence bans et réponses, indépendamment du pool allié.
