# Tchim Draft

**Version 0.15.1.** Les statistiques pro comprennent 444 matchs, dont 38 parties des Worlds. Les données Master+ et les fiches des 173 champions sont actualisées jusqu’au patch 16.21. Le modèle est réentraîné et conservé comme candidat inactif : ses résultats ne passent pas les seuils de validation. [Données, validation et limites](docs/VALIDATION-0.15.1.md), [nouveautés FR/EN](docs/RELEASE_NOTES.md).

[Télécharger la version publiée](https://github.com/RomainRichard42/Tchim-Draft/releases/latest). Préparations par match, deux équipes et pools OP.GG, BO classique ou Fearless et parcours Préparation → Draft → Résultat, liste de picks défilante et fiches de survol. Le jeu publié sur Supabase le 16 octobre compte 409 matchs pro, dont 8 Worlds et 61 LPL ; les statistiques Master+ du 14 octobre sont conservées. Huit parties Worlds ne suffisent pas à établir une méta fiable. Aucun compte GitHub n’est nécessaire. Les versions de l’application se téléchargent automatiquement et s’installent à la fermeture après une publication expressément demandée. Les nouveautés s’affichent une fois par version et restent accessibles dans **Réglages → Compte et interface → Nouveautés et historique**. [Supabase, accès et modèle](docs/SUPABASE.md), [champions et patchs](docs/CHAMPIONS-ET-PATCHS.md), [publication de l’application](docs/GITHUB.md).

Application **desktop Electron Windows** d’assistance à la draft League of Legends, entièrement manuelle. React + TypeScript pour l’interface, Electron pour les fenêtres/IPC, SQLite `better-sqlite3` pour les brouillons locaux et workers Node pour l’analyse. Supabase centralise les statistiques, les comptes et les résultats privés ; cette configuration nécessite une connexion. Next.js n’apporterait ici ni SSR utile ni simplification du packaging.

Pour un nouvel utilisateur : installer l’application, obtenir auprès de l’administrateur un code d’invitation lié à son adresse e-mail, puis créer son compte avec ce code et son propre mot de passe. Les statistiques partagées sont consultées automatiquement ; aucune collecte manuelle des sites n’est nécessaire.

## Lancer

Depuis ce dossier, dans PowerShell :

```powershell
npm.cmd install
npm.cmd run dev
```

`dev` ouvre une vraie fenêtre Electron ; le serveur Vite sert uniquement le renderer en développement. Pour exécuter les fichiers de production :

```powershell
npm.cmd run build
npm.cmd start
```

Node >= 22.12 est requis. Le projet est verrouillé par `package-lock.json`. `npm.cmd` évite le blocage du script npm.ps1 par la politique PowerShell. SQLite 13 utilise les binaires Node-API distribués avec le paquet. Electron peut télécharger son runtime au premier lancement.

## Consulter les picks

Dans la draft, **Tous les picks** affiche la liste complète. Fais défiler la colonne, compare un champion avec sa **Carte détaillée**, ou utilise **Agrandir les choix** pour une grande fenêtre. Survole une ligne pour consulter les counters, matchups favorables, synergies et raisons propres à la draft. **Infos** garde cette fiche ouverte ; **Échap** la ferme. La flèche prépare directement le champion. Les données manquantes et les interactions de sorts conditionnelles restent signalées. [Validation 0.13.1](docs/VALIDATION-0.13.1.md).

## Préparer chaque match

La navigation principale contient **Matchs** et **Simulations** ; **Réglages** reste à part. Dans Matchs, crée une préparation avec les deux noms d’équipes, le type (scrim, officiel ou entraînement), le BO, le côté et éventuellement les deux multi OP.GG. Les joueurs/pools sont propres à chaque match. Il n’y a pas de gestion de club.

Chaque préparation possède trois étapes : **Préparation**, **Draft**, **Résultat**. Confirme les joueurs et rôles dans Préparation ; tu peux précharger les matchups depuis la base partagée sans scraper les sites. Dans Draft, l’analyse 5v5 et les fiches s’ouvrent à côté des choix. Une fois les dix picks saisis, enregistre le vainqueur, les kills et ta note sur 5 avant de passer à la manche suivante. Le BO classique autorise les picks déjà joués ; le Fearless les bloque.

Les préparations incomplètes sont sauvegardées dans `draft_preparations`, séparément des résultats utilisés pour l’apprentissage. Chaque compte voit les siennes ; l’administrateur peut consulter celles des autres et ouvrir une copie privée. Un conflit de modification conserve le brouillon local au lieu d’écraser la version distante. Les anciennes sessions et résultats restent accessibles.

Vérification locale : `npm.cmd test`, `npm.cmd run test:ui`, `node scripts/workspace-ui-test.mjs --cloud`, `node scripts/matches-cloud-test.mjs` et `node scripts/release-notes-ui-test.mjs`. Les deux tests Supabase nécessitent les autorisations privées locales et nettoient leurs comptes de test. [Validation 0.13.0](docs/VALIDATION-0.13.0.md).

## Utilisation

Créer son compte avec le code fourni par l’administrateur, l’adresse e-mail liée au code et son propre mot de passe. Aucun e-mail de confirmation n’est nécessaire. Les statistiques deviennent accessibles automatiquement. L’administrateur crée les codes dans **Réglages → Compte et interface**.

1. Dans Matchs, créer ou reprendre la préparation, choisir le BO et confirmer le patch, la ligue et le côté. Les anciennes sessions Solo/Duo restent rechargeables.
2. Saisir chaque ban/pick dans l’ordre affiché en haut, avec le détail accessible via **Ordre de draft**, via le bouton principal, une proposition ou un emplacement actif. Attribuer un rôle libre à chaque pick. Les bans peuvent être vides.
3. Faire défiler tous les picks éligibles, classés par score, ou rechercher un champion. Les filtres de rôle et pools restent appliqués. La jauge compare les deux équipes à chaque pick et annulation, y compris dans l’overlay. Inspecter « Pourquoi ce choix ? » pour la fiabilité, les facteurs et les poids propres au rôle. En compétitif, le support évalue notre duo contre leur duo, la réponse à leur composition et le plan allié ; les autres rôles distinguent le vis-à-vis des autres ennemis. Tant que le vis-à-vis est inconnu, les réponses disponibles, bans, Fearless et pools adverses influencent la lecture du blind ; les tops dépendants de leur développement reçoivent un coût qualitatif explicite. Un double pick compétitif propose trois paires et une réponse adverse ; un clic sur la paire inscrit ses deux champions.
4. Dans **Simulations → Draft guidée**, utilisez le match sélectionné et ses deux pools OP.GG déjà préparés. Confirmez les cinq rôles et les pools de chaque équipe, puis lancez le face à face. Choisissez une proposition et validez-la, ou glissez un champion sur un pick/ban. L’adversaire répond visiblement, un tour à la fois, et les propositions sont recalculées selon vos décisions. **Pause**, **Annuler** et la chronologie permettent de reprendre la main ; **Dérouler la suite** joue les choix restants devant vous. La jauge suit les picks révélés. Sauvegardez pour reprendre une simulation plus tard ; les exceptions manuelles aux pools sont signalées et le Fearless reste respecté.

   La scène centrale montre le choix à examiner ou à confirmer, avec son illustration, son rôle et son indice. Les champions validés rejoignent visuellement leur équipe. Les propositions se réorganisent après chaque analyse ; les flèches comparent leurs scores et places aux dernières propositions du même côté pour le même type de choix. Pendant le recalcul, la liste précédente reste visible et désactivée. Les emplacements disponibles s’éclairent pendant un glisser-déposer. Les plans de jeu s’ouvrent au-dessus de la scène sans déplacer les commandes.

   **Comparer des drafts** conserve la création de branches libres, les verrous futurs et l’exploration de 12, 24 ou 48 drafts. Comparez jusqu’à trois branches, leurs plans et leurs indices. Les simulations sont indépendantes de votre draft réelle ; les scores restent des indices heuristiques, sans probabilité de victoire.
5. Utiliser Mon pool pour la maîtrise en Solo et Équipes pour importer les deux multis OP.GG. En compétitif, les pools des joueurs peuvent limiter chaque équipe. Un pool restreint doit contenir les rôles nécessaires.
5. Sauvegarder/charger une session ou l’exporter/importer en JSON. La draft courante et les paramètres se sauvegardent aussi automatiquement. Revenir sur une ancienne étape retire la suite pour permettre une nouvelle saisie.
6. Ouvrir l’overlay, le déplacer par sa barre et ajuster son opacité dans Réglages. Position et taille sont mémorisées. Les recommandations et étapes se synchronisent avec la fenêtre principale.
7. En compétition, activer **Fearless BO3 ou BO5**. Après dix picks, choisir éventuellement le résultat et cliquer **Archiver et continuer** : les picks des deux équipes deviennent indisponibles ; les bans ordinaires redeviennent disponibles. Les victoires sont suivies par équipe même si son côté change. On peut saisir les dix picks d’une manche précédente pour rejoindre une série en cours, rouvrir la dernière manche ou démarrer une nouvelle série. Les transitions sont sauvegardées dans Sessions ; les exports incluent l’historique Fearless.
8. Le design **Face-à-face** aligne les deux équipes par rôle et place les options au centre. La liste complète est défilable et ses scores suivent les filtres. Cliquer sur une option affiche sa lecture dans le bandeau du bas : **plan** en vert, **matchup / duo / conséquences du ban** en ambre et **pool** en violet. **Préparer** ouvre la sélection manuelle ; confirmer ensuite le rôle avec **Valider**. `Ctrl+1/2/3` prépare les trois premiers du classement complet. **Détails des données** ouvre les statistiques, la fiabilité et les facteurs. La jauge reste visible en haut. **Plans des équipes** regroupe les deux plans complets, les compositions, les réponses adverses et les sources. Le bouton de série ouvre l’historique Fearless ; il s’ouvre aussi quand une draft BO3/BO5 se termine. **Ordre de draft** et **Sessions** restent accessibles en bas.
9. Dans **Draft → Analyse 5v5**, comparer les compositions, explorer deux à quatre actions dans l’arbre et glisser ses idées sur les choix futurs. **Matchs → Résultats enregistrés** permet de revoir ou modifier les kills, le vainqueur et la note. Chaque compte voit son propre espace ; l’administrateur peut consulter l’ensemble. L’entraînement et la validation restent dans **Réglages → Modèle avancé**.
10. Dans **Réglages → Champions et patchs**, consulter les stats et compétences sur trois patchs, comparer un matchup et distinguer les résultats observés des interactions conditionnelles. **Fiche & patch** ouvre le champion proposé depuis la draft. Les pistes de méta restent des hypothèses limitées ; l’administrateur prépare une actualisation, l’examine puis choisit son utilisation locale ou son partage.

Raccourcis : `Ctrl+K` choisir, `Ctrl+Z` annuler (hors saisie de texte), `Ctrl+1/2/3` préparer une option rapide, `Ctrl+Shift+D` ouvrir/fermer l’overlay. Thème sombre et textes FR/EN. L’overlay interactif est conçu pour rester à côté du client, pas pour être injecté dans League.

En compétitif, l’ordre suit les deux phases de bans et B1/R1/R2/B2/B3/R3 puis R4/B4/B5/R5. En Solo, les bans simultanés sont saisis cinq par équipe, avec doublons entre équipes permis ; les picks suivent les tours usuels. Les rôles saisis peuvent être réaffectés si un flex documenté le permet ; un rôle fixé reste verrouillé. Aucun LCU n’est intégré.

## Données et honnêteté des recommandations

Les utilisateurs consultent automatiquement les statistiques déjà publiées dans Supabase. **La collecte gol.gg/Lolalytics reste une action administrative explicite**, sans scraping au lancement ou après une mise à jour. Le jeu initial contient les trois derniers patchs disponibles de chaque source, en Master+ pour Lolalytics. L’application ne télécharge pas une base complète à chaque démarrage ; elle reçoit les statistiques et les interactions utiles à la draft. Les icônes sont embarquées. Les brouillons locaux restent dans un dossier indépendant du binaire, séparés par compte. Le mode de développement `TCHIM_OFFLINE=1` conserve l’entraînement local sur les données présentes, sans accès au service.

Les statistiques **gol.gg et Lolalytics sont collectées par scraping chez l’éditeur**, puis publiées sur Supabase après validation. Les utilisateurs consultent ces données partagées sans scraper les sites. Le mode Éditeur et la CLI permettent la collecte locale. La fenêtre reste fixée aux **trois derniers patchs disponibles par source**, indépendamment du patch choisi pour la session. Lolalytics utilise exclusivement **Master+**, les cinq rôles, les matchups et les synergies des champions/rôles suffisamment joués. Le collecteur gol.gg retient **LFL, EMEA Masters, LCK, LPL, LCS/Amérique du Nord, LEC et Worlds** ; LCK CL, NACL, LFL Division 2 et les autres compétitions sont exclus. Victoires, pickrates, banrates et paires pro sont recalculés à partir des seuls matchs retenus. Aucun plafond de champions ou de matchs par défaut. La collecte réutilise les pages déjà vérifiées ; un tournoi qui gagne des matchs ne provoque plus le rechargement de toutes ses séries terminées. Chaque nouvelle game valide est sauvegardée pour permettre une reprise après interruption.

Une actualisation manuelle revalide les agrégats et les détails du patch Solo actif, puis complète les données manquantes. Les détails des deux anciens patchs Lolalytics déjà importés sont conservés. Les matchs pro joués sont réutilisés depuis SQLite ; les listes de tournois sont vérifiées pour trouver les nouvelles games. Les pages de séries en cache permettent de retrouver les liens associés ; seules les séries de tournois dont le nombre de matchs a changé sont recontrôlées pour découvrir les nouvelles games. Les anciens patchs pro peuvent encore recevoir des matchs : leurs petits agrégats restent vérifiés. Les packs de flux HTTPS utilisent leur ETag. Les bruts sont conservés entre les versions.

Dans **Équipes**, collez un multi OP.GG par équipe. Les cinq Riot IDs, pools classés et rôles suggérés sont importés depuis les pages publiques. Vérifiez les rôles des joueurs ; ils ne sont pas un filtre sur votre rôle personnel. Les pools sont éditables et peuvent limiter les suggestions de chaque équipe. Ils influencent picks, bans, doubles picks et réponses adverses. Leur historique de familiarité couvre la saison OP.GG affichée ; ce n’est pas un winrate sur trois patchs. Le pool personnel concerne désormais la Solo Queue.

Les **bans** disposent d’un poids dédié **OP.GG · bans**, réglable dans Réglages (35 % maximum par défaut). Il favorise les champions souvent joués par l’adversaire, particulièrement ceux qui concentrent son pool, avec résultats de saison lissés. Les petits échantillons et rôles incertains réduisent le poids effectif. L’explication indique le joueur ciblé, son volume de parties, sa fréquence et le poids appliqué. Sans profil exploitable, les bans reposent sur les statistiques et la composition. À 0 %, le score OP.GG est désactivé ; les restrictions de pool restent indépendantes.

Le scoring compétitif combine statistiques corrigées par rapport à la moyenne Master+, données pro, fiabilité des échantillons, usage réel de chaque rôle et besoins des compositions : dégâts des carries, protection contre le dive, poke, initiation, dégâts de zone, double frontline et timings. Un premier tank ne reçoit plus un bonus automatique. Le bonus de flex se fonde sur les rôles effectivement joués. Les règles de mécanique sont qualitatives, explicites et testées ; ce n’est pas encore un modèle ML entraîné ou une probabilité de victoire calibrée.

Depuis la **0.5.0**, chaque source doit atteindre **10 matchs pro pondérés ou 200 matchs Master+ pondérés** pour influencer le winrate, les matchups, les synergies et la priorité méta. Une ligne pro d’un ou deux matchs ne remplace plus la priorité Master+. Le lissage et une atténuation continue s’appliquent ensuite. La recommandation indique l’insuffisance des données ; un champion déclaré jouable peut encore être proposé pour des raisons qualitatives, avec fiabilité statistique nulle.

Un rôle uniquement soutenu par un échantillon inférieur à ces minima n’est plus proposé sans pool connu. La sélection manuelle reste possible.

Les **conséquences d’un ban** comparent le meilleur remplacement adverse dans le rôle, les autres options et le coût de retirer ce champion à notre équipe. Le gain net ajuste le classement, avec un réglage dédié dans Réglages. La comparaison porte sur le prochain pick dans les pools/filtres connus ; elle ne prétend pas résoudre toute la série. Une absence de données sur les alternatives n’est pas considérée comme un ban-out certain.

Collecte en ligne de commande, dans une base locale au projet :

```powershell
npm.cmd run build
npm.cmd run scrape -- --enable-scraping
$env:TCHIM_DATA_DIR = "$PWD\data\local"
npm.cmd start
```

La collecte complète est le comportement par défaut. `--details=N` et `--games=N` servent aux diagnostics limités ; `0` désactive ces détails. `--source=pro` ou `--source=solo` sélectionne une source. Le patch de collecte vient de Data Dragon et des patchs disponibles chez les fournisseurs ; `--patch` ne change plus la fenêtre. `--rank` accepte seulement `master_plus`. `--force` sert à réparer ou recharger explicitement les anciens détails et matchs ; le bouton Actualiser garde une collecte incrémentale. `--directory=...` choisit un dossier. SQLite : `data/local/tchim.sqlite`. Exports : `data/local/scraping/exports/`. **Lancer Tchim Draft.cmd** ouvre l’exécutable packagé avec cette base. L’installeur conserve la base du profil utilisateur lors des mises à jour. La version Supabase consulte les statistiques après connexion ; cette collecte locale concerne uniquement l’éditeur et les anciennes configurations locales. Le lanceur du projet et l’installeur utilisent toujours leurs deux emplacements respectifs.

Les patchs pro peuvent être plus anciens que ceux de Solo Queue ; l’interface affiche les deux fenêtres. Une ligue sans matchs sur la fenêtre n’est pas remplacée par une compétition exclue ou un patch plus ancien. Les victoires Lolalytics sont reconstituées à partir des taux arrondis. Les compositions pro viennent des tableaux des joueurs, qui peuvent différer des bandes de picks. L’ordre de draft est conservé uniquement si les phases, dix picks et rôles concordent ; sinon il est inconnu. Les agrégats pro couvrent uniquement les ligues sélectionnées, avec des déclinaisons par ligue et une référence globale commune pour corriger les paires. La provenance n’affirme aucun droit de redistribution.

La **jauge d’avantage de draft** note les picks révélés de chaque équipe sur 100 : résultats lissés, matchups, synergies et composition, selon les poids configurés. Elle utilise une moyenne par champion pour ne pas favoriser l’équipe qui a choisi davantage de picks. L’écart signé indique le côté avantagé ; sans picks il est neutre et avant dix picks la lecture reste provisoire. La jauge reste visible pendant le défilement. L’en-tête compact, l’indication du tour et les explications courtes facilitent la saisie.

Les recommandations et la jauge ont un **score de draft**, pas une probabilité de victoire. Les scénarios affichent un indice de composition ; une probabilité nécessiterait un modèle entraîné et calibré sur des données autorisées. Le scoring bayésien, les filtres, la pondération des sources et les limites sont détaillés dans [docs/DATA.md](docs/DATA.md), avec la comparaison des architectures de collecte, les droits des fournisseurs et la trajectoire ML V2/V3.

## Illustrations et animations

Les 173 champions du catalogue possèdent une illustration large et une carte verticale officielles Data Dragon. Les 346 fichiers WebP (~13,3 Mo) sont inclus dans le renderer packagé ; aucun téléchargement d’illustration n’est effectué au lancement ou lors d’un recalcul. Un portrait remplace une illustration manquante, notamment pour un nouveau champion ajouté avant la prochaine version de l’application. Motion anime les transitions, classements et scores. Le réglage système de réduction des animations est respecté.

Pour préparer explicitement les illustrations manquantes depuis le catalogue local : `node scripts/fetch-champion-art.mjs`. Le script consulte SQLite en lecture seule, utilise un cache local et limite la collecte à trois requêtes simultanées. Il ne fait partie ni du lancement ni du build, et ne collecte aucune statistique. Les sources et empreintes figurent dans resources/visuals/art-manifest.json ; la mention Riot accompagne les fichiers. Vérification : `node scripts/verify-champion-art.mjs --packaged`.

## Architecture

```text
src/main/index.ts       fenêtres, IPC validé, protocoles locaux, updates
src/main/preload.ts     API minimale typée, aucun accès Node côté UI
src/main/storage.ts     SQLite, bruts validés, sessions, logs, paramètres
src/main/data.ts        Data Dragon, cache PNG, feed HTTPS, fallback hors ligne
src/main/worker.ts      calcul hors du renderer et de la boucle UI du main
src/engine/            scoring, prédiction relative, duos, scénarios
src/shared/            contrats IPC, validation Zod, profils qualitatifs, ordre
src/renderer/          React, styles et traductions
src/collector/         scraping public gol.gg/Lolalytics, cache, parsers, CLI
tests/                 invariants de draft et tests statistiques
scripts/ui-test.mjs    interactions réelles dans Electron via Playwright
```

SQLite : `%APPDATA%\Tchim Draft\tchim.sqlite`. Catalogue/icônes/bruts dans le même `userData`. Aucun identifiant Riot ni télémétrie. `TCHIM_DATA_DIR` et `TCHIM_OFFLINE=1` permettent une exécution de test isolée.

Sécurité : renderer sandboxé, `contextIsolation: true`, `nodeIntegration: false`, API preload limitée, validation Zod et du sender/main-frame, navigation/popups/webviews et permissions refusés, CSP, protocole `tchim://` limité aux assets locaux. Les fichiers importés ont une limite de taille ; seules les données JSON sont acceptées. Les URLs de collecte doivent utiliser HTTPS ; aucune page distante ne s’exécute dans le renderer.

## Construire l’installeur

```powershell
npm.cmd run dist:win
```

Produit `release/0.10.3/Tchim-Draft-0.10.3-win-x64.exe`, installeur NSIS par utilisateur, et `release/0.10.3/win-unpacked/Tchim Draft.exe`. Le packaging utilise un dossier par version pour permettre la construction pendant qu’une ancienne version est ouverte ; `TCHIM_BUILD_OUTPUT` permet un autre dossier. Icône et métadonnées Windows intégrées. La signature Windows n’est pas configurée (`signExecutable` désactivé) ; elle peut être ajoutée au workflow.

macOS : `npm.cmd run dist:mac` sur une machine macOS. Configuration DMG/ZIP fournie ; ni build macOS, ni signature, ni notarisation validées sous Windows.

Les mises à jour applicatives utilisent `electron-updater` avec les Releases GitHub configurées dans `resources/distribution.json`. Le tag `vX.Y.Z` déclenche le workflow Windows, qui vérifie le numéro de version, lance les tests, construit et publie l’installeur, son `.blockmap` et `latest.yml`. Les clients vérifient au lancement et toutes les quatre heures, téléchargent automatiquement et installent à la fermeture normale, ou sur clic dans Réglages. Les statistiques restent actualisées uniquement sur clic, séparément de l’app. [Procédure de publication](docs/GITHUB.md), [documentation electron-builder](https://www.electron.build/v26/docs/features/auto-update/).

Un autre flux HTTPS peut être choisi au build via `TCHIM_UPDATE_URL` ; par défaut, GitHub est actif sans configuration supplémentaire.

## Vérifications

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:desktop
npm.cmd run test:ui
# Ajoute l’actualisation réseau réelle (Data Dragon + les deux scrapers) :
$env:TCHIM_TEST_REFRESH = '1'
npm.cmd run test:ui
```

Tests moteur : ordre, unicité, simulations complètes, rôles, duos, pool, lissage/Wilson, sources Pro/Solo, dimensions, patchs et imports invalides. Smoke desktop : SQLite, worker, preload et renderer. Tests UI : sélection manuelle, retour arrière, duo, sessions, pool, démo, langue, overlay et isolation. Captures dans `artifacts/`. Les tests de l’application ne constituent pas une validation prédictive sur des matchs réels.

Après une collecte CLI, `node scripts/scraped-ui-test.mjs` vérifie les recommandations et l’écran Données avec une copie des vrais packs dans une base isolée. `TCHIM_TEST_EXECUTABLE` permet de cibler l’exécutable packagé ; `TCHIM_TEST_SOURCE_REFRESH=1` vérifie aussi une collecte sur clic avec deux pages sources retirées du cache ; une actualisation complète du patch actif peut être longue. `node scripts/manual-refresh-test.mjs` vérifie le démarrage sans collecte, le bouton, la réutilisation du catalogue/icônes et la persistance après relancement, sans appel réel aux sites.

Résultats de la version locale actuelle : [docs/VALIDATION-0.10.3.md](docs/VALIDATION-0.10.3.md). Les rapports précédents conservent l’état des livraisons antérieures.

Sur certains environnements Windows AppContainer, Electron peut signaler que le runtime téléchargé n’a pas les droits de lecture pour `ALL APPLICATION PACKAGES`. Son diagnostic indique alors une commande `icacls` ciblant le dossier du runtime. Ne pas désactiver le sandbox Chromium pour contourner cela. Ce cas concerne l’environnement d’exécution de développement ; l’application conserve son sandbox.

## Suite du projet

Restent : couverture élargie des matchups/synergies, ordre pro depuis une source qui l’expose explicitement, collecte cron hébergée et droits de redistribution, validation sur matchs hors échantillon, signature et hébergement des releases. Riot mastery/RSO, LCU et ML sont des étapes ultérieures explicites. La V1 n’affiche pas de fonctionnalité ML ou d’automatisation fictive.
