import type { Lang } from '../shared/types';

export function UpdateStatus({status,language,compact=false,onCheck,onInstall}:{status:string;language:Lang;compact?:boolean;onCheck:()=>void;onInstall:()=>void}) {
  const fr=language==='fr',ready=status==='downloaded',downloading=status.startsWith('downloading:');
  if(compact) return ready?<button className="update-ready" onClick={onInstall}>{fr?'Mise à jour prête':'Update ready'}</button>:downloading?<span className="update-progress">{fr?'Mise à jour':'Updating'} {status.split(':')[1]}%</span>:null;
  const label=ready?(fr?'Version téléchargée : installation automatique à la fermeture.':'Update downloaded: installs automatically when you close the app.'):
    downloading?(fr?`Téléchargement de l’application : ${status.split(':')[1]}%`:`Downloading app update: ${status.split(':')[1]}%`):
    status==='checking'?(fr?'Vérification…':'Checking…'):status==='current'?(fr?'Application à jour':'App is up to date'):
    status==='development'?(fr?'Version de développement':'Development build'):status==='disabled'?(fr?'Mises à jour désactivées pour ce lancement.':'Updates disabled for this launch.'):
    fr?'Vérification indisponible. Vous pouvez réessayer ; la draft reste utilisable.':'Update check unavailable. You can retry; drafting remains available.';
  return <><p className="muted">{label}</p><p className="muted small-text">{fr?'Vérification au lancement et toutes les 4 h, téléchargement automatique. Les statistiques restent actualisées sur clic.':'Checks at startup and every 4 hours; downloads automatically. Statistics refresh only when you click.'}</p><button disabled={downloading||status==='checking'} onClick={ready?onInstall:onCheck}>{ready?(fr?'Installer et redémarrer':'Install and restart'):(fr?'Vérifier':'Check')}</button></>;
}
