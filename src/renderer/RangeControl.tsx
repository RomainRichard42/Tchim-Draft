import type { ComponentProps } from 'react';

export function RangeControl({value,min=0,max=100,...props}:Omit<ComponentProps<'input'>,'type'|'value'|'min'|'max'>&{value:number;min?:number;max?:number}) {
  const fill=Math.max(0,Math.min(100,(value-min)/Math.max(1,max-min)*100));
  return <div className="range-control"><span className="range-track" aria-hidden="true"><span style={{width:`${fill}%`}}/></span><input {...props} type="range" min={min} max={max} value={value}/></div>;
}
