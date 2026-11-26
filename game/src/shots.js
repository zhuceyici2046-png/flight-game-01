// The screenshot scenes behind ?shot=start|play|mid|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the nearest ring, keep clear of what is close ahead), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { FIELD, GROUND_Y, PLANE, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const MID_SECONDS = 48;
const END_LIMIT_SECONDS = 600;

/** Steer toward the nearest ring, with a shove away from any hazard close ahead. */
function autopilot(state, careless) {
  const plane = state.plane;
  let targetY = plane.y;
  let ring = null;
  let bestD = Infinity;
  for (const r of state.rings) {
    if (r.taken || r.passed || r.x < plane.x) continue;
    const d = r.x - plane.x;
    if (d < bestD) {
      bestD = d;
      ring = r;
    }
  }
  if (ring) targetY = ring.y;
  let steer = Math.max(-1, Math.min(1, (targetY - plane.y) / 60));
  if (!careless) {
    // Hazards ahead in our band push us the other way.
    const ahead = (list, radius) => {
      for (const e of list) {
        const dx = e.x - plane.x;
        if (dx > 0 && dx < 260 && Math.abs(e.y - plane.y) < radius) {
          return e.y > plane.y ? -1 : 1;
        }
      }
      return 0;
    };
    let dodge = ahead(state.clouds, 90) || ahead(state.balloons, 80) || ahead(state.birds, 60);
    if (dodge !== 0) steer = dodge;
    // Towers and peaks: climb if one is close ahead and we are low.
    for (const t of state.towers) {
      const dx = t.x - plane.x;
      if (dx > 0 && dx < 280 && plane.y > GROUND_Y - t.h - 40) steer = -1;
    }
    for (const p of state.peaks) {
      const dx = p.x - plane.x;
      if (dx > 0 && dx < 280 && plane.y > GROUND_Y - p.h - 30) steer = -1;
    }
    // Never dive into the ground.
    if (plane.y > GROUND_Y - 130) steer = -1;
    // Stay out of the ceiling.
    if (plane.y < 80) steer = 1;
  }
  return { x: 0, y: steer, boost: false, pointer: null };
}

/**
 * Set `world` to the named scene (start, play, mid or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'mid' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, boost: false, pointer: null }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const seconds = name === 'end' ? END_LIMIT_SECONDS : name === 'mid' ? MID_SECONDS : PLAY_SECONDS;
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    // The end scene flies well for 30 seconds, then gets careless and is caught out,
    // as a hurried player is: it must end on the game-over screen, with a real score.
    const careless = name === 'end' && world.state.elapsed > 30;
    events = world.step(STEP, autopilot(world.state, careless), false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.over;
  return {
    screen: over ? SCREEN_OVER : SCREEN_PLAY,
    best: world.state.score,
  };
}
