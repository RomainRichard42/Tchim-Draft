# Distribution GitHub

Le dépôt public `RomainRichard42/Tchim-Draft` distribue les fichiers sans connexion GitHub. GitHub héberge le code et les Releases ; chaque utilisateur garde sa propre SQLite locale. Aucun serveur de calcul n’est nécessaire.

## Installer pour un ami

Télécharger l’installeur Windows depuis [la dernière version](https://github.com/RomainRichard42/Tchim-Draft/releases/latest), l’installer, puis ouvrir **Données → Actualiser**. Le mode **GitHub : données déjà collectées** est choisi par défaut. Ce clic récupère les statistiques de l’éditeur, pas les pages gol.gg/Lolalytics. La première installation peut également télécharger les icônes Data Dragon.

Après cette installation, les versions de l’app sont vérifiées au démarrage et toutes les quatre heures. Le téléchargement est automatique ; l’installation se fait à la fermeture normale de l’application, ou via **Installer et redémarrer**. Une draft en cours n’est pas interrompue. Les données statistiques ne sont jamais actualisées au lancement, y compris après une mise à jour de l’app.

Les anciennes versions sans flux de publication, notamment 0.5.0, doivent installer une première fois la 0.6.0. L’identité NSIS et le dossier de données restent identiques pour conserver les paramètres et sessions. Le lanceur de développement utilise `data/local` et désactive les installations automatiques pour ce lancement ; les amis doivent utiliser l’installeur.

## Collecter et publier les statistiques

À exécuter chez l’éditeur, avec GitHub CLI connecté et des données collectées à distribuer :

```powershell
npm.cmd run build
npm.cmd run scrape -- --enable-scraping
npm.cmd run publish:data
```

La première commande de scraping réutilise les caches existants ; elle ne fait pas partie d’une mise à jour de l’application. Si la base locale contient déjà les données souhaitées, exécuter seulement `npm.cmd run publish:data`.

`data:export` ouvre `data/local/tchim.sqlite` en lecture seule. Il conserve les agrégats réels gol.gg/Lolalytics, les trois derniers patchs disponibles par source, Master+ côté Solo, les matchs pro et le catalogue des champions. Il exclut les packs de démonstration, les paramètres, équipes OP.GG, sessions, logs, caches bruts et secrets. La provenance est conservée ; l’accès public ou robots.txt ne constitue pas une licence de redistribution des fournisseurs.

Chaque patch est découpé en packs JSON gzip, nommés par leur SHA-256. Une publication réutilise les fichiers identiques et téléverse les nouveaux avant de remplacer le petit `manifest.json`. La Release permanente `dataset` est marquée **prerelease**, avec `latest=false`, pour rester distincte des versions de l’application. Ne pas en faire la dernière version stable.

Le client vérifie HTTPS, redirections GitHub autorisées, tailles, SHA-256, schémas, compteurs et identifiants. Il conserve les packs gzip en cache et ne télécharge que les parties absentes ou modifiées. L’import de toutes les modifications et le retrait des anciens packs partagés se font dans une transaction SQLite après validation complète. Un échec conserve la dernière base exploitable. Les tables personnelles et les packs importés manuellement sont conservés. Les anciens assets à hash restent disponibles dans GitHub ; surveiller la limite de 1 000 assets par Release si les publications deviennent nombreuses.

## Publier une nouvelle version de l’app

Modifier le code et `docs/RELEASE_NOTES.md`, puis :

```powershell
npm.cmd test
git add .
git commit -m "Improve draft assistant"
npm.cmd version patch
git push origin main --follow-tags
```

Le tag `vX.Y.Z` déclenche `.github/workflows/release.yml` : installation des dépendances, tests, compilation, installeur Windows, puis publication de l’exécutable, de son `.blockmap` et de `latest.yml`. La Release reste un brouillon tant que les trois fichiers ne sont pas téléversés. Un push de code sans tag ne diffuse pas une nouvelle version aux utilisateurs. Un changement du numéro de version est nécessaire pour que les installations existantes détectent une mise à jour.

`resources/distribution.json` est l’unique configuration du dépôt et du tag de données. Aucun jeton GitHub n’est embarqué dans l’app. Le workflow utilise son `GITHUB_TOKEN` temporaire et l’éditeur utilise sa propre connexion GitHub CLI. Ne pas publier `data/local`, SQLite, `.env`, les autorisations du collecteur ou `node_modules` ; ils sont ignorés par Git.

Cette distribution vérifie Windows. Les cibles macOS restent disponibles dans le projet, mais leur mise à jour automatique demande un build signé sur macOS.
