// Cloudrunner: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. The plane sits near the left and the world scrolls past it.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The ground line: touch it and the plane crashes. */
export const GROUND_Y = 692;

export const PLANE = {
  x: 300,
  y: 330,
  radius: 16,
  /** Vertical acceleration from full climb/dive input. */
  accel: 1500,
  /** Vertical speed cap; the plane always flies forward, never backwards. */
  maxVy: 420,
  /** How fast vertical speed bleeds off when the stick is centred. */
  damping: 2.4,
  /** Forward speed at level 1, in px/s; the world scrolls at this speed. */
  baseSpeed: 230,
  speedPerLevel: 22,
  maxSpeed: 430,
  /** A/D throttle trim, in px/s. */
  throttleStep: 55,
  boostMult: 1.55,
  boostTime: 0.9,
  boostCooldown: 2.6,
  invulnerable: 1.8,
};

export const HULL = 3;

/** Rings per delivery: finish a delivery and the level rises, the sky gets faster. */
export const RINGS_PER_DELIVERY = 8;

export const FUEL = {
  max: 100,
  drain: 3.2,
  ring: 5,
  can: 26,
  /** Below this the gauge flashes and the engine note drops. */
  low: 25,
};

export const RING = {
  radius: 44,
  collectRadius: 46,
  points: 100,
  /** Seconds a ring stays "chained" to the previous one for the combo. */
  comboWindow: 4,
};

export const STAR = { radius: 11, points: 25 };
export const CAN = { radius: 14 };

export const OBSTACLE = {
  cloudRadius: 46,
  birdRadius: 14,
  balloonRadius: 34,
  towerWidth: 26,
};

export const PARTICLES = 240;
export const FLOATERS = 16;

export const PALETTE = {
  skyTop: '#7db8e8',
  skyMid: '#a8d0f0',
  skyLow: '#f6d9a8',
  sun: '#ffd76a',
  sunCore: '#fff3c4',
  farMountain: '#8fa8c8',
  nearHill: '#6f9a6a',
  ground: '#5d7a4a',
  groundTop: '#7ba05b',
  cloud: '#ffffff',
  storm: '#5b6b7d',
  stormCore: '#3d4a5c',
  plane: '#e8543f',
  planeDark: '#b93a2c',
  planeLight: '#ffd166',
  planeGlass: '#bfe8ff',
  ring: '#fbbf24',
  ringCore: '#fff7d6',
  star: '#ffe066',
  can: '#22c55e',
  canDark: '#15803d',
  bird: '#334155',
  balloon: '#ef4444',
  balloonAlt: '#3b82f6',
  tower: '#475569',
  panel: '#12263f',
  text: '#ffffff',
  muted: '#dbeafe',
  gold: '#fbbf24',
  danger: '#ef4444',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'cloudrunner.best';
