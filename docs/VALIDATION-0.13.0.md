# Validation locale — 0.13.0

La 0.13.0 organise l’application autour de chaque match, avec Préparation, Draft et Résultat. Les deux entrées principales sont Matchs et Simulations ; Réglages est séparé. Aucun club ni gestion d’organisation n’a été ajouté.

## Fonctionnement

- Création avec deux noms d’équipes, événement, type de match, côté, patch, BO1/3/5 et liens multi OP.GG facultatifs. Chaque nouveau match commence avec ses propres joueurs et une draft vide.
- BO classique et Fearless distincts : le classique autorise à rejouer les champions ; le Fearless conserve les interdictions des manches précédentes.
- Reprise d’une préparation incomplète, conservation des deux pools et de l’ordre des choix, archivage/restauration. Les anciennes sessions restent lisibles ; les nouvelles sauvegardes conservent aussi les équipes.
- Analyse 5v5, arbre de réponses et fiche du champion accessibles depuis la draft. Les simulations affichent le match utilisé et ses rosters.
- Vainqueur, kills et note sur 5 saisis après les dix picks. Le résultat est enregistré avant la manche suivante. Une modification met à jour le même résultat et conserve sa date ; le journal de résultats existant reste accessible.
- Sauvegarde locale immédiate, synchronisation privée dans Supabase et garde de révision. Un conflit conserve une copie locale, sans écraser la version distante ; une requête déjà reçue par le serveur n’est pas dupliquée après une interruption réseau.

## Vérifications exécutées

- `npm.cmd test` : **177 tests, 21 fichiers, tous réussis**. Les nouveaux tests couvrent les deux pools par match, les reprises, les résultats, le BO classique/Fearless, les sauvegardes anciennes, l’interruption réseau et les modifications concurrentes.
- `npm.cmd run dist:win` : compilation TypeScript/renderer et installeur Windows x64 terminés. Aucun téléchargement de statistiques ni scraping n’est déclenché par la compilation.
- `node scripts/workspace-ui-test.mjs --cloud` : parcours complet dans Electron contre le vrai Supabase, avec comptes temporaires. Deux matchs distincts, rosters restaurés après redémarrage, simulation contextualisée, saisie du résultat et passage à G2 ; aucune exception du renderer.
- `node scripts/matches-cloud-test.mjs` : consultation limitée au créateur, lecture admin sans modification d’autrui, refus anonyme et compte non approuvé, refus d’usurpation de propriétaire, révisions et rejet d’une draft mal formée.
- `node scripts/workspace-ui-test.mjs --packaged` : même parcours dans `release/0.13.0/win-unpacked/Tchim Draft.exe`, avec base de test isolée. Aucune exception.
- Taille de contenu **1104 × 721**, FR/sombre et EN/clair : aucun débordement horizontal ; texte minimal de la draft **14 px**. Images de validation dans `artifacts/workspace-*.png`.
- `node scripts/release-notes-ui-test.mjs --packaged` : nouveautés FR/EN, affichage une fois par version, réouverture depuis Réglages, versions sautées, navigation clavier et absence dans l’overlay.
- Inspection ASAR : **173 icônes**, aucun fichier de données privé, fichier d’autorisation ou contenu de clé privée dans le paquet.

## Supabase et publication

La migration **202610140013_match_preparations.sql** a été appliquée : table privée `draft_preparations`, politiques d’accès et révision des documents. Elle est reliée à l’app par l’IPC sécurisé et le processus main. Les comptes de vérification ont été nettoyés après les tests. Le jeu de statistiques partagé reste à la révision `f48f570ba3450cf1dbfcf487adbe963f0a65ca8d3c67a9650b7dc233fa529cb7` ; aucune nouvelle collecte ou publication de statistiques n’a été lancée pour cette réorganisation.

Les changements, le lancement local et l’installeur sont prêts. **Aucun push GitHub, tag, workflow de release ou publication d’application n’a été effectué.** `Lancer Tchim Draft.cmd` cible la 0.13.0 locale et conserve `data/local` comme dossier utilisateur ; les mises à jour de l’application y sont désactivées pour ce test local.

Installeur : `release/0.13.0/Tchim-Draft-0.13.0-win-x64.exe` — 149 512 225 octets.

SHA256 : `6b31df7b4e14eef70cb8127222eb82895c54bf9652d7f06e4bfadce789933a80`.
