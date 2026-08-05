"use client";

import { useEffect, useRef } from "react";

const VERT = /* glsl */ `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec2 u_resolution;

  vec2 hash22(vec2 p) {
    p = fract(p * vec2(0.283, 0.531));
    p += dot(p, p + 45.32) + 45.32;
    return fract((p.xy + p.yx) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
    float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p, int octaves, float lac, float gain) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      sum += amp * noise(p);
      amp *= gain;
      p *= lac;
    }
    return sum;
  }

  void main() {
    vec2 uv = v_uv;
    uv.y = 1.0 - uv.y;

    vec2 m = u_mouse * 0.5 + 0.5;
    m.x = clamp(m.x, 0.001, 0.999);
    m.y = clamp(m.y, 0.001, 0.999);

    // Two-layer noise field with time-based evolution
    float n1 = fbm(uv * 2.4 + vec2(u_time * 0.03, u_time * 0.017), 5, 2.0, 0.55);
    float n2 = fbm(uv * 4.8 + vec2(u_time * 0.011, u_time * 0.043), 5, 2.0, 0.55);

    vec2 offset = vec2(n1, n2) * 0.035;
    float d = length(uv - m);
    offset += normalize(uv - m) * exp(-d * 3.0) * 0.04;

    vec2 distorted = uv + offset;
    float n = fbm(distorted * 6.0 + u_time * 0.025, 5, 2.1, 0.48);
    n = n * 0.5 + 0.5;

    // Brand palette: purple → teal → pink
    vec3 c1 = vec3(0.486, 0.361, 1.0);
    vec3 c2 = vec3(0.133, 0.827, 0.831);
    vec3 c3 = vec3(0.957, 0.447, 0.714);

    float t = n + u_time * 0.02;
    vec3 color = mix(c1, c2, smoothstep(0.2, 0.8, fract(t * 0.3)));
    color = mix(color, c3, smoothstep(0.3, 0.7, fract(t * 0.5) + 0.1));

    float vignette = 1.0 - pow(length(uv - 0.5) * 1.1, 2.0);
    vignette = clamp(vignette, 0.0, 1.0);

    float alpha = 0.11 + 0.06 * n + 0.03 * sin(u_time * 0.5);
    alpha *= vignette * vignette * (0.8 + 0.2 * d);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function BackgroundShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const mouseRef = useRef({ x: 0, y: 0 });
  const programRef = useRef<WebGLProgram | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (/Mobi|Android/i.test(navigator.userAgent)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;
    glRef.current = gl;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    programRef.current = program;

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uResolution = gl.getUniformLocation(program, "u_resolution");

    let startTime = performance.now();

    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener("mousemove", onMove);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uResolution, window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    let paused = false;
    const visibilityHandler = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const render = () => {
      frameRef.current = requestAnimationFrame(render);
      if (paused) return;

      const elapsed = (performance.now() - startTime) * 0.001;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    render();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityHandler);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(quad);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-[1] h-full w-full"
      style={{ background: "transparent" }}
      aria-hidden="true"
      data-cursor="ignore"
    />
  );
}
