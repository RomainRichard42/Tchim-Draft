# Tchim Draft 0.10.4 — validation locale

L’écran de draft reprend la maquette constructiviste approuvée : crème papier, noir charbon, bleu électrique et rouge vermillon, cadres en diagonale, portraits SVG génériques et grain discret. Aucun service distant ne sert à dessiner l’interface.

Les équipes se trouvent en haut. La carte du champion affiché domine la zone des recommandations, avec le score en grand, les critères et une action Préparer. Les alternatives restent accessibles par recherche et défilement ; leur classement et les scores viennent du moteur, sans valeurs de démonstration ajoutées à la draft personnelle. Comparer un champion ne valide aucun choix.

Les rôles viables déjà déterminés par le moteur sont exposés à l’interface pour distinguer un rôle fixe d’un flex. Les seuils et les poids du scoring sont inchangés. Un test vérifie qu’une apparition sur deux parties ne suffit pas à créer un rôle flexible.

## Vérifications

- `npm.cmd run build` : TypeScript et compilation Electron/React réussis.
- `npm.cmd test` : **122 tests dans 14 fichiers**, tous réussis.
- `scripts/constructivist-ui-test.mjs` et `--packaged` : copie isolée de la base réelle ; huit picks révélés, 38 recommandations ADC, score identique au moteur, dix emplacements de picks et dix de bans, deux lignes d’ordre réel et étape 19 active. Comparaison, recherche avec conservation du rang, préparation, validation, annulation, retour sur une étape, historique Fearless, plans, FR/EN, changement de côté et overlay vérifiés. Aucun rafraîchissement des données déclenché.
- Mesures à **1920 × 1080** et **1104 × 721** : trois niveaux de texte dans la draft (14/28/100 px à 1080p, 14/20/68 px en petite fenêtre), textes visibles à au moins 14 px, score principal à 100/68 px, jauges noires, carte et liste au-dessus des commandes fixes. Défilement interne des panneaux sur la petite fenêtre.
- `scripts/ui-test.mjs` : saisie manuelle, annulation, doubles picks, sessions SQLite, pool, données de démonstration isolées, FR/EN et overlay. `contextIsolation` et sandbox actifs, absence d’accès Node dans l’interface, fenêtre overlay toujours au-dessus vérifiés.
- `scripts/release-notes-ui-test.mjs` : popup FR/EN, fermeture persistante, historique, versions sautées et absence de popup dans l’overlay vérifiés.
- `scripts/guided-simulation-ui-test.mjs --real` : réponse adverse visible, recalcul selon les propositions, glisser-déposer, sauvegarde/reprise, pause, dix picks complets, petite fenêtre et réduction des mouvements vérifiés. Aucune erreur renderer ni image distante.

Les scripts utilisent des dossiers `.test-data` séparés ; ils ne changent pas la draft ni les statistiques personnelles de `data/local`.

## Livraison locale

Installeur : `release/0.10.4/Tchim-Draft-0.10.4-win-x64.exe` — **140 842 494 octets**.

SHA-256 : `32a2294a256a2e1a880d11fa4b1add3a64d5b32fe14689b31438fd339cfe1f1c`.

`Lancer Tchim Draft.cmd` ouvre la version locale 0.10.4 avec les données personnelles existantes et les mises à jour de l’application désactivées pour ce lancement. L’installeur est préparé avec `publish: never`.

La version et les styles inclus dans l’archive de l’application, ainsi que la taille et le SHA-512 référencés dans `latest.yml`, sont vérifiés localement. Les rapports et captures sont dans `artifacts`.

**Aucun push, tag, workflow de release, publication de l’application ou des données effectué.**
