// Level data in grid cells (160 x 100, origin bottom-left, y up).
// terrain rects are [x0, y0, x1, y1) ; door/kit positions are bottom-left/bottom-center in cells.
export const LEVELS = [
  {
    id: 'gap', name: 'I. The Gap', hands: 1,
    hint: 'Kit only walks on shadow. Lay your hand flat to make a bridge.',
    terrain: [[0, 0, 52, 34], [108, 0, 160, 34]],
    kit: { x: 14, y: 34, dir: 1 }, door: { x: 146, y: 34 },
    fireflies: [[32, 39], [80, 39], [126, 39]],
    decor: { moon: [124, 78], hills: true },
  },
  {
    id: 'lift', name: 'II. The Lift', hands: 1,
    hint: 'Slide your shadow under Kit, then raise your hand. You are the elevator.',
    terrain: [[0, 0, 160, 14], [112, 0, 160, 58]],
    kit: { x: 10, y: 14, dir: 1 }, door: { x: 144, y: 58 },
    fireflies: [[60, 19], [96, 52], [128, 63]],
    decor: { moon: [30, 80], hills: true },
  },
  {
    id: 'embers', name: 'III. Ember Rain', hands: 1,
    hint: 'Embers burn paper. Hold your hand above Kit like an umbrella.',
    terrain: [[0, 0, 160, 14]],
    kit: { x: 8, y: 14, dir: 1 }, door: { x: 148, y: 14 },
    fireflies: [[52, 19], [86, 19], [120, 19]],
    embers: { x0: 36, x1: 128, rate: 10 },
    decor: { moon: null, hills: false, clouds: true },
  },
  {
    id: 'turn', name: 'IV. Turnabout', hands: 2,
    hint: 'Raise a shadow wall to turn Kit around. Two hands help.',
    terrain: [[0, 0, 100, 10], [130, 0, 160, 10], [0, 10, 40, 32]],
    kit: { x: 58, y: 10, dir: 1 }, door: { x: 16, y: 32 },
    fireflies: [[80, 15], [115, 16], [52, 30]],
    decor: { moon: [80, 82], hills: true },
  },
  {
    id: 'home', name: 'V. The Long Way Home', hands: 2,
    hint: 'Everything you have learned. Bridge, shelter, lift.',
    terrain: [[0, 0, 30, 42], [64, 0, 108, 20], [128, 0, 160, 56]],
    kit: { x: 8, y: 42, dir: 1 }, door: { x: 146, y: 56 },
    fireflies: [[47, 47], [86, 25], [118, 54]],
    embers: { x0: 72, x1: 106, rate: 8 },
    decor: { moon: [60, 84], hills: true, clouds: true },
  },
];

export const HARP = { id: 'harp', name: 'Shadow Harp', strings: 8 };
