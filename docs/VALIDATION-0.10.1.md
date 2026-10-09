# Validation 0.10.1 — 9 octobre 2026

La fenêtre des nouveautés présente les changements en français et en anglais, avec des explications destinées aux utilisateurs. Elle apparaît une fois par nouvelle version dans la fenêtre principale. La fermeture est mémorisée dans la base locale ; les paramètres permettent de rouvrir les notes et leur historique. Les versions intermédiaires sont regroupées lorsqu’elles ont été sautées. Les notes restent disponibles hors connexion.

## Vérifications locales

- 116 tests passent dans 13 fichiers. Les nouveaux contrôles couvrent les notes bilingues de la version courante, la comparaison des versions, les mises à jour successives, les versions sautées, la persistance de la fermeture et le refus d’acquitter une autre version. Les drafts, équipes, paramètres et données ne sont pas modifiés.
- TypeScript et Vite compilent. L’installeur Windows NSIS est construit : `release/0.10.1/Tchim-Draft-0.10.1-win-x64.exe`.
- `scripts/release-notes-ui-test.mjs` passe sur le build de développement puis sur le binaire empaqueté avec `--packaged`. Le contrôle couvre l’ouverture automatique, la fermeture, le redémarrage sans réapparition, l’accès depuis les paramètres, l’historique, FR/EN, les versions sautées, les raccourcis bloqués pendant la popup et l’absence de popup dans l’overlay. Aucun problème renderer signalé.
- La popup tient dans un renderer Windows de 1104 × 721 pixels ; le bouton de fermeture reste visible et le contenu défile à l’intérieur. Captures : `artifacts/release-notes-desktop.png`, `artifacts/release-notes-small.png`. Rapport : `artifacts/release-notes-ui-report.json`.
- `scripts/ui-test.mjs` passe sur le binaire 0.10.1 : draft manuelle, annulation, doubles picks, douze simulations, sessions SQLite, pool, démo, FR/EN et synchronisation de l’overlay. `contextIsolation` et `sandbox` sont actifs dans les deux fenêtres ; l’overlay natif reste au premier plan.
- Le contrôle du premier plan échouait lorsque l’overlay était créé masqué par le test. Une comparaison des binaires 0.10.0 et 0.10.1 avec des fenêtres visibles confirme le comportement normal dans les deux versions. Le test général crée désormais les fenêtres visibles pour vérifier leur ordre réel sous Windows ; le code produit de l’overlay reste identique.

Les tests Electron utilisent uniquement des profils isolés sous `.test-data`. L’installeur personnel n’a pas été remplacé et aucune collecte de statistiques n’a été déclenchée.

## Publication

Cette version reste locale. Aucun commit, push, tag distant, lancement de workflow, publication de release ou publication de données n’a été effectué pour ce changement.

`AGENTS.md` conserve la consigne de publier uniquement sur demande explicite. Le workflow de release préparé localement est déclenché manuellement et vérifie la version du tag. Ce changement de workflow atteindra GitHub au prochain push autorisé ; le dépôt distant n’a pas été modifié.
