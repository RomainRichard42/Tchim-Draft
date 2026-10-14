# Validation Windows — 0.12.0

Installeur préparé localement le 14 octobre 2026 : `release/0.12.0/Tchim-Draft-0.12.0-win-x64.exe`.

SHA-256 : `f8081cb78de6c687bb7b8f0f9f145577ef007efa373a6e7d2b56bc3cfc1bac80`.

- Compilation TypeScript/Electron réussie ; **159 tests dans 19 fichiers** passent.
- Collecte réelle : 173 champions × trois patchs, 98 changements de la Faille, paramètres complémentaires pour les 173 champions actuels. Les sources et versions sont conservées. Une deuxième préparation réutilise le cache brut.
- Parcours dans l’exécutable final : actualisation explicite, préparation sans changement des fiches actives, utilisation locale, recherche, passif/Q/W/E/R, paramètres réels, choix des rôles, comparaison Poppy/Camille et explication Swain/Ahri.
- Clair/sombre et FR/EN vérifiés ; à 1 104 × 721, pas de débordement horizontal, textes visibles au moins à 14 px, aucune ombre/flou dans cette page. Contraste de l’onglet actif : 14,6:1.
- Popup des nouveautés : une fois par version, confirmation persistante, versions sautées dans l’historique, petit écran et exclusion de l’overlay vérifiés.
- Atelier de simulations avec vraies données dans l’exécutable : 48 branches complètes et différentes en 10,7 secondes, interface réactive pendant le calcul ; glisser-déposer, comparaison, sauvegarde, reprise et annulation passent. Mesure sur le scénario testé, pas une garantie pour tous les pools ou ordinateurs.
- Supabase : lecture réservée aux comptes autorisés ; refus de publication par un coach et des écritures directes. La transaction de publication a été exécutée puis annulée pour le test : **aucun jeu de fiches n’a été publié**. Comptes temporaires supprimés.
- Archive de l’installeur : 173 icônes, données versionnées et calcul dans un processus séparé présents ; aucun fichier d’autorisation, clé secrète ou jeton de gestion Supabase dans les scripts de l’application.

Les captures et rapports sont dans `artifacts/`, hors Git. Le fichier d’installation est construit mais n’a pas été installé sur ce poste ; son exécutable embarqué a été testé directement. Aucune publication GitHub, aucun tag ni workflow de release n’ont été déclenchés pour cette version. Les limites et règles d’interprétation sont décrites dans [CHAMPIONS-ET-PATCHS.md](CHAMPIONS-ET-PATCHS.md).
