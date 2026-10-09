# Validation 0.10.2 — 10 octobre 2026

Le mode Draft guidée est ouvert par défaut dans Simulations. Il exige deux liens multi OP.GG, cinq joueurs par équipe, cinq rôles distincts confirmés et des pools renseignés. Le bouton d’import des deux équipes appelle le collecteur existant successivement ; les champs conservent le lien de l’autre équipe pendant un import.

Chaque étape demande un nouveau classement au moteur local avec la draft réellement révélée, les poids capturés et les deux pools. Les réponses automatiques arrivent une par une, avec un délai pour voir l’action et la mettre en pause. Cliquer une proposition permet de la consulter avant de confirmer ; le glisser-déposer applique le choix à l’étape courante. Annuler ou revenir sur la chronologie retire également les réponses suivantes. Le déroulé automatique reste interruptible, sans modifier la draft principale.

Les deux pools sont restreints dans le contexte de la simulation, sans changer les préférences globales. Un choix manuel peut dépasser un pool ; cette exception est affichée avant confirmation et dans le dernier choix après un dépôt direct. Les duplications, rôles déjà pris, champions bannis et indisponibilités Fearless sont rejetés. Les scores sont des indices, sans probabilité de victoire.

La jauge reste visible pendant le défilement du plateau ; propositions et équipes défilent séparément. À chaque nouvelle étape, les propositions reviennent en haut et le catalogue manuel se referme. Les simulations partielles peuvent être sauvegardées et reprises avec leurs équipes et réglages capturés. Une ancienne branche avec des réservations futures reste éditable dans l’atelier de variantes.

## Vérifications

- **121 tests passent dans 14 fichiers.** Les cinq nouveaux tests couvrent les deux rosters, leurs rôles et pools, l’isolation du contexte, la réponse à un pick imposé, les pools adverses côté rouge, le Fearless, les bans passés et le refus d’un choix illégal. Une fixture de matchups contrôlés inverse la préférence Akali/Orianna lorsque le pick adverse passe d’Ahri à Azir.
- TypeScript et Vite compilent. Packaging NSIS Windows x64 réussi : `release/0.10.2/Tchim-Draft-0.10.2-win-x64.exe`.
- `scripts/guided-simulation-ui-test.mjs` passe sur le build de développement, puis avec `--real --packaged` sur une copie isolée de la base statistique réelle. Le test vérifie la préparation des deux rosters, une réponse adverse visible, le dépôt manuel d’Ahri MID, la signalisation de l’exception au pool, son remplacement par Azir, le recalcul des propositions, la pause, la sauvegarde, la reprise, le déroulé complet avec dix picks, FR/EN et le refus d’un contexte incomplet. Le choix imposé est conservé ; aucune erreur renderer.
- Dans ce test, les **pools des dix joueurs sont des fixtures explicites**, tandis que le test empaqueté utilise les statistiques gol.gg/Lolalytics et les icônes de la copie locale. Aucune nouvelle collecte OP.GG en ligne n’a été exécutée pour la validation. Le test de développement ajoute des matchups fictifs contrôlés dans sa base isolée, signalés comme tels.
- La reprise à sept étapes puis le déroulé des treize restantes prennent **21,1 secondes**, délais de présentation compris, sur les données réelles de cette machine. Ce temps ne représente pas une garantie de performance.
- `scripts/simulation-ui-test.mjs --real --packaged` passe : édition par dépôt, verrous futurs, comparaison, duplication, sauvegarde, reprise et annulation de calcul. Douze branches en 8,7 secondes ; **48 branches distinctes et complètes en 20,1 secondes**, avec 16 snapshots traités pendant le calcul.
- `scripts/release-notes-ui-test.mjs --packaged` passe avec les textes FR/EN de la 0.10.2, l’historique de quatre versions, les versions sautées, l’acquittement conservé au redémarrage et l’absence de popup dans l’overlay.
- `scripts/ui-test.mjs` passe également sur le binaire : draft manuelle, annulation, doubles picks, sessions, pool, démo, FR/EN et overlay synchronisé. L’overlay natif reste au premier plan ; isolation et sandbox sont actifs dans les deux fenêtres.
- Les deux interfaces sont inspectées à 1104 × 721 pixels, sans débordement horizontal ; les commandes du bas restent visibles. Les tests utilisent exclusivement des dossiers `.test-data`.

Captures et rapports : `artifacts/guided-setup.png`, `artifacts/guided-desktop.png`, `artifacts/guided-desktop-small.png`, `artifacts/guided-ui-report.json`, `artifacts/simulation-ui-report.json` et `artifacts/release-notes-ui-report.json`.

## Livraison locale

Le lanceur local vise la 0.10.2. Les données personnelles et l’installation existante n’ont pas été remplacées. Aucun push, tag distant, lancement de workflow ou publication de release/données n’a été effectué. La publication reste soumise à une demande explicite de l’utilisateur.
