# Validation 0.4.0 — 8 octobre 2026

Les picks ne sont plus limités aux cinq premiers : tous les champions éligibles sont classés par score, avec recherche et défilement. Le meilleur rôle libre représente chaque champion. Les filtres, pools des équipes et exclusions des champions déjà utilisés restent appliqués. Les bans conservent leurs cinq options et le poids dédié OP.GG livré en 0.3.1.

La jauge compare les picks révélés des deux équipes : résultats lissés, matchups, synergies et composition. Chaque équipe reçoit une moyenne sur 100 ; l’écart est leur différence signée. La moyenne évite un bonus lié au nombre de picks déjà saisis. La jauge se recalcule après les choix et annulations, se retourne avec le côté sélectionné et se synchronise dans l’overlay. Elle reste visible quand on fait défiler la page. Ce calcul est heuristique ; ce n’est pas une probabilité de victoire.

L’en-tête est plus compact. Le tour courant indique s’il faut choisir pour notre équipe ou renseigner l’adversaire. Les cartes affichent une raison courte, les boutons Pick/Ban et le détail complet à la demande. Le filtre par défaut propose tous les rôles libres. Une draft terminée affiche un message adapté. Textes FR/EN et navigation au clavier conservés.

- **50 tests unitaires dans sept fichiers réussis**. Six nouvelles régressions couvrent la neutralité avant les picks, les nombres de picks différents, la protection contre le dive et l’annulation, l’inversion des équipes, l’évaluation d’un pick manuel hors pool/rôle conseillé, le classement étendu et ses contraintes.
- **TypeScript et build Electron/React réussis**, puis installeur NSIS Windows x64 construit. Les quatre suites Electron ont été exécutées sur l’exécutable final `release/0.4.0/win-unpacked/Tchim Draft.exe`.
- **Nouvelle suite d’interface réussie** : 173 picks proposés avant toute sélection, défilement réel, recherche sans résultat et effacement, recherche et validation du pick classé 13e, rôle conservé, recherche remise à zéro après sélection, jauge actualisée, annulation, deux côtés, synchronisation overlay, draft complète et message de fin. La jauge reste intégralement visible après un défilement de la page. Aucun défaut JavaScript renderer détecté.
- **Suite des données réelles réussie** : SQLite et worker, recommandations issues des statistiques, scénarios complets, trois patchs par source, gestion des packs et renderer isolé. Première analyse mesurée à 4 467 ms pendant l’exécution parallèle des suites ; ce n’est pas un benchmark de performance.
- **Suite OP.GG réussie** : cinq profils publics dans les deux équipes, édition des pools, bans ciblés, facteur « Menace OP.GG », slider 35 → 0, changement effectif des scores, restauration et picks conformes aux pools.
- **Suite générale réussie** : saisie, annulation, double pick, scénarios, sessions SQLite, pool personnel, démo, FR/EN, overlay synchronisé, `contextIsolation` et sandbox dans les deux fenêtres.

Avec Jinx côté bleu contre Vi/Akali, l’écart mesuré est **Rouge +3,4**. Ajouter Lulu côté bleu donne **Bleu +6,6**, avec des notes **55,4 contre 48,8**. Annuler ce pick restaure l’écart précédent dans la fenêtre principale et l’overlay. Cet exemple prouve que l’indice réagit au contexte ; il ne valide pas un taux de victoire. Rapport complet : `artifacts/draft-ux-report.json`.

Captures : `artifacts/draft-ux-viewport.png`, `artifacts/draft-ux-blue.png`, `artifacts/draft-ux-scrolled.png`, `artifacts/draft-ux-overlay.png`, `artifacts/draft-ux-complete.png`. Les suites utilisent chacune une base isolée ; aucun test ne réécrit la draft utilisateur.

Données existantes conservées : Lolalytics Master+ 16.20 / 16.19 / 16.18 et gol.gg 16.18 / 16.17 / 16.16. Leurs décomptes et limites sont documentés dans `VALIDATION-0.3.md` et `DATA.md`. La jauge exploite les mêmes fenêtres que les recommandations et ne compte pas les bans comme de la force révélée.

Installeur : `release/0.4.0/Tchim-Draft-0.4.0-win-x64.exe`, **125 930 867 octets**. SHA-256 : `4A001FB46F1DEA2AFD15B58D91AEA856D0EF0712C68A7A0B119FBAA29D3C157A`.

`Lancer Tchim Draft.cmd` pointe sur la 0.4.0 et la même base du projet. Fermer puis relancer l’application charge cette version. L’ancienne instance utilisateur n’a pas été arrêtée par les tests. Le binaire packagé a été testé directement ; l’installeur n’a pas été exécuté dans le profil utilisateur. Build locale non signée, sans publication distante.
