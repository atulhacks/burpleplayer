import { mkdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const destination = new URL("../src/assets/lottie/", import.meta.url);

const fixed = (value) => ({ a: 0, k: value });

function animated(points) {
  const values = points.map(([t, value], index) => {
    const next = points[index + 1]?.[1];
    const start = Array.isArray(value) ? value : [value];
    const easing = {
      x: start.map(() => 0.667),
      y: start.map(() => 1),
    };
    const outgoing = {
      x: start.map(() => 0.333),
      y: start.map(() => 0),
    };
    return next === undefined
      ? { t, s: start }
      : {
          t,
          s: start,
          e: Array.isArray(next) ? next : [next],
          i: easing,
          o: outgoing,
        };
  });
  return { a: 1, k: values };
}

function color(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4]
    .map((start) => parseInt(value.slice(start, start + 2), 16) / 255)
    .concat(1);
}

function shapeTransform() {
  return {
    ty: "tr",
    p: fixed([0, 0]),
    a: fixed([0, 0]),
    s: fixed([100, 100]),
    r: fixed(0),
    o: fixed(100),
    sk: fixed(0),
    sa: fixed(0),
    nm: "Shape transform",
  };
}

function group(name, geometry, fill) {
  return {
    ty: "gr",
    nm: name,
    np: 3,
    cix: 2,
    bm: 0,
    ix: 1,
    it: [
      geometry,
      {
        ty: "fl",
        c: fixed(color(fill)),
        o: fixed(100),
        r: 1,
        bm: 0,
        nm: `${name} fill`,
      },
      shapeTransform(),
    ],
  };
}

function rectangle(width, height, radius = 0) {
  return {
    ty: "rc",
    d: 1,
    p: fixed([0, 0]),
    s: fixed([width, height]),
    r: fixed(radius),
    nm: "Rectangle",
  };
}

function ellipse(width, height) {
  return {
    ty: "el",
    d: 1,
    p: fixed([0, 0]),
    s: fixed([width, height]),
    nm: "Ellipse",
  };
}

function polygon(points) {
  return {
    ty: "sh",
    ks: fixed({
      i: points.map(() => [0, 0]),
      o: points.map(() => [0, 0]),
      v: points,
      c: true,
    }),
    nm: "Path",
  };
}

function layer(name, geometry, fill, position, options = {}) {
  const { frames = 45, scale = 100, rotation = 0, opacity = 100 } = options;
  return {
    ddd: 0,
    ind: 0,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: Array.isArray(opacity) ? animated(opacity) : fixed(opacity),
      r: Array.isArray(rotation) ? animated(rotation) : fixed(rotation),
      p: Array.isArray(position[0])
        ? animated(position)
        : fixed([...position, 0]),
      a: fixed([0, 0, 0]),
      s: Array.isArray(scale) ? animated(scale) : fixed([scale, scale, 100]),
    },
    ao: 0,
    shapes: [group(name, geometry, fill)],
    ip: 0,
    op: frames,
    st: 0,
    bm: 0,
  };
}

function animation(name, width, height, frames, layers) {
  return {
    v: "5.12.2",
    fr: 30,
    ip: 0,
    op: frames,
    w: width,
    h: height,
    nm: name,
    ddd: 0,
    assets: [],
    layers: layers.map((item, index) => ({ ...item, ind: index + 1 })),
    markers: [],
  };
}

const heartPath = polygon([
  [0, -11],
  [-12, -24],
  [-28, -22],
  [-34, -9],
  [-31, 7],
  [0, 35],
  [31, 7],
  [34, -9],
  [28, -22],
  [12, -24],
]);
const heartLayers = [
  layer("Clay heart", heartPath, "#d94988", [60, 59], {
    frames: 48,
    scale: [
      [0, [25, 25, 100]],
      [9, [122, 122, 100]],
      [16, [100, 100, 100]],
      [33, [104, 104, 100]],
      [47, [45, 45, 100]],
    ],
    opacity: [
      [0, 0],
      [5, 100],
      [31, 100],
      [47, 0],
    ],
  }),
];
for (let index = 0; index < 8; index += 1) {
  const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
  const radius = index % 2 ? 51 : 43;
  const x = 60 + Math.cos(angle) * radius;
  const y = 60 + Math.sin(angle) * radius;
  heartLayers.push(
    layer(
      `Heart sparkle ${index + 1}`,
      index % 2 ? ellipse(8, 8) : rectangle(7, 7, 1),
      ["#ffda51", "#8060d9", "#4fbde9", "#ef82af"][index % 4],
      [
        [0, [60, 59, 0]],
        [7, [60, 59, 0]],
        [26, [x, y, 0]],
        [47, [x + (x - 60) * 0.18, y + (y - 60) * 0.18, 0]],
      ],
      {
        frames: 48,
        opacity: [
          [0, 0],
          [7, 0],
          [11, 100],
          [30, 100],
          [47, 0],
        ],
        rotation: [
          [0, 0],
          [47, index % 2 ? 70 : -70],
        ],
      },
    ),
  );
}

