import type { Champion, Selection } from '../shared/types';

/** A real native drag image, built synchronously before Chromium takes its snapshot. */
export function championDragImage(event:React.DragEvent,champion:Champion,selection:Selection):()=>void {
  const image=document.createElement('div');image.className='champion-native-drag';image.dataset.testid='champion-drag-preview';
  const art=document.createElement('img');art.src='./art/card/'+champion.id+'.webp';art.alt='';art.draggable=false;
  const label=document.createElement('strong');label.textContent=champion.name;
  const role=document.createElement('span');role.textContent=selection.role??'BAN';
  image.append(art,label,role);document.body.append(image);
  event.dataTransfer.setDragImage(image,70,40);
  return ()=>image.remove();
}
