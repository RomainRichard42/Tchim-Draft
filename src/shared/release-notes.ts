import type { ReleaseNote, ReleaseNotesStatus } from './types';

// User-facing copy shipped with the app: plain text, no remote HTML or network dependency.
export const RELEASE_NOTES:ReleaseNote[]=[
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
