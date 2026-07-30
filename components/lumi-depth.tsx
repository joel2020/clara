"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { equippedOutfitBase } from "@/lib/cosmetics";

// A real-time "3D photo" of Lumi: her flat artwork gains volume by displacing
// pixels in a WebGL shader according to a depth map, so she parallaxes and
// appears to have form as you move the pointer or tilt the phone. No 3D model,
// no AI service, no dependencies — just a color texture + a depth texture and a
// few lines of GLSL. Falls back to the plain sticker if WebGL is unavailable
// or the user prefers reduced motion.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 1.0 - (aPos.y * 0.5 + 0.5));
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uOffset; // viewpoint shift, roughly [-1,1]
uniform float uAmp;   // max UV displacement
void main() {
  float d = texture2D(uDepth, vUv).r;           // 0 far … 1 near
  vec2 shift = (d - 0.5) * uAmp * uOffset;       // near pixels move most
  vec2 uv = vUv + shift;
  vec4 c = texture2D(uColor, uv);
  // A soft top-left key light that tracks the tilt gives her rounded shading.
  float lit = 1.0 + (d - 0.5) * (uOffset.x * 0.12 - uOffset.y * 0.12);
  c.rgb *= clamp(lit, 0.85, 1.15);
  gl_FragColor = c;
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
  }
  return s;
}

function loadTexture(gl: WebGLRenderingContext, url: string): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      resolve(tex);
    };
    img.onerror = () => reject(new Error("image load failed: " + url));
    img.src = url;
  });
}

export function LumiDepth({
  color,
  depth = "/character/lumi-depth.png",
  amp = 0.05,
  className,
  priority,
}: {
  color?: string;
  depth?: string;
  amp?: number;
  className?: string;
  priority?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  // Front art follows the equipped outfit; the depth map is shared (same
  // silhouette across outfits). An explicit `color` still overrides.
  const player = usePlayer();
  const resolvedColor = color ?? `${equippedOutfitBase(player)}.png`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) {
      setFailed(true);
      return;
    }

    let raf = 0;
    let disposed = false;
    // target/current viewpoint offset; smoothly chased each frame
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let t = 0;

    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = ((e.clientX - (r.left + r.width / 2)) / r.width) * 2;
      target.y = ((e.clientY - (r.top + r.height / 2)) / r.height) * 2;
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      // Only if the device already grants orientation without a prompt.
      if (e.gamma == null || e.beta == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 30));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onOrient, { passive: true });

    (async () => {
      try {
        const prog = gl.createProgram()!;
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const [colorTex, depthTex] = await Promise.all([loadTexture(gl, resolvedColor), loadTexture(gl, depth)]);
        if (disposed) return;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, colorTex);
        gl.uniform1i(gl.getUniformLocation(prog, "uColor"), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, depthTex);
        gl.uniform1i(gl.getUniformLocation(prog, "uDepth"), 1);

        const uOffset = gl.getUniformLocation(prog, "uOffset");
        const uAmp = gl.getUniformLocation(prog, "uAmp");
        gl.uniform1f(uAmp, amp);

        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);

        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.round(canvas.clientWidth * dpr);
          const h = Math.round(canvas.clientHeight * dpr);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
          }
        };

        const render = () => {
          if (disposed) return;
          t += 0.016;
          resize();
          // A slow, barely-there idle drift so she's alive without wobbling —
          // calm and intentional, not a bounce. Pointer/tilt still leads.
          const idleX = Math.sin(t * 0.4) * 0.16;
          const idleY = Math.cos(t * 0.32) * 0.08;
          const tx = target.x * 0.6 + idleX * 0.5;
          const ty = target.y * 0.6 + idleY * 0.5;
          cur.x += (tx - cur.x) * 0.045;
          cur.y += (ty - cur.y) * 0.045;
          gl.uniform2f(uOffset, cur.x, cur.y);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          raf = requestAnimationFrame(render);
        };
        render();
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [resolvedColor, depth, amp, reduceMotion]);

  if (failed || reduceMotion) {
    return (
      <div className={cn("relative h-full w-full select-none", className)}>
        <Image
          src={resolvedColor}
          alt=""
          fill
          sizes="(max-width: 640px) 45vw, 320px"
          priority={priority}
          className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full select-none", className)}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ filter: "drop-shadow(0 14px 26px rgba(0,0,0,0.2))" }}
        aria-label="Lumi"
        role="img"
      />
    </div>
  );
}
