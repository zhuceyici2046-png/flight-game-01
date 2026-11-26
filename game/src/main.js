// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the ring and hazard pattern. ?shot=start|play|mid|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady.
import { BEST_KEY, FIELD, HULL, PLANE, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BOOST,
  EVENT_FUEL,
  EVENT_HIT,
  EVENT_LEVEL,
  EVENT_OVER,
  EVENT_RING,
  EVENT_STAR,
} from './world.js';
import { ACTION_BOOST, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Pointer position in client pixels -> field coordinates, honouring the letterbox. */
function pointerToField(pointer) {
  if (!pointer) return null;
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
  const ox = (rect.width - FIELD.width * scale) / 2;
  const oy = (rect.height - FIELD.height * scale) / 2;
  return { x: (pointer.x - rect.left - ox) / scale, y: (pointer.y - rect.top - oy) / scale };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Flying. ${HULL} hull. Thread ${8} rings to finish delivery 1.`);
  }

  function finish(score) {
    if (score > best) {
      best = score;
      saveBest(best);
    }
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.engineOff();
    finish(world.state.score);
    announce(`Flight over. Score ${Math.floor(world.state.score)}. Best ${best}.`);
  }

  // Actions are taken exactly once per frame, here, and handed to both handlers: the
  // boost flag must survive until step() runs, so nothing else may take actions.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.engineOff();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, boost: false, pointer: null }, true);
      return;
    }
    const keys = input.keysVector();
    const events = world.step(STEP, {
      x: keys.x, y: keys.y, boost: Boolean(actions & ACTION_BOOST), pointer: pointerToField(input.pointer()),
    }, false);
    const speedNorm = Math.max(0, Math.min(1, (world.state.speed - PLANE.baseSpeed) / (PLANE.maxSpeed - PLANE.baseSpeed)));
    audio.engine(speedNorm, world.state.fuel);
    if (events & EVENT_RING) audio.ring(Math.min(5, world.state.combo));
    if (events & EVENT_STAR) audio.star();
    if (events & EVENT_FUEL) audio.fuel();
    if (events & EVENT_BOOST) audio.boost();
    if (events & EVENT_LEVEL) {
      audio.delivery();
      announce(`Delivery ${world.state.level - 1} complete. Level ${world.state.level}, faster sky.`);
    }
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.plane.hull === 1 ? 'Hit. 1 hull left.' : `Hit. ${world.state.plane.hull} hull left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.engineOff();
      announce('Paused.');
    }
  });

  announce('Cloudrunner. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
