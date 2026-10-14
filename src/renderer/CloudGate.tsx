import { useState } from 'react';
import { ArrowRight, Copy, LogOut, Shield, UserPlus } from 'lucide-react';
import type { Snapshot } from '../shared/types';
const api=window.draftApi;
export function CloudGate({snapshot}:{snapshot:Snapshot}){
 const fr=snapshot.settings.language==='fr';
 const [signup,setSignup]=useState(false),[email,setEmail]=useState(snapshot.cloud?.email??''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function submit(){
  setPending(true);setMessage('');
  try{
   if(signup){const result=await api.cloudSignup(email.trim(),password,code.trim());setMessage(result.message);setSignup(false);setCode('');}
   else await api.cloudLogin(email.trim(),password);
   setPassword('');
  }catch{setMessage(signup?(fr?'Création impossible. Vérifie l’adresse liée au code, sa validité et ta connexion. Si ton compte a été créé, essaie de te connecter.':'Could not create your account. Check the email linked to the code, its validity and your connection. If the account was created, try signing in.'):(fr?'Connexion impossible. Vérifie ton e-mail, ton mot de passe et ta connexion.':'Could not sign in. Check your email, password and connection.'));}
  finally{setPending(false);}
 }
 return <div className="desktop-app constructivist-app cloud-login" data-theme={snapshot.settings.theme??'dark'} data-testid="cloud-login">
  <div className="cloud-login-poster"><span>TCHIM / DRAFT</span><h1>{fr?'La draft commence ici.':'The draft starts here.'}</h1><p>{fr?'Les statistiques pro et Master+ sont centralisées. Tes drafts restent privées ; ton administrateur peut les consulter pour améliorer le modèle commun.':'Pro and Master+ statistics are centralized. Your drafts stay private; your administrator can review them to improve the shared model.'}</p><div className="cloud-login-mark">5<br/>V5</div><span><Shield size={19}/>{fr?'Accès sur invitation':'Invitation access'}</span></div>
  <section className="cloud-login-form"><h2>{signup?(fr?'Créer mon compte':'Create my account'):(fr?'Retrouver mon espace':'Sign in')}</h2><p>{signup?(fr?'Colle le code reçu de ton administrateur, puis choisis ton mot de passe. Aucun e-mail de confirmation nécessaire.':'Paste the code from your administrator, then choose your password. No confirmation email required.'):(fr?'E-mail et mot de passe. Aucun compte Riot nécessaire.':'Email and password. No Riot account required.')}</p>
   <form onSubmit={e=>{e.preventDefault();void submit();}}>
    {signup&&<label>{fr?'Code d’invitation':'Invitation code'}<input aria-label="Invitation code" required pattern="[Tt][Dd]-[a-fA-F0-9]{32}" maxLength={35} autoComplete="off" spellCheck={false} placeholder="TD-…" value={code} onChange={e=>setCode(e.target.value.trim())}/></label>}
    <label>E-mail<input aria-label="Account email" type="email" required autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>{fr?'Mot de passe':'Password'}<input aria-label="Account password" type="password" required minLength={8} maxLength={72} autoComplete={signup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button className="primary" disabled={pending}>{pending?(fr?'Connexion…':'Connecting…'):signup?(fr?'Créer mon compte':'Create account'):(fr?'Me connecter':'Sign in')}<ArrowRight size={19}/></button>
   </form>
   {(message||snapshot.cloud?.message)&&<p role="status">{message||snapshot.cloud?.message}</p>}
   <button className="cloud-switch" disabled={pending} onClick={()=>{setSignup(!signup);setMessage('');}}><UserPlus size={18}/>{signup?(fr?'J’ai déjà un compte':'I already have an account'):(fr?'Créer un compte avec mon code':'Create an account with my code')}</button>
   {snapshot.cloud?.email&&<button onClick={()=>void api.cloudLogout()}><LogOut size={18}/>{fr?'Changer de compte':'Change account'}</button>}
  </section>
 </div>;
}
export function AccountPanel({snapshot}:{snapshot:Snapshot}){
 const [email,setEmail]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false),[invitation,setInvitation]=useState<{email:string;code:string;expiresAt:string}|null>(null),fr=snapshot.settings.language==='fr';
 if(!snapshot.cloud?.configured)return null;
 return <section className="surface cloud-account">
  <div><h2>{fr?'Mon compte':'My account'}</h2><p>{snapshot.cloud.email} · {snapshot.cloud.role==='owner'?'ADMIN':'Coach'}</p><p>{fr?'Tes drafts et résultats sont enregistrés dans Supabase.':'Your drafts and results are saved in Supabase.'}</p></div>
  <button onClick={()=>void api.cloudLogout()}><LogOut size={17}/>{fr?'Me déconnecter':'Sign out'}</button>
  {snapshot.cloud.role==='owner'&&<form onSubmit={e=>{e.preventDefault();setPending(true);setInvitation(null);setMessage('');void api.cloudInvite(email.trim()).then(result=>{setInvitation(result);setEmail('');}).catch(()=>setMessage(fr?'Impossible de créer ce code. Vérifie l’adresse ; le compte est peut-être déjà inscrit.':'Could not create this code. Check the email; the account may already be registered.')).finally(()=>setPending(false));}}>
   <label>{fr?'Inviter un coach par code':'Invite a coach with a code'}<input type="email" required maxLength={254} aria-label="Invite coach email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button disabled={pending}><UserPlus size={18}/>{fr?'Créer le code':'Create code'}</button>
  </form>}
  {invitation&&<div className="cloud-invitation" data-testid="issued-invitation"><p>{invitation.email} · {fr?'valable jusqu’au':'valid until'} {new Date(invitation.expiresAt).toLocaleDateString(fr?'fr-FR':'en-GB')}</p><label>{fr?'Code à transmettre à ce coach':'Code to share with this coach'}<input aria-label="Created invitation code" readOnly value={invitation.code} onFocus={e=>e.currentTarget.select()}/></label><button onClick={()=>void api.copyInvitation(invitation.code).then(()=>setMessage(fr?'Code copié.':'Code copied.')).catch(()=>setMessage(fr?'Sélectionne le code et copie-le avec Ctrl+C.':'Select the code and copy it with Ctrl+C.'))}><Copy size={18}/>{fr?'Copier le code':'Copy code'}</button><p>{fr?'Usage unique. Affiché uniquement ici : copie-le avant de quitter. Créer un nouveau code pour cette adresse annule le précédent.':'Single use. Shown only here: copy it before leaving. Creating a new code for this email cancels the previous one.'}</p></div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
