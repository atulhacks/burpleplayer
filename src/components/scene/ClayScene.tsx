import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cubeColorForTrack, fallbackCubeColor } from "../../lib/artPalette";
import { LCD_ASCII_ROWS } from "../../lib/ascii";
import {
  armBoneMatrix,
  swingArmBones,
  SWING_GRIPS,
} from "../../lib/swingGeometry";
import type { Track } from "../../lib/playerApi";
import { useAppStore } from "../../store/appStore";
import { usePlayerStore } from "../../store/playerStore";
import { useSceneMotion } from "./useSceneMotion";
import "./ClayScene.css";

type CloudProps = {
  x: number;
  y: number;
  scale?: number;
  foreground?: boolean;
  flip?: boolean;
};

type CubeColor = "blue" | "purple" | "pink" | "green" | "yellow" | "red";

type CubeProps = {
  x: number;
  y: number;
  size: number;
  color: CubeColor;
  rotate?: number;
  face?: string;
};

function Cloud({
  x,
  y,
  scale = 1,
  foreground = false,
  flip = false,
}: CloudProps) {
  return (
    <g
      className={foreground ? "cloud cloud--foreground" : "cloud"}
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}
    >
      <ellipse cx="0" cy="21" rx="128" ry="47" fill="url(#cloud-soft-shadow)" />
      <ellipse cx="-54" cy="20" rx="73" ry="67" fill="url(#cloud-gradient)" />
      <circle cx="-19" cy="-28" r="67" fill="url(#cloud-gradient)" />
      <circle cx="56" cy="13" r="62" fill="url(#cloud-gradient)" />
      <ellipse cx="-2" cy="35" rx="85" ry="51" fill="url(#cloud-gradient)" />
      <path
        d="M-113 13c22-21 38-21 52-4M-35-62c26-19 60-3 74 24"
        fill="none"
        stroke="var(--cloud-highlight)"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.37"
      />
    </g>
  );
}

