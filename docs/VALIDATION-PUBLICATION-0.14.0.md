# Publication 0.14.0 — 15 octobre 2026

Publication de l’application et du contexte Supabase effectuée après la demande explicite « push tout supabase et github ».

## GitHub et installeur public

- Dépôt : [RomainRichard42/Tchim-Draft](https://github.com/RomainRichard42/Tchim-Draft).
- Commit de la version : `433d3ec285e7b01405c1fa99d27d701c6dc664e8`, poussé sur `main` ; tag annoté `v0.14.0` vérifié sur ce commit.
- [Workflow Windows 38682901880](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/38682901880) terminé avec succès : dépendances, 206 tests dans 24 fichiers, compilation TypeScript et packaging Windows.
- [Release v0.14.0](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.14.0) publiée le 15 octobre à 04:47:42 UTC, stable, non brouillon et non prerelease. Les trois fichiers sont présents : installeur, `.blockmap` et `latest.yml`. Le téléchargement `releases/latest/download` pointe bien sur 0.14.0.
- Téléchargement direct de l’installeur complet vérifié sans jeton, cookie ni connexion GitHub : **153 138 879 octets**.
- SHA-256 du fichier public : `9a0522845d701a87e87075a0fa7383d92fd461421d209d0bd85fe5dde59b84a6`. Le SHA-512 du téléchargement correspond à `latest.yml`.

Le code de la version, les collecteurs, migrations, tests et notes FR/EN sont sur GitHub. Les clés privées, bases SQLite, profils, caches bruts et codes d’invitation restent exclus. Les propositions graphiques locales sans rapport avec cette version sont conservées sur le poste.

## Mise à jour réelle depuis 0.13.1

L’exécutable Windows 0.13.1 a été lancé dans un profil isolé, connecté avec un compte temporaire. Une draft de sept actions a été saisie avant le téléchargement.

Le mécanisme natif `electron-updater` a trouvé la 0.14.0, téléchargé l’installeur public et validé sa somme de contrôle. L’interface affiche « Mise à jour prête » et l’installation à la fermeture. Le téléchargement automatique et l’installation à la fermeture sont activés par défaut ; l’installation a été désactivée uniquement pendant ce test pour préserver l’installation du poste.

La draft, les équipes, les réglages, les packs et leur date d’actualisation restent identiques après le téléchargement. Aucun scraping ni incident du renderer n’est déclenché par cette mise à jour.

## Supabase

Les 15 migrations sont appliquées. Le contexte pro des **340 matchs** est publié dans `draft_pro_context`, associé à la révision active `f9056aa7da5f052a3cc019d6118a3bf5d057907ebb6b5ca23e62f416eda2bf03`. La transaction de publication a réutilisé les **73 blocs existants**, sans nouvelle collecte ni renvoi des statistiques.

- Master+ : 16.20 / 16.19 / 16.18, 2 558 lignes et 1 008 382 interactions.
- Pro : 16.20 / 16.18 / 16.17, 813 lignes, 33 778 interactions et 340 matchs, dont 21 au patch courant.
- Contexte distant identique au fichier validé : SHA-256 canonique `d8767b145b363bb488dc60ff217a57a8c6ac6138fce0b4610957f23bbc8264ea`.

La requête authentifiée d’un coach reçoit ce contexte ; les anonymes et comptes non approuvés sont refusés. Un contrôle dans Electron 0.14.0 a observé directement le message du worker : **340 contextes distants, 340 matchs et 3 371 lignes statistiques**. L’analyse reconnaît les 340 formats Fearless, sans erreur du renderer. Les avis et préparations privés conservent leurs règles d’accès par auteur, avec lecture administrateur.

## Rapports locaux

`artifacts/supabase-publication-0.14.0-report.json`, `artifacts/public-release-report.json` et `artifacts/update-download-0.14.0-report.json` conservent les contrôles détaillés. [La validation fonctionnelle préalable](VALIDATION-0.14.0.md) décrit les tests de méta, responsabilités, avis, thèmes, overlay et défilement des picks.

Les comptes temporaires et leurs préparations ont été supprimés après les vérifications. Le contrôle final retrouve 15 migrations, un contexte actif et aucun compte de test restant, avec la même révision statistique.

Le workflow reste manuel : un prochain push ne publiera aucune version destinée aux utilisateurs sans déclenchement explicite.
