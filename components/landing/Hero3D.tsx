"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { ContactShadows } from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------- particles ---------------------------------- */

const PARTICLE_VERT = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  uniform float uTime;
  varying vec3 vColor;
  varying float vSize;
  void main() {
    vColor = color;
    vSize = size;
    vec3 pos = position;
    pos.y += sin(uTime * 0.4 + position.x * 1.6) * 0.12;
    pos.x += cos(uTime * 0.3 + position.z * 1.2) * 0.08;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (2.4 + size * 4.6) * (250.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vSize;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.012) discard;
    vec3 c = mix(vec3(0.486, 0.361, 1.0), vec3(0.13, 0.83, 0.93), vColor.b);
    c = mix(c, vec3(0.956, 0.447, 0.714), vColor.r);
    c = mix(c, vec3(0.969, 0.788, 0.282), vColor.g * 0.6);
    gl_FragColor = vec4(c, a * (0.55 + vSize * 0.35));
  }
`;

function Particles({ count }: { count: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      pos[i * 3] = (Math.random() - 0.5) * 11;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4 - 0.6;
      const c = new THREE.Color().setHSL(Math.random() * 0.75, 0.85, 0.62);
      if (r < 0.12) c.setHSL(0.12, 0.9, 0.62); // gold particles
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      size[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    return g;
  }, [count]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (!ref.current || REDUCED) return;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.12;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.05;
  });

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  return <points ref={ref} geometry={geo} material={mat} />;
}

/* ------------------------------ procedural clip art ----------------------------- */

const CAPTION_POOLS = [
  ["THIS IS INSANE", "you won't believe it", "clip it before it ends", "1000x faster editing"],
  ["wait for it...", "THE PLOT TWIST", "this changes everything", "go viral or go home"],
  ["hooked in 3 seconds", "AI found this moment", "pure gold", "ship it vertical"],
];

interface VideoTexture {
  tex: THREE.CanvasTexture;
  draw: (t: number) => void;
}

function makeVideoTexture(themeIdx: number, startDelay: number, isGold = false): VideoTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const hue = isGold ? 0.12 : [0.72, 0.55, 0.94][themeIdx % 3];
  const captions = CAPTION_POOLS[themeIdx % 3];

  let t = startDelay;
  const draw = (dt: number) => {
    t += dt;

    const bg = ctx.createLinearGradient(0, 0, 0, 640);
    const h = (hue + Math.sin(t * 0.1) * 0.06 + 1) % 1;
    bg.addColorStop(0, `hsl(${h * 360}, 62%, 16%)`);
    bg.addColorStop(0.55, `hsl(${(h + 0.08) * 360}, 64%, 11%)`);
    bg.addColorStop(1, `hsl(${(h + 0.14) * 360}, 70%, 6%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 360, 640);

    const blob = ctx.createRadialGradient(
      180 + Math.sin(t * 0.5) * 130,
      300 + Math.cos(t * 0.4) * 90,
      20,
      180,
      320,
      240
    );
    blob.addColorStop(0, `hsla(${h * 360 + 40}, 95%, 62%, 0.34)`);
    blob.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, 360, 640);

    ctx.font = "600 20px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("@creator · 1:24:00", 22, 44);

    ctx.font = "700 22px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("ittyclip", 258, 44);

    const captionIdx = Math.floor(t * 0.45) % captions.length;
    const caption = captions[captionIdx];
    ctx.font = "800 34px Inter, sans-serif";
    const tw = ctx.measureText(caption).width;
    const bw = tw + 48;
    const bx = (360 - bw) / 2;
    const by = 430;
    const r = 16;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + 56, r);
    ctx.arcTo(bx + bw, by + 56, bx, by + 56, r);
    ctx.arcTo(bx, by + 56, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(caption, bx + 24, by + 38);

    for (let i = 0; i < 26; i++) {
      const w = 7;
      const gap = 9;
      const hgt = (Math.abs(Math.sin(t * 3 + i * 0.7)) * 0.5 + 0.15) * 44;
      const x = 22 + i * (w + gap);
      ctx.fillStyle = i % 4 === 0 ? "#F472B6" : i % 3 === 0 ? "#22D3EE" : "#7C5CFF";
      if (isGold && i % 5 === 0) ctx.fillStyle = "#F7C948";
      ctx.fillRect(x, 560 - hgt, w, hgt);
    }

    const p = ((t % 20) / 20) * 316;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(22, 588, 316, 7);
    ctx.fillStyle = isGold ? "#F7C948" : "#7C5CFF";
    ctx.fillRect(22, 588, p, 7);

    ctx.beginPath();
    ctx.arc(180, 300, 52, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(168, 280);
    ctx.lineTo(200, 300);
    ctx.lineTo(168, 320);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    tex.needsUpdate = true;
  };

  return { tex, draw };
}

