# Publication GitHub — Tchim Draft 0.10.3

Publication demandée explicitement par l’utilisateur le 10 octobre 2026.

- Code publié : commit 00e13365dfb4f840ab03868c99451455205486a1.
- Tag v0.10.3 : le commit ciblé a été contrôlé à distance.
- [Workflow manuel 38000921017](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/38000921017) terminé avec succès : installation des dépendances, 121 tests dans 14 fichiers, build Windows, installeur et publication.
- [Release v0.10.3](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.10.3) publiée le 9 octobre 2026 à 22:49:07 UTC, soit le 10 octobre à 00:49:07 en France. Elle est publique, stable, hors brouillon et reconnue comme dernière version par GitHub.
- Les trois fichiers nécessaires sont présents : installeur Windows, blockmap et latest.yml. La release des données reste distincte et n’a pas été modifiée.

## Installeur public vérifié

- Tchim-Draft-0.10.3-win-x64.exe : 140 833 907 octets.
- SHA256 : 45e79fbdf023ad1136ba2194c60fc868c01d6dd1db289822c4220a05f613bfaa.
- Le fichier téléchargé par l’updater correspond au checksum de latest.yml et au digest publié dans l’API GitHub.
- [Téléchargement direct sans compte GitHub](https://github.com/RomainRichard42/Tchim-Draft/releases/download/v0.10.3/Tchim-Draft-0.10.3-win-x64.exe).

Le build GitHub et le build local du rapport VALIDATION-0.10.3.md ont des empreintes distinctes. Les informations ci-dessus concernent l’installeur réellement distribué.

## Mise à jour native contrôlée

Depuis l’exécutable packagé 0.10.0, electron-updater a trouvé la 0.10.3 et téléchargé l’installeur public. Le checksum est validé et l’interface affiche que la mise à jour est prête. La configuration normale d’installation à la fermeture est activée.

Le test utilise un dossier de données isolé et désactive l’exécution de l’installeur : aucune installation utilisateur ni entrée de registre n’a été modifiée. La draft, les équipes, les paramètres, les packs et la date d’actualisation sont identiques avant et après le téléchargement. Aucune erreur renderer relevée.

L’exécutable packagé 0.10.3 a également vérifié le flux public au lancement et sur clic : il se reconnaît à jour, ignore la prerelease des données et laisse les statistiques inactives. Rapports locaux : artifacts/update-download-report.json et artifacts/github-updates-report.json.

Les prochains pushes de code ou de tags ne déclencheront pas une release : le workflow reste exclusivement manuel.
