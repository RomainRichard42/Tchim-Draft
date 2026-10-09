# Face-à-face — design validé le 9 octobre 2026

L’utilisateur a choisi [cette maquette](face-a-face.png) pour remplacer Focus. Les champions et chiffres de la maquette sont illustratifs. L’application affiche les données et scores calculés à partir de sa base, sans reprendre ces valeurs.

- Notre équipe à gauche, options au centre, équipe adverse à droite ; mêmes rôles sur les mêmes lignes.
- Liste complète défilable, avec recherche, filtre de rôle et option sélectionnée en menthe.
- Un bandeau pour toutes les explications de l’option : plan en vert, matchup / duo / ban en ambre, pool en violet.
- Jauge et tour visibles en haut, validation manuelle et actions de session en bas.
- Ordre complet, plans détaillés et historique Fearless dans des fenêtres dédiées.
- Textes essentiels d’au moins 14 px ; noms et scores agrandis. Adaptation à la fenêtre Windows minimale.

Les contrôles automatisés et captures réelles sont produits par `scripts/face-ui-test.mjs`. L’overlay conserve son fonctionnement. Aucun scraping ni changement du scoring n’est requis pour ce design.
