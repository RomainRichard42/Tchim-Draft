# Validation de Tchim Draft 0.11.0

Version Windows préparée localement le 14 octobre 2026. Aucun push GitHub, tag ou workflow de release n’a été déclenché pour cette version. Supabase est réellement configuré, avec le jeu initial et les règles d’accès demandées.

## Application et moteur

- Compilation TypeScript et bundle Electron réussis ; 145 tests passent dans 18 fichiers.
- Les tests du moteur couvrent les branches légales, les choix imposés, les rôles libres, les pools, la réserve Fearless, la séparation entre préférence adverse et qualité du choix, et la correction des petits échantillons.
- L’apprentissage utilise une séparation temporelle et ne lit ni gold, ni objectifs, ni durée pour prédire la draft. Le candidat distribué exclut les coefficients identifiant les équipes ; ses métriques portent sur ces coefficients effectivement utilisables.
- Le candidat initial reste inactif : 1 163 matchs d’entraînement, 341 de test ; log loss 0,7002 contre 0,6923 pour la meilleure référence simple. Les recommandations actuelles utilisent le moteur statistique et les caractéristiques qualitatives des compositions.

## Supabase réel

- Dix migrations installées ; fonction d’inscription par code déployée. Inscription publique standard désactivée ; connexion e-mail/mot de passe conservée.
- Tests réels des codes : adresse liée, usage unique, expiration, remplacement, réservation simultanée, refus d’un rôle choisi par le client, refus de génération par un coach et table des codes privée.
- Tests réels des données : refus des requêtes anonymes et des comptes non autorisés ; un coach ne peut pas lire, modifier ou supprimer les matchs d’un autre ; l’administrateur voit les deux. Usurpation d’auteur et scores invalides rejetés.
- Le parcours dans l’exécutable Windows vérifie inscription par code, données accessibles sans téléchargement manuel, arbre cliquable, glisser-déposer, application du premier choix, sauvegarde et modification des résultats, changement de compte et copie d’invitation.
- Affichage Coach vérifié à 1 104 × 721 : aucun débordement horizontal, textes visibles au moins à 14 px, aucune erreur JavaScript.
- La popup des nouveautés passe le test dans l’exécutable final : affichage une fois par version, confirmation persistante, historique des versions sautées, fenêtre adaptée au petit écran et absence de popup dans l’overlay.
- Les comptes temporaires sont supprimés après les essais. Le compte administrateur réel reste à créer par son propriétaire avec le code privé local et son propre mot de passe.

## Simulations

L’atelier a été vérifié dans l’exécutable avec les vraies statistiques locales : glisser-déposer, verrous futurs, comparaison, sauvegarde, duplication, reprise, annulation et indépendance de la draft en cours. Le lot de 48 a produit 48 branches complètes et distinctes en 10,2 secondes, avec huit réponses IPC pendant le calcul. Cette mesure concerne le scénario du test et ne garantit pas ce temps pour tous les pools et toutes les machines.

La simulation guidée a également passé le parcours complet avec données réelles : deux rosters, réponse adverse visible, propositions et indice recalculés après les décisions, glisser-déposer, pause, reprise et dix picks finaux. La fin du scénario testé s’est déroulée en 19,7 secondes. Les animations réduites, les illustrations embarquées, le FR/EN et l’absence de débordement à 1 104 × 721 sont vérifiés.

La draft constructiviste et l’overlay ont passé le test dans l’exécutable final : vraie liste de 38 suggestions dans le scénario testé, sélection, confirmation, annulation, frise, Fearless, plans et passage de côté. Trois tailles de texte sur la draft, au moins 14 px, contrôlées à 1 920 × 1 080 et 1 104 × 721. Les six pages et le changement de thème avaient aussi passé le contrôle Windows de cette version ; le nouvel espace Coach est couvert par le parcours connecté.

## Installeur

Fichier : `release/0.11.0/Tchim-Draft-0.11.0-win-x64.exe`.

SHA-256 : `5ae4a8e0ed3e741ee52f9053bcb00390cd28593cc461f9b821c1fae08fa8b1ea`.

Archive contrôlée : 173 icônes de champions, workers de simulation et d’entraînement présents, aucun fichier de clés privées ou d’autorisation, aucun jeton de gestion ou clé secrète Supabase dans les scripts embarqués. L’installeur n’a pas été installé sur le poste pour éviter de modifier ses raccourcis et son installation existante ; l’exécutable qu’il embarque a été testé directement.

Les rapports et captures sont dans `artifacts/` (hors Git). Les limites de données, les fenêtres de patch distinctes et le protocole d’apprentissage sont détaillés dans [SUPABASE.md](SUPABASE.md). L’avantage de draft reste un indice heuristique, sans probabilité de victoire calibrée ni garantie de gagner.
