import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
export function Modal({title,close,children,className=''}:{title:string;close:()=>void;children:React.ReactNode;className?:string}){
 const box=useRef<HTMLDivElement>(null),closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const root=box.current;
  (root?.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled])')??root?.querySelector<HTMLElement>('button:not([disabled])'))?.focus();
  function key(event:KeyboardEvent){if(event.key==='Escape'){event.stopPropagation();closeRef.current();}if(event.key==='Tab'){
   const nodes=[...(root?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')??[])].filter(node=>node.getClientRects().length),first=nodes[0],last=nodes.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);previous?.focus();};
 },[]);
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><div ref={box} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close"><X size={19}/></button></div>{children}</div></div>;
}
