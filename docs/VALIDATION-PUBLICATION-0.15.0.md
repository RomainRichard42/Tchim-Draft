# Publication 0.15.0 — 16 octobre 2026

Publication après validation de l’essai par l’utilisateur et demande explicite : « ok j’ai testé c’est bon, tu peux push tout sur github et supabase ».

## Application et GitHub

- Commit de la version : `4e88263ee1bee14ea6e51ebc271177660727f5b6`, poussé sur `main`, avec le tag annoté `v0.15.0` vérifié sur ce commit.
- [Workflow Windows 38888307794](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/38888307794) terminé avec succès : installation des dépendances, **222 tests dans 25 fichiers**, compilation TypeScript et installeur Windows. Les tests sont exécutés avec un seul worker, comme lors de la validation locale.
- [Release stable v0.15.0](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.15.0) publiée le 16 octobre à **10:40:26 UTC**, ni brouillon ni prerelease. Les trois fichiers sont présents : installeur, `.blockmap` et `latest.yml`.
- Téléchargement complet depuis `releases/latest/download` vérifié sans jeton, cookie ou connexion GitHub : **153 230 133 octets**. SHA-256 : `2fe63a2be718954b10f6ffe791185a8601c04dae4de45e869255ee119626fcba`. Le SHA-512 correspond à `latest.yml` ; le SHA-256 correspond également à l’empreinte fournie par GitHub.

Le build local normal est disponible dans `release/0.15.0`. Son archive d’application a la même empreinte que le candidat testé : `c06932b6952d55598364403c0d7a751f0923908170288f542425ef45fab00704`. `Lancer Tchim Draft.cmd` ouvre cette version avec le dossier habituel `data/local`. Le raccourci d’essai garde son profil séparé et son fonctionnement hors ligne.

Les notes de nouveautés sont disponibles en français et en anglais, dans la fenêtre de l’application et dans la release. Le contrôle du paquet local confirme la présence des **173 icônes**, l’exclusion des fichiers privés et l’absence des clés administratives dans les fichiers distribués. Les bases locales, profils, caches bruts et propositions graphiques sans rapport restent hors du commit.

## Mise à jour native

L’exécutable Windows 0.14.0 a été lancé avec un **profil isolé hors ligne**, sans modifier l’installation du poste. Une draft de sept actions a été créée avant le téléchargement.

Le mécanisme natif `electron-updater` a trouvé la 0.15.0, téléchargé l’installeur public complet et validé son empreinte. L’interface affiche « Mise à jour prête ». Le téléchargement automatique et l’installation à la fermeture sont activés par défaut ; l’installation a été désactivée uniquement dans le test.

La draft, les équipes, les réglages, les packs et leur date d’actualisation restent identiques après le téléchargement. Aucun scraping ni incident de l’interface n’a été déclenché. Ce contrôle vérifie le téléchargement et la conservation de l’état, sans exécuter l’installeur.

## Données Supabase

La révision active est `0ff207db31d782a25ea85dc899642c6be76608d5d7a786a7a237c04ce4300c61`, avec **74 blocs**, **15 694 373 octets compressés** et le contexte pro correspondant, publiés ensemble.

| Source | Fenêtre de patchs | Agrégats | Interactions | Matchs |
| --- | --- | ---: | ---: | ---: |
| Lolalytics Master+ | 16.20 / 16.19 / 16.18 | 2 558 | 1 008 382 | — |
| gol.gg | 16.20 / 16.18 / 16.17 | 995 | 41 002 | 409 |

Répartition pro : **235 EMEA Masters, 8 Worlds Play-In, 57 LCS, 48 LEC et 61 LPL**. Le patch courant comporte 29 matchs : 21 EMEA Masters et 8 Worlds. Le contexte des 409 matchs est documenté comme Fearless. Huit matchs Worlds restent un faible échantillon ; aucun modèle appris non validé n’a été activé.

Les 74 blocs Postgres et les 74 archives sont vérifiés avec leurs nombres et tailles attendus. Le contexte distant est identique au fichier validé : SHA-256 canonique `87202f28facf1d93162b8effde28964f4b87ac7b4df6fb4b4344812552e7d283`.

Un compte coach approuvé reçoit le contexte ; les accès anonymes et non approuvés sont refusés. Dans l’exécutable 0.15.0 connecté à Supabase, le message envoyé au worker contient réellement **409 contextes, 409 matchs et 3 553 lignes statistiques**. L’analyse retrouve les 8 Worlds et les 61 LPL, sans erreur du renderer. Les 15 migrations existantes restent appliquées ; aucune modification des règles de confidentialité n’est nécessaire.

Un incident temporaire du service Supabase pendant un envoi d’archive a été repris avant l’activation. L’outil de publication vérifie désormais à la fois le bloc Postgres et son archive, répare une archive manquante sans réimporter le bloc, et réessaie les erreurs HTTP temporaires. Un contrôle simulant une erreur 520 confirme la reprise et l’activation seulement après réparation. Le correctif de cet outil administratif est poussé séparément du tag de l’application ; il ne change pas le binaire 0.15.0.

## Rapports locaux et fonctionnement futur

Les rapports détaillés sont conservés dans `artifacts/` : `public-release-report.json`, `update-download-0.15.0-report.json`, `supabase-publication-0.15.0-report.json`, `package-0.15.0-report.json`, `publisher-resume-015-report.json` et `final-published-0.15.0-report.json`. Les comptes temporaires sont supprimés après le contrôle ; le rapport final vérifie leur absence et la révision active.

Le workflow reste **manuel** : un prochain push de code ou de tag ne publiera pas automatiquement une nouvelle application. La collecte des sites et la publication des données restent des actions administratives demandées explicitement. [La validation locale](VALIDATION-0.15.0-LOCAL.md) décrit les comportements de flex, de bans et leurs limites.
