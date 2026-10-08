# Validation de la distribution GitHub — 0.6.2

Le dépôt public est [RomainRichard42/Tchim-Draft](https://github.com/RomainRichard42/Tchim-Draft). La [Release 0.6.2](https://github.com/RomainRichard42/Tchim-Draft/releases/tag/v0.6.2) contient l’installeur Windows, son blockmap et `latest.yml`. Le [workflow Windows](https://github.com/RomainRichard42/Tchim-Draft/actions/runs/37833314059) a terminé avec succès : dépendances, 81 tests, compilation, packaging et publication.

## Fichier distribué

L’installeur public `Tchim-Draft-0.6.2-win-x64.exe` a été téléchargé sans GitHub CLI, jeton, cookie ni en-tête Authorization. Taille : **125 983 137 octets**. SHA-256 :

```text
68974471253eee6081d03fd5ece8aaea5df503796b3617e8b9f9af07868542fc
```

Son SHA-512 correspond à `latest.yml`. Le rapport local est `artifacts/public-release-report.json`. Le même fichier a été téléchargé par `electron-updater` depuis une app 0.6.0 et contrôlé par son propre mécanisme d’intégrité, puis par le test : `artifacts/update-download-report.json`.

## Statistiques partagées

La Release `dataset` est publique, marquée prerelease et exclue du canal de mise à jour stable. Le manifeste publié identifie **16 packs gzip**, **15 625 668 octets compressés**, révision :

```text
0ff5a83a1cd791965eee5486a515b5f0ba31009eadcb1c8620e7304640370faa
```

| Source | Patchs | Statistiques | Paires | Matchs |
| --- | --- | ---: | ---: | ---: |
| Lolalytics Master+ | 16.20, 16.19, 16.18 | 2 499 | 923 824 | 0 |
| gol.gg, toutes ligues | 16.18, 16.17, 16.16 | 602 | 149 378 | 1 504 |

L’export ouvre la base de l’éditeur en lecture seule et sélectionne seulement les agrégats réels de ces fournisseurs, les matchs pro et le catalogue public. Paramètres, sessions, équipes OP.GG, caches de profils, logs, bruts et secrets sont exclus. Les scripts réseau d’exemple demandent désormais une URL via l’environnement ; les fixtures OP.GG utilisent des identités fictives. La base locale et les fichiers générés ne sont pas versionnés dans Git.

## Tests effectués

- **81 tests unitaires passés**, dont export sans données personnelles, fenêtre de trois patchs, déterminisme, conservation des fichiers si seule la date de collecte change, import sur base vierge, préservation des tables utilisateur, actualisation d’un seul fichier modifié, restauration depuis le cache après retrait et réponse 304, rollback si une seconde partie est corrompue, regroupement/retrait d’un patch complet, redirections HTTPS et politique de mises à jour.
- **Electron 0.6.2 packagé, base vierge** : téléchargement réel de GitHub en **24 136 ms** dans ce test, 16 fichiers importés, six lignes de patchs affichées, couverture identique au manifeste. Aucun appel gol.gg/Lolalytics, aucun profil privé importé. Le second clic ne télécharge aucun pack, catalogue ou PNG existant. Le relancement conserve les données et ne les actualise pas. Zéro erreur renderer. Rapport : `artifacts/distribution-report.json`.
- **Vérification automatique du canal GitHub sur app packagée** : la Release stable est trouvée, la Release de données est ignorée, la collecte reste inactive. Rapport : `artifacts/github-updates-report.json`.
- **Téléchargement réel 0.6.0 → 0.6.2** : téléchargement automatique activé, fichier obtenu et checksum correct, état téléchargé et bouton prêt visibles ; draft, équipes et statistiques conservées. La politique normale est l’installation à la fermeture. L’exécution de NSIS a été volontairement désactivée pour ce test et son cache isolé : aucune installation ni modification de l’application de l’utilisateur. Le cycle d’installation NSIS complet n’a donc pas été exercé.
- **Préférences historiques et actualisation manuelle** : test Electron avec copie de la base réelle, ancien réglage de collecte activé et date périmée ; aucun rafraîchissement de données au démarrage, conservation des paramètres, équipes, sessions, SQLite et cache après relancement. Rapport : `artifacts/manual-refresh-report.json`.

## Limites

Les durées mesurées dépendent du réseau et de la machine. La build Windows reste non signée. Aucun packaging ni cycle de mise à jour macOS n’est validé ; il demande notamment un build signé sur macOS. Le système partage des statistiques publiques normalisées et conserve leur attribution, sans prétendre que robots.txt accorde une licence de redistribution. Le moteur reste heuristique, sans probabilité de victoire calibrée.