/* -------------------------------- clip card -------------------------------- */

const FRONT_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRONT_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uHover;
  varying vec2 vUv;
  varying vec3 vViewDir;

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = sdRoundRect(p, vec2(0.93, 0.955), 0.055);
    float alpha = 1.0 - smoothstep(0.0, 0.014, d);
    if (alpha < 0.01) discard;
    vec3 col = texture2D(uTex, vUv).rgb;
    float border = smoothstep(0.88, 0.93, abs(p.x)) + smoothstep(0.92, 0.955, abs(p.y));
    col = mix(col, col + uTint * 0.7, clamp(border, 0.0, 1.0));
    float fres = pow(1.0 - abs(dot(normalize(vViewDir), vec3(0.0, 0.0, 1.0))), 2.2);
    col += uTint * fres * 0.5;
    col += uTint * 0.06 * (0.5 + 0.5 * sin(uTime * 2.0));
    col += uHover * uTint * 0.35 * (0.5 + 0.5 * sin(uTime * 3.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uHover;
  varying vec2 vUv;

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = sdRoundRect(p, vec2(1.03 + uHover * 0.08, 1.05 + uHover * 0.08), 0.09);
    float glow = exp(-max(d, 0.0) * 6.5) * (0.5 + uHover * 0.5);
    glow *= 0.55 + 0.45 * sin(uTime * 1.3 + d * 3.0);
    if (glow < 0.012) discard;
    gl_FragColor = vec4(uTint, glow);
  }
`;

function ClipCard({
  position,
  rotation,
  scale = 1,
  themeIdx,
  delay,
  isGold = false,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  themeIdx: number;
  delay: number;
  isGold?: boolean;
}) {
  const vid = useMemo(() => makeVideoTexture(themeIdx, delay, isGold), [themeIdx, delay, isGold]);
  const frontRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const hover = useRef(0);
  const targetHover = useRef(0);

  const tint = useMemo(
    () => new THREE.Color(isGold ? "#F7C948" : ["#7C5CFF", "#22D3EE", "#F472B6"][themeIdx % 3]),
    [themeIdx, isGold]
  );

  const frontMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FRONT_VERT,
        fragmentShader: FRONT_FRAG,
        uniforms: {
          uTex: { value: vid.tex },
          uTime: { value: 0 },
          uTint: { value: tint },
          uHover: { value: 0 },
        },
        transparent: true,
      }),
    [vid, tint]
  );

  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FRONT_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: {
          uTint: { value: tint },
          uTime: { value: 0 },
          uHover: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [tint]
  );

  useFrame((state, delta) => {
    vid.draw(REDUCED ? 0.016 : delta);
    frontMat.uniforms.uTime.value = state.clock.elapsedTime;
    glowMat.uniforms.uTime.value = state.clock.elapsedTime;

    // Smooth hover lerp
    hover.current += (targetHover.current - hover.current) * Math.min(1, delta * 5);
    frontMat.uniforms.uHover.value = hover.current;
    glowMat.uniforms.uHover.value = hover.current;

    if (groupRef.current && !REDUCED) {
      const t = state.clock.elapsedTime + delay * 4;
      groupRef.current.position.y = position[1] + Math.sin(t * 0.6) * 0.09;
      groupRef.current.rotation.y =
        rotation[1] + Math.sin(t * 0.45) * 0.06 + (isGold ? 0 : hover.current * 0.22);
      groupRef.current.rotation.x = rotation[0] + (isGold ? 0 : hover.current * -0.12);
      const s = scale * (isGold ? 1 + hover.current * 0.04 : 1);
      groupRef.current.scale.setScalar(s);
    }
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isGold) return;
      const rect = (frontRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null) as DOMRect | null;
      // Approximate using window center since mesh is center-screen
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      targetHover.current = dist < 0.35 ? 1 : 0;
      void rect;
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      frontMat.dispose();
      glowMat.dispose();
      vid.tex.dispose();
    };
  }, [frontMat, glowMat, vid, isGold]);

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <mesh ref={glowRef} material={glowMat}>
        <planeGeometry args={[1.5, 2.667]} />
      </mesh>
      <mesh ref={frontRef} material={frontMat}>
        <planeGeometry args={[1.5, 2.667]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- rig + scene ---------------------------------- */

function Rig({
  scroll,
  mouse,
}: {
  scroll: React.MutableRefObject<number>;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const k = Math.min(1, delta * 3);
    // Mouse-reactive camera
    state.camera.position.x += (mouse.current.x * 0.55 - state.camera.position.x) * k;
    state.camera.position.y += (-mouse.current.y * 0.35 - state.camera.position.y) * k;
    // Scroll-tied camera dolly: pull back + lift when scrolling
    const targetZ = 5.2 - scroll.current * 1.6;
    const targetY = -mouse.current.y * 0.35 + scroll.current * 0.4;
    state.camera.position.z += (targetZ - state.camera.position.z) * k;
    state.camera.position.y += (targetY - state.camera.position.y) * k;
    state.camera.lookAt(0, 0, 0);

    if (group.current) {
      group.current.rotation.y +=
        (scroll.current * 0.9 + mouse.current.x * 0.08 - group.current.rotation.y) * k;
      group.current.rotation.x +=
        (scroll.current * 0.18 - group.current.rotation.x) * k * 0.5;
    }
  });

  return <group ref={group} />;
}

/* ---------------------------------- fallback poster ---------------------------------- */

function WebGLFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative h-[52vh] w-[30vh] rotate-3 rounded-2xl border border-white/10 bg-gradient-to-b from-panel3 to-ink p-3 shadow-[0_0_80px_-20px_rgba(124,92,255,0.5)]">
        <div className="flex h-full w-full flex-col rounded-xl bg-gradient-to-b from-[#1a1038] to-ink p-4">
          <div className="flex items-center justify-between text-xs text-mute">
            <span>@creator · 1:24:00</span>
            <span className="text-brand2">ittyclip</span>
          </div>
          <div className="mt-auto rounded-lg bg-black/60 px-4 py-3 text-sm font-bold text-white">
            THIS IS INSANE
          </div>
          <div className="mt-4 flex items-end gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-2 rounded-sm bg-brand2"
                style={{ height: `${20 + Math.abs(Math.sin(i * 0.7)) * 40}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- main export ---------------------------------- */

export default function Hero3D({ mobile }: { mobile: boolean }) {
  const scroll = useRef(0);
  const mouse = useRef({ x: 0, y: 0 });
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    // Detect WebGL support
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) setWebgl(false);
    } catch {
      setWebgl(false);
    }

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX / window.innerWidth - 0.5;
      mouse.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMove);
    const trigger = ScrollTrigger.create({
      trigger: "#hero",
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        scroll.current = self.progress;
      },
    });
    return () => {
      window.removeEventListener("mousemove", onMove);
      trigger.kill();
    };
  }, []);

  const particleCount = mobile ? 1500 : 4200;

  if (!webgl) return <WebGLFallback />;

  return (
    <Canvas
      dpr={mobile ? [1, 1.5] : [1, 1.75]}
      camera={{ position: [0, 0, 5.2], fov: 42 }}
      gl={{ antialias: !mobile, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      aria-label="Animated 3D video clips being cut and captioned by ittyclip"
    >
      <Rig scroll={scroll} mouse={mouse} />
      <Particles count={particleCount} />
      <ClipCard position={[0, 0.05, 0.4]} rotation={[0, 0, 0]} themeIdx={0} delay={0} isGold />
      {!mobile && (
        <>
          <ClipCard position={[-2.5, 0.55, -1.1]} rotation={[0.05, 0.5, -0.04]} scale={0.62} themeIdx={1} delay={2.2} />
          <ClipCard position={[2.5, 0.35, -1.3]} rotation={[-0.03, -0.52, 0.05]} scale={0.56} themeIdx={2} delay={4.1} />
        </>
      )}
      <ContactShadows position={[0, -1.6, 0]} opacity={0.4} scale={8} blur={2.4} far={3} color="#000000" />
      {mobile ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.18} luminanceSmoothing={0.35} />
          <Vignette eskil={false} offset={0.3} darkness={0.58} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.18} luminanceSmoothing={0.35} />
          <ChromaticAberration offset={[0.0014, 0.0008]} blendFunction={BlendFunction.NORMAL} />
          <Vignette eskil={false} offset={0.3} darkness={0.58} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
