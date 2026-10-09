# Tchim Draft

[Télécharger l’installeur Windows](https://github.com/RomainRichard42/Tchim-Draft/releases/latest). Après installation : **Données → Actualiser**, avec **GitHub : données déjà collectées**. Aucun compte GitHub n’est nécessaire. Les versions de l’application se téléchargent automatiquement et s’installent à la fermeture ; les statistiques restent actualisées sur clic. [Publier l’app et les données](docs/GITHUB.md).

Application **desktop Electron Windows** d’assistance à la draft League of Legends, entièrement manuelle. React + TypeScript pour l’interface, Electron pour les fenêtres/IPC, SQLite `better-sqlite3` pour les données locales et worker Node pour l’analyse. Aucun serveur n’est nécessaire pour drafter. Next.js n’apporterait ici ni SSR utile ni simplification du packaging.

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

## Utilisation

1. Choisir Compétitif ou Solo/Duo, patch, ligue et côté. Le rôle personnel concerne uniquement la Solo Queue.
2. Saisir chaque ban/pick dans l’ordre affiché en haut, avec le détail accessible via **Ordre de draft**, via le bouton principal, une proposition ou un emplacement actif. Attribuer un rôle libre à chaque pick. Les bans peuvent être vides.
3. Faire défiler tous les picks éligibles, classés par score, ou rechercher un champion. Les filtres de rôle et pools restent appliqués. La jauge compare les deux équipes à chaque pick et annulation, y compris dans l’overlay. Inspecter « Pourquoi ce choix ? » pour la fiabilité, les facteurs et les poids propres au rôle. En compétitif, le support évalue notre duo contre leur duo, la réponse à leur composition et le plan allié ; les autres rôles distinguent le vis-à-vis des autres ennemis. Tant que le vis-à-vis est inconnu, les réponses disponibles, bans, Fearless et pools adverses influencent la lecture du blind ; les tops dépendants de leur développement reçoivent un coût qualitatif explicite. Un double pick compétitif propose trois paires et une réponse adverse ; un clic sur la paire inscrit ses deux champions.
4. Dans **Simulations**, créez une branche depuis la draft ou une draft libre. Glissez les champions sur les picks/bans, attribuez les rôles et verrouillez vos choix. **Compléter ma branche** termine une draft ; **Explorer les suites** propose jusqu’à 12, 24 ou 48 continuations distinctes. Comparez jusqu’à trois branches, leurs plans et leurs indices, puis sauvegardez ou dupliquez vos variantes dans la bibliothèque locale. Les choix manuels peuvent dépasser les pools connus ; les continuations automatiques respectent les pools OP.GG et le Fearless. Les branches impossibles sont signalées. Les simulations ne remplacent pas votre draft réelle.
5. Utiliser Mon pool pour la maîtrise en Solo et Équipes pour importer les deux multis OP.GG. En compétitif, les pools des joueurs peuvent limiter chaque équipe. Un pool restreint doit contenir les rôles nécessaires.
5. Sauvegarder/charger une session ou l’exporter/importer en JSON. La draft courante et les paramètres se sauvegardent aussi automatiquement. Revenir sur une ancienne étape retire la suite pour permettre une nouvelle saisie.
6. Ouvrir l’overlay, le déplacer par sa barre et ajuster son opacité dans Paramètres. Position et taille sont mémorisées. Les recommandations et étapes se synchronisent avec la fenêtre principale.
7. En compétition, activer **Fearless BO3 ou BO5**. Après dix picks, choisir éventuellement le résultat et cliquer **Archiver et continuer** : les picks des deux équipes deviennent indisponibles ; les bans ordinaires redeviennent disponibles. Les victoires sont suivies par équipe même si son côté change. On peut saisir les dix picks d’une manche précédente pour rejoindre une série en cours, rouvrir la dernière manche ou démarrer une nouvelle série. Les transitions sont sauvegardées dans Sessions ; les exports incluent l’historique Fearless.
8. Le design **Face-à-face** aligne les deux équipes par rôle et place les options au centre. La liste complète est défilable et ses scores suivent les filtres. Cliquer sur une option affiche sa lecture dans le bandeau du bas : **plan** en vert, **matchup / duo / conséquences du ban** en ambre et **pool** en violet. **Préparer** ouvre la sélection manuelle ; confirmer ensuite le rôle avec **Valider**. `Ctrl+1/2/3` prépare les trois premiers du classement complet. **Détails des données** ouvre les statistiques, la fiabilité et les facteurs. La jauge reste visible en haut. **Plans des équipes** regroupe les deux plans complets, les compositions, les réponses adverses et les sources. Le bouton de série ouvre l’historique Fearless ; il s’ouvre aussi quand une draft BO3/BO5 se termine. **Ordre de draft** et **Sessions** restent accessibles en bas.

Raccourcis : `Ctrl+K` choisir, `Ctrl+Z` annuler (hors saisie de texte), `Ctrl+1/2/3` préparer une option rapide, `Ctrl+Shift+D` ouvrir/fermer l’overlay. Thème sombre et textes FR/EN. L’overlay interactif est conçu pour rester à côté du client, pas pour être injecté dans League.

En compétitif, l’ordre suit les deux phases de bans et B1/R1/R2/B2/B3/R3 puis R4/B4/B5/R5. En Solo, les bans simultanés sont saisis cinq par équipe, avec doublons entre équipes permis ; les picks suivent les tours usuels. La V1 fixe les rôles au moment de la saisie. Aucun LCU n’est intégré.

## Données et honnêteté des recommandations

Les données sont mises à jour **uniquement sur clic sur Actualiser** ou via une commande de collecte explicite. Aucun accès aux sites de données au lancement, au premier démarrage ou après une mise à jour de l’application. La base SQLite, les pools et le cache restent dans le même dossier, indépendant de la version du binaire. Le bouton vérifie les patchs Data Dragon ; le catalogue du même patch et les icônes déjà présentes sont réutilisés. Un nouveau patch remplace le catalogue, sans réécrire une draft déjà commencée. Hors réseau, les données existantes et les profils embarqués restent disponibles.

Les statistiques **gol.gg et Lolalytics sont collectées par scraping chez l’éditeur**, puis publiées sur GitHub. Par défaut, Actualiser télécharge ces données partagées sans scraper les sites. Le mode Éditeur et la CLI permettent la collecte locale. La fenêtre est fixée aux **trois derniers patchs disponibles par source**, indépendamment du patch choisi pour la session. Lolalytics utilise exclusivement **Master+**, les cinq rôles, les matchups et les synergies des champions/rôles suffisamment joués. gol.gg collecte les agrégats de toutes les ligues puis parcourt tous les tournois et matchs accessibles de sa fenêtre. Aucun plafond de 10 champions ou 12 matchs par défaut. Les statistiques de base arrivent d’abord ; les détails sont publiés progressivement et repris depuis le cache après interruption. La première collecte complète peut prendre une heure ou davantage. La draft reste utilisable pendant celle-ci.

Une actualisation manuelle revalide les agrégats et les détails du patch Solo actif, puis complète les données manquantes. Les détails des deux anciens patchs Lolalytics déjà importés sont conservés. Les matchs pro joués sont réutilisés depuis SQLite ; les listes de tournois sont vérifiées pour trouver les nouvelles games. Les pages de séries en cache permettent de retrouver les liens associés ; seules les séries de tournois dont le nombre de matchs a changé sont recontrôlées pour découvrir les nouvelles games. Les anciens patchs pro peuvent encore recevoir des matchs : leurs petits agrégats restent vérifiés. Les packs de flux HTTPS utilisent leur ETag. Les bruts sont conservés entre les versions.

Dans **Équipes**, collez un multi OP.GG par équipe. Les cinq Riot IDs, pools classés et rôles suggérés sont importés depuis les pages publiques. Vérifiez les rôles des joueurs ; ils ne sont pas un filtre sur votre rôle personnel. Les pools sont éditables et peuvent limiter les suggestions de chaque équipe. Ils influencent picks, bans, doubles picks et réponses adverses. Leur historique de familiarité couvre la saison OP.GG affichée ; ce n’est pas un winrate sur trois patchs. Le pool personnel concerne désormais la Solo Queue.

Les **bans** disposent d’un poids dédié **OP.GG · bans**, réglable dans Paramètres (35 % maximum par défaut). Il favorise les champions souvent joués par l’adversaire, particulièrement ceux qui concentrent son pool, avec résultats de saison lissés. Les petits échantillons et rôles incertains réduisent le poids effectif. L’explication indique le joueur ciblé, son volume de parties, sa fréquence et le poids appliqué. Sans profil exploitable, les bans reposent sur les statistiques et la composition. À 0 %, le score OP.GG est désactivé ; les restrictions de pool restent indépendantes.

Le scoring compétitif combine statistiques corrigées par rapport à la moyenne Master+, données pro, fiabilité des échantillons, usage réel de chaque rôle et besoins des compositions : dégâts des carries, protection contre le dive, poke, initiation, dégâts de zone, double frontline et timings. Un premier tank ne reçoit plus un bonus automatique. Le bonus de flex se fonde sur les rôles effectivement joués. Les règles de mécanique sont qualitatives, explicites et testées ; ce n’est pas encore un modèle ML entraîné ou une probabilité de victoire calibrée.

Depuis la **0.5.0**, chaque source doit atteindre **10 matchs pro pondérés ou 200 matchs Master+ pondérés** pour influencer le winrate, les matchups, les synergies et la priorité méta. Une ligne pro d’un ou deux matchs ne remplace plus la priorité Master+. Le lissage et une atténuation continue s’appliquent ensuite. La recommandation indique l’insuffisance des données ; un champion déclaré jouable peut encore être proposé pour des raisons qualitatives, avec fiabilité statistique nulle.

Un rôle uniquement soutenu par un échantillon inférieur à ces minima n’est plus proposé sans pool connu. La sélection manuelle reste possible.

Les **conséquences d’un ban** comparent le meilleur remplacement adverse dans le rôle, les autres options et le coût de retirer ce champion à notre équipe. Le gain net ajuste le classement, avec un réglage dédié dans Paramètres. La comparaison porte sur le prochain pick dans les pools/filtres connus ; elle ne prétend pas résoudre toute la série. Une absence de données sur les alternatives n’est pas considérée comme un ban-out certain.

Collecte en ligne de commande, dans une base locale au projet :

```powershell
npm.cmd run build
npm.cmd run scrape -- --enable-scraping
$env:TCHIM_DATA_DIR = "$PWD\data\local"
npm.cmd start
```

La collecte complète est le comportement par défaut. `--details=N` et `--games=N` servent aux diagnostics limités ; `0` désactive ces détails. `--source=pro` ou `--source=solo` sélectionne une source. Le patch de collecte vient de Data Dragon et des patchs disponibles chez les fournisseurs ; `--patch` ne change plus la fenêtre. `--rank` accepte seulement `master_plus`. `--force` sert à réparer ou recharger explicitement les anciens détails et matchs ; le bouton Actualiser garde une collecte incrémentale. `--directory=...` choisit un dossier. SQLite : `data/local/tchim.sqlite`. Exports : `data/local/scraping/exports/`. **Lancer Tchim Draft.cmd** ouvre l’exécutable packagé avec cette base. L’installeur conserve la base du profil utilisateur lors des mises à jour ; sur une première installation, cliquez sur Actualiser pour alimenter cette base. Le lanceur du projet et l’installeur utilisent toujours leurs deux emplacements respectifs.

Les patchs pro peuvent être plus anciens que ceux de Solo Queue ; l’interface affiche les deux fenêtres. Les victoires Lolalytics sont reconstituées à partir des taux arrondis. Les compositions pro viennent des tableaux des joueurs, qui peuvent différer des bandes de picks. L’ordre de draft est conservé uniquement si les phases, dix picks et rôles concordent ; sinon il est inconnu. Les paires pro proviennent des matchs réellement récupérés. Winrates et priorité pro sont agrégés toutes ligues ; les paires peuvent aussi être filtrées par ligue. La provenance n’affirme aucun droit de redistribution.

La **jauge d’avantage de draft** note les picks révélés de chaque équipe sur 100 : résultats lissés, matchups, synergies et composition, selon les poids configurés. Elle utilise une moyenne par champion pour ne pas favoriser l’équipe qui a choisi davantage de picks. L’écart signé indique le côté avantagé ; sans picks il est neutre et avant dix picks la lecture reste provisoire. La jauge reste visible pendant le défilement. L’en-tête compact, l’indication du tour et les explications courtes facilitent la saisie.

Les recommandations et la jauge ont un **score de draft**, pas une probabilité de victoire. Les scénarios affichent un indice de composition ; une probabilité nécessiterait un modèle entraîné et calibré sur des données autorisées. Le scoring bayésien, les filtres, la pondération des sources et les limites sont détaillés dans [docs/DATA.md](docs/DATA.md), avec la comparaison des architectures de collecte, les droits des fournisseurs et la trajectoire ML V2/V3.

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

Produit `release/0.10.0/Tchim-Draft-0.10.0-win-x64.exe`, installeur NSIS par utilisateur, et `release/0.10.0/win-unpacked/Tchim Draft.exe`. Le packaging utilise un dossier par version pour permettre la construction pendant qu’une ancienne version est ouverte ; `TCHIM_BUILD_OUTPUT` permet un autre dossier. Icône et métadonnées Windows intégrées. La signature Windows n’est pas configurée (`signExecutable` désactivé) ; elle peut être ajoutée au workflow.

macOS : `npm.cmd run dist:mac` sur une machine macOS. Configuration DMG/ZIP fournie ; ni build macOS, ni signature, ni notarisation validées sous Windows.

Les mises à jour applicatives utilisent `electron-updater` avec les Releases GitHub configurées dans `resources/distribution.json`. Le tag `vX.Y.Z` déclenche le workflow Windows, qui vérifie le numéro de version, lance les tests, construit et publie l’installeur, son `.blockmap` et `latest.yml`. Les clients vérifient au lancement et toutes les quatre heures, téléchargent automatiquement et installent à la fermeture normale, ou sur clic dans Paramètres. Les statistiques restent actualisées uniquement sur clic, séparément de l’app. [Procédure de publication](docs/GITHUB.md), [documentation electron-builder](https://www.electron.build/v26/docs/features/auto-update/).

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

Résultats vérifiés de cette livraison : [docs/VALIDATION-0.5.0.md](docs/VALIDATION-0.5.0.md). Les rapports précédents conservent l’état des versions 0.2.0, 0.3.0, 0.3.1, 0.4.0 et 0.4.1.

Sur certains environnements Windows AppContainer, Electron peut signaler que le runtime téléchargé n’a pas les droits de lecture pour `ALL APPLICATION PACKAGES`. Son diagnostic indique alors une commande `icacls` ciblant le dossier du runtime. Ne pas désactiver le sandbox Chromium pour contourner cela. Ce cas concerne l’environnement d’exécution de développement ; l’application conserve son sandbox.

## Suite du projet

Restent : couverture élargie des matchups/synergies, ordre pro depuis une source qui l’expose explicitement, collecte cron hébergée et droits de redistribution, validation sur matchs hors échantillon, signature et hébergement des releases. Riot mastery/RSO, LCU et ML sont des étapes ultérieures explicites. La V1 n’affiche pas de fonctionnalité ML ou d’automatisation fictive.
