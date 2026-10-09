# Consignes du projet Tchim Draft

## Publication

L’utilisateur a demandé de garder les changements locaux jusqu’à sa demande explicite de publication.

- Ne pas pousser sur GitHub, pousser des tags, déclencher un workflow de release, publier une release ou des données sans demande explicite de l’utilisateur pour cette publication.
- Une demande de fonctionnalité, correction, test ou packaging ne constitue pas une autorisation de publication.
- Développer, tester et préparer les builds localement. Rapporter clairement ce qui est prêt et ce qui n’a pas été publié.
- Le workflow de release est manuel. Un push de code ou de tag ne doit pas publier une nouvelle version destinée aux utilisateurs.

## Nouveautés de l’application

- Chaque version doit avoir une entrée FR/EN dans `src/shared/release-notes.ts`, avec des phrases compréhensibles sans connaissances en programmation.
- Décrire l’action possible pour l’utilisateur, le bénéfice ou le problème corrigé. Éviter les détails de code et les promesses non vérifiées.
- La fenêtre des nouveautés s’affiche une fois par version dans la fenêtre principale ; elle reste consultable depuis les paramètres.
