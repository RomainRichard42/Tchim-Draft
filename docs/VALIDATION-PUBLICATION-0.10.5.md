# Publication GitHub — Tchim Draft 0.10.5

Publication autorisée explicitement par l’utilisateur le 13 octobre 2026, après la validation locale de la nouvelle interface.

- Code et tag `v0.10.5` : commit `c36ec8d184873835b1472b21ce16af217e2a0403`, contrôlé sur les références distantes.
- [Workflow manuel 38334493843](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/38334493843) terminé avec succès : 124 tests dans 15 fichiers, compilation, installeur Windows et publication.
- [Release v0.10.5](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.10.5) publiée le 13 octobre 2026 à 02:00:42 UTC, soit 04:00:42 en France. Elle est publique, stable, hors brouillon et reconnue comme dernière version par GitHub.
- Les trois fichiers de distribution sont présents : `Tchim-Draft-0.10.5-win-x64.exe`, sa `.blockmap` et `latest.yml`.
- Le changelog public décrit la nouvelle interface en français et en anglais. Les nouveautés de l’application sont également disponibles dans les deux langues.
- La release des statistiques `dataset` est restée distincte et inchangée ; aucune collecte ni publication de données n’a été effectuée.

## Téléchargement public vérifié

Le script `verify-public-release.mjs` a téléchargé l’installeur et les métadonnées sans compte, cookie ou jeton GitHub.

- Installeur distribué : 145 654 873 octets.
- SHA-256 : `0a4377feeb89da665669d22ce19d795db6677728210d838612221daa21ef9b4c`.
- Le SHA-512 du fichier téléchargé correspond à `latest.yml`. Son SHA-256 correspond aussi au digest publié par l’API GitHub.
- [Téléchargement direct](https://github.com/RomainRichard42/Tchim-Draft/releases/download/v0.10.5/Tchim-Draft-0.10.5-win-x64.exe).

Le build GitHub possède une empreinte distincte de l’installeur local documenté dans `VALIDATION-0.10.5.md`. Les chiffres ci-dessus concernent le fichier réellement distribué. Rapport local : `artifacts/public-release-report.json`.

## Mise à jour native vérifiée

L’exécutable empaqueté 0.10.3 a trouvé puis téléchargé la 0.10.5 avec `electron-updater`. Le checksum correspond au fichier public et l’interface affiche que la mise à jour est prête. La configuration de distribution active normalement l’installation à la fermeture de l’application.

Ce test utilise un dossier isolé et désactive l’exécution de l’installeur. Il ne modifie donc pas l’installation utilisateur ni le registre. La draft, les équipes, les paramètres, les packs et la date d’actualisation sont identiques avant et après le téléchargement. Aucune erreur renderer n’a été relevée. Rapport : `artifacts/update-download-report.json`.

L’exécutable empaqueté 0.10.5 a aussi vérifié le flux au lancement et sur clic : il se reconnaît à jour, exclut la prerelease des statistiques et ne lance aucune actualisation des données. Rapport : `artifacts/github-updates-report.json`.

Les prochains pushes de code ou de tags ne publieront pas de nouvelle version automatiquement : le workflow reste exclusivement manuel.
