# Champions, compétences et lecture de patch — 0.12.0

La page **Patch & champions** relie les fiches des champions aux statistiques de matchup et à la lecture du patch. Elle est utilisable dans l’application Electron, avec les données officielles embarquées. Les statistiques de matchs restent celles de gol.gg et Lolalytics Master+ consultées depuis Supabase.

## Données présentes

Le jeu préparé localement comprend 173 champions sur 16.20, 16.19 et 16.18 : 20 champs de statistiques de base/croissance, passif et Q/W/E/R, descriptions FR/EN, délais, coûts, portées, effets et coefficients déclarés par Data Dragon. Les 173 champions du patch actuel ont aussi des paramètres nommés issus des fichiers CommunityDragon.

Les sources restent versionnées : les notes Riot « 26.20 » correspondent à Data Dragon « 16.20.1 ». Les trois notes ont fourni 34, 36 et 28 changements, soit 98 au total. Les sections ARAM, Arena et Classic ne sont pas mélangées à la Faille. Les corrections de milieu de patch reconnues prennent priorité sur la ligne initiale du même champ.

Certains tooltips utilisent des calculs dynamiques que Data Dragon ne résout pas. L’interface le signale. Les paramètres CommunityDragon peuvent inclure un rang zéro ou plusieurs effets : ils ne sont pas additionnés pour inventer des dégâts finaux. Le coût déclaré peut omettre un coût en PV ou une valeur conditionnelle. Les paramètres complémentaires des anciens patchs ne sont pas présents dans ce premier jeu ; leurs valeurs Data Dragon et notes Riot sont conservées.

## Ce qui est évalué

- Les **résultats observés** affichent les sources, les parties pondérées et le winrate lissé du matchup exact et des rôles choisis. Les petits échantillons restent signalés. Un historique de matchup ne prédit pas une victoire individuelle.
- Les **interactions de compétences** décrivent des possibilités conditionnelles : interruption de dash, interception de projectile, protection contre un sort, immunité au contrôle, réduction de soins et bris de bouclier. Des règles qualitatives complètent les descriptions lorsque leur résumé omet un détail. Elles ne prouvent pas un counter de lane.
- Les **changements chiffrés** classent dégâts, armure, résistance magique, soins, boucliers, délais, ressources, mobilité, contrôle, portée, vitesse d’attaque et modificateurs contre les monstres. Un changement textuel ambigu ou aux termes incompatibles reste à examiner. Une baisse de coût peut être favorable ; un échange de statistiques peut être mixte.
- Les **pistes de méta** sont une anticipation limitée des changements encore absents des statistiques d’une source. Leur fiabilité affichée concerne les matchs, pas une validation de la prédiction du patch. Les items sont listés dans la lecture mais aucun build de champion n’est supposé.

L’ajustement de patch est limité à deux points par candidat avant le classement final et ne s’applique pas à une source qui couvre déjà le patch. Les modificateurs de monstres concernent le jungle. Les ennemis révélés modifient l’interprétation : davantage de résistance magique apporte moins face à une opposition physique, davantage de soins ou de bouclier reste limité par les réponses adaptées. L’indice de composition ajoute également un effet borné des interactions de sorts. Cette lecture alimente recommandations, conséquences des bans et simulations ; elle reste indépendante du modèle appris, actuellement inactif.

## Actualiser et partager

L’administrateur peut cliquer **Préparer une actualisation**, examiner les nouvelles fiches puis choisir **Utiliser sur ce PC** ou **Partager cette version aux coachs**. La préparation ne modifie pas l’analyse active et ne publie rien. Le partage est une action explicite ; il remplace les fiches communes dans Supabase, avec protection contre une publication simultanée. Un coach ordinaire ne peut pas publier.

Les téléchargements conservent leur cache brut et utilisent les réponses conditionnelles quand la source les propose. Les fichiers Data Dragon déjà versionnés sont réutilisés ; les notes et paramètres actuels peuvent être revérifiés pour les corrections du même patch. Une erreur de source conserve les fiches actives. Aucune lecture de site n’est lancée à l’ouverture de l’application ou après installation d’une mise à jour.

La commande locale `npm.cmd run knowledge:collect` prépare le fichier embarqué dans `resources/champion-knowledge.json`, après compilation. Elle ne pousse pas sur GitHub et ne publie pas dans Supabase. La migration `202610140011_champion_knowledge.sql` prépare la lecture et la publication contrôlée dans la base ; aucun jeu de fiches n’a été publié pendant l’implémentation.

## Vérifications

159 tests couvrent notamment la séparation des modes de jeu, la reconnaissance des coûts par rang devenus constants, la priorité des corrections de milieu de patch, l’exclusion des versions erronées, les interactions conditionnelles et l’absence de double comptage des buffs déjà observés. Le parcours Electron vérifie les paramètres réels, les explications de matchup, FR/EN, clair/sombre, le petit écran, les liens autorisés et les textes au moins à 14 px. Le test Supabase vérifie les droits des comptes et la transaction de publication avec annulation ; aucune publication de données n’est conservée.

Sources : [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon), [notes Riot 26.20](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes/), [CommunityDragon](https://www.communitydragon.org/docs).
