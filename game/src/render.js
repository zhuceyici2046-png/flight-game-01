// Cloudrunner's renderer: one canvas, one fixed 1280x720 field, letterboxed to the window.
// Every picture is drawn from the world state, so the screenshot scenes are the real game.
import { FIELD, FONT, FUEL, GROUND_Y, PALETTE, PLANE, RINGS_PER_DELIVERY } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

/** Deterministic ridge height for the parallax ranges, from world x alone. */
function ridge(x, amp, base) {
  return base + Math.sin(x * 0.011) * amp * 0.55 + Math.sin(x * 0.004 + 1.7) * amp + Math.sin(x * 0.023 + 4.1) * amp * 0.3;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, x, y, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawSky(state) {
    const w = FIELD.width;
    const h = FIELD.height;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Sun, upper right, with a soft halo.
    const sunX = w - 190;
    const sunY = 96;
    const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
    halo.addColorStop(0, 'rgba(255, 243, 196, 0.9)');
    halo.addColorStop(1, 'rgba(255, 243, 196, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 120, sunY - 120, 240, 240);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRanges(state) {
    const w = FIELD.width;
    // Far mountains, slow parallax.
    ctx.fillStyle = PALETTE.farMountain;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, ridge(x + state.distance * 0.12, 70, 470));
    }
    ctx.lineTo(w, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    // Near hills, faster parallax.
    ctx.fillStyle = PALETTE.nearHill;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, ridge(x + state.distance * 0.35, 46, 580));
    }
    ctx.lineTo(w, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    // Ground strip.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, GROUND_Y, w, FIELD.height - GROUND_Y);
    ctx.fillStyle = PALETTE.groundTop;
    ctx.fillRect(0, GROUND_Y, w, 6);
    // Grass tufts scrolling with the ground.
    ctx.fillStyle = '#4c6b3d';
    const off = state.distance % 90;
    for (let x = -off; x < w; x += 90) {
      ctx.fillRect(x, GROUND_Y + 12, 4, 10);
      ctx.fillRect(x + 40, GROUND_Y + 18, 4, 8);
    }
  }

  function drawSceneryCloud(state) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const c of state.scenery) {
      const s = c.s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 26 * s, 0, Math.PI * 2);
      ctx.arc(c.x + 22 * s, c.y + 6 * s, 18 * s, 0, Math.PI * 2);
      ctx.arc(c.x - 22 * s, c.y + 8 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlane(state) {
    const plane = state.plane;
    // Blink while recovering from a hit.
    if (plane.invuln > 0 && Math.floor(state.elapsed * 14) % 2 === 0) return;
    const pitch = Math.max(-0.5, Math.min(0.5, plane.vy / 700));
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(pitch);
    // Propeller wash: a translucent disc at the nose.
    const prop = state.elapsed * 40;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(26, 0, 4, 14 + Math.sin(prop) * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Tail.
    ctx.fillStyle = PALETTE.planeDark;
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.lineTo(-30, -14);
    ctx.lineTo(-24, -2);
    ctx.closePath();
    ctx.fill();
    // Main wing.
    ctx.fillStyle = PALETTE.planeLight;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(4, 2);
    ctx.lineTo(10, 16);
    ctx.lineTo(-12, 16);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = PALETTE.plane;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Stripe.
    ctx.fillStyle = PALETTE.planeLight;
    ctx.fillRect(-14, -3, 30, 3);
    // Cockpit.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.ellipse(8, -5, 9, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Nose + spinner.
    ctx.fillStyle = PALETTE.planeDark;
    ctx.beginPath();
    ctx.arc(25, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Boost flames.
    if (plane.boostTime > 0) {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(plane.x - 26, plane.y - 4);
      ctx.lineTo(plane.x - 44 - Math.random() * 10, plane.y);
      ctx.lineTo(plane.x - 26, plane.y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawEntities(state) {
    // Rings: golden hoops, spinning a little, glowing when the combo is hot.
    for (const ring of state.rings) {
      const glow = state.combo > 1;
      ctx.save();
      ctx.translate(ring.x, ring.y);
      if (glow) {
        ctx.shadowColor = PALETTE.ring;
        ctx.shadowBlur = 18;
      }
      ctx.strokeStyle = PALETTE.ring;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.ringCore;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 44, 0, 0, Math.PI * 2);
      ctx.stroke();
      // A small marker that spins, so the ring reads as a hoop, not a disc.
      const a = state.elapsed * 2 + ring.spin;
      ctx.fillStyle = PALETTE.ringCore;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 44, Math.sin(a) * 44, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const star of state.stars) {
      const pulse = 1 + Math.sin(state.elapsed * 5 + star.phase) * 0.15;
      ctx.fillStyle = PALETTE.star;
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.scale(pulse, pulse);
      starPath(ctx, 0, 0, 13);
      ctx.fill();
      ctx.fillStyle = '#fff7d6';
      starPath(ctx, 0, 0, 6);
      ctx.fill();
      ctx.restore();
    }
    for (const can of state.cans) {
      const bob = Math.sin(state.elapsed * 3 + can.bob) * 4;
      ctx.save();
      ctx.translate(can.x, can.y + bob);
      ctx.fillStyle = PALETTE.can;
      roundRect(ctx, -13, -11, 26, 24, 4);
      ctx.fill();
      ctx.fillStyle = PALETTE.canDark;
      ctx.fillRect(-6, -16, 12, 6);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', 0, 2);
      ctx.restore();
    }
    for (const cloud of state.clouds) {
      const bob = Math.sin(state.elapsed * 1.4 + cloud.bob) * 6;
      ctx.save();
      ctx.translate(cloud.x, cloud.y + bob);
      ctx.fillStyle = cloud.storm ? PALETTE.storm : PALETTE.cloud;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.arc(26, 8, 26, 0, Math.PI * 2);
      ctx.arc(-26, 10, 24, 0, Math.PI * 2);
      ctx.arc(0, 14, 26, 0, Math.PI * 2);
      ctx.fill();
      if (cloud.storm) {
        ctx.fillStyle = PALETTE.stormCore;
        ctx.beginPath();
        ctx.arc(0, 16, 24, 0, Math.PI);
        ctx.fill();
        // Lightning flicker, rare and brief.
        if (Math.sin(state.elapsed * 7 + cloud.x * 0.13) > 0.985) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 26);
          ctx.lineTo(-6, 44);
          ctx.lineTo(2, 44);
          ctx.lineTo(-4, 62);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const bird of state.birds) {
      const flap = Math.sin(bird.flap) * 0.7;
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.strokeStyle = PALETTE.bird;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(-4, -8 - flap * 10, 0, 0);
      ctx.quadraticCurveTo(4, -8 - flap * 10, 12, 0);
      ctx.stroke();
      ctx.fillStyle = PALETTE.bird;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const balloon of state.balloons) {
      const bob = Math.sin(state.elapsed * 1.8 + balloon.bob) * 8;
      ctx.save();
      ctx.translate(balloon.x, balloon.y + bob);
      ctx.fillStyle = balloon.hue === 0 ? PALETTE.balloon : PALETTE.balloonAlt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-9, -12, 9, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, 30);
      ctx.lineTo(-8, 46);
      ctx.moveTo(16, 30);
      ctx.lineTo(8, 46);
      ctx.stroke();
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-9, 44, 18, 12);
      ctx.restore();
    }
    for (const tower of state.towers) {
      ctx.fillStyle = PALETTE.tower;
      ctx.fillRect(tower.x - tower.w / 2, GROUND_Y - tower.h, tower.w, tower.h);
      ctx.fillRect(tower.x - 2, GROUND_Y - tower.h - 26, 4, 26);
      const blink = Math.sin(state.elapsed * 3 + tower.blink) > 0.6;
      ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(tower.x, GROUND_Y - tower.h - 28, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const peak of state.peaks) {
      ctx.fillStyle = '#7c8aa0';
      ctx.beginPath();
      ctx.moveTo(peak.x - peak.w / 2, GROUND_Y);
      ctx.lineTo(peak.x, GROUND_Y - peak.h);
      ctx.lineTo(peak.x + peak.w / 2, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(peak.x - peak.w * 0.14, GROUND_Y - peak.h * 0.72);
      ctx.lineTo(peak.x, GROUND_Y - peak.h);
      ctx.lineTo(peak.x + peak.w * 0.14, GROUND_Y - peak.h * 0.72);
      ctx.lineTo(peak.x + peak.w * 0.05, GROUND_Y - peak.h * 0.6);
      ctx.lineTo(peak.x, GROUND_Y - peak.h * 0.68);
      ctx.lineTo(peak.x - peak.w * 0.05, GROUND_Y - peak.h * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    // Particles and score floaters.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.colour;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const plane = state.plane;
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(18, 38, 63, 0.55)';
    roundRect(ctx, 18, 14, 250, 64, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(String(Math.floor(state.score)), 32, 48);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best ${Math.floor(Math.max(best, state.score))} · ${(state.distance / 1000).toFixed(1)} km`, 32, 68);
    // Delivery progress, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(18, 38, 63, 0.55)';
    roundRect(ctx, FIELD.width / 2 - 130, 14, 260, 70, 12);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 17px ' + FONT;
    ctx.fillText(`Delivery ${state.level} · Rings ${state.ringsThisLevel}/${RINGS_PER_DELIVERY}`, FIELD.width / 2, 43);
    // Instruments: altitude above the ground, forward speed and heading, so the
    // HUD reads like a real panel — climb steepens the heading off 090.
    const climbDeg = Math.max(-25, Math.min(25, (Math.atan2(-plane.vy, Math.max(1, state.speed)) * 180) / Math.PI));
    const heading = Math.round(90 - climbDeg);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px ' + FONT;
    ctx.fillText(
      `ALT ${Math.max(0, Math.round((GROUND_Y - plane.y) * 3)).toLocaleString('en-US')} ft · SPD ${Math.round(state.speed * 0.35)} kt · HDG ${String(heading).padStart(3, '0')}°`,
      FIELD.width / 2,
      70,
    );
    // Fuel gauge + hull, top right.
    const gx = FIELD.width - 268;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(18, 38, 63, 0.55)';
    roundRect(ctx, gx, 14, 250, 64, 12);
    ctx.fill();
    const lowFuel = state.fuel < FUEL.low;
    const flash = lowFuel && Math.sin(state.elapsed * 8) > 0;
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, gx + 14, 28, 150, 14, 7);
    ctx.fill();
    ctx.fillStyle = flash ? '#ef4444' : lowFuel ? '#f59e0b' : '#4ade80';
    const fw = Math.max(0, (state.fuel / FUEL.max) * 146);
    if (fw > 0) {
      roundRect(ctx, gx + 16, 30, fw, 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText(lowFuel ? 'FUEL LOW' : 'FUEL', gx + 172, 40);
    // Hull: little planes, one per life left.
    for (let i = 0; i < plane.hull; i += 1) {
      const hx = gx + 24 + i * 30;
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(hx, 62);
      ctx.lineTo(hx + 16, 58);
      ctx.lineTo(hx + 16, 66);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText(`${plane.hull} hull`, gx + 120, 66);
    // Combo badge.
    const mult = Math.min(5, state.combo);
    if (mult > 1 && state.comboTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillText(`COMBO x${mult}`, FIELD.width / 2, 112);
    }
    // Delivery banner.
    if (state.bannerTimer > 0) {
      ctx.globalAlpha = Math.min(1, state.bannerTimer);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff7d6';
      ctx.font = 'bold 34px ' + FONT;
      ctx.fillText(state.banner, FIELD.width / 2, 180);
      ctx.globalAlpha = 1;
    }
    // Out-of-fuel warning.
    if (state.fuel <= 0 && !state.over) {
      ctx.textAlign = 'center';
      ctx.fillStyle = flash ? '#fecaca' : '#ef4444';
      ctx.font = 'bold 24px ' + FONT;
      ctx.fillText('OUT OF FUEL — glide to a fuel can!', FIELD.width / 2, 220);
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(18, 38, 63, 0.82)';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
  }

  function drawTitle(state, best) {
    panel(340, 150, 600, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 54px ' + FONT;
    ctx.fillText('CLOUDRUNNER', FIELD.width / 2, 220);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText('Fly the mail route. Thread the rings, mind the fuel,', FIELD.width / 2, 262);
    ctx.fillText('and bring every delivery home.', FIELD.width / 2, 290);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '17px ' + FONT;
    ctx.fillText('W / ↑ climb · S / ↓ dive · A / D throttle · Space boost', FIELD.width / 2, 336);
    ctx.fillText('Mouse or touch: the plane chases your finger · P pause · M mute', FIELD.width / 2, 362);
    ctx.fillText('8 rings finish a delivery · rings and green cans refuel · 3 hull', FIELD.width / 2, 388);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(best > 0 ? `Best score ${Math.floor(best)} — press Enter or click to fly` : 'Press Enter or click to fly', FIELD.width / 2, 448);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px ' + FONT;
    ctx.fillText('Storm clouds, birds, balloons, towers and peaks all bite.', FIELD.width / 2, 486);
  }

  function drawPaused() {
    panel(440, 250, 400, 160);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 36px ' + FONT;
    ctx.fillText('Paused', FIELD.width / 2, 310);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '18px ' + FONT;
    ctx.fillText('Press P or Enter to keep flying', FIELD.width / 2, 350);
  }

  function drawOver(state, best) {
    panel(340, 150, 600, 400);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 46px ' + FONT;
    ctx.fillText('FLIGHT OVER', FIELD.width / 2, 214);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(`Score ${Math.floor(state.score)}`, FIELD.width / 2, 268);
    ctx.font = '19px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best ${Math.floor(Math.max(best, state.score))}`, FIELD.width / 2, 300);
    ctx.fillText(`Distance ${(state.distance / 1000).toFixed(2)} km · ${state.ringsCollected} rings · ${state.level - 1} ${state.level - 1 === 1 ? 'delivery' : 'deliveries'}`, FIELD.width / 2, 332);
    ctx.fillText(state.plane.hull <= 0 ? 'The sky keeps the wreckage. The route is still yours.' : 'Out of fuel, out of sky — same route tomorrow.', FIELD.width / 2, 368);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('Press Enter or click to fly again', FIELD.width / 2, 440);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px ' + FONT;
    ctx.fillText('Tip: rings refuel you — chase the gold, not the gap.', FIELD.width / 2, 486);
  }

  function draw(state, screen, best) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ox = (canvas.width / dpr - FIELD.width * scale) / 2;
    const oy = (canvas.height / dpr - FIELD.height * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    drawSky(state);
    drawRanges(state);
    drawSceneryCloud(state);
    drawEntities(state);
    drawPlane(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) {
      drawHud(state, best);
      drawPaused();
    } else if (screen === SCREEN_OVER) {
      drawHud(state, best);
      drawOver(state, best);
    } else {
      drawHud(state, best);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw };
}
