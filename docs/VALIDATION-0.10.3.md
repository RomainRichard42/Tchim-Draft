# Validation locale — Tchim Draft 0.10.3

Date : 10 octobre 2026. Ce rapport décrit les vérifications locales réalisées avant la demande de publication. À cette étape, aucun commit, push, tag, workflow distant, publication de release ou de données n’avait été effectué pour cette livraison.

## Livraison

- Electron + React + TypeScript conservés, Motion 14.1.0 ajouté pour les transitions et les scores.
- Simulation guidée : illustration centrale, confirmation au centre, arrivée du champion dans son équipe, réponses adverses visibles, propositions qui se réorganisent, variations de score et de classement.
- Les variations comparent les dernières propositions du même côté et du même type de décision. Elles ne comparent pas deux joueurs adverses entre eux.
- Glisser-déposer : aperçu natif, destination surlignée, cases libres éclairées, nettoyage après dépôt ou annulation. L’atelier dispose aussi de l’aperçu natif.
- Draft manuelle et atelier : illustrations dans les emplacements de picks ; suggestions manuelles et jauges avec scores animés.
- Propositions désactivées pendant leur recalcul. Les choix manuels du coach restent possibles.
- Réduction des mouvements du système respectée ; popup des nouveautés FR/EN ajoutée pour cette version.

## Assets hors connexion

Les 173 champions du catalogue ont chacun une carte et une illustration large. Les 346 WebP représentent 13 262 852 octets. Les empreintes SHA256 et la mention Riot ont été vérifiées dans l’archive de l’application packagée.

Le script de préparation des assets est déclenché explicitement par le développeur. Il consulte SQLite en lecture seule et conserve les fichiers déjà présents. Il n’est appelé ni au lancement, ni lors du build, ni pendant les analyses. Le renderer utilise le protocole local existant ; aucune autorisation HTTP supplémentaire n’a été ajoutée.

Une illustration manquante retombe sur le portrait du champion. Un nouveau champion arrivé entre deux versions peut donc utiliser son portrait jusqu’à la prochaine préparation des illustrations.

## Vérifications

- Compilation TypeScript et build production réussis.
- 121 tests réussis dans 14 fichiers. La première exécution simultanée avec un test desktop a atteint le délai de cinq secondes du test Fearless ; la suite complète exécutée seule est passée.
- Simulation guidée, exécutable Windows packagé : copie de la base réelle gol.gg/Lolalytics et des icônes, avec deux équipes de test aux pools déclarés. Aucun nouveau scraping OP.GG n’est revendiqué.
- Ban manuel puis réponse adverse automatique ; import d’un choix Ahri hors pool par les vrais événements de glissement ; aperçu et surbrillance observés ; retour à une étape puis remplacement par Azir ; réponses et scores différents.
- Animation d’arrivée observée pour quatre choix avant le contrôle de pause. Illustration centrale chargée via le protocole local ; aucune requête d’image HTTP/HTTPS relevée.
- Petite fenêtre de 1104 × 721 : les dix emplacements de picks, les bans, la scène centrale, les propositions et les commandes tiennent dans la fenêtre. Aucun débordement horizontal.
- Sauvegarde/rechargement, pause, reprise et complétion des treize étapes restantes : 21 857 ms avec les statistiques réelles copiées, dix picks et vingt décisions. Le choix Azir imposé est conservé.
- Modification du réglage de réduction des mouvements pendant la session : le choix reste fonctionnel, sans animation de transfert.
- Nouveautés packagées : une présentation par version, confirmation conservée au redémarrage, historique de cinq versions, quatre nouveautés depuis 0.9.0, FR/EN, overlay sans popup, aucune erreur renderer.
- Test desktop général packagé : draft manuelle, annulation, duo, scénarios, sessions SQLite, pools, données de démonstration, FR/EN et synchronisation de l’overlay. Isolation et sandbox conservés. Une première lecture native de l’ordre des fenêtres a renvoyé un overlay non prioritaire ; le même test relancé est passé avec un overlay prioritaire. Aucun changement du main n’a été fait pour masquer ce résultat.
- Draft face à face packagée, base réelle copiée : 60 propositions, analyse initiale en 497 ms. Comparaison sans saisie prématurée, recherche, défilement, préparation/confirmation, raccourcis, annulation, FR/EN, côté rouge, overlay synchronisé et archivage Fearless vérifiés. Grande et petite fenêtres sans débordement, cinq rôles alignés dans chaque équipe et textes contrôlés à 14 px minimum ; aucune erreur renderer.
- Atelier packagé, données synthétiques : déplacement, verrous, comparaison, sauvegarde, duplication, rechargement et annulation fonctionnent ; 48 branches complètes et distinctes en 2 600 ms, deux réponses aux sollicitations de snapshot pendant la génération, aucune erreur renderer.

Les captures et rapports détaillés sont dans artifacts/. Les tests utilisent des dossiers isolés sous .test-data/. Le moteur de scoring et la collecte de statistiques n’ont pas été modifiés dans cette version visuelle.

## Fichiers prêts

- Installeur : release/0.10.3/Tchim-Draft-0.10.3-win-x64.exe — 140 834 893 octets.
- SHA256 : 65A49101C82645E93C2171D93BA9AA1958398D9783EF34E2F6AEA288A33B396B.
- Exécutable : release/0.10.3/win-unpacked/Tchim Draft.exe.
- Lancer Tchim Draft.cmd cible la version 0.10.3 et la base du projet, avec recherche des mises à jour d’application désactivée pour ce lancement local.

Le build émet un avertissement de taille du bundle renderer (~515 Ko avant compression, ~161 Ko gzip). La compilation reste réussie. Les scores restent des indices heuristiques. Aucun test macOS n’a été effectué.
