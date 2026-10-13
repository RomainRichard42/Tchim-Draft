# Validation locale 0.10.5 — 13 octobre 2026

## Résultat

Les six pages Electron utilisent la direction constructiviste sombre : Draft, Équipes, Simulations, Mon pool, Données et Paramètres. Le thème clair reste disponible dans Paramètres. Le choix est enregistré dans SQLite et se synchronise avec l’overlay, les détails et les nouveautés.

Les vrais portraits remplacent les silhouettes. L’application inclut 173 icônes Data Dragon et conserve les grandes illustrations déjà embarquées ; le cache local du patch reste prioritaire. Les bans sont grisés et barrés d’une diagonale fine. Les scores et les compteurs restent issus de l’analyse et des données enregistrées.

Les équipes affichent un résumé des cinq joueurs et leurs trois premiers champions. Développer permet de voir et modifier tout le pool. Mon pool affiche la maîtrise déclarée et un récapitulatif calculé. Les données regroupent la couverture réelle des sources, les packs, l’actualisation manuelle et le journal. Les curseurs conservent leurs valeurs quand on change de langue ou de thème sans appliquer les poids.

La simulation conserve ses choix, ses réponses et ses interactions. Son portrait central, ses deux camps et sa frise à deux lignes reprennent la même présentation. Les mouvements respectent la préférence de réduction des animations.

## Vérifications

- `npm.cmd run build` : TypeScript et compilation passent. Vite signale toujours un fichier JavaScript de plus de 500 ko.
- `npm.cmd test` : 124 tests passent dans 15 fichiers, dont la migration des anciens paramètres vers le thème sombre et la persistance du thème clair après réouverture de SQLite.
- `node scripts/constructivist-ui-test.mjs` : draft avec 8 picks saisis, recommandations calculées sur une copie des statistiques locales, aperçu puis confirmation, défilement, recherche et ordre de draft. Textes à 14/28/100 px en 1920 × 1080 et 14/20/68 px en 1104 × 721 ; aucun débordement horizontal.
- `node scripts/theme-ui-test.mjs --packaged --no-icon-cache` : six pages en clair et sombre, portraits sans cache d’icônes, édition des pools, maîtrise, langue, nouveautés, thème persistant, overlay synchronisé. Poids et draft préservés ; aucune requête d’image externe ni erreur renderer. Les textes des pages restent à au moins 14 px.
- `node scripts/guided-simulation-ui-test.mjs --real --packaged` : choix imposé, changement des réponses, glisser-déposer, pause, retour en arrière, sauvegarde/reprise, 20 étapes complètes, dix picks, FR/EN et réduction des animations. Les deux équipes et l’action centrale restent dans la petite fenêtre. Textes lisibles et aucun fond en dégradé dans les éléments vérifiés.
- `node scripts/simulation-ui-test.mjs --real --packaged` : branches imposées, comparaison, duplication, déverrouillage, sauvegarde/reprise et annulation, sans modifier la draft principale. 48 branches distinctes et complètes en environ 13 secondes sur cette machine ; l’IPC répond pendant le calcul. Ce délai dépend de la machine et de la draft.
- `TCHIM_TEST_EXECUTABLE=<win-unpacked/Tchim Draft.exe>` puis `node scripts/ui-test.mjs` : saisie manuelle, annulation, duo, sessions SQLite, simulations, maîtrise, démo et langues dans l’application empaquetée. Overlay toujours au-dessus, synchronisé, avec `contextIsolation` et sandbox actifs. Les textes de l’overlay restent à au moins 14 px.
- `node scripts/release-notes-ui-test.mjs` : nouveautés FR/EN, fermeture persistante, historique des versions sautées, accessibilité en petite fenêtre et absence de popup dans l’overlay.

Les vérifications avec statistiques utilisent des copies isolées de `data/local/tchim.sqlite`. Les pools des scénarios de test sont déclarés explicitement pour ces scénarios ; aucune collecte OP.GG en direct n’est prétendue. Aucun site de statistiques n’a été actualisé pour cette modification visuelle.

## Build et publication

`node scripts/package.mjs win` produit localement l’installeur NSIS x64, l’application `win-unpacked`, sa blockmap et `latest.yml`, avec `publish: 'never'`. Les tests empaquetés exécutent réellement `win-unpacked/Tchim Draft.exe`. L’installation NSIS sur le système utilisateur n’a pas été effectuée.

`Lancer Tchim Draft.cmd` ouvre la version 0.10.5 avec la base habituelle `data/local`. Les mises à jour de l’application sont désactivées pour ce lanceur local de développement ; la collecte des statistiques reste manuelle.

Cette validation locale a précédé l’autorisation de publication : à ce stade, aucun push, tag, workflow, dépôt de données ou release GitHub n’avait été publié pour cette version. La vérification de la publication sera consignée dans `VALIDATION-PUBLICATION-0.10.5.md`. Les tests macOS n’ont pas été exécutés.

Installeur final : `release/0.10.5/Tchim-Draft-0.10.5-win-x64.exe`, 145 657 014 octets. Son SHA-512 correspond à `latest.yml`. SHA-256 :

```text
00E87F016359A3BE5DEA766D5B74A175CC58458CDB6A2DBDC1AE28B43F813E05
```
