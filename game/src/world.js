// Cloudrunner's world: one fixed-step simulation. The plane holds its x and the world
// scrolls past it; the player climbs, dives and works the throttle. Rings are the job:
// fly through 8 and a delivery is complete, the level rises and the sky gets faster.
// Fuel drains the whole flight and only rings and fuel cans put it back, so a pilot who
// ignores the rings eventually glides into the ground.
import { CAN, FIELD, FUEL, GROUND_Y, HULL, OBSTACLE, PLANE, RING, RINGS_PER_DELIVERY, STAR, STEP } from './config.js';

export const EVENT_RING = 1;
export const EVENT_STAR = 2;
export const EVENT_FUEL = 4;
export const EVENT_HIT = 8;
export const EVENT_OVER = 16;
export const EVENT_LEVEL = 32;
export const EVENT_BOOST = 64;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {};
  let spawnIn = 0;
  let patternsSinceRing = 0;

  function freshPlane() {
    return {
      x: PLANE.x,
      y: PLANE.y,
      vy: 0,
      hull: HULL,
      boostTime: 0,
      boostCooldown: 0,
      invuln: 0,
    };
  }

  function reset() {
    state.plane = freshPlane();
    state.speed = PLANE.baseSpeed;
    state.throttle = 0;
    state.distance = 0;
    state.score = 0;
    state.fuel = FUEL.max;
    state.level = 1;
    state.ringsCollected = 0;
    state.ringsThisLevel = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.elapsed = 0;
    state.over = false;
    state.banner = '';
    state.bannerTimer = 0;
    state.rings = [];
    state.stars = [];
    state.cans = [];
    state.clouds = [];
    state.birds = [];
    state.balloons = [];
    state.towers = [];
    state.peaks = [];
    state.particles = [];
    state.floaters = [];
    state.scenery = [];
    for (let i = 0; i < 14; i += 1) {
      state.scenery.push({
        x: random() * FIELD.width,
        y: 40 + random() * 300,
        s: 0.5 + random() * 0.9,
        v: 12 + random() * 18,
      });
    }
    spawnIn = 200;
    patternsSinceRing = 0;
    // A friendly opening: three rings in a gentle arc, so the first seconds teach the game.
    for (let i = 0; i < 3; i += 1) {
      state.rings.push({ x: 620 + i * 150, y: 330 - Math.sin(i * 0.9) * 70, taken: false, passed: false, spin: random() * 6 });
    }
  }

  function burst(x, y, colour, n, power) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const sp = (0.3 + random() * 0.7) * power;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + random() * 0.5,
        max: 1,
        size: 2 + random() * 4,
        colour,
      });
    }
    if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  }

  function floater(x, y, text, colour) {
    state.floaters.push({ x, y, text, colour, life: 1.1, max: 1.1 });
    if (state.floaters.length > 16) state.floaters.shift();
  }

  function spawnPattern() {
    const x = FIELD.width + 90;
    const roll = random();
    const needRing = patternsSinceRing >= 3;
    if (needRing || roll < 0.34) {
      // An arc of three rings: the main way to earn, refuel and finish deliveries.
      const cy = 140 + random() * 380;
      const arc = (random() - 0.5) * 220;
      for (let i = 0; i < 3; i += 1) {
        state.rings.push({ x: x + i * 130, y: cy + Math.sin((i / 2) * Math.PI) * arc * 0.4, taken: false, passed: false, spin: random() * 6 });
      }
      patternsSinceRing = 0;
    } else if (roll < 0.44) {
      state.rings.push({ x, y: 150 + random() * 400, taken: false, passed: false, spin: random() * 6 });
      state.stars.push({ x: x + 90, y: 120 + random() * 420, taken: false, phase: random() * 6 });
      state.stars.push({ x: x + 170, y: 120 + random() * 420, taken: false, phase: random() * 6 });
      patternsSinceRing += 1;
    } else if (roll < 0.56) {
      state.clouds.push({ x, y: 110 + random() * 420, r: OBSTACLE.cloudRadius, bob: random() * 6, storm: true });
      if (random() < 0.6) state.clouds.push({ x: x + 190, y: 110 + random() * 420, r: OBSTACLE.cloudRadius, bob: random() * 6, storm: true });
      patternsSinceRing += 1;
    } else if (roll < 0.66) {
      for (let i = 0; i < 3; i += 1) {
        state.birds.push({ x: x + i * 110, y: 130 + random() * 400, phase: random() * 6, flap: random() * 6 });
      }
      patternsSinceRing += 1;
    } else if (roll < 0.74) {
      state.balloons.push({ x, y: 150 + random() * 320, bob: random() * 6, hue: random() < 0.5 ? 0 : 1 });
      patternsSinceRing += 1;
    } else if (roll < 0.82) {
      if (random() < 0.5) {
        state.towers.push({ x, h: 120 + random() * 180, w: OBSTACLE.towerWidth, blink: random() * 6 });
      } else {
        state.peaks.push({ x, w: 150 + random() * 130, h: 110 + random() * 150 });
      }
      patternsSinceRing += 1;
    } else if (roll < 0.88) {
      if (state.fuel < 72) state.cans.push({ x, y: 130 + random() * 420, taken: false, bob: random() * 6 });
      else state.stars.push({ x, y: 130 + random() * 420, taken: false, phase: random() * 6 });
      patternsSinceRing += 1;
    } else {
      state.rings.push({ x, y: 150 + random() * 400, taken: false, passed: false, spin: random() * 6 });
      patternsSinceRing = 0;
    }
    spawnIn = 170 + random() * 130;
  }

  function hitObstacle(x, y) {
    const plane = state.plane;
    if (plane.invuln > 0 || state.over) return 0;
    plane.hull -= 1;
    plane.invuln = PLANE.invulnerable;
    plane.vy = -300;
    plane.y = Math.min(plane.y, GROUND_Y - 70);
    burst(x, y, '#f97316', 26, 320);
    burst(plane.x, plane.y, '#e8543f', 18, 260);
    let events = EVENT_HIT;
    if (plane.hull <= 0) {
      state.over = true;
      events |= EVENT_OVER;
      burst(plane.x, plane.y, '#475569', 40, 420);
    }
    return events;
  }

  function step(dt, input, attract) {
    const plane = state.plane;
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (plane.invuln > 0) plane.invuln -= dt;
    if (plane.boostCooldown > 0) plane.boostCooldown -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    if (attract) {
      // Title screen: the plane cruises on its own in a lazy sine, rings and clouds drift by.
      plane.y = 330 + Math.sin(state.elapsed * 0.8) * 70;
      plane.vy = Math.cos(state.elapsed * 0.8) * 56;
      state.speed = 130;
      state.distance += state.speed * dt;
      spawnIn -= state.speed * dt;
      if (spawnIn <= 0) {
        const x = FIELD.width + 90;
        if (random() < 0.55) {
          state.rings.push({ x, y: 150 + random() * 380, taken: false, passed: false, spin: random() * 6 });
        } else {
          state.clouds.push({ x, y: 110 + random() * 420, r: OBSTACLE.cloudRadius, bob: random() * 6, storm: random() < 0.4 });
        }
        spawnIn = 220 + random() * 160;
      }
    } else {
      if (state.over) {
        // Wreckage settles: keep the world drifting a touch so the end screen is alive.
        state.speed = Math.max(0, state.speed - 300 * dt);
      } else {
        // Throttle: A/left eases off, D/right pushes on; the pointer's height steers.
        let steerY = input.y;
        if (input.pointer) {
          const dy = input.pointer.y - plane.y;
          steerY = Math.max(-1, Math.min(1, dy / 60));
        }
        const outOfFuel = state.fuel <= 0;
        if (input.boost && plane.boostCooldown <= 0 && !outOfFuel) {
          plane.boostTime = PLANE.boostTime;
          plane.boostCooldown = PLANE.boostCooldown;
          events |= EVENT_BOOST;
        }
        if (plane.boostTime > 0) plane.boostTime -= dt;
        const base = Math.min(PLANE.maxSpeed, PLANE.baseSpeed + (state.level - 1) * PLANE.speedPerLevel);
        const target = base + input.x * PLANE.throttleStep;
        state.speed = target * (plane.boostTime > 0 ? PLANE.boostMult : 1);
        if (!outOfFuel) {
          plane.vy += steerY * PLANE.accel * dt;
        } else {
          // Engine out: no climb, gravity takes the plane down.
          plane.vy += 520 * dt;
        }
        plane.vy *= Math.max(0, 1 - 1.5 * dt);
        plane.vy = Math.max(-PLANE.maxVy, Math.min(PLANE.maxVy, plane.vy));
        plane.y += plane.vy * dt;
        if (plane.y < 26) {
          plane.y = 26;
          plane.vy = Math.abs(plane.vy) * 0.3;
        }
        state.distance += state.speed * dt;
        state.score += state.speed * dt * 0.05;
        state.fuel = Math.max(0, state.fuel - FUEL.drain * (plane.boostTime > 0 ? 1.6 : 1) * dt);

        spawnIn -= state.speed * dt;
        if (spawnIn <= 0) spawnPattern();

        // --- pickups ---
        for (const ring of state.rings) {
          if (ring.taken || ring.passed) continue;
          if (Math.abs(ring.x - plane.x) < 40 && Math.abs(ring.y - plane.y) < RING.collectRadius) {
            ring.taken = true;
            state.combo += 1;
            state.comboTimer = RING.comboWindow;
            const mult = Math.min(5, state.combo);
            const pts = RING.points * mult;
            state.score += pts;
            state.fuel = Math.min(FUEL.max, state.fuel + FUEL.ring);
            state.ringsCollected += 1;
            state.ringsThisLevel += 1;
            floater(ring.x, ring.y - 30, `+${pts}${mult > 1 ? ` x${mult}` : ''}`, '#fbbf24');
            burst(ring.x, ring.y, '#fbbf24', 12, 180);
            events |= EVENT_RING;
            if (state.ringsThisLevel >= RINGS_PER_DELIVERY) {
              state.ringsThisLevel = 0;
              state.level += 1;
              state.score += 500;
              state.banner = `Delivery ${state.level - 1} complete! +500`;
              state.bannerTimer = 2.4;
              events |= EVENT_LEVEL;
            }
          } else if (ring.x < plane.x - 70) {
            ring.passed = true;
            state.combo = 0;
          }
        }
        for (const star of state.stars) {
          if (star.taken) continue;
          if (dist2(star.x, star.y, plane.x, plane.y) < (STAR.radius + PLANE.radius) ** 2) {
            star.taken = true;
            state.score += STAR.points;
            floater(star.x, star.y - 22, `+${STAR.points}`, '#ffe066');
            events |= EVENT_STAR;
          }
        }
        for (const can of state.cans) {
          if (can.taken) continue;
          if (dist2(can.x, can.y, plane.x, plane.y) < (CAN.radius + PLANE.radius) ** 2) {
            can.taken = true;
            state.fuel = Math.min(FUEL.max, state.fuel + FUEL.can);
            floater(can.x, can.y - 24, `+${FUEL.can} fuel`, '#4ade80');
            events |= EVENT_FUEL;
          }
        }

        // --- hazards ---
        for (const cloud of state.clouds) {
          if (dist2(cloud.x, cloud.y, plane.x, plane.y) < (cloud.r + PLANE.radius - 8) ** 2) {
            events |= hitObstacle(cloud.x, cloud.y);
            cloud.x = -9999;
          }
        }
        for (const bird of state.birds) {
          if (dist2(bird.x, bird.y, plane.x, plane.y) < (OBSTACLE.birdRadius + PLANE.radius) ** 2) {
            events |= hitObstacle(bird.x, bird.y);
            bird.x = -9999;
          }
        }
        for (const balloon of state.balloons) {
          if (dist2(balloon.x, balloon.y, plane.x, plane.y) < (OBSTACLE.balloonRadius + PLANE.radius - 6) ** 2) {
            events |= hitObstacle(balloon.x, balloon.y);
            balloon.x = -9999;
          }
        }
        for (const tower of state.towers) {
          if (Math.abs(tower.x - plane.x) < tower.w / 2 + PLANE.radius - 4 && plane.y > GROUND_Y - tower.h) {
            events |= hitObstacle(tower.x, plane.y);
            tower.x = -9999;
          }
        }
        for (const peak of state.peaks) {
          const dx = Math.abs(peak.x - plane.x);
          const half = peak.w / 2;
          if (dx < half) {
            const edgeY = GROUND_Y - peak.h * (1 - dx / half);
            if (plane.y + PLANE.radius - 4 > edgeY) {
              events |= hitObstacle(peak.x, edgeY);
              peak.x = -9999;
            }
          }
        }
        if (plane.y + PLANE.radius >= GROUND_Y) {
          plane.y = GROUND_Y - PLANE.radius;
          events |= hitObstacle(plane.x, GROUND_Y);
        }
        if (plane.invuln > 0 && Math.floor(state.elapsed * 20) % 2 === 0) {
          // A little smoke while the plane is recovering.
          state.particles.push({
            x: plane.x - 20, y: plane.y + 6,
            vx: -60 - random() * 40, vy: (random() - 0.5) * 30,
            life: 0.5, max: 0.5, size: 3 + random() * 3, colour: '#cbd5e1',
          });
        }
      }
    }

    // --- everything scrolls left at the flight speed ---
    const scroll = state.speed * dt;
    const move = (list) => {
      for (const e of list) e.x -= scroll;
    };
    move(state.rings);
    move(state.stars);
    move(state.cans);
    move(state.clouds);
    move(state.balloons);
    move(state.towers);
    move(state.peaks);
    for (const b of state.birds) {
      b.x -= scroll + 70 * dt;
      b.y += Math.sin(state.elapsed * 6 + b.phase) * 22 * dt;
      b.flap += dt * 10;
    }
    for (const c of state.scenery) {
      c.x -= c.v * dt * (state.over ? 0.2 : 1);
      if (c.x < -90) {
        c.x = FIELD.width + 80;
        c.y = 40 + random() * 300;
      }
    }
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - 2 * dt);
      p.vy *= Math.max(0, 1 - 2 * dt);
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floaters) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
    const drop = (list) => list.filter((e) => e.x > -160);
    state.rings = drop(state.rings).filter((r) => !r.taken);
    state.stars = drop(state.stars).filter((s) => !s.taken);
    state.cans = drop(state.cans).filter((c) => !c.taken);
    state.clouds = drop(state.clouds);
    state.birds = drop(state.birds);
    state.balloons = drop(state.balloons);
    state.towers = drop(state.towers);
    state.peaks = drop(state.peaks);
    return events;
  }

  reset();
  return { state, step, reset };
}