const confettiLayers = [];
for (let index = 0; index < 13; index += 1) {
  const angle = (Math.PI * 2 * index) / 13 - Math.PI / 2;
  const radius = 32 + (index % 3) * 18;
  const x = 80 + Math.cos(angle) * radius;
  const y = 72 + Math.sin(angle) * radius + 25;
  confettiLayers.push(
    layer(
      `Confetti cube ${index + 1}`,
      rectangle(9 + (index % 3) * 3, 9 + (index % 3) * 3, 2),
      ["#8060d9", "#4fbde9", "#ef82af", "#8edc6a", "#ffda51", "#ed6756"][
        index % 6
      ],
      [
        [0, [80, 72, 0]],
        [5, [80, 72, 0]],
        [28, [x, y - 19, 0]],
        [51, [x + Math.cos(angle) * 17, y + 17, 0]],
      ],
      {
        frames: 52,
        opacity: [
          [0, 0],
          [6, 100],
          [31, 100],
          [51, 0],
        ],
        rotation: [
          [0, 0],
          [51, (index % 2 ? -1 : 1) * (90 + index * 12)],
        ],
      },
    ),
  );
}

const bob = (x, y) => [
  [0, [x, y, 0]],
  [30, [x, y - 5, 0]],
  [60, [x, y, 0]],
];
const emptyLayers = [
  layer("Console shell", rectangle(66, 84, 10), "#f4a090", bob(75, 76), {
    frames: 60,
  }),
  layer("LCD bezel", rectangle(53, 48, 5), "#5b3a7a", bob(75, 62), {
    frames: 60,
  }),
  layer("LCD screen", rectangle(43, 38, 2), "#4fb3e8", bob(75, 62), {
    frames: 60,
  }),
  layer("Left eye", rectangle(5, 8, 1), "#312052", bob(65, 58), { frames: 60 }),
  layer("Right eye", rectangle(5, 8, 1), "#312052", bob(86, 58), {
    frames: 60,
  }),
  layer("Smile", rectangle(18, 4, 1), "#312052", bob(75, 72), { frames: 60 }),
  layer("D-pad stem", rectangle(7, 21, 1), "#312052", bob(61, 98), {
    frames: 60,
  }),
  layer("D-pad bar", rectangle(21, 7, 1), "#312052", bob(61, 98), {
    frames: 60,
  }),
  layer("A button", ellipse(8, 8), "#7b1f5e", bob(85, 96), { frames: 60 }),
  layer("B button", ellipse(8, 8), "#7b1f5e", bob(97, 92), { frames: 60 }),
];

const scanLayers = [
  layer("Cloud left", ellipse(48, 28), "#fffaf3", [41, 63], { frames: 60 }),
  layer("Cloud center", ellipse(54, 42), "#fffaf3", [80, 50], { frames: 60 }),
  layer("Cloud right", ellipse(48, 29), "#fffaf3", [116, 63], { frames: 60 }),
];
for (let index = 0; index < 4; index += 1) {
  scanLayers.push(
    layer(
      `Scanning cube ${index + 1}`,
      rectangle(13, 13, 2),
      ["#8060d9", "#4fbde9", "#ef82af", "#8edc6a"][index],
      [
        [0, [-15 - index * 22, 93 - index * 3, 0]],
        [59, [175 - index * 22, 93 - index * 3, 0]],
      ],
      {
        frames: 60,
        rotation: [
          [0, 0],
          [59, 90],
        ],
      },
    ),
  );
}

await mkdir(destination, { recursive: true });
for (const [filename, data] of [
  [
    "heart-burst.json",
    animation("Burple heart burst", 120, 120, 48, heartLayers),
  ],
  [
    "confetti-cubes.json",
    animation("Burple confetti cubes", 160, 150, 52, confettiLayers),
  ],
  [
    "empty-library.json",
    animation("Burple empty library", 150, 150, 60, emptyLayers),
  ],
  [
    "scanning-cloud.json",
    animation("Burple scanning cloud", 160, 120, 60, scanLayers),
  ],
]) {
  await writeFile(
    new URL(filename, destination),
    `${JSON.stringify(data, null, 2)}\n`,
  );
}