function Cube({ x, y, size, color, rotate = 0, face }: CubeProps) {
  return (
    <g
      className={`scene-cube scene-cube--${color}`}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size / 70})`}
      style={face ? ({ "--cube-face": face } as CSSProperties) : undefined}
    >
      <ellipse
        cx="17"
        cy="78"
        rx="46"
        ry="11"
        fill="var(--ground-shadow)"
        opacity="0.28"
        filter="url(#ground-soft)"
      />
      <path d="M-30-25 20-34 43-22-7-10Z" className="cube-top" />
      <path d="M-7-10 43-22 43 36-7 48Z" className="cube-side" />
      <path d="M-30-25-7-10-7 48-30 31Z" className="cube-front" />
      <path
        d="M-26-20-12-12v50"
        fill="none"
        stroke="var(--cloud-highlight)"
        strokeWidth="3"
        opacity="0.46"
        strokeLinecap="round"
      />
    </g>
  );
}

function Pillars() {
  return (
    <g className="pillars" aria-hidden="true">
      <g data-pillar="left">
        <ellipse
          cx="190"
          cy="1205"
          rx="169"
          ry="36"
          fill="var(--ground-shadow)"
          opacity="0.31"
          filter="url(#ground-soft)"
        />
        <path d="M35 1190h309v43H51q-16 0-16-16Z" fill="url(#base-gradient)" />

        <rect
          x="81"
          y="708"
          width="218"
          height="494"
          rx="24"
          fill="url(#lavender-gradient)"
        />
        <path
          d="M94 721c18-8 30-9 45-7v477H98q-17 0-17-18V746q0-18 13-25Z"
          fill="var(--pillar-left-highlight)"
          opacity="0.34"
        />
        <path
          d="M270 724q26 0 29 25v420q-3 26-29 30Z"
          fill="var(--pillar-left-shadow)"
          opacity="0.22"
        />
        <rect
          x="81"
          y="603"
          width="218"
          height="108"
          rx="22"
          fill="url(#green-gradient)"
        />
        <path
          d="M88 622q16-21 48-17h147q-25 9-30 26l-1 77H99q-19-3-18-24v-53Z"
          fill="var(--cloud-highlight)"
          opacity="0.21"
        />
        <rect
          x="80"
          y="61"
          width="218"
          height="541"
          rx="34"
          fill="url(#lavender-gradient)"
        />
        <path
          d="M86 104q10-34 54-39h114q-28 8-36 43v491H104q-24 0-24-25V130q0-17 6-26Z"
          fill="var(--pillar-left-highlight)"
          opacity="0.25"
        />
        <path
          d="M270 74q28 7 28 37v448q-4 31-28 42Z"
          fill="var(--pillar-left-shadow)"
          opacity="0.27"
        />
        <ellipse
          cx="137"
          cy="77"
          rx="9"
          ry="14"
          fill="var(--cloud-highlight)"
          opacity="0.8"
          filter="url(#sparkle-soft)"
        />
      </g>

      <g data-pillar="right">
        <ellipse
          cx="924"
          cy="1177"
          rx="157"
          ry="35"
          fill="var(--ground-shadow)"
          opacity="0.31"
          filter="url(#ground-soft)"
        />
        <path
          d="M783 1146h291v54H811q-28 0-28-19Z"
          fill="url(#base-gradient)"
        />

        <rect
          x="829"
          y="709"
          width="215"
          height="454"
          rx="24"
          fill="url(#coral-gradient)"
        />
        <path
          d="M842 725q19-12 42-11v442h-31q-24-3-24-25V752q0-18 13-27Z"
          fill="var(--pillar-right-highlight)"
          opacity="0.34"
        />
        <path
          d="M1014 719q30 7 30 32v381q-2 24-30 29Z"
          fill="var(--pillar-right-shadow)"
          opacity="0.18"
        />
        <rect
          x="829"
          y="608"
          width="215"
          height="105"
          rx="22"
          fill="url(#green-gradient)"
        />
        <path
          d="M838 625q19-15 50-14h148q-24 10-29 34v65H853q-24-2-24-25v-39q0-15 9-21Z"
          fill="var(--cloud-highlight)"
          opacity="0.19"
        />
        <rect
          x="829"
          y="124"
          width="215"
          height="485"
          rx="35"
          fill="url(#coral-gradient)"
        />
        <path
          d="M837 170q13-32 53-43h104q-28 11-35 42v434H851q-22 0-22-25V194q0-15 8-24Z"
          fill="var(--pillar-right-highlight)"
          opacity="0.25"
        />
        <path
          d="M1015 135q29 8 29 37v397q-3 26-29 37Z"
          fill="var(--pillar-right-shadow)"
          opacity="0.23"
        />
        <ellipse
          cx="907"
          cy="138"
          rx="7"
          ry="11"
          fill="var(--cloud-highlight)"
          opacity="0.65"
          filter="url(#sparkle-soft)"
        />
      </g>

      <g transform="translate(58 718) rotate(-14)">
        <rect
          x="-34"
          y="-34"
          width="70"
          height="71"
          rx="6"
          fill="url(#purple-gradient)"
        />
        <path
          d="M-29-29 24-34"
          stroke="var(--cloud-highlight)"
          strokeWidth="5"
          opacity="0.35"
        />
      </g>
      <g transform="translate(1072 799) rotate(30)">
        <rect
          x="-35"
          y="-34"
          width="69"
          height="68"
          rx="7"
          fill="url(#red-gradient)"
        />
        <path
          d="M-29-29 24-34"
          stroke="var(--cloud-highlight)"
          strokeWidth="5"
          opacity="0.35"
        />
      </g>
    </g>
  );
}

function Rope({ x, top }: { x: number; top: number }) {
  return (
    <g className="rope" data-swing-rope={x} aria-hidden="true">
      <path
        d={`M${x} ${top - 10}V880`}
        stroke="var(--rope-shadow)"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d={`M${x - 2} ${top - 10}V880`}
        stroke="url(#rope-gradient)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {Array.from({ length: 47 }, (_, index) => {
        const y = top + 10 + index * 13;
        return y < 873 ? (
          <path
            key={index}
            d={`M${x - 7} ${y + 6}l13-9`}
            stroke="var(--rope-weave)"
            strokeWidth="2"
            opacity="0.72"
          />
        ) : null;
      })}
    </g>
  );
}

function SwingArms() {
  return (
    <g aria-hidden="true">
      {swingArmBones(0, 0).map((bone, index) => (
        <g
          key={index}
          data-arm-bone={index}
          style={{ transform: armBoneMatrix(bone), transformOrigin: "0 0" }}
        >
          <path
            d="M0 0V100"
            fill="none"
            stroke="var(--arm-shadow)"
            strokeWidth="33"
            strokeLinecap="round"
          />
          <path
            d="M0 0V100"
            fill="none"
            stroke="url(#arm-gradient)"
            strokeWidth="28"
            strokeLinecap="round"
          />
          <path
            d="M-6 5V95"
            fill="none"
            stroke="var(--arm-highlight)"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.45"
          />
        </g>
      ))}
    </g>
  );
}

function RopeGrip({ side }: { side: keyof typeof SWING_GRIPS }) {
  const { x, gripY: y } = SWING_GRIPS[side];
  const direction = side === "left" ? 1 : -1;
  return (
    <g data-swing-grip={x} aria-hidden="true">
      <g transform={`translate(${x} ${y}) scale(${direction} 1)`}>
        <rect
          x="-17"
          y="19"
          width="34"
          height="15"
          rx="7"
          fill="var(--glove-outline)"
        />
        <path
          d="M-19-26q-18 1-18 24v11q0 20 20 24h24q19-4 20-24v-17q-2-22-21-23Z"
          fill="url(#glove-gradient)"
          stroke="var(--glove-outline)"
          strokeWidth="3"
        />
        <path
          d="M-17-23q-12 2-13 15"
          fill="none"
          stroke="var(--glove-highlight)"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.65"
        />
        {[-12, 0, 12].map((fingerY) => (
          <path
            key={fingerY}
            d={`M-5 ${fingerY}q14-5 26 0`}
            fill="none"
            stroke="var(--glove-outline)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.58"
          />
        ))}
        <path
          d="M-17 10q-7-12 0-19q6-4 13 4l9 13q3 9-5 13q-10 4-17-11Z"
          fill="url(#glove-gradient)"
          stroke="var(--glove-outline)"
          strokeWidth="3"
        />
      </g>
    </g>
  );
}

function SwingRing({
  x,
  top,
  rear = false,
}: {
  x: number;
  top: number;
  rear?: boolean;
}) {
  const cy = top - 52;
  const arc = `M${x} ${cy - 33}a19 33 0 0 1 0 66`;
  return (
    <g aria-hidden="true" data-ring-side={rear ? "rear" : "front"}>
      {rear ? (
        <ellipse
          cx={x}
          cy={cy}
          rx="19"
          ry="33"
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth="14"
        />
      ) : (
        <>
          <path
            d={arc}
            fill="none"
            stroke="var(--ring-shadow)"
            strokeWidth="15"
          />
          <path
            d={arc}
            fill="none"
            stroke="url(#ring-gradient)"
            strokeWidth="11"
          />
          <path
            d={`M${x + 3} ${cy - 31}a16 31 0 0 1 12 12`}
            fill="none"
            stroke="var(--ring-light)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

function PixelEye({ x, sleepy = false }: { x: number; sleepy?: boolean }) {
  return (
    <path
      d={
        sleepy
          ? `M${x + 1} 622h22v5h-22Z`
          : `M${x + 5} 610h12v4h4v18h-4v4h-12v-4h-4v-18h4Z`
      }
      fill="var(--lcd-ink)"
      shapeRendering="crispEdges"
    />
  );
}

function lcdText(value: string, max = 15): string {
  const letters = Array.from(value.trim());
  return letters.length > max
    ? `${letters.slice(0, max - 1).join("")}…`
    : value;
}

function lcdClock(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function LcdDisplay({
  bars,
  ascii,
}: {
  bars: React.RefObject<(SVGRectElement | null)[]>;
  ascii: React.RefObject<(SVGTextElement | null)[]>;
}) {
  const track = usePlayerStore((state) => state.playback.track);
  const positionMs = usePlayerStore((state) => state.playback.positionMs);
  const playing = usePlayerStore((state) => state.playback.playing);
  const status = usePlayerStore((state) => state.status);
  const error = usePlayerStore((state) => state.error);
  const visualizerMode = useAppStore((state) => state.visualizerMode);
  const face = error
    ? "error"
    : status === "loading" || status === "scanning"
      ? "loading"
      : !track
        ? "idle"
        : playing
          ? "playing"
          : "paused";
  const asciiActive =
    visualizerMode === "ascii" &&
    !!track &&
    face !== "error" &&
    face !== "loading";

  return (
    <g clipPath="url(#lcd-clip)">
      {track && (
        <>
          <text
            x="591"
            y="585"
            textAnchor="middle"
            className="lcd-copy lcd-copy--title"
          >
            {lcdText(track.title, 16)}
          </text>
          <text
            x="591"
            y="598"
            textAnchor="middle"
            className="lcd-copy lcd-copy--artist"
          >
            {lcdText(track.artist, 19)}
          </text>
        </>
      )}
      <g data-motion-face opacity={asciiActive ? 0 : 1}>
        <g data-motion-eyes>
          {face === "error" ? (
            <>
              <path
                d="M546 613l19 18m0-18-19 18M612 613l19 18m0-18-19 18"
                stroke="var(--lcd-ink)"
                strokeWidth="5"
              />
            </>
          ) : face === "loading" ? (
            <>
              <rect
                x="548"
                y="618"
                width="14"
                height="14"
                fill="var(--lcd-ink)"
              />
              <rect
                x="613"
                y="618"
                width="14"
                height="14"
                fill="var(--lcd-ink)"
                opacity="0.55"
              />
            </>
          ) : (
            <>
              <PixelEye x={543} sleepy={face === "paused"} />
              <PixelEye x={609} sleepy={face === "paused"} />
            </>
          )}
        </g>
        <path
          d={
            face === "error"
              ? "M558 654h14v-5h14v5h15v-5h14v5h8v6h-65Z"
              : face === "loading"
                ? "M565 650h52v6h-52Z"
                : face === "paused"
                  ? "M565 653h52v5h-52Z"
                  : face === "playing"
                    ? "M559 652h11v10h41v-10h11v10h-10v12h-42v-12h-11Z"
                    : "M559 655h11v6h41v-6h11v8h-63Z"
          }
          fill="var(--lcd-ink)"
          shapeRendering="crispEdges"
          transform="translate(0 -19)"
        />
      </g>
      {track && (
        <text
          x="591"
          y="670"
          textAnchor="middle"
          className="lcd-copy lcd-copy--time"
        >
          {lcdClock(positionMs)} / {lcdClock(track.durationMs)}
        </text>
      )}
      {Array.from({ length: 16 }, (_, index) => (
        <rect
          key={index}
          className="lcd-spectrum-bar"
          ref={(element) => {
            bars.current[index] = element;
          }}
          x={529 + index * 7.6}
          y="683"
          width="5"
          height="13"
          rx="0.5"
          fill="var(--lcd-ink)"
          opacity={asciiActive ? 0 : track ? 0.88 : 0.28}
        />
      ))}
      <g opacity={asciiActive ? 0.88 : 0}>
        {Array.from({ length: LCD_ASCII_ROWS }, (_, index) => (
          <text
            key={index}
            ref={(element) => {
              ascii.current[index] = element;
            }}
            x="532"
            y={612 + index * 8}
            className="lcd-copy lcd-copy--ascii"
            xmlSpace="preserve"
          >
            {" ".repeat(20)}
          </text>
        ))}
      </g>
    </g>
  );
}

function Player({
  bars,
  ascii,
}: {
  bars: React.RefObject<(SVGRectElement | null)[]>;
  ascii: React.RefObject<(SVGTextElement | null)[]>;
}) {
  return (
    <g className="player" aria-hidden="true">
      <path
        d="M423 853q-12 4-13 25v21h57v-17q-2-24-19-29Z"
        fill="url(#shell-gradient)"
      />
      <path
        d="M704 850q-15 4-16 29v22h54v-26q-5-23-18-26Z"
        fill="url(#shell-gradient)"
      />
      <path d="M501 855q3-18 31-18h31v68h-62Z" fill="url(#shell-gradient)" />
      <path d="M653 852q8-17 32-17h28v70h-60Z" fill="url(#shell-gradient)" />

      <path
        d="M435 546q0-25 26-27l217 1q24 3 25 27v339q-1 29-31 31H463q-28-1-28-31Z"
        fill="url(#shell-gradient)"
        stroke="var(--shell-outline)"
        strokeWidth="3"
      />
      <path
        d="M436 547q3-27 25-28h30v398h-27q-30-1-30-28Z"
        fill="var(--shell-side)"
        opacity="0.55"
      />
      <path
        d="M447 540q5-13 19-13h205q18 1 22 17H447Z"
        fill="var(--shell-highlight)"
        opacity="0.4"
      />
      <path
        d="M458 536v367"
        stroke="var(--shell-highlight)"
        strokeWidth="4"
        opacity="0.58"
      />
      <path
        d="M436 547q131-6 266 0"
        fill="none"
        stroke="var(--shell-seam)"
        strokeWidth="4"
      />
      <path
        d="M436 558q131-6 266 0"
        fill="none"
        stroke="var(--shell-highlight)"
        strokeWidth="3"
        opacity="0.6"
      />
      <rect
        x="501"
        y="547"
        width="181"
        height="173"
        rx="10"
        fill="url(#bezel-gradient)"
        stroke="var(--bezel-rim)"
        strokeWidth="3"
      />
      <rect
        x="525"
        y="568"
        width="131"
        height="132"
        rx="2"
        fill="url(#screen-gradient)"
      />
      <path
        d="M529 571h124v5H529Z"
        fill="var(--cloud-highlight)"
        opacity="0.12"
      />
      <LcdDisplay bars={bars} ascii={ascii} />

      <path
        d="M525 773h24v21h21v24h-21v21h-24v-21h-22v-24h22Z"
        fill="var(--dpad-shadow)"
        opacity="0.18"
        transform="translate(2 4)"
      />
      <path
        d="M525 773h24v21h21v24h-21v21h-24v-21h-22v-24h22Z"
        fill="url(#control-glass-gradient)"
        stroke="var(--glass-edge)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M528 779h18"
        stroke="var(--cloud-highlight)"
        strokeWidth="3"
        opacity="0.26"
        strokeLinecap="round"
      />
      <circle
        cx="638"
        cy="811"
        r="16"
        fill="var(--button-shadow)"
        opacity="0.18"
        transform="translate(2 4)"
      />
      <circle
        cx="638"
        cy="807"
        r="15"
        fill="url(#control-glass-gradient)"
        stroke="var(--glass-edge)"
        strokeWidth="2"
      />
      <circle
        cx="676"
        cy="798"
        r="16"
        fill="var(--button-shadow)"
        opacity="0.18"
        transform="translate(2 4)"
      />
      <circle
        cx="676"
        cy="794"
        r="15"
        fill="url(#control-glass-gradient)"
        stroke="var(--glass-edge)"
        strokeWidth="2"
      />
      <path
        d="M622 870q23-24 60-30"
        fill="none"
        stroke="var(--shell-seam)"
        strokeWidth="5"
        opacity="0.5"
      />
      {Array.from({ length: 8 }, (_, index) => (
        <path
          key={index}
          d={`M${625 + index * 8} ${867 - index * 3}l-3 12`}
          stroke="var(--shell-seam)"
          strokeWidth="3"
          opacity="0.45"
        />
      ))}

      <path d="M423 867q15-17 27 0l-6 30h-24Z" fill="url(#ring-gradient)" />
      <rect
        x="402"
        y="883"
        width="69"
        height="33"
        rx="8"
        fill="url(#purple-gradient)"
      />
      <path d="M710 866q12-15 25 2l-4 31h-22Z" fill="url(#ring-gradient)" />
      <rect
        x="690"
        y="883"
        width="62"
        height="34"
        rx="8"
        fill="url(#purple-gradient)"
      />

      <path
        d="M501 865q16-14 41-1l31 38-12 35-55-17Z"
        fill="url(#shell-gradient)"
      />
      <path
        d="M645 863q15-13 35-4l35 39-10 37-58-18Z"
        fill="url(#shell-gradient)"
      />
      <path
        d="M517 890q14-12 35-11h29q17 1 19 19v58q-4 19-21 21h-58q-18-3-17-23v-47q0-11 13-17Z"
        fill="url(#boot-gradient)"
        stroke="var(--boot-outline)"
        strokeWidth="3"
      />
      <path
        d="M677 890q15-12 34-11h22q17 2 18 20v56q-4 19-20 21h-52q-18-2-19-21v-46q0-13 17-19Z"
        fill="url(#boot-gradient)"
        stroke="var(--boot-outline)"
        strokeWidth="3"
      />
      <path
        d="M518 891q17-9 64-8M676 891q15-9 56-7"
        fill="none"
        stroke="var(--boot-highlight)"
        strokeWidth="5"
        opacity="0.64"
        strokeLinecap="round"
      />
      <path
        d="M524 943h58m102 0h48"
        stroke="var(--boot-seam)"
        strokeWidth="3"
        opacity="0.45"
      />
      <path
        d="M519 961h62m99 0h51"
        stroke="var(--boot-outline)"
        strokeWidth="4"
        opacity="0.4"
      />
    </g>
  );
}

function SceneDefs() {
  return (
    <defs>
      <linearGradient id="sky-gradient" x2="0" y2="1">
        <stop offset="0" className="stop-sky-top" />
        <stop offset="1" className="stop-sky-bottom" />
      </linearGradient>
      <linearGradient id="ground-gradient" x2="0" y2="1">
        <stop offset="0" className="stop-ground-light" />
        <stop offset="1" className="stop-ground" />
      </linearGradient>
      <linearGradient id="lavender-gradient" x2="1" y2="0.15">
        <stop offset="0" className="stop-lavender-light" />
        <stop offset="0.36" className="stop-lavender" />
        <stop offset="1" className="stop-lavender-dark" />
      </linearGradient>
      <linearGradient id="coral-gradient" x2="1" y2="0.2">
        <stop offset="0" className="stop-coral-light" />
        <stop offset="0.48" className="stop-coral" />
        <stop offset="1" className="stop-coral-dark" />
      </linearGradient>
      <linearGradient id="green-gradient" x2="1" y2="0.2">
        <stop offset="0" className="stop-green-light" />
        <stop offset="0.45" className="stop-green" />
        <stop offset="1" className="stop-green-dark" />
      </linearGradient>
      <linearGradient id="bar-gradient" x2="0" y2="1">
        <stop offset="0" className="stop-bar-light" />
        <stop offset="0.5" className="stop-bar" />
        <stop offset="1" className="stop-bar-dark" />
      </linearGradient>
      <linearGradient id="shell-gradient" x2="1" y2="0.85">
        <stop offset="0" className="stop-shell-light" />
        <stop offset="0.48" className="stop-shell" />
        <stop offset="1" className="stop-shell-dark" />
      </linearGradient>
      <linearGradient id="bezel-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-bezel-light" />
        <stop offset="1" className="stop-bezel-dark" />
      </linearGradient>
      <linearGradient id="screen-gradient" x2="0.8" y2="1">
        <stop offset="0" className="stop-screen-light" />
        <stop offset="1" className="stop-screen-dark" />
      </linearGradient>
      <radialGradient id="cloud-gradient" cx="0.3" cy="0.18" r="0.9">
        <stop offset="0" className="stop-cloud-light" />
        <stop offset="0.65" className="stop-cloud" />
        <stop offset="1" className="stop-cloud-shade" />
      </radialGradient>
      <radialGradient id="cloud-soft-shadow">
        <stop offset="0" stopColor="var(--cloud-shadow)" stopOpacity="0.36" />
        <stop offset="0.7" stopColor="var(--cloud-shadow)" stopOpacity="0.16" />
        <stop offset="1" stopColor="var(--cloud-shadow)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="rope-gradient" x2="1" y2="0">
        <stop offset="0" className="stop-rope-dark" />
        <stop offset="0.5" className="stop-rope-light" />
        <stop offset="1" className="stop-rope" />
      </linearGradient>
      <linearGradient id="ring-gradient" x2="1" y2="0">
        <stop offset="0" className="stop-ring-dark" />
        <stop offset="0.5" className="stop-ring-light" />
        <stop offset="1" className="stop-ring" />
      </linearGradient>
      <linearGradient id="glove-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-glove-light" />
        <stop offset="0.5" className="stop-glove" />
        <stop offset="1" className="stop-glove-dark" />
      </linearGradient>
      <linearGradient id="boot-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-boot-light" />
        <stop offset="0.6" className="stop-boot" />
        <stop offset="1" className="stop-boot-dark" />
      </linearGradient>
      <linearGradient id="control-glass-gradient" x2="0.8" y2="1">
        <stop stopColor="#ffffff" stopOpacity="0.65" />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.12" />
        <stop offset="1" stopColor="#5b3a7a" stopOpacity="0.22" />
      </linearGradient>
      <linearGradient id="button-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-button-light" />
        <stop offset="1" className="stop-button-dark" />
      </linearGradient>
      <linearGradient id="dpad-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-dpad-light" />
        <stop offset="1" className="stop-dpad-dark" />
      </linearGradient>
      <linearGradient id="arm-gradient" x2="1" y2="0.2">
        <stop offset="0" className="stop-arm-light" />
        <stop offset="1" className="stop-arm-dark" />
      </linearGradient>
      <linearGradient id="purple-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-purple-light" />
        <stop offset="1" className="stop-purple-dark" />
      </linearGradient>
      <linearGradient id="red-gradient" x2="1" y2="1">
        <stop offset="0" className="stop-red-light" />
        <stop offset="1" className="stop-red-dark" />
      </linearGradient>
      <linearGradient id="base-gradient" x2="0" y2="1">
        <stop offset="0" className="stop-base-light" />
        <stop offset="1" className="stop-base-dark" />
      </linearGradient>
      <filter id="ground-soft" x="-50%" y="-100%" width="200%" height="300%">
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter id="sparkle-soft" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id="foreground-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <clipPath id="lcd-clip">
        <rect x="525" y="568" width="131" height="132" rx="2" />
      </clipPath>
    </defs>
  );
}

export function ClayScene() {
  const stageRef = useRef<HTMLDivElement>(null);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const ascii = useRef<(SVGTextElement | null)[]>([]);
  if (!Array.isArray(ascii.current)) ascii.current = [];
  useSceneMotion(stageRef, bars, ascii);
  const queue = usePlayerStore((state) => state.playback.queue);
  const queueIndex = usePlayerStore((state) => state.playback.queueIndex);
  const toggle = usePlayerStore((state) => state.toggle);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const adjustVolume = usePlayerStore((state) => state.adjustVolume);
  const jumpTo = usePlayerStore((state) => state.jumpTo);
  const setView = useAppStore((state) => state.setView);
  const [cubeColors, setCubeColors] = useState<Record<number, string>>({});
  const firstUpcoming = (queueIndex ?? -1) + 1;
  const upcoming = useMemo(
    () => queue.slice(firstUpcoming, firstUpcoming + 6),
    [queue, firstUpcoming],
  );

  useEffect(() => {
    let active = true;
    void Promise.all(
      upcoming.map(
        async (track) => [track.id, await cubeColorForTrack(track)] as const,
      ),
    ).then((colors) => {
      if (active) setCubeColors(Object.fromEntries(colors));
    });
    return () => {
      active = false;
    };
  }, [upcoming]);

  const cubeSlots = [
    { x: 278, y: 1193, size: 78, rotate: -4 },
    { x: 380, y: 1122, size: 49, rotate: 1 },
    { x: 403, y: 1253, size: 60, rotate: -2 },
    { x: 518, y: 1275, size: 69, rotate: 2 },
    { x: 711, y: 1275, size: 72, rotate: -1 },
    { x: 892, y: 1249, size: 70, rotate: 2 },
  ];

  function hotspot(
    x: number,
    y: number,
    width: number,
    height: number,
  ): CSSProperties {
    return {
      left: `${(x / 1136) * 100}%`,
      top: `${(y / 1472) * 100}%`,
      width: `${(width / 1136) * 100}%`,
      height: `${(height / 1472) * 100}%`,
    };
  }

  return (
    <div className="clay-stage" ref={stageRef}>
      <svg
        className="clay-scene"
        viewBox="0 0 1136 1472"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <title>BurplePlayer clay playground</title>
        <SceneDefs />
        <rect width="1136" height="1472" fill="url(#sky-gradient)" />
        <g data-scene-layer="clouds-back">
          <Cloud x={-6} y={994} scale={1.25} />
          <Cloud x={1003} y={995} scale={1.18} flip />
        </g>
        <path
          d="M0 1040Q560 1026 1136 1040V1472H0Z"
          fill="url(#ground-gradient)"
        />
        <path
          d="M0 1041Q565 1026 1136 1041"
          fill="none"
          stroke="var(--ground-horizon)"
          strokeWidth="5"
          opacity="0.24"
        />
        <path
          d="M297 1174q177-18 446 16l-51 29q-276 21-472-1Z"
          fill="var(--ground-shadow)"
          opacity="0.18"
          filter="url(#ground-soft)"
        />
        <g data-scene-layer="crossbar" aria-hidden="true">
          <SwingRing x={433} top={270} rear />
          <SwingRing x={723} top={291} rear />
          <path
            d="M274 173 865 210q21 1 21 22v21q0 24-24 23L278 239Z"
            fill="url(#bar-gradient)"
          />
          <path
            d="M294 178 855 213"
            stroke="var(--bar-highlight)"
            strokeWidth="10"
            opacity="0.55"
            strokeLinecap="round"
          />
        </g>
        <Pillars />
        <g data-scene-layer="clouds-mid">
          <Cloud x={96} y={288} scale={1.34} />
          <Cloud x={1048} y={471} scale={1.21} flip />
        </g>
        <g data-scene-layer="swing">
          <Rope x={433} top={270} />
          <Rope x={723} top={291} />
          <SwingArms />
          <g data-swing-player>
            <g data-swing-body>
              <Player bars={bars} ascii={ascii} />
            </g>
          </g>
          <RopeGrip side="left" />
          <RopeGrip side="right" />
          <SwingRing x={433} top={270} />
          <SwingRing x={723} top={291} />
        </g>
        <g data-scene-layer="cubes">
          <Cube x={111} y={1198} size={63} color="red" rotate={-3} />
          <Cube x={779} y={1107} size={52} color="red" rotate={-2} />
          {cubeSlots.map((slot, index) => {
            const track = upcoming[index];
            const colors: CubeColor[] = [
              "blue",
              "blue",
              "purple",
              "pink",
              "yellow",
              "green",
            ];
            return (
              <g key={slot.x} data-motion-cube={index}>
                <Cube
                  {...slot}
                  color={colors[index]}
                  face={
                    track
                      ? (cubeColors[track.id] ?? fallbackCubeColor(track))
                      : undefined
                  }
                />
              </g>
            );
          })}
        </g>
        <g
          data-scene-layer="clouds-front"
          filter="url(#foreground-soft)"
          aria-hidden="true"
        >
          <Cloud x={28} y={1406} scale={1.8} foreground />
          <Cloud x={263} y={1486} scale={1.52} foreground />
          <Cloud x={1010} y={1492} scale={1.72} foreground flip />
        </g>
      </svg>
      <button
        className="scene-hotspot scene-hotspot--dpad"
        data-direction="up"
        type="button"
        style={hotspot(518, 769, 39, 29)}
        aria-label="Volume up"
        title="Volume up · ↑"
        onClick={() => void adjustVolume(0.05)}
      />
      <button
        className="scene-hotspot scene-hotspot--dpad"
        data-direction="left"
        type="button"
        style={hotspot(497, 790, 33, 38)}
        aria-label="Previous track"
        title="Previous track · ←"
        onClick={() => void previous()}
      />
      <button
        className="scene-hotspot scene-hotspot--dpad"
        data-direction="right"
        type="button"
        style={hotspot(546, 790, 31, 38)}
        aria-label="Next track"
        title="Next track · →"
        onClick={() => void next()}
      />
      <button
        className="scene-hotspot scene-hotspot--dpad"
        data-direction="down"
        type="button"
        style={hotspot(518, 819, 39, 27)}
        aria-label="Volume down"
        title="Volume down · ↓"
        onClick={() => void adjustVolume(-0.05)}
      />
      <button
        className="scene-hotspot scene-hotspot--round"
        type="button"
        style={hotspot(622, 790, 33, 35)}
        aria-label="Play or pause"
        title="Play / pause · Space"
        onClick={() => void toggle()}
      />
      <button
        className="scene-hotspot scene-hotspot--round"
        type="button"
        style={hotspot(660, 778, 34, 35)}
        aria-label="Open queue"
        title="Open queue"
        onClick={() => setView("queue")}
      />
      {upcoming.map((track: Track, index) => {
        const slot = cubeSlots[index];
        return (
          <button
            key={`${track.id}-${index}`}
            className="scene-hotspot scene-hotspot--cube"
            type="button"
            style={hotspot(
              slot.x - slot.size * 0.55,
              slot.y - slot.size * 0.48,
              slot.size * 1.15,
              slot.size * 1.2,
            )}
            aria-label={`Play next: ${track.title} by ${track.artist}`}
            title={`${track.title} — ${track.artist}`}
            onClick={() => void jumpTo(firstUpcoming + index)}
          />
        );
      })}
    </div>
  );
}
