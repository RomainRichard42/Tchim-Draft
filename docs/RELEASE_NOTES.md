# Tchim Draft 0.10.0 — Atelier de simulations

- Créez une simulation depuis la draft en cours ou une draft libre. Glissez-déposez les champions sur les picks et bans, choisissez leurs rôles et verrouillez les étapes souhaitées.
- Explorez jusqu’à 12, 24 ou 48 continuations distinctes. Le moteur complète les deux équipes en respectant les champions disponibles, les rôles, les pools OP.GG et le Fearless. Les choix manuels du coach peuvent dépasser le pool connu.
- Orientez votre équipe vers l’équilibre, l’engage, le poke, le tempo ou le scaling. La préférence reste légère et les réponses adverses restent évaluées avec le moteur.
- Trois vues : face à face, chronologie des vingt étapes, comparaison de trois branches. Scores de draft, plans de jeu des deux équipes et raisons des choix accessibles sur chaque branche.
- Bibliothèque SQLite locale : sauvegardez, rouvrez, dupliquez et modifiez vos branches. Les simulations conservent leur point de départ ; elles ne modifient pas la draft en cours.
- Calcul dans un worker distinct, progression visible et arrêt possible. Les contraintes impossibles et pools insuffisants donnent une branche bloquée explicite.

Les scores sont des indices heuristiques, pas des probabilités de victoire. Les mises à jour statistiques restent manuelles ; aucun nouveau téléchargement des sources n’est nécessaire pour cette mise à jour de l’app.
