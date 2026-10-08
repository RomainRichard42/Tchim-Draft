# Validation de la version 0.3.0 — 8 octobre 2026

La version corrige deux causes des propositions répétitives : le bonus automatique de frontline/flex et la lecture des bandes de picks gol.gg comme si elles indiquaient les rôles. Les rôles pro viennent maintenant des tableaux des joueurs. Un rôle anecdotique ne crée plus une suggestion ou un bonus de flex.

## Vérifications exécutées

- `npm.cmd test` : **38 tests passent** dans cinq fichiers. Cas couverts : protection de Jinx face au dive Vi/Akali, dernier pick AD dans une composition AP, exclusion des rôles peu joués, petits échantillons pro, deux pools distincts, priorité aux champions adverses pour les bans, fenêtre de trois patchs indépendante de la session, parsers, SQLite, cache, robots, CAPTCHA/429 et conservation des matchs lors d’une reprise interrompue.
- `npm.cmd run dist:win` : compilation TypeScript, renderer, main, worker et collecteur, puis installeur NSIS x64 **0.3.0**.
- `scripts/ui-test.mjs` sur `release/win-unpacked/Tchim Draft.exe` : draft manuelle, undo, double pick, trois scénarios, sessions SQLite, pool, démo, langue FR/EN et overlay synchronisé. `contextIsolation` et sandbox vérifiés dans les deux fenêtres ; overlay visible avec `alwaysOnTop: true`.
- `scripts/teams-ui-test.mjs` sur l’exécutable packagé : import réel des profils mis en cache depuis le multi fourni par l’utilisateur, dans **les deux équipes**, rôles uniques, ajout manuel et restriction des pools, recommandations compétitives, absence de filtre « Mon rôle » et IPC validé. Aucune erreur renderer.
- `scripts/scraped-ui-test.mjs` sur l’exécutable packagé final : vraie base collectée copiée dans une base de test, fenêtres des trois patchs, recommandations issues des deux sources, trois scénarios complets, écran Données et sandbox. Aucune erreur renderer. Première analyse : **1 909 ms** sur cette machine avec la collecte terminée. La durée dépend de la machine et de la taille de la base.
- `scripts/pack-import-test.mjs` sur l’exécutable final : import IPC du pack pro réel de **37 542 291 octets**, dans une copie isolée de la base. La limite des packs est passée à 64 Mio pour accepter les synergies de toutes les ligues sur trois patchs.
- Import réseau OP.GG : **5/5 profils** identifiés et chargés depuis l’URL française/allemande fournie. Pools de 42, 73, 30, 31 et 31 champions. Ces pools représentent la saison du profil, pas des winrates sur trois patchs. L’exemple n’est pas imposé comme équipe dans la base utilisateur.

## Données réelles

Le catalogue Data Dragon contient **173 champions**, version **16.20.1**, avec icônes locales. Aucun pack de démonstration n’est utilisé dans `data/local/tchim.sqlite`.

Lolalytics : **16.20 / 16.19 / 16.18**, **Master+ uniquement**, cinq rôles. **2 499 lignes champion/rôle** et **788 443 lignes de matchups/synergies**. Les détails couvrent les rôles suffisamment joués et les pools prioritaires ; les victoires sont reconstituées depuis des pourcentages arrondis et cette approximation est signalée.

gol.gg : **16.18 / 16.17 / 16.16**, statistiques de toutes les ligues, **602 lignes champion/rôle**, **1 504 matchs récupérés** et **149 378 lignes de matchups/synergies**, globales et par ligue. Les 153 tournois du catalogue de saison ont été parcourus sans erreur finale ; les matchs retenus concernent 45 tournois et 31 ligues. Répartition : 341 / 559 / 604 matchs. Sur 16.17, l’agrégat de statistiques indique 562 matchs, soit trois de plus que le parcours public : l’exhaustivité de cet index par rapport aux agrégats n’est pas garantie. La source pro est décalée par rapport à la Solo Queue, avec avertissement dans l’application. Décompte final et recommandations : `artifacts/draft-regressions.json` ; livraison et SHA-256 : `artifacts/delivery-0.3.json`.

Sur les pages réellement récupérées, **aucun ordre de draft n’a passé le contrôle de concordance**. Les dix champions et leurs rôles sont conservés, mais la priorité de premier tour reste heuristique : aucun ordre chronologique n’est inventé à partir de leur position dans la page.

Les captures et rapports sont dans `artifacts/teams-desktop.png`, `artifacts/team-pool-draft.png`, `artifacts/desktop-overlay.png`, `artifacts/scraped-draft.png`, `artifacts/teams-desktop-report.json` et `artifacts/scraped-desktop-report.json`. Les tests UI utilisent des copies isolées dans `.test-data/`.

## Livraison et limites

`Lancer Tchim Draft.cmd` ouvre la version packagée avec la base déjà collectée du projet. L’installeur `release/Tchim-Draft-0.3.0-win-x64.exe` utilise une base dans le profil utilisateur et effectue sa propre collecte. L’installation NSIS dans ce profil n’a pas été exécutée ; c’est l’exécutable packagé qui a été testé.

Installeur final : **125 923 704 octets**. SHA-256 : `CDAF7E46EB9FB8F5E85EA7E6675CFE7B05087B244CFD9BF852A1DC70CB6D7E50`.

Build Windows non signée, sans publication distante, sans flux de mises à jour applicatives configuré ni build macOS validée. Aucun client League n’a été lu. Le moteur reste statistique et heuristique, avec règles de composition explicites ; aucun modèle ML entraîné ou taux de victoire prédictif calibré n’est revendiqué. Les scores et préférences adverses ne sont pas des probabilités de victoire. L’ordre historique pro n’est utilisé que lorsqu’il peut être vérifié sur les pages sources.
