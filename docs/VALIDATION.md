# Validation de la version 0.2.0 — 8 octobre 2026

- `npm.cmd test` : **28 tests passent** (moteur, SQLite, imports, fallback Data Dragon, collecteur, parsers de vrais HTML Qwik/gol.gg, robots, cache, refus des redirections externes et arrêt sur 429).
- `npm.cmd run build` : TypeScript et bundling Electron/React réussis.
- `npm.cmd run test:desktop` : SQLite natif, worker, preload sécurisé et renderer chargés dans Electron.
- `npm.cmd run dist:win` : installeur NSIS x64 et application autonome générés. Métadonnées Windows Tchim Draft 0.2.0 et icône intégrées. La version affichée utilise le manifeste.
- `scripts/ui-test.mjs` exécuté sur **`release/win-unpacked/Tchim Draft.exe`** : sélection manuelle, undo, double pick, scénarios, sauvegarde/chargement SQLite, pool, démo fictive, FR/EN, overlay synchronisé. `contextIsolation` et sandbox vérifiés dans les deux fenêtres ; overlay `alwaysOnTop: true` vérifié avec la fenêtre principale visible, comme en utilisation normale.
- Actualisation réseau réelle : **Data Dragon 16.20.1, 173 champions**, icônes téléchargées et mises en cache. Les anciennes entrées `lolpatch_*` de versions.json sont prises en charge sans invalider les versions modernes.
- Collecte réelle CLI, validée puis importée dans `data/local/tchim.sqlite` : **860 lignes champion/rôle Lolalytics** (patch 16.20, Émeraude+, cinq rôles), **7 217 matchups** de dix champions/rôles ; **373 lignes pro gol.gg** (patchs 16.17/16.18), **12 matchs professionnels**, **1 058 paires pro** comptées sur ces matchs. Aucun pack de démonstration dans cette base.
- `scripts/scraped-ui-test.mjs` exécuté sur l’application packagée : chargement des deux packs SQLite, recommandations avec winrates/effectifs réels, trois simulations complètes, écran Données et case d’actualisation automatique. Aucune erreur renderer. Analyse initiale avec les données réelles : environ **0,7 seconde** lors du dernier passage, dépendant de la machine.
- `TCHIM_TEST_SOURCE_REFRESH=1` : démarrage de l’exécutable avec une copie isolée de la base, une ancienne date d’actualisation et deux pages retirées du cache (une par fournisseur). **Collecte réseau gol.gg et Lolalytics au lancement réussie**, packs remplacés et `lastRefresh` renouvelé. Les autres pages utilisaient leur cache valide.
- Audit npm en ligne : **0 vulnérabilité déclarée** après mise à jour des dépendances (rapport local `artifacts/audit.json`).
- Captures de la version packagée : `artifacts/desktop-draft.png`, `artifacts/desktop-overlay.png`, `artifacts/scraped-draft.png`, `artifacts/scraped-data.png`. Rapport des packs et recommandations : `artifacts/scraped-desktop-report.json`.

L’overlay et la fenêtre principale ont été brièvement affichés pour vérifier l’ordre des fenêtres natif Windows et capturer les images. Les autres tests utilisent des bases isolées dans `.test-data/`. Aucun client League n’a été lu ou automatisé.

Installeur : `release/Tchim-Draft-0.2.0-win-x64.exe` (125 897 742 octets).

SHA-256 : `8F54C70133CB4713D338294D69A5A5856F9C98064990908051FAE9795C2E3F37`.

L’installation NSIS dans le profil utilisateur n’a pas été lancée. L’exécutable packagé a été testé directement. Build **non signée** (`NotSigned`), sans publication distante ni flux d’updates applicatives configuré. Aucune build macOS, inférence ML ou validation prédictive sur matchs réels réalisée. L’installeur embarque les scrapers ; les données propriétaires sont collectées localement. `Lancer Tchim Draft.cmd` cible la base déjà collectée dans ce projet. DPM n’est pas collecté. Les victoires Lolalytics sont des reconstitutions depuis des taux arrondis ; les matchups ne couvrent que dix pages de champions/rôles. Les synergies Solo Queue et l’ordre réel des picks pro ne sont pas récupérés ; les matchs gol.gg portent explicitement `draftOrderKnown: false`.
