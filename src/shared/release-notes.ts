import type { ReleaseNote, ReleaseNotesStatus } from './types';

// User-facing copy shipped with the app: plain text, no remote HTML or network dependency.
export const RELEASE_NOTES:ReleaseNote[]=[
  {
    version:'0.13.1',title:{fr:'Plus de choix, plus lisibles et expliqués',en:'More readable choices with draft explanations'},
    summary:{fr:'Parcours tous les picks, même quand une grande carte flex est affichée, et survole un champion pour lire ses atouts et ses risques.',en:'Browse every pick even when a large flex card is displayed, and hover a champion to read its strengths and risks.'},
    sections:[{kind:'fixed',items:[
      {fr:'La colonne des choix défile entièrement : une carte flex ne cache plus les autres picks sous la zone visible, côté bleu comme côté rouge.',en:'The entire choice column scrolls: a flex card no longer hides other picks below the visible area, on either side.'}
    ]},{kind:'improved',items:[
      {fr:'Les portraits et lignes de champions sont agrandis. Ouvre Tous les picks ou agrandis les choix pour voir la liste dans une grande fenêtre. Tu peux préparer un pick directement depuis sa ligne ou comparer sa grande carte.',en:'Champion portraits and rows are larger. Open All picks or expand choices to browse the list in a large window. Prepare a pick directly from its row or compare its large card.'}
    ]},{kind:'new',items:[
      {fr:'Au survol, consulte les menaces, les matchups favorables, les synergies et les raisons de jouer ce champion dans la draft actuelle. Le bouton Infos garde la fiche ouverte.',en:'Hover to review threats, favourable matchups, synergies and reasons to play the champion in the current draft. The Info button keeps the card open.'},
      {fr:'Les interactions affichées utilisent les statistiques corrigées et lissées. Les petits échantillons restent limités ; les interactions de sorts indiquent leurs conditions.',en:'Displayed interactions use corrected, shrunk statistics. Small samples remain constrained; spell interactions show their conditions.'}
    ]}]
  },
  {
    version:'0.13.0',title:{fr:'Tous les choix au même endroit : ton match',en:'One workspace for each match'},
    summary:{fr:'Crée un match avec les deux équipes, prépare leurs joueurs, puis passe de la draft au résultat sans chercher dans les onglets.',en:'Create a match with both teams, prepare their players, then move from draft to result without hunting through tabs.'},
    sections:[{kind:'new',items:[
      {fr:'Retrouve tes préparations dans Matchs, avec leurs équipes, pools OP.GG, BO et progression. Chaque match se sauvegarde séparément dans ton compte.',en:'Find preparations in Matches, with team names, OP.GG pools, series and progress. Each match saves separately in your account.'},
      {fr:'Choisis un BO1, ou un BO3/BO5 classique ou Fearless. Le format classique autorise à rejouer les champions aux manches suivantes.',en:'Choose a BO1, or a standard or Fearless BO3/BO5. Standard series let you play champions again in later games.'},
      {fr:'Après la draft, renseigne le vainqueur, les kills et ta note sur 5. En BO, enregistre le résultat avant de passer à la manche suivante.',en:'After drafting, record the winner, kills and your rating out of 5. In a series, save the result before moving to the next game.'}
    ]},{kind:'improved',items:[
      {fr:'La navigation principale se limite à Matchs et Simulations. Les statistiques, fiches de champions et réglages avancés restent accessibles dans Réglages.',en:'Main navigation now contains Matches and Simulations. Statistics, champion profiles and advanced options remain available in Settings.'},
      {fr:'Ouvre l’analyse 5v5, les réponses adverses et la fiche d’un champion directement depuis la draft. Les simulations affichent le match et les deux équipes utilisés.',en:'Open 5v5 analysis, enemy replies and champion profiles directly from the draft. Simulations show the match and both teams being used.'}
    ]}]
  },
  {
    version:'0.12.1',
    title:{fr:'Mieux choisir les blinds et les flexs',en:'Better blind and flex choices'},
    summary:{fr:'Compare les placements d’un flex et garde la méta, les pools et le risque de blind visibles dans les recommandations.',en:'Compare flex placements and keep meta priority, pools and blind risk visible in recommendations.'},
    sections:[{kind:'improved',items:[
      {fr:'Au début de la draft, les réponses explorées ajustent le classement sans effacer les critères de méta, de blind et de confort.',en:'Early in the draft, explored replies adjust the ranking without removing meta, blind and comfort criteria.'},
      {fr:'Un flex doit avoir des rôles réellement observés, encore disponibles et compatibles avec les pools renseignés. Compare leurs scores puis prépare le rôle voulu.',en:'A flex needs observed roles that remain available and match known player pools. Compare their scores and prepare your preferred role.'},
      {fr:'La priorité de méta réunit les picks d’un champion dans ses différents rôles et compte ses bans une fois. Les petits échantillons restent limités.',en:'Meta priority combines champion picks across roles and counts bans once. Small samples remain constrained.'},
      {fr:'Les côtés et l’ordre des matchs pro sont relus depuis l’indicateur de premier pick de gol.gg. Les recommandations utilisent ces choix observés quand l’échantillon est suffisant.',en:'Pro match sides and order are read from gol.gg’s first-pick marker. Recommendations use those observed choices when the sample is sufficient.'},
      {fr:'Les statistiques partagées couvrent davantage d’options de méta et de flex pour documenter leurs matchups. Le scraping reste réservé à une actualisation demandée.',en:'Shared statistics cover more meta and flex options to document their matchups. Scraping still requires a requested refresh.'},
      {fr:'Clique sur Préparer la draft avant de commencer pour préparer les matchups depuis la base partagée et limiter l’attente pendant tes choix.',en:'Click Prepare draft before starting to prepare matchups from the shared database and reduce waiting during your choices.'}
    ]}]
  },
  {
    version:'0.12.0',title:{fr:'Comprendre les champions et les patchs',en:'Understand champions and patches'},
    summary:{fr:'Explore les compétences, lis les changements Riot et examine leurs conséquences possibles avant de drafter.',en:'Explore spells, read Riot changes and examine their possible consequences before drafting.'},
    sections:[{kind:'new',items:[
      {fr:'La page Patch & champions réunit les fiches des 173 champions sur trois patchs, avec descriptions FR/EN, stats de base, coûts, portées et délais des sorts.',en:'Patch & champions brings together 173 champion profiles across three patches, with FR/EN descriptions, base stats, spell costs, ranges and cooldowns.'},
      {fr:'Compare deux champions et leurs rôles : les résultats observés restent séparés des interactions de sorts, avec leurs conditions de placement et de disponibilité.',en:'Compare two champions and their roles: observed results stay separate from spell interactions, with their positioning and availability conditions.'},
      {fr:'Retrouve les changements chiffrés Riot et les pistes à tester dans chaque matchup. Les changements ambigus sont signalés et les autres modes de jeu sont écartés.',en:'Read numeric Riot changes and hypotheses to test in each matchup. Ambiguous changes are flagged and other game modes are excluded.'},
      {fr:'L’administrateur peut préparer une nouvelle lecture, l’examiner, l’utiliser sur son ordinateur puis choisir de la partager aux coachs. Rien n’est collecté automatiquement au lancement.',en:'The administrator can prepare a new collection, review it, use it on their computer and choose to share it with coaches. Nothing is automatically collected at startup.'}
    ]},{kind:'improved',items:[
      {fr:'Les recommandations, bans et simulations tiennent compte des interactions de compétences reconnues et d’un effet de patch limité lorsque les statistiques ne couvrent pas encore les changements.',en:'Recommendations, bans and simulations include recognized spell interactions and a limited patch effect when statistics do not yet cover the changes.'},
      {fr:'Les valeurs dynamiques incomplètes sont indiquées. Un changement de compétence reste une hypothèse de méta, sans promesse de victoire ni calcul de dégâts inventé.',en:'Incomplete dynamic values are identified. A spell change remains a meta hypothesis, with no promise of victory or invented damage calculation.'}
    ]}]
  },
  {
    version:'0.11.0',
    title:{fr:'Ton coach et tes drafts connectés',en:'Your coach and drafts, connected'},
    summary:{fr:'Connecte-toi à ton espace, explore les réponses adverses et garde une trace de tes drafts et résultats.',en:'Sign in to your workspace, explore enemy replies and keep your drafts and results together.'},
    sections:[{kind:'new',items:[
      {fr:'Crée ton compte avec un code d’invitation, ton e-mail et un mot de passe. Les statistiques centrales deviennent disponibles automatiquement. Chaque coach voit ses drafts ; l’administrateur peut consulter l’ensemble.',en:'Create your account using an invitation code, email and password. Central statistics become available automatically. Each coach sees their own drafts; the administrator can review all of them.'},
      {fr:'Dans Coach, compare les deux compositions par leur pression, leur duo bot, leurs objectifs et leurs possibilités de combat. L’avantage reste un indice, pas une chance de victoire.',en:'In Coach, compare both compositions by pressure, bot duo, objectives and fighting options. The edge remains an index, not a win probability.'},
      {fr:'Explore deux à quatre actions, clique sur les branches et glisse tes idées sur un choix futur. Compare les réponses probables, les contres dangereux et la réserve Fearless avant de choisir.',en:'Explore two to four actions, click branches and drag ideas onto future choices. Compare likely replies, dangerous counters and Fearless reserves before choosing.'},
      {fr:'Nomme les équipes et le BO. Enregistre la draft avec ses joueurs, puis saisis ou modifie le résultat, les kills et ta note de draft sur cinq.',en:'Name the teams and series. Save the draft with its players, then enter or edit the result, kills and your draft rating out of five.'},
      {fr:'L’administrateur peut entraîner un modèle commun à partir des matchs pro et des résultats renseignés. Son activation exige une vérification sur des matchs réservés au test ; les ajustements d’équipe limitent l’effet des petits échantillons.',en:'The administrator can train a shared model using pro games and recorded results. Activation requires validation on held-out games; team adjustments limit the influence of small samples.'}
    ]},{kind:'improved',items:[
      {fr:'Les picks tiennent compte des échanges explorés entre les équipes. Les réponses adverses utilisent les habitudes des joueurs séparément de la qualité théorique du champion.',en:'Picks account for explored trades between teams. Enemy replies use player habits separately from a champion’s theoretical quality.'},
      {fr:'Précise le confort de chaque joueur sur ses champions. Les simulations et l’analyse des bans utilisent les pools, les compositions et les alternatives encore disponibles.',en:'Set each player’s comfort on their champions. Simulations and ban analysis use pools, compositions and remaining alternatives.'}
    ]}]
  },
  {
    version:'0.10.5',
    title:{fr:'Toute la draft passe au sombre',en:'A dark look for the whole draft assistant'},
    summary:{fr:'Les six pages partagent la même présentation sombre, avec le retour des vrais portraits des champions.',en:'All six pages share the same dark design, with real champion portraits back in the draft.'},
    sections:[
      {kind:'improved',items:[
        {fr:'Retrouve les icônes des champions dans les équipes, les bans et les propositions. Elles sont incluses dans l’application et restent disponibles hors connexion.',en:'Champion icons return to teams, bans and suggestions. They are bundled with the app and remain available offline.'},
        {fr:'Choisis Sombre ou Clair dans Paramètres. Ton choix est mémorisé et s’applique aussi aux détails, aux nouveautés et à l’overlay.',en:'Choose Dark or Light in Settings. Your choice is saved and also applies to details, release notes and the overlay.'},
        {fr:'Dans Équipes, les cinq joueurs de chaque camp sont regroupés. Développe un joueur pour consulter et modifier tout son pool.',en:'In Teams, each side’s five players are grouped together. Expand a player to view and edit their full pool.'},
        {fr:'Mon pool présente les champions maîtrisés et un récapitulatif calculé depuis tes choix. Données regroupe les trois patchs disponibles, les packs et le journal d’actualisation.',en:'My pool shows your playable champions and an overview calculated from your choices. Data groups the available three-patch coverage, packs and update log.'},
        {fr:'La simulation et les paramètres reprennent les mêmes couleurs et cadres. Les statistiques continuent de s’actualiser uniquement sur clic.',en:'Simulations and settings use the same colors and frames. Statistics still refresh only when you click.'}
      ]}
    ]
  },
  {
    version:'0.10.4',
    title:{fr:'Le bon choix au premier regard',en:'Your next choice at a glance'},
    summary:{fr:'La draft adopte une présentation crème, bleu et rouge : les équipes en haut, le choix principal au centre et les plans de jeu à côté.',en:'The draft adopts a cream, blue and red layout: teams at the top, the main choice in the center and game plans alongside it.'},
    sections:[
      {kind:'improved',items:[
        {fr:'Une grande carte met en avant le champion affiché, son score et trois critères. Compare les autres choix dans la liste, puis clique sur Préparer pour confirmer.',en:'A large card highlights the previewed champion, its score and three criteria. Compare other choices in the list, then click Prepare to confirm.'},
        {fr:'Retrouve l’ordre des bans et des picks en deux lignes. L’étape en cours et le nombre de picks révélés restent visibles.',en:'Follow bans and picks on two rows. The current step and number of revealed picks remain visible.'},
        {fr:'Consulte le plan de ta composition et les réponses adverses à côté des recommandations. Les échantillons insuffisants et les risques de blind restent signalés.',en:'Review your composition plan and enemy responses alongside recommendations. Insufficient samples and blind-pick risks remain highlighted.'},
        {fr:'Des silhouettes remplacent les illustrations sur l’écran de draft. Les bans sont grisés et barrés ; les rôles fixes ont un badge dédié.',en:'Silhouettes replace illustrations on the draft screen. Bans are gray and crossed out; fixed roles have a dedicated badge.'}
      ]}
    ]
  },
  {
    version:'0.10.3',
    title:{fr:'Ta draft prend vie',en:'Your draft comes to life'},
    summary:{fr:'Le choix en cours prend place au centre, entre les deux équipes, avec de grandes illustrations et des transitions plus claires.',en:'The current choice takes center stage between both teams, with large illustrations and clearer transitions.'},
    sections:[
      {kind:'new',items:[
        {fr:'Dans la simulation guidée, examine ton champion en grand au centre puis valide ton choix. La réponse adverse apparaît au même endroit.',en:'In guided simulation, examine your champion in the center, then confirm your choice. Enemy responses appear in the same place.'},
        {fr:'Glisse un champion avec son aperçu : les emplacements disponibles s’éclairent. Quand le choix est validé, le champion rejoint son équipe.',en:'Drag a champion with its preview: available slots light up. When confirmed, the champion joins its team.'},
        {fr:'Les propositions se réorganisent avec leurs nouveaux scores. Les flèches montrent les changements de score et de classement depuis les précédentes propositions de cette équipe.',en:'Suggestions reorder with their new scores. Arrows show changes in score and rank since this team’s previous suggestions.'}
      ]},
      {kind:'improved',items:[
        {fr:'Les illustrations sont incluses dans l’application et restent disponibles hors connexion, sans téléchargement au lancement.',en:'Illustrations are included in the app and remain available offline, with no startup download.'},
        {fr:'Les deux équipes et l’action centrale restent visibles dans une petite fenêtre. Les plans de jeu s’ouvrent à la demande.',en:'Both teams and the central action remain visible in a small window. Open game plans when you need them.'},
        {fr:'Pendant un recalcul, les anciennes propositions restent visibles mais ne peuvent pas être validées. Les animations respectent le réglage de réduction des mouvements de ton système.',en:'During recalculation, previous suggestions remain visible but cannot be confirmed. Animations respect your system’s reduced motion setting.'}
      ]}
    ]
  },
  {
    version:'0.10.2',
    title:{fr:'La simulation se joue devant toi',en:'Watch your simulation unfold'},
    summary:{fr:'Prépare les deux équipes OP.GG, choisis tes champions et regarde les réponses adverses, tour après tour.',en:'Prepare both OP.GG teams, choose your champions and watch enemy responses, turn by turn.'},
    sections:[
      {kind:'new',items:[
        {fr:'La draft guidée part des deux équipes OP.GG. Confirme les cinq rôles et les pools de chaque équipe avant de lancer ; les informations manquantes sont signalées.',en:'Guided draft starts with both OP.GG teams. Confirm each team’s five roles and pools before starting; missing information is highlighted.'},
        {fr:'À chaque tour, choisis une proposition ou glisse un champion sur le pick ou le ban. Les propositions suivantes sont recalculées selon tes choix.',en:'On each turn, choose a suggestion or drag a champion onto a pick or ban. The next suggestions are recalculated from your choices.'},
        {fr:'Les réponses adverses apparaissent une par une. Mets en pause pour imposer ton idée, ou déroule toute la suite et reprends la main quand tu veux.',en:'Enemy responses appear one at a time. Pause to force your idea, or play out the rest and take control whenever you want.'},
        {fr:'Reviens sur une étape pour essayer une autre décision. Sauvegarde ta simulation pour la reprendre plus tard.',en:'Return to a step to try another decision. Save your simulation to resume it later.'}
      ]},
      {kind:'improved',items:[
        {fr:'Les deux équipes se font face avec leurs joueurs, picks et bans. La jauge et les plans de jeu suivent les choix déjà révélés.',en:'Both teams face each other with their players, picks and bans. The gauge and game plans follow the choices already revealed.'},
        {fr:'Les propositions restent dans les pools connus et respectent le Fearless. Tu peux imposer une exception au pool ; elle est clairement signalée.',en:'Suggestions stay within known pools and respect Fearless. You can force a pool exception; it is clearly highlighted.'},
        {fr:'L’atelier de variantes reste accessible pour explorer et comparer 12, 24 ou 48 drafts complètes.',en:'The variations workshop remains available to explore and compare 12, 24 or 48 complete drafts.'}
      ]}
    ]
  },
  {
    version:'0.10.1',
    title:{fr:'Les nouveautés expliquées simplement',en:'Clear explanations of what is new'},
    summary:{fr:'Après une mise à jour, découvre ce qui change et comment en profiter.',en:'After an update, see what has changed and how to use it.'},
    sections:[
      {kind:'new',items:[
        {fr:'Une fenêtre présente les nouveautés à la première ouverture d’une nouvelle version. Une fois fermée, elle ne revient plus à chaque lancement.',en:'A window introduces new features when you first open a new version. Once closed, it will not appear on every launch.'},
        {fr:'Tu peux relire les nouveautés et retrouver les versions précédentes dans Paramètres → Nouveautés et historique.',en:'You can revisit the changes and previous versions in Settings → What is new and history.'}
      ]},
      {kind:'improved',items:[
        {fr:'Les changements sont regroupés et expliqués avec des mots simples : ce que tu peux faire, ce qui devient plus pratique et ce qui a été corrigé.',en:'Changes are grouped and explained in plain language: what you can do, what is easier and what has been fixed.'}
      ]}
    ]
  },
  {
    version:'0.10.0',
    title:{fr:'Un atelier pour préparer tes drafts',en:'A workshop to prepare your drafts'},
    summary:{fr:'Essaie plusieurs suites possibles avant de choisir tes picks et tes bans.',en:'Try different continuations before choosing your picks and bans.'},
    sections:[
      {kind:'new',items:[
        {fr:'Crée une simulation depuis ta draft en cours ou pars d’une draft vide. Glisse les champions sur les picks et les bans, puis verrouille les choix que tu veux garder.',en:'Create a simulation from your current draft or start with an empty draft. Drag champions onto picks and bans, then lock the choices you want to keep.'},
        {fr:'« Compléter ma branche » termine les deux équipes pour toi. « Explorer les suites » propose jusqu’à 12, 24 ou 48 drafts différentes.',en:'“Complete my branch” fills both teams for you. “Explore continuations” suggests up to 12, 24 or 48 different drafts.'},
        {fr:'Compare jusqu’à trois drafts, leurs forces et leurs plans de jeu. Tu peux viser l’engage, le poke, le début de partie ou la fin de partie.',en:'Compare up to three drafts, their strengths and game plans. You can focus on engage, poke, early game or late game.'},
        {fr:'Sauvegarde tes simulations, retrouve-les plus tard et duplique-les pour tester une autre idée.',en:'Save your simulations, reopen them later and duplicate them to test another idea.'}
      ]},
      {kind:'improved',items:[
        {fr:'Choisis la vue face à face, les vingt étapes de draft ou la comparaison. Les commandes restent visibles pendant que tu fais défiler les champions.',en:'Choose head-to-head, the twenty draft steps or comparison. Controls stay visible while you scroll through champions.'},
        {fr:'Les simulations respectent les rôles, les pools connus des joueurs et le Fearless. Si un choix bloque la suite, l’application te l’indique.',en:'Simulations respect roles, known player pools and Fearless. If a choice blocks the continuation, the app tells you.'}
      ]}
    ]
  },
  {
    version:'0.9.0',
    title:{fr:'Une draft plus facile à lire',en:'A draft that is easier to read'},
    summary:{fr:'Les informations utiles sont regroupées pour décider plus vite.',en:'Useful information is grouped so you can decide faster.'},
    sections:[
      {kind:'improved',items:[
        {fr:'Notre équipe et l’équipe adverse se font face, avec les mêmes rôles sur les mêmes lignes. Les propositions se trouvent au centre.',en:'Our team and the enemy team face each other, with matching roles on the same rows. Suggestions sit in the middle.'},
        {fr:'La jauge d’avantage reste visible. Les explications utilisent trois couleurs : plan de jeu en vert, opposition en orange et pool du joueur en violet.',en:'The advantage gauge stays visible. Explanations use three colors: game plan in green, opposition in orange and player pool in purple.'},
        {fr:'Clique sur un champion pour le comparer, puis sur « Préparer » pour confirmer ton choix. Tu peux rechercher un champion et faire défiler toutes les propositions.',en:'Click a champion to compare, then “Prepare” to confirm your choice. You can search for a champion and scroll through all suggestions.'}
      ]}
    ]
  }
];

export function compareVersions(a:string,b:string):number {
  const first=a.split('.').map(Number),second=b.split('.').map(Number);
  for(let i=0;i<3;i++){const difference=first[i]-second[i];if(difference)return difference;}
  return 0;
}
export function releaseNotesStatus(currentVersion:string,lastSeen?:unknown):ReleaseNotesStatus {
  const lastSeenVersion=typeof lastSeen==='string'&&/^\d+\.\d+\.\d+$/.test(lastSeen)?lastSeen:null;
  const history=RELEASE_NOTES.filter(note=>compareVersions(note.version,currentVersion)<=0).sort((a,b)=>compareVersions(b.version,a.version));
  const pending=!lastSeenVersion||compareVersions(currentVersion,lastSeenVersion)>0;
  const entries=pending&&lastSeenVersion?history.filter(note=>compareVersions(note.version,lastSeenVersion)>0):history.filter(note=>note.version===currentVersion);
  return {currentVersion,lastSeenVersion,pending,entries,history};
}
