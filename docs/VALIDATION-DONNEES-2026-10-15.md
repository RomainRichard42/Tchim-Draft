# Données pro préparées le 15 octobre 2026

**Jeu activé dans Supabase après confirmation explicite de l’utilisateur.** Aucune nouvelle version de l’application n’est publiée pour cette collecte.

## Périmètre

Ligues retenues : LFL, EMEA Masters, LCK, LCS/Amérique du Nord, LEC et Worlds. LCK Cup appartient à LCK ; l’ancien libellé LTA North est reconnu comme NA. LCK CL, NACL, LFL Division 2, LTA South et les autres compétitions restent exclus. La décision repose sur le nom complet du tournoi, sans confondre les préfixes.

La fenêtre reste celle des trois derniers patchs gol.gg disponibles : **16.20, 16.18, 16.17**. Une absence n’est pas complétée par un ancien patch. Le site ne fournit pas de matchs 16.19 dans son sélecteur actuel.

| Ligue | 16.20 | 16.18 | 16.17 | Total |
| --- | ---: | ---: | ---: | ---: |
| EMEA Masters | 21 | 214 | 0 | 235 |
| LCS | 0 | 0 | 57 | 57 |
| LEC | 0 | 0 | 48 | 48 |
| LFL | 0 | 0 | 0 | 0 |
| LCK | 0 | 0 | 0 | 0 |
| Worlds | 0 | 0 | 0 | 0 |
| **Total** | **21** | **214** | **105** | **340** |

Les quatre nouvelles parties sont `gol-83588` à `gol-83591`, Solary–Anubis Gaming, EMEA Masters Summer Main Event, jouées le 14 octobre en 16.20. La série est terminée sur le score 1–3 dans la liste gol.gg. Parmi les 953 anciens matchs, 617 sont hors périmètre ; 336 sont conservés et complétés par ces quatre matchs. Les données brutes exclues restent dans les archives locales.

Les zéros signifient qu’aucun match de cette ligue n’est disponible dans cette fenêtre au moment de la collecte. Ils ne signifient pas que ces ligues sont absentes de toute la saison. La restriction réduit la diversité de compétitions et le volume ; elle ne garantit pas une meilleure prédiction.

## Recalcul et vérification

Les winrates, pickrates, banrates, synergies et matchups pro sont reconstruits depuis les seuls matchs retenus. Les anciens agrégats toutes ligues sont écartés. Le dénominateur est le nombre de matchs réellement présents pour le patch et la ligue ; chaque rôle représente exactement deux picks par match. Une paire utilise la référence globale du même périmètre, sans la remplacer par une ligne de ligue particulière.

Le jeu contient 813 lignes de statistiques pro (agrégats globaux et par ligue) et 33 778 paires. Les 340 matchs ont une date et les identifiants des deux équipes ; 331 ont un ordre de draft vérifié. Les neuf autres conservent leurs compositions sans inventer une séquence.

Lolalytics reste sur Master+ et les patchs **16.20, 16.19, 16.18** : 2 558 lignes de statistiques et 1 008 382 paires. Les blocs Solo sont identiques, octet pour octet, au jeu Supabase précédent. Aucun scraping Lolalytics n’a été relancé.

La collecte utilise une base isolée `data/refresh-20261015`, et réutilise le cache précédent. Les listes découvrent les nouvelles séries ; une série dont les onglets couvrent déjà le score publié n’est pas redemandée. Une nouvelle partie valide est sauvegardée immédiatement. L’export refait indépendamment le filtrage et les agrégats avant toute publication. Les sources publiques sont consultées avec robots.txt, cache et limitation des requêtes ; les refus d’accès arrêtent la collecte.

**193 tests dans 23 fichiers réussis**, compilation TypeScript et build de production réussis. Les tests couvrent notamment les ligues au nom proche, le recalcul des bans, les doublons, les compositions incomplètes, les références des paires, les séries en cache, les patchs vides et la conservation des données Solo. Les fichiers privés et bruts ne sont pas exportés.

Le manifeste et ses blocs sont prêts dans `data/shared-scope-20261015`, ignoré par Git. Le rapport détaillé est `artifacts/pro-scope-review-20261015.json`. La version Windows publiée 0.13.1 sait lire ce schéma de données ; une publication de données ne nécessite pas de nouvel installeur.

## Publication vérifiée

Révision active : `f9056aa7da5f052a3cc019d6118a3bf5d057907ebb6b5ca23e62f416eda2bf03`. Révision précédente conservée : `f48f570ba3450cf1dbfcf487adbe963f0a65ca8d3c67a9650b7dc233fa529cb7`.

Le publieur a réutilisé les **69 blocs Solo existants** et ajouté seulement **quatre blocs pro**. Les 73 blocs représentent 15 622 675 octets compressés. Le changement du pointeur stable est vérifié après l’envoi et le contrôle de chaque bloc.

Une requête authentifiée `draft_context_slice` renvoie 340 matchs, les 21 games du patch 16.20, les quatre nouveaux identifiants, les seules ligues EMEA Masters/LCS/LEC effectivement présentes et les 3 371 lignes de statistiques Solo + pro. Les autres ligues autorisées restent à zéro.

Le test dans **l’application Windows 0.13.1 packagée** ouvre un compte temporaire, crée une préparation de match et prépare les données. L’application retrouve la révision publiée et les deux couvertures attendues, sans lancer de collecte de sites ni incident du renderer. Les comptes et préparations de test sont supprimés à la fin. Rapport : `artifacts/published-pro-scope-20261015-report.json`.

À l’issue de cette publication de données, le code du collecteur et cette documentation étaient encore locaux. Ils ont ensuite été publiés avec [l’application 0.14.0, après la demande explicite suivante](VALIDATION-PUBLICATION-0.14.0.md).
