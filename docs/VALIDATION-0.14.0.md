# Tchim Draft 0.14.0 — validation locale du 15 octobre 2026

Validation Windows réalisée avant publication. Les contrôles ci-dessous décrivent le jeu statistique et les métadonnées avant la demande explicite de publication du 15 octobre. Le raccourci `Lancer Tchim Draft.cmd` ouvre la version 0.14.0 et conserve le dossier de données existant. [La publication et ses vérifications distantes](VALIDATION-PUBLICATION-0.14.0.md) font l’objet d’un rapport séparé.

## Fonctions livrées

- **Références classique/Fearless séparées.** Le moteur utilise les formats documentés et l’ordre réel des manches. Les champions consommés sont retirés du nombre de manches où ils étaient disponibles. Une manche tardive dont les prédécesseurs manquent, ou avec une répétition contradictoire, est exclue. Un filtre strict vide reste vide ; les autres ligues ne le remplacent pas.
- **Correction du niveau des équipes.** Une estimation régularisée atténue l’avantage apparent des champions joués par des équipes dominantes. Elle utilise uniquement les jours précédents : les dates gol.gg ont une précision journalière, donc aucune partie du même jour ne contribue au niveau estimé avant ce jour. Les victoires et nombres de parties réels restent conservés. Le réglage peut être désactivé pour comparer.
- **Méta expliquée interactive.** Dans la draft, recherche, filtre de rôle, tri par présence/progression/flex et fiche détaillée affichent les dénominateurs Fearless, rôles observés, effectifs et usages dans l’ordre de draft. Les résultats de moins de dix parties ne sont pas présentés comme un taux interprétable. Le panneau montre aussi les compétitions réellement présentes.
- **Responsabilités de composition.** Plans des équipes → Qui fait quoi attribue la préparation de vague, l’accompagnement du jungler, l’engage, le suivi en dégâts, la protection et la side aux champions révélés. Les manques, conditions et relais sont explicites.
- **Avis privés sur un pick.** Le bouton Donner mon avis et la fiche de survol permettent un verdict, une raison et une note. Le contexte est figé à l’ouverture ; un changement de draft, de compte ou de révision empêche d’enregistrer un avis sur une ancienne proposition. Les avis sont conservés dans SQLite, synchronisés, retrouvés après redémarrage et annulables. Les copies d’un même avis ne s’additionnent pas.

## Contexte et limites

Les six tournois des 340 matchs du jeu actif indiquent explicitement « Fearless Draft » dans leur champ Draft mode. Le collecteur a retrouvé le format et les onglets Game N de chacun des 340 matchs. Les métadonnées publiques sont embarquées dans la version locale ; les statistiques partagées restent à la révision `f9056aa7da5f052a3cc019d6118a3bf5d057907ebb6b5ca23e62f416eda2bf03`.

Il n’y a donc aucun match classique documenté dans cette fenêtre. En classique, le mode automatique utilise les premières manches de BO et le signale ; le filtre classique strict n’invente pas de population. Les formats saisis personnellement avec un lien HTTPS sont signalés comme déclaratifs : l’application ne vérifie pas automatiquement le contenu de leur lien.

La correction des équipes reste une heuristique sur trois patchs, avec peu de données pour certaines équipes. Elle ne prouve pas l’effet causal d’un champion. Les responsabilités de composition dépendent des profils de mécaniques connus, et restent conditionnelles au matchup, aux vagues, aux ressources et aux joueurs. Les indices ne sont pas des probabilités de victoire.

Les avis influencent uniquement les propositions de l’équipe/roster correspondant, dans la fenêtre de trois patchs, avec un maximum de ±3 points de score. Un avis de matchup exige un adversaire correspondant ; ADC et support tiennent compte du duo. Ils n’affectent pas les préférences adverses, ne changent pas les règles d’éligibilité et ne deviennent pas des victoires/défaites d’entraînement. L’administrateur peut lire tous les comptes ; les autres coachs ne voient que leurs propres avis.

## Vérifications

- `npm.cmd test` : **206 tests, 24 fichiers, réussis**. Contrôles du format explicite, série réelle, dénominateurs Fearless, séries manquantes/contradictoires, filtre de ligue vide, correction sans fuite temporelle, six responsabilités, contexte des avis, doublons, limites de poids, sauvegarde, annulation, synchronisation concurrente et isolation locale des comptes.
- `npm.cmd run dist:win` : TypeScript, build de production, exécutable Windows et installeur NSIS réussis. Publication désactivée par le script de packaging.
- `node scripts/coaching-cloud-test.mjs` : tests réels Supabase réussis : lecture/modification privées, lecture administrateur, usurpation d’auteur refusée, anonymes et comptes non approuvés exclus, publication du contexte interdite aux coachs, contexte invalide refusé, annulation synchronisée, révision statistique inchangée. Les comptes temporaires sont supprimés après les tests.
- Audit ASAR : **173 icônes** embarquées, aucun fichier privé local ni valeur de clé secrète dans le paquet.
- `node scripts/coaching-ui-test.mjs --packaged` : parcours réel de l’application 0.14.0 réussi, connecté à Supabase : 340 matchs Fearless, 21 au patch courant, aucune série exclue, filtres et correction interactifs, avis synchronisé sans sélectionner un champion, effet contextualisé, redémarrage, annulation, deux plans de six responsabilités, petite fenêtre claire en anglais, aucune erreur du renderer. Captures `artifacts/coaching-meta-dark.png`, `artifacts/coaching-duties-dark.png` et `artifacts/coaching-meta-light-en.png` examinées.
- `node scripts/release-notes-ui-test.mjs --packaged` : nouveautés FR/EN, affichage unique persistant, historique des versions sautées, petite fenêtre et absence de popup dans l’overlay vérifiés sans erreur.
- `node scripts/pick-scroll-ui-test.mjs --packaged` : défilement complet aux étapes 6, 7 et 9, côtés bleu/rouge, fenêtres 1500×960 et 1104×721 ; portraits de 46 à 54 px et noms de 20 px, sans débordement horizontal. Fiches au survol et épinglées, thèmes sombre/clair, choix directs et vue agrandie vérifiés sans modifier la draft pendant la consultation. Aucune erreur du renderer.
- Vérification distante finale : **15 migrations**, **0 compte de test restant**, **0 contexte pro publié**, révision statistique stable inchangée.

Les migrations 14 et 15 ont été appliquées : tables d’avis privés et de contexte pro, politiques d’accès et publication atomique du contexte avec son jeu de statistiques. Cette préparation du schéma n’a pas changé les données communes. La table de contexte partagé reste vide ; le contexte actuel est fourni par l’application locale. Une future publication de données demandée explicitement pourra inclure le contexte avec `--context=...`.

Installeur : `release/0.14.0/Tchim-Draft-0.14.0-win-x64.exe` — 153 140 511 octets, SHA-256 `134d7f0e595e3c67b2ca6a1e9fd378757f94c99ca73a5cb921a511ed0cab81ea`.

Rapports détaillés locaux : `artifacts/coaching-cloud-report.json`, `artifacts/coaching-ui-report.json`, `artifacts/coaching-final-cloud-state.json`, `artifacts/release-notes-ui-report.json`, `artifacts/pick-scroll-ui-report.json`, `artifacts/package-0.14.0-report.json`.
