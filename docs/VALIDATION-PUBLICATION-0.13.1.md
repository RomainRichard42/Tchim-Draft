# Publication vérifiée — Tchim Draft 0.13.1

Publication effectuée le 14 octobre 2026, après la demande explicite « tu peux push vas y ».

- Dépôt public : `RomainRichard42/Tchim-Draft`.
- Commit de l’application : `36e673228b95f96d349768730beab22c50399e0d`, poussé sur `main` et référencé par le tag annoté `v0.13.1`.
- [Workflow manuel 38641895289](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/38641895289) : réussi, avec **186 tests dans 22 fichiers**, compilation et installeur Windows.
- [Release v0.13.1](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.13.1) : publique, publiée le 14 octobre à 21:45:13 UTC, ni brouillon ni prerelease, sélectionnée comme dernière version stable.
- Les trois fichiers sont présents : installeur, `.blockmap` et `latest.yml`.

## Téléchargement public

[Installeur Windows](https://github.com/RomainRichard42/Tchim-Draft/releases/download/v0.13.1/Tchim-Draft-0.13.1-win-x64.exe) téléchargé sans jeton, cookie ou compte GitHub : **149 549 930 octets**. Son SHA-512 correspond à `latest.yml` ; son SHA-256 correspond également au digest de l’asset GitHub.

SHA-256 publié : `db9db03e47fab991f3a5d611aa0b17e80ddc1a761cbfd0b6b1d4dac4cfa2c0d6`.

Le binaire du build GitHub et celui du build local ont des empreintes différentes. La validation ci-dessus porte sur le fichier effectivement distribué et son propre manifeste.

## Mise à jour native

Le téléchargement **0.10.5 → 0.13.1** a réussi avec `electron-updater` dans l’ancienne application Windows packagée. L’empreinte correspond au manifeste public et l’interface affiche la mise à jour prête. Draft, équipes, paramètres, packs et date de collecte sont conservés. L’installation automatique à la fermeture est activée par défaut ; elle est désactivée uniquement dans ce test afin de ne pas modifier l’installation réelle ni le registre Windows.

Dans la 0.13.1 packagée, la vérification au lancement et une seconde vérification retrouvent la version stable 0.13.1, même avant connexion au compte. Les prereleases de données sont exclues. La collecte reste inactive et aucune exception du renderer n’a été observée.

Les vérifications locales précédentes de la liste, du survol, de l’agrandissement et du vrai Supabase sont détaillées dans [VALIDATION-0.13.1.md](VALIDATION-0.13.1.md). Les rapports de publication et de mise à jour sont conservés localement dans `artifacts/`, hors Git.

Cette publication ne relance aucune collecte et ne remplace pas les statistiques Supabase. Leur révision reste `f48f570ba3450cf1dbfcf487adbe963f0a65ca8d3c67a9650b7dc233fa529cb7`, avec treize migrations appliquées. Les fichiers privés, les clés d’administration et les codes d’invitation restent hors Git et de l’installeur. Les maquettes sans rapport avec cette version restent locales.
