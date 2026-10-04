import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import heartBurst from "../../assets/lottie/heart-burst.json";
import confettiCubes from "../../assets/lottie/confetti-cubes.json";
import emptyLibrary from "../../assets/lottie/empty-library.json";
import scanningCloud from "../../assets/lottie/scanning-cloud.json";
import { lottiePathData, sampleLottieValue } from "../../lib/lottieFrame";
import type { AnimatedValue, PathValue } from "../../lib/lottieFrame";
import { useAppStore } from "../../store/appStore";
import "./LottieArt.css";

type Shape = {
  ty: string;
  p?: AnimatedValue;
  s?: AnimatedValue;
  r?: AnimatedValue;
  ks?: { a: number; k: PathValue };
  c?: AnimatedValue;
  it?: Shape[];
};
type Layer = {
  nm: string;
  ks: {
    o: AnimatedValue;
    r: AnimatedValue;
    p: AnimatedValue;
    s: AnimatedValue;
  };
  shapes: Shape[];
};
type AnimationData = {
  nm: string;
  fr: number;
  op: number;
  w: number;
  h: number;
  layers: Layer[];
};

export type LottieKind = "heart" | "confetti" | "empty" | "scanning";

const animations: Record<LottieKind, AnimationData> = {
  heart: heartBurst as unknown as AnimationData,
  confetti: confettiCubes as unknown as AnimationData,
  empty: emptyLibrary as unknown as AnimationData,
  scanning: scanningCloud as unknown as AnimationData,
};

function ShapeGraphic({ shape }: { shape: Shape }) {
  const group = shape.it;
  if (!group) return null;
  const geometry = group.find(
    (item) => item.ty === "rc" || item.ty === "el" || item.ty === "sh",
  );
  const fill = group.find((item) => item.ty === "fl");
  if (!geometry || !fill?.c) return null;
  const rgba = sampleLottieValue(fill.c, 0);
  const color = `rgb(${Math.round(rgba[0] * 255)} ${Math.round(rgba[1] * 255)} ${Math.round(rgba[2] * 255)})`;
  if (geometry.ty === "rc" && geometry.s && geometry.r) {
    const [width, height] = sampleLottieValue(geometry.s, 0);
    const radius = sampleLottieValue(geometry.r, 0)[0];
    return (
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={radius}
        fill={color}
      />
    );
  }
  if (geometry.ty === "el" && geometry.s) {
    const [width, height] = sampleLottieValue(geometry.s, 0);
    return <ellipse rx={width / 2} ry={height / 2} fill={color} />;
  }
  if (geometry.ty === "sh" && geometry.ks) {
    return <path d={lottiePathData(geometry.ks.k)} fill={color} />;
  }
  return null;
}

export function LottieArt({
  kind,
  loop = false,
  paused = false,
  onComplete,
  className = "",
}: {
  kind: LottieKind;
  loop?: boolean;
  paused?: boolean;
  onComplete?: () => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const elapsedRef = useRef(0);
  const kindRef = useRef(kind);
  if (kindRef.current !== kind) {
    kindRef.current = kind;
    elapsedRef.current = 0;
  }
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const data = animations[kind];

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const nodes = Array.from(
      svg.querySelectorAll<SVGGElement>("[data-lottie-layer]"),
    );
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let preference = useAppStore.getState().motionPreference;
    let lastFrame = -1;
    let attached = false;
    let finished = false;

    function draw(frame: number) {
      if (frame === lastFrame) return;
      lastFrame = frame;
      data.layers.forEach((layer, index) => {
        const node = nodes[index];
        const [x, y] = sampleLottieValue(layer.ks.p, frame);
        const [sx, sy] = sampleLottieValue(layer.ks.s, frame);
        const rotation = sampleLottieValue(layer.ks.r, frame)[0];
        const opacity = sampleLottieValue(layer.ks.o, frame)[0] / 100;
        node.setAttribute(
          "transform",
          `translate(${x} ${y}) rotate(${rotation}) scale(${sx / 100} ${sy / 100})`,
        );
        node.style.opacity = String(opacity);
      });
    }

    function tick(_time: number, deltaTime: number) {
      elapsedRef.current += Math.min(deltaTime / 1000, 0.05);
      const raw = Math.floor(elapsedRef.current * data.fr);
      const frame = loop ? raw % data.op : Math.min(data.op - 1, raw);
      draw(frame);
      if (!loop && raw >= data.op && !finished) {
        finished = true;
        gsap.ticker.remove(tick);
        attached = false;
        onCompleteRef.current?.();
      }
    }

    function sync() {
      const reduced =
        preference === "reduced" || (preference === "system" && media.matches);
      const shouldRun = !reduced && !paused && !document.hidden && !finished;
      if (shouldRun && !attached) {
        gsap.ticker.add(tick);
        attached = true;
      } else if (!shouldRun && attached) {
        gsap.ticker.remove(tick);
        attached = false;
      }
      if (reduced)
        draw(
          kind === "heart" || kind === "confetti"
            ? Math.floor(data.op * 0.3)
            : 0,
        );
    }

    const unsubscribe = useAppStore.subscribe((state) => {
      preference = state.motionPreference;
      sync();
    });
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    const initialFrame = Math.floor(elapsedRef.current * data.fr);
    draw(loop ? initialFrame % data.op : Math.min(data.op - 1, initialFrame));
    sync();
    return () => {
      if (attached) gsap.ticker.remove(tick);
      unsubscribe();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [data, kind, loop, paused]);

  return (
    <svg
      ref={svgRef}
      className={`lottie-art lottie-art--${kind} ${className}`.trim()}
      viewBox={`0 0 ${data.w} ${data.h}`}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {data.layers.map((layer, index) => (
        <g key={`${layer.nm}-${index}`} data-lottie-layer={index}>
          {layer.shapes.map((shape, shapeIndex) => (
            <ShapeGraphic key={shapeIndex} shape={shape} />
          ))}
        </g>
      ))}
    </svg>
  );
}
