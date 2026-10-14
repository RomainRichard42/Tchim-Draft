# Validation locale — 0.13.1

## Picks lisibles et défilants

Le problème a été reproduit dans Electron : une carte flex pouvait mesurer 504 px alors que sa colonne disposait de 360 px. La liste située en dessous était comprimée à zéro et coupée par le panneau parent. À 1104 × 721, le même problème se produisait avec une carte de 478 px dans une zone de 230 px.

La colonne possède désormais un seul défilement réel. La vue **Tous les picks** est proposée par défaut ; **Carte détaillée** permet de comparer un champion. Le bouton **Agrandir les choix** ouvre une grande fenêtre. Les lignes et portraits sont agrandis ; noms et scores utilisent 20 px, les portraits 48 à 56 px. La flèche d’une ligne prépare directement le pick.

## Informations du survol

Le survol et le focus clavier ouvrent les informations après un court délai. Le bouton Infos épingle la fiche ; Échap la referme. La fiche reste dans la fenêtre et accessible en thème sombre/clair, FR/EN.

Le processus main consulte une tranche Supabase dédiée au champion, sans remplacer les données de la draft. Les calculs tournent dans un worker séparé. Une lecture à la fois, suppression des demandes devenues inutiles et cache limité à douze champions évitent de relire la base à chaque mouvement de souris.

Les trois groupes distinguent les menaces, les matchups favorables et les synergies. Ils utilisent le même lissage et la même correction des forces individuelles que le moteur ; les nombres affichés sont des effets ajustés, pas des winrates bruts. Les échantillons insuffisants restent neutralisés. Les champions déjà révélés et les pools passent avant les possibilités générales, avec priorité au duo pour ADC/support. Un offrole général connu comme inhabituel doit être documenté en pro ou dans un pool ; un offrole déjà révélé reste analysé.

La fiche explique les apports à la composition et les risques ; les interactions de compétences affichent leurs conditions. Les statistiques de victoire ne prétendent pas mesurer une domination de lane. Une absence de données est affichée explicitement.

## Vérification

- **186 tests dans 22 fichiers**, tous réussis : effets corrigés, direction des paires inversées, petits échantillons pro, picks/bans indisponibles, trois patchs, rôle rare et synergies du duo bot.
- Test Electron de la liste : blue B1, red R1/R2 et blue B2/B3, chacun à 1500 × 960 et 1104 × 721. La molette atteint la fin de la liste dans tous les cas, avec carte flex affichée, sans débordement horizontal.
- Survol, fiche épinglée, lecture FR/sombre et EN/clair, préparation depuis une ligne et grande fenêtre vérifiés sans modifier la draft par simple consultation. Aucun incident du renderer.
- Test sur le vrai Supabase : lecture complète des interactions d’un pick hors du sous-ensemble courant, fenêtres Master+ 16.20/16.19/16.18 et pro 16.20/16.18/16.17. Dernier relevé : **470 ms** au premier chargement, **60 ms** en cache, mesurés sur cet environnement. Le classement de la draft ne change pas après consultation. Comptes temporaires nettoyés.
- Nouveautés FR/EN ajoutées pour cette version. Les statistiques partagées et le schéma Supabase ne sont pas modifiés par cette correction.

Scripts : `scripts/pick-scroll-ui-test.mjs`, `scripts/pick-insight-cloud-test.mjs`, `scripts/release-notes-ui-test.mjs`. Les captures et résultats sont dans `artifacts/pick-*.png` et `artifacts/pick-*-report.json`.

Les changements restent locaux. Aucune publication GitHub, release ou nouvelle collecte de statistiques n’est autorisée ni effectuée pour ce correctif.

## Installeur vérifié

Les tests de défilement, survol, fiche épinglée, grande fenêtre, préparation directe et nouveautés ont également réussi dans `release/0.13.1/win-unpacked/Tchim Draft.exe`. Aucune exception du renderer. La vérification ASAR confirme les 173 icônes et l’absence des fichiers et clés privés. Supabase conserve la même révision et les treize migrations existantes ; aucun compte de test ne reste dans le projet.

Installeur : `release/0.13.1/Tchim-Draft-0.13.1-win-x64.exe` — 149 550 291 octets.

SHA256 : `ebf62d9512489b5aaf992531622201ce940be7d051b01d2d674351d5a30f0521`.

`Lancer Tchim Draft.cmd` cible cette version locale et conserve le dossier utilisateur `data/local`.
