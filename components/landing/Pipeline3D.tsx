"use client";

import { useLayoutEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Text, Sphere } from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REDUCED =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface NodeData {
  id: string;
  label: string;
  position: [number, number, number];
  color: [number, number, number];
}

const NODES: NodeData[] = [
  { id: "audio", label: "Audio Input", position: [-4.5, -0.8, 0], color: [0.133, 0.827, 0.831] },
  { id: "whisper", label: "Whisper-class\nanalysis", position: [-2.8, 0.6, -0.3], color: [0.486, 0.361, 1.0] },
  { id: "scoring", label: "Retention\nScoring", position: [-0.5, 1.2, 0.2], color: [1.0, 0.447, 0.714] },
  { id: "selection", label: "Highlight\nSelection", position: [1.8, 0.4, -0.4], color: [0.486, 0.361, 1.0] },
  { id: "captions", label: "Word-Perfect\nCaptions", position: [3.2, -0.6, 0.1], color: [0.133, 0.827, 0.831] },
  { id: "export", label: "FFmpeg\nExport", position: [4.7, -1.4, -0.2], color: [1.0, 0.447, 0.714] },
];

const CURVE_OFFSET = 0.45;

function makeCurve(i: number): THREE.BufferGeometry {
  const start = NODES[i].position;
  const end = NODES[i + 1].position;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(start[0] + dx * 0.3, start[1] + dy * 0.3 + CURVE_OFFSET, start[2] + dz * 0.3),
    new THREE.Vector3(start[0] + dx * 0.7, start[1] + dy * 0.7 - CURVE_OFFSET, start[2] + dz * 0.7),
    new THREE.Vector3(end[0], end[1], end[2])
  );
  const points = curve.getPoints(24);
  return new THREE.BufferGeometry().setFromPoints(points);
}

function PipelineNode({
  node,
  active,
}: {
  node: NodeData;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const baseColor = useMemo(
    () => new THREE.Color(node.color[0], node.color[1], node.color[2]),
    [node]
  );

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 2 + node.position[0]) * 0.03);
    }
    if (glowRef.current) {
      const pulse = active ? 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.5 : 0;
      const intensity = (active ? 0.9 : 0.25) + pulse * 0.4;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.color = baseColor.clone().multiplyScalar(intensity);
      mat.opacity = 0.25 + (active ? 0.3 : 0) + pulse * 0.15;
    }
  });

  return (
    <group position={node.position}>
      <Sphere ref={meshRef} args={[0.52, 32, 32]} castShadow receiveShadow>
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={active ? 1.2 : 0.4}
          roughness={0.25}
          metalness={0.7}
        />
      </Sphere>
      <Sphere ref={glowRef} args={[0.82, 32, 32]}>
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
      <Text
        position={[0, -0.95, 0]}
        fontSize={0.28}
        maxWidth={3.2}
        lineHeight={1.2}
        textAlign="center"
        color={active ? "#ffffff" : "#9aa1b8"}
        anchorX="center"
        anchorY="middle"
      >
        {node.label}
      </Text>
    </group>
  );
}

function ConnectionLines({ activeIndex }: { activeIndex: number }) {
  const lines = useMemo(
    () =>
      NODES.slice(0, -1).map((_, i) => {
        const geometry = makeCurve(i);
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(0x22d3ee),
          transparent: true,
          opacity: i < activeIndex ? 0.8 : 0.12,
          blending: THREE.AdditiveBlending,
        });
        return new THREE.Line(geometry, material);
      }),
    [activeIndex]
  );

  useFrame((state) => {
    lines.forEach((line, i) => {
      const mat = line.material as THREE.LineBasicMaterial;
      if (i < activeIndex) {
        mat.opacity = 0.8;
        mat.color.setHSL(0.65, 0.85, 0.65 + Math.sin(state.clock.elapsedTime * 2 + i) * 0.15);
      } else {
        mat.opacity = 0.12;
      }
    });
  });

  return (
    <>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </>
  );
}

function CameraRig({ scrollProgress }: { scrollProgress: { current: number } }) {
  const { camera } = useThree();
  const target = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const startZ = 12;

  useFrame(() => {
    if (REDUCED) return;
    const progress = scrollProgress.current;
    const targetZ = startZ - progress * 4;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.position.y += ((1 - Math.cos(progress * Math.PI)) * 0.8 - camera.position.y) * 0.04;
    target.current.lerpVectors(camera.position, target.current, 0.1);
    camera.lookAt(target.current);
  });

  return null;
}

function PipelineScene({ scrollProgress }: { scrollProgress: { current: number } }) {
  const activeIndex = Math.floor(scrollProgress.current * NODES.length);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <Environment preset="studio" />
      <CameraRig scrollProgress={scrollProgress} />
      <ConnectionLines activeIndex={activeIndex} />
      {NODES.map((node, i) => (
        <PipelineNode key={node.id} node={node} active={i <= activeIndex} />
      ))}
    </>
  );
}

export function Pipeline3D() {
  const scrollProgress = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (REDUCED || !containerRef.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: "#pipeline-3d",
        start: "top 85%",
        end: "bottom 15%",
        scrub: true,
        onUpdate: (self) => {
          scrollProgress.current = self.progress;
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} id="pipeline-3d" className="relative mx-auto max-w-7xl py-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-ink/70 to-transparent" aria-hidden />

      <div className="relative z-10 mb-16 px-6">
        <div className="chip mb-6 uppercase tracking-[0.22em]">PROCESS</div>
        <h2 className="font-display max-w-3xl text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl md:text-6xl">
          The engine, visualized as it runs
        </h2>
      </div>

      <div className="relative mx-auto aspect-[16/6] w-full max-w-5xl rounded-3xl border border-line/30 bg-panel/40">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
          style={{ background: "transparent" }}
        >
          <color attach="background" args={["#04050a"]} />
          <fog attach="fog" args={["#04050a", 15, 35]} />
          <PipelineScene scrollProgress={scrollProgress} />
        </Canvas>
      </div>

      <div className="relative z-10 mt-12 text-center font-mono text-xs tracking-widest text-mute/60">
        scroll to drive the pipeline →
      </div>
    </section>
  );
}
