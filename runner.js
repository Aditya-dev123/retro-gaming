const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const CW = 620, CH = 300;
canvas.width = CW; canvas.height = CH;
const GROUND_Y   = 230;
const PW = 34, PH = 46, PX = 85;
const GRAVITY    = 0.55;
const JUMP_FORCE = -13;
const COIN_R     = 8;
const OBS_TYPES  = ['rock','spike','tree','bird','pit'];
const PU_TYPES   = ['magnet','shield','boost','slowmo'];
const PU_COLORS  = { magnet:'#06d6a0', shield:'#38bdf8', boost:'#ef233c', slowmo:'#a78bfa' };
const PU_LABELS  = { magnet:'M', shield:'S', boost:'B', slowmo:'⧗' };
const PU_NAMES   = { magnet:'MAGNET', shield:'SHIELD', boost:'BOOST', slowmo:'SLOW' };
let g = {};
let highScore = 0;
let raf = null;
function rand(a,b){ return Math.random()*(b-a)+a; }
function randInt(a,b){ return Math.floor(rand(a,b+1)); }
function freshState(){
  return {
    running: false, paused: false, over: false,
    score: 0, collectedCoins: 0, distance: 0, speed: 4, tick: 0,
    player: {
      x:PX, y:GROUND_Y, vy:0,
      jumping:false, doubleJumped:false,
      sliding:false, slideTimer:0,
      shielded:false, shieldTimer:0,
      magnetized:false, magnetTimer:0,
      boosted:false, boostTimer:0,
      slowmo:false, slowTimer:0,
    },
    obstacles:[], coins:[], powerups:[], particles:[],
    obsCooldown:0, coinCooldown:0, puCooldown:0,
    stars: Array.from({length:55},()=>({
      x:rand(0,CW), y:rand(0,CH*0.65),
      r:rand(0.4,1.8), s:rand(0.2,1.2)
    })),
    groundLines:[0,1,2,3,4,5,6,7].map(i=>i*(CW/7)),
  };
}
document.addEventListener('keydown', e => {
  if(['Space','ArrowUp','KeyW'].includes(e.code)){ e.preventDefault(); doJump(); }
  if(['ArrowDown','KeyS'].includes(e.code)){ e.preventDefault(); doSlide(); }
  if(e.code==='KeyP'||e.code==='Escape') togglePause();
});
function doJump(){
  if(!g.running||g.paused||g.over) return;
  const p = g.player;
  if(!p.jumping){
    p.vy = JUMP_FORCE; p.jumping = true; p.doubleJumped = false;
    spawnParticles(p.x+PW/2, p.y+PH, '#ff6b35', 5);
  } else if(!p.doubleJumped){
    p.vy = JUMP_FORCE*0.85; p.doubleJumped = true;
    spawnParticles(p.x+PW/2, p.y+PH, '#ffd166', 6);
  }
}
function doSlide(){
  if(!g.running||g.paused||g.over) return;
  const p = g.player;
  if(!p.jumping){ p.sliding=true; p.slideTimer=30; }
}
function startGame(){
  g = freshState();
  g.running = true;
  show('none');
  if(raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}
function pauseGame(){
  g.paused = true;
  show('pause');
}
function resumeGame(){
  g.paused = false;
  show('none');
}
function togglePause(){
  if(!g.running||g.over) return;
  g.paused ? resumeGame() : pauseGame();
}
function endGame(){
  g.running = false; g.over = true;
  if(Math.floor(g.score) > highScore) highScore = Math.floor(g.score);
  const bestEl = document.getElementById('h-best');
  if(bestEl) bestEl.textContent = highScore;
  const sr = document.getElementById('over-stats');
  if(sr){
    sr.innerHTML = `
      <div class="stat-box"><div class="stat-label">SCORE</div><div class="stat-val" style="color:#ffd166">${Math.floor(g.score)}</div></div>
      <div class="stat-box"><div class="stat-label">COINS</div><div class="stat-val" style="color:#06d6a0">${g.collectedCoins}</div></div>
      <div class="stat-box"><div class="stat-label">DISTANCE</div><div class="stat-val" style="color:#38bdf8">${Math.floor(g.distance)}m</div></div>
      <div class="stat-box"><div class="stat-label">BEST</div><div class="stat-val" style="color:#ff6b35">${highScore}</div></div>
    `;
  }
  show('over');
}
function show(which){
  const startEl = document.getElementById('ov-start');
  const pauseEl = document.getElementById('ov-pause');
  const overEl = document.getElementById('ov-over');
  if(startEl) startEl.classList.add('hidden');
  if(pauseEl) pauseEl.classList.add('hidden');
  if(overEl) overEl.classList.add('hidden');
  if(which==='start' && startEl) startEl.classList.remove('hidden');
  if(which==='pause' && pauseEl) pauseEl.classList.remove('hidden');
  if(which==='over' && overEl) overEl.classList.remove('hidden');
}
function spawnParticles(x,y,color,n){
  for(let i=0;i<n;i++){
    g.particles.push({
      x,y,
      vx:rand(-3,3), vy:rand(-4,-1),
      r:rand(2,5), color,
      life:28, maxLife:28
    });
  }
}
function loop(){
  raf = requestAnimationFrame(loop);
  drawBackground();
  if(!g.running && !g.over){ return; }
  if(g.paused){ drawEntities(); return; }
  if(g.over){ drawEntities(); return; }
  update();
  drawEntities();
  updateHUD();
}
function update(){
  const p = g.player;
  const sp = p.slowmo ? g.speed*0.45 : p.boosted ? g.speed*1.7 : g.speed;
  p.vy += GRAVITY;
  p.y  += p.vy;
  if(p.y >= GROUND_Y){ p.y=GROUND_Y; p.vy=0; p.jumping=false; p.doubleJumped=false; }
  if(p.slideTimer>0){ p.slideTimer--; if(!p.slideTimer) p.sliding=false; }
  if(p.shielded   && --p.shieldTimer  <=0) p.shielded=false;
  if(p.magnetized && --p.magnetTimer  <=0) p.magnetized=false;
  if(p.boosted    && --p.boostTimer   <=0) p.boosted=false;
  if(p.slowmo     && --p.slowTimer    <=0) p.slowmo=false;
  g.stars.forEach(s=>{ s.x-=s.s*sp*0.09; if(s.x<0){s.x=CW;s.y=rand(0,CH*0.65);} });
  g.groundLines = g.groundLines.map(x=>{ x-=sp; return x<0?x+CW:x; });
  if(g.obsCooldown>0) g.obsCooldown--;
  if(g.obsCooldown===0){
    const minGap = Math.max(110, 270 - g.score/45);
    const type = OBS_TYPES[randInt(0,OBS_TYPES.length-1)];
    let w,h,y;
    if(type==='rock')  { w=40;h=34;y=GROUND_Y-4; }
    else if(type==='spike'){ w=42;h=26;y=GROUND_Y+4; }
    else if(type==='tree') { w=40;h=62;y=GROUND_Y-32; }
    else if(type==='bird') { w=36;h=22;y=rand(GROUND_Y-120,GROUND_Y-60); }
    else                   { w=50;h=20;y=GROUND_Y+10; }
    g.obstacles.push({type,x:CW+20,y,w,h});
    g.obsCooldown = randInt(minGap/sp, (minGap+90)/sp);
  }
  g.obstacles.forEach(o=>o.x-=sp);
  g.obstacles = g.obstacles.filter(o=>o.x+o.w>-20);
  if(g.coinCooldown>0) g.coinCooldown--;
  if(g.coinCooldown===0){
    const n=randInt(1,4);
    for(let i=0;i<n;i++) g.coins.push({x:CW+20+i*28, y:rand(GROUND_Y-80,GROUND_Y-12)});
    g.coinCooldown=randInt(40,90);
  }
  if(p.magnetized){
    g.coins.forEach(c=>{
      const dx=p.x+PW/2-c.x, dy=p.y+PH/2-c.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<160){c.x+=dx*0.1;c.y+=dy*0.1;}
    });
  }
  g.coins.forEach(c=>c.x-=sp);
  g.coins=g.coins.filter(c=>c.x>-20);
  if(g.puCooldown>0) g.puCooldown--;
  if(g.puCooldown===0){
    g.powerups.push({type:PU_TYPES[randInt(0,3)],x:CW+20,y:rand(GROUND_Y-110,GROUND_Y-24)});
    g.puCooldown=randInt(200,360);
  }
  g.powerups.forEach(pu=>pu.x-=sp);
  g.powerups=g.powerups.filter(pu=>pu.x>-20);
  g.particles.forEach(pt=>{ pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.15; pt.life--; });
  g.particles=g.particles.filter(pt=>pt.life>0);
  const phx=p.x+5, phw=PW-10;
  const phy=p.sliding?p.y+PH/2:p.y;
  const phh=p.sliding?PH/2:PH;
  for(let i=g.obstacles.length-1;i>=0;i--){
    const o=g.obstacles[i];
    let hit=false;
    if(o.type==='pit'){
      hit = p.x+PW>o.x+4 && p.x<o.x+o.w-4 && !p.jumping;
    } else {
      hit = phx<o.x+o.w-4 && phx+phw>o.x+4 && phy<o.y+o.h-4 && phy+phh>o.y+4;
    }
    if(hit){
      if(p.shielded){
        p.shielded=false;
        spawnParticles(o.x+o.w/2,o.y+o.h/2,'#38bdf8',12);
        g.obstacles.splice(i,1);
      } else {
        spawnParticles(p.x+PW/2,p.y,'#ef233c',20);
        endGame(); return;
      }
    }
  }
  g.coins=g.coins.filter(c=>{
    const cx=p.x+PW/2, cy=p.sliding?p.y+PH*0.75:p.y+PH/2;
    if(Math.hypot(cx-c.x,cy-c.y)<PW/2+COIN_R){
      g.score+=10; 
      g.collectedCoins++;
      spawnParticles(c.x,c.y,'#ffd166',5);
      return false;
    }
    return true;
  });
  g.powerups=g.powerups.filter(pu=>{
    if(Math.hypot(p.x+PW/2-pu.x,p.y+PH/2-pu.y)<PW/2+14){
      if(pu.type==='shield')  { p.shielded=true;   p.shieldTimer=300; }
      if(pu.type==='magnet')  { p.magnetized=true;  p.magnetTimer=300; }
      if(pu.type==='boost')   { p.boosted=true;     p.boostTimer=180; }
      if(pu.type==='slowmo')  { p.slowmo=true;      p.slowTimer=200; }
      spawnParticles(pu.x,pu.y,'#06d6a0',10);
      return false;
    }
    return true;
  });
  g.score    += 0.05;
  g.distance += sp*0.01;
  g.tick++;
  if(g.tick%600===0 && g.speed<12) g.speed+=0.4;
}
function drawBackground(){
  ctx.fillStyle='#0a0e17';
  ctx.fillRect(0,0,CW,CH);
  if(!g.stars) return;
  g.stars.forEach(s=>{
    ctx.globalAlpha=0.55;
    ctx.fillStyle='#c9d1d9';
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha=1;
  const gr=ctx.createLinearGradient(0,GROUND_Y+28,0,CH);
  gr.addColorStop(0,'#111827');
  gr.addColorStop(1,'#0a0e17');
  ctx.fillStyle=gr;
  ctx.fillRect(0,GROUND_Y+28,CW,CH-GROUND_Y-28);
  ctx.strokeStyle='#1f2937';
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(0,GROUND_Y+28);
  ctx.lineTo(CW,GROUND_Y+28);
  ctx.stroke();
  if(g.groundLines){
    ctx.strokeStyle='#161d2b';
    ctx.lineWidth=0.5;
    g.groundLines.forEach(x=>{
      ctx.beginPath();
      ctx.moveTo(x,GROUND_Y+28);
      ctx.lineTo(x,CH);
      ctx.stroke();
    });
  }
}
function drawEntities(){
  g.obstacles.forEach(drawObstacle);
  g.coins.forEach(drawCoin);
  g.powerups.forEach(drawPowerUp);
  drawParticles();
  drawPlayer();
}
function drawPlayer(){
  const p=g.player;
  const h=p.sliding?PH/2:PH;
  const y=p.sliding?p.y+PH/2:p.y;
  if(p.shielded){
    ctx.save();
    ctx.shadowColor='#38bdf8';
    ctx.shadowBlur=20;
    ctx.strokeStyle='#38bdf8';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.ellipse(p.x+PW/2, y+h/2, PW/2+10, h/2+10, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
  const t=Date.now();
  if(!p.sliding && !p.jumping){
    const phase=(t/80)%(Math.PI*2);
    ctx.save();
    ctx.strokeStyle='#cc4a1a';
    ctx.lineWidth=4;
    ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(p.x+8,y+h-2); ctx.lineTo(p.x+8,y+h+8+Math.sin(phase)*6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x+PW-8,y+h-2); ctx.lineTo(p.x+PW-8,y+h+8+Math.sin(phase+Math.PI)*6); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle='#ff6b35';
  ctx.fillRect(p.x+4, y+h*0.35, PW-8, h*0.5);
  ctx.fillStyle='#c24c20';
  ctx.fillRect(p.x, y+h*0.38, 6, h*0.4);
  ctx.fillStyle='#ffd166';
  ctx.beginPath();
  ctx.arc(p.x+PW/2, y+h*0.2, PW*0.34, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle='#ef233c';
  ctx.fillRect(p.x+5, y+h*0.07, PW-10, 5);
  ctx.fillStyle='#0a0e17';
  ctx.beginPath();
  ctx.arc(p.x+PW*0.65, y+h*0.17, 3, 0, Math.PI*2);
  ctx.fill();
  if(p.magnetized){
    ctx.save();
    ctx.shadowColor='#06d6a0';
    ctx.shadowBlur=14;
    ctx.strokeStyle='#06d6a0';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.arc(p.x+PW/2, y+h/2, PW/2+14, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}
function drawObstacle(o){
  ctx.save();
  ctx.shadowColor='#ef233c';
  ctx.shadowBlur=5;
  const t=Date.now();
  switch(o.type){
    case 'rock':
      ctx.fillStyle='#6b7280';
      ctx.beginPath();
      ctx.ellipse(o.x+o.w/2,o.y+o.h,o.w/2,o.h*0.55,0,Math.PI,0,true);
      ctx.fill();
      ctx.fillStyle='#9ca3af';
      ctx.beginPath();
      ctx.ellipse(o.x+o.w/2,o.y+o.h*0.45,o.w*0.33,o.h*0.32,-0.3,0,Math.PI*2);
      ctx.fill();
      break;
    case 'spike':
      ctx.fillStyle='#d1d5db';
      for(let i=0;i<3;i++){
        ctx.beginPath();
        ctx.moveTo(o.x+i*14,     o.y+o.h);
        ctx.lineTo(o.x+i*14+7,   o.y);
        ctx.lineTo(o.x+i*14+14,  o.y+o.h);
        ctx.fill();
      }
      break;
    case 'tree':
      ctx.fillStyle='#4a3520';
      ctx.fillRect(o.x+o.w*0.35, o.y+o.h*0.5, o.w*0.3, o.h*0.5);
      ctx.fillStyle='#166534';
      ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y); ctx.lineTo(o.x,o.y+o.h*0.62); ctx.lineTo(o.x+o.w,o.y+o.h*0.62); ctx.fill();
      ctx.fillStyle='#15803d';
      ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y+o.h*0.18); ctx.lineTo(o.x+4,o.y+o.h*0.74); ctx.lineTo(o.x+o.w-4,o.y+o.h*0.74); ctx.fill();
      break;
    case 'bird':
      ctx.fillStyle='#7c3aed';
      ctx.beginPath();
      ctx.ellipse(o.x+o.w/2,o.y+o.h/2,o.w/2,o.h*0.35,0,0,Math.PI*2);
      ctx.fill();
      const wing=Math.sin(t/80)*7;
      ctx.strokeStyle='#a78bfa'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y+o.h/2); ctx.quadraticCurveTo(o.x,o.y-wing,o.x-10,o.y+o.h/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(o.x+o.w/2,o.y+o.h/2); ctx.quadraticCurveTo(o.x+o.w,o.y-wing,o.x+o.w+10,o.y+o.h/2); ctx.stroke();
      ctx.fillStyle='#fbbf24';
      ctx.beginPath(); ctx.moveTo(o.x+o.w,o.y+o.h/2); ctx.lineTo(o.x+o.w+8,o.y+o.h/2+3); ctx.lineTo(o.x+o.w,o.y+o.h/2+6); ctx.fill();
      break;
    case 'pit':
      ctx.fillStyle='#060a12';
      ctx.fillRect(o.x, o.y, o.w, CH-o.y);
      ctx.strokeStyle='#ef233c'; ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      ctx.strokeRect(o.x,o.y,o.w,CH-o.y);
      ctx.setLineDash([]);
      ctx.fillStyle='#1f2937';
      for(let i=0;i<3;i++){
        ctx.beginPath();
        ctx.moveTo(o.x+i*(o.w/3),      o.y);
        ctx.lineTo(o.x+i*(o.w/3)+o.w/6, o.y+18);
        ctx.lineTo(o.x+(i+1)*(o.w/3),   o.y);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}
function drawCoin(c){
  const pulse=Math.sin(Date.now()/200+c.x)*0.25+0.75;
  ctx.save();
  ctx.globalAlpha=pulse;
  ctx.shadowColor='#ffd166';
  ctx.shadowBlur=10;
  ctx.fillStyle='#ffd166';
  ctx.beginPath();
  ctx.arc(c.x,c.y,COIN_R,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle='#f59e0b';
  ctx.beginPath();
  ctx.arc(c.x-2,c.y-2,COIN_R*0.45,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}
function drawPowerUp(pu){
  ctx.save();
  const col=PU_COLORS[pu.type];
  ctx.shadowColor=col; ctx.shadowBlur=14;
  ctx.strokeStyle=col; ctx.lineWidth=2;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pu.x-14,pu.y-14,28,28,5);
  } else {
    ctx.rect(pu.x-14,pu.y-14,28,28);
  }
  ctx.stroke();
  ctx.fillStyle=col+'28';
  ctx.fill();
  ctx.fillStyle=col;
  ctx.font='bold 14px "Share Tech Mono",monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(PU_LABELS[pu.type],pu.x,pu.y);
  ctx.restore();
}
function drawParticles(){
  g.particles.forEach(p=>{
    ctx.save();
    ctx.globalAlpha=p.life/p.maxLife;
    ctx.fillStyle=p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}
function updateHUD(){
  const sc=Math.floor(g.score);
  const scoreEl = document.getElementById('h-score');
  const distEl = document.getElementById('h-dist');
  const bestEl = document.getElementById('h-best');
  const coinsEl = document.getElementById('h-coins');
  const bar = document.getElementById('effects-bar');
  if(scoreEl) scoreEl.textContent=sc;
  if(distEl) distEl.textContent=Math.floor(g.distance);
  if(bestEl) bestEl.textContent=highScore;
  if(coinsEl) coinsEl.textContent=g.collectedCoins;
  if(bar){
    bar.innerHTML='';
    const p=g.player;
    const effs=[];
    if(p.shielded)   effs.push({l:'SHIELD', c:'#38bdf8'});
    if(p.magnetized) effs.push({l:'MAGNET', c:'#06d6a0'});
    if(p.boosted)    effs.push({l:'BOOST',  c:'#ef233c'});
    if(p.slowmo)     effs.push({l:'SLOW',   c:'#a78bfa'});
    effs.forEach(e=>{
      const d=document.createElement('div');
      d.className='effect-badge';
      d.style.color=e.c;
      d.style.borderColor=e.c;
      d.style.background=e.c+'22';
      d.textContent=e.l;
      bar.appendChild(d);
    });
  }
}
g = freshState();
show('start');
raf = requestAnimationFrame(loop);