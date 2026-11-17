import type {Point2} from "./map-schema";
type Rect={x:number;y:number;width:number;height:number};
const cross=(a:Point2,b:Point2,c:Point2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const near=(a:number,b:number)=>Math.abs(a-b)<1e-8;
export function pointSegmentDistance(p:Point2,a:Point2,b:Point2){
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function segmentsMeet(a:Point2,b:Point2,c:Point2,d:Point2){
  const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b);
  return (u*v<0&&w*z<0)||near(pointSegmentDistance(a,c,d),0)||near(pointSegmentDistance(b,c,d),0)||near(pointSegmentDistance(c,a,b),0)||near(pointSegmentDistance(d,a,b),0);
}
export const polygonArea=(p:Point2[])=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-b.x*a.y;},0))/2;
export function simplePolygon(p:Point2[]){
  if(p.length<3||p.length>32||polygonArea(p)<1)return false;
  for(let i=0;i<p.length;i++){
    if(Math.hypot(p[i].x-p[(i+1)%p.length].x,p[i].y-p[(i+1)%p.length].y)<.01)return false;
    for(let j=i+1;j<p.length;j++){
      if(j===i+1||(i===0&&j===p.length-1))continue;
      if(segmentsMeet(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return false;
    }
  }return true;
}
export function pointInPolygon(p:Point2,ring:Point2[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(pointSegmentDistance(p,a,b)<1e-8)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
export function rectangleInPolygon(r:Rect,ring:Point2[],clearance=0){
  const corners=[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
  if(!corners.every(p=>pointInPolygon(p,ring)))return false;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    // Clip each roof edge against the open rectangle. Corner-only tests miss
    // concave notches, including segments that enter exactly at a corner.
    let low=0,high=1,intersects=true;
    for(const [v,delta,min,max] of [[a.x,b.x-a.x,r.x+1e-8,r.x+r.width-1e-8],[a.y,b.y-a.y,r.y+1e-8,r.y+r.height-1e-8]]){
      if(Math.abs(delta)<1e-12){if(v<min||v>max)intersects=false;}
      else{const t1=(min-v)/delta,t2=(max-v)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}
    }
    if(intersects&&high>=low)return false;
    for(let j=0;j<4;j++){
      const c=corners[j],d=corners[(j+1)%4];
      const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b);
      if(u*v< -1e-12&&w*z< -1e-12)return false;
      const distance=Math.min(pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b),pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d));
      if(distance+1e-6<clearance)return false;
    }
  }return true;
}
export function segmentInPolygon(a:Point2,b:Point2,ring:Point2[]){
  if(!pointInPolygon(a,ring)||!pointInPolygon(b,ring))return false;
  const ts=[0,1],dx=b.x-a.x,dy=b.y-a.y;
  for(let i=0;i<ring.length;i++){
    const c=ring[i],d=ring[(i+1)%ring.length],ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;
    if(Math.abs(den)>1e-10){
      const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;
      if(t>=0&&t<=1&&u>=0&&u<=1)ts.push(t);
    }else{
      for(const p of [c,d])if(pointSegmentDistance(p,a,b)<1e-8){const len=dx*dx+dy*dy;if(len)ts.push(((p.x-a.x)*dx+(p.y-a.y)*dy)/len);}
    }
  }
  ts.sort((x,y)=>x-y);
  return ts.slice(1).every((t,i)=>{const middle=(ts[i]+t)/2;return pointInPolygon({x:a.x+dx*middle,y:a.y+dy*middle},ring);});
}
