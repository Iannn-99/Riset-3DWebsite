/*
  PURE. COLD. ALWAYS. — Immersive 3D Tumbler Landing Page
  ----------------------------------------------------------------
  Procedural tumbler (no external .glb/.gltf) built from R3F primitives.

  Setup:
    npm install react react-dom three @react-three/fiber @react-three/drei framer-motion
    npm install -D tailwindcss postcss autoprefixer

  index.html <head> — add fonts:
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">

  tailwind.config.js — add:
    theme: { extend: { fontFamily: {
      display: ['"Space Grotesk"', 'sans-serif'],
      body: ['Inter', 'sans-serif'],
    }}}

  Design tokens used:
    bg #0a0a0a · surface rgba(255,255,255,.04) · ice accent #7dd3e0
    onyx #15171a · frost #e9edf0 · ocean #1c4e63
*/

import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  Suspense,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows, Sparkles } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";
import './index.css';

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

const COLOR_OPTIONS = [
  { key: "onyx", label: "Onyx Black", hex: "#15171a" },
  { key: "frost", label: "Frost White", hex: "#e9edf0" },
  { key: "ocean", label: "Ocean Blue", hex: "#1c4e63" },
];

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

// Mouse position in -1..1, kept in a ref so it never triggers React renders.
function useMouseParallax() {
  const mouseRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    function handleMove(e) {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    }
    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);
  return mouseRef;
}

// Continuous scroll progress across `numSections` full-height sections,
// expressed as a float (0 = top of section 0, 1 = top of section 1, ...).
function useScrollSections(numSections) {
  const scrollRef = useRef(0);
  useEffect(() => {
    let ticking = false;
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const raw = max > 0 ? window.scrollY / max : 0;
      scrollRef.current = raw * (numSections - 1);
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [numSections]);
  return scrollRef;
}

// Procedurally generated brushed-metal roughness map — no external texture files.
function useBrushedMetalTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#8a8a8a";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
      const y = Math.random() * 256;
      const alpha = Math.random() * 0.18;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (Math.random() * 2 - 1));
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 5);
    return tex;
  }, []);
}

/* ------------------------------------------------------------------ */
/* 3D — Tumbler                                                         */
/* ------------------------------------------------------------------ */

function Tumbler({ colorHex, scrollRef, mouseRef }) {
  const group = useRef();
  const lidGroup = useRef();
  const bodyMat = useRef();
  const roughnessMap = useBrushedMetalTexture();

  const targetColor = useMemo(() => new THREE.Color(colorHex), [colorHex]);
  const liveColor = useRef(new THREE.Color(colorHex));

  useFrame((_, delta) => {
    const s = scrollRef.current; // 0 (hero) .. 1 (features) .. 2 (customizer)
    const m = mouseRef.current;

    const p1 = THREE.MathUtils.clamp(s, 0, 1); // hero -> features
    const p2 = THREE.MathUtils.clamp(s - 1, 0, 1); // features -> customizer

    const targetRotY =
      THREE.MathUtils.lerp(0, Math.PI, p1) + THREE.MathUtils.lerp(0, Math.PI * 0.85, p2);
    const targetX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0, -1.7, p1), 0.4, p2);
    const exploded = Math.sin(Math.min(p1 + p2 * 0.3, 1) * Math.PI);

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(
        group.current.rotation.y,
        targetRotY + m.x * 0.25,
        4,
        delta
      );
      group.current.rotation.x = THREE.MathUtils.damp(
        group.current.rotation.x,
        m.y * 0.12,
        4,
        delta
      );
      group.current.position.x = THREE.MathUtils.damp(
        group.current.position.x,
        targetX,
        3,
        delta
      );
    }
    if (lidGroup.current) {
      lidGroup.current.position.y = THREE.MathUtils.damp(
        lidGroup.current.position.y,
        1.35 + exploded * 0.5,
        4,
        delta
      );
    }
    if (bodyMat.current) {
      liveColor.current.lerp(targetColor, delta * 3);
      bodyMat.current.color.copy(liveColor.current);
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        {/* Body + base */}
        <group>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.52, 0.46, 2.3, 64]} />
            <meshPhysicalMaterial
              ref={bodyMat}
              color={colorHex}
              metalness={0.88}
              roughness={0.28}
              roughnessMap={roughnessMap}
              clearcoat={1}
              clearcoatRoughness={0.12}
              envMapIntensity={1.3}
            />
          </mesh>
          <mesh position={[0, -1.18, 0]} castShadow>
            <cylinderGeometry args={[0.47, 0.47, 0.06, 64]} />
            <meshPhysicalMaterial color="#0d0d0d" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>

        {/* Lid assembly — animates independently for the exploded view */}
        <group ref={lidGroup} position={[0, 1.35, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.56, 0.54, 0.4, 64]} />
            <meshPhysicalMaterial
              color="#101114"
              metalness={0.15}
              roughness={0.55}
              clearcoat={0.4}
              clearcoatRoughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.16, 32]} />
            <meshPhysicalMaterial color="#101114" metalness={0.2} roughness={0.5} />
          </mesh>
          <mesh position={[0.35, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.18, 0.035, 16, 48]} />
            <meshPhysicalMaterial color="#101114" metalness={0.2} roughness={0.5} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 3D — Scene                                                           */
/* ------------------------------------------------------------------ */

function Scene({ colorHex, scrollRef, mouseRef }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.3, 5.5], fov: 32 }} gl={{ antialias: true }}>
      <color attach="background" args={["#0a0a0a"]} />
      <fog attach="fog" args={["#0a0a0a", 6, 14]} />

      <ambientLight intensity={0.15} />
      <spotLight
        position={[3, 4, 4]}
        angle={0.35}
        penumbra={0.6}
        intensity={2.2}
        castShadow
        color="#bfe9ff"
      />
      <spotLight position={[-4, 2, -2]} angle={0.4} penumbra={0.8} intensity={1.1} color="#7dd3e0" />
      <directionalLight position={[0, 3, -4]} intensity={0.5} color="#ffffff" />

      <Suspense fallback={null}>
        <Environment preset="city" background={false} />
        <Tumbler colorHex={colorHex} scrollRef={scrollRef} mouseRef={mouseRef} />
        <ContactShadows position={[0, -1.4, 0]} opacity={0.55} scale={8} blur={2.4} far={2} />
        <Sparkles count={40} scale={[4, 4, 4]} size={2} speed={0.2} color="#bfe9ff" opacity={0.4} />
      </Suspense>
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* HTML overlay                                                         */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pointer-events-none">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="font-body text-sm text-white/50 mb-4"
      >
        The everyday carry, reconsidered
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15 }}
        className="font-display text-white text-[13vw] leading-[0.9] sm:text-7xl md:text-8xl font-medium"
      >
        Pure. Cold.
        <br />
        Always.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="font-body text-white/60 max-w-md mt-6 text-base"
      >
        Double-wall vacuum steel that holds its temperature — and its shape —
        no matter how hard the day gets.
      </motion.p>
      <a
        href="#customizer"
        className="font-body pointer-events-auto mt-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur px-6 py-3 text-white text-sm hover:bg-white/10 transition-colors"
      >
        Build your tumbler
      </a>
    </section>
  );
}

function Features() {
  return (
    <section className="relative min-h-screen px-6 md:px-16 flex items-center pointer-events-none">
      <div className="ml-auto w-full max-w-sm space-y-6">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6"
        >
          <p className="font-display text-3xl text-white mb-1">24 hours cold</p>
          <p className="font-body text-white/55 text-sm leading-relaxed">
            12 hours hot. A sealed vacuum core keeps ice intact through a full
            day, no matter the weather outside.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6"
        >
          <p className="font-display text-3xl text-white mb-1">18/8 stainless</p>
          <p className="font-body text-white/55 text-sm leading-relaxed">
            Double-wall insulation and a powder-coated shell resist dents,
            condensation, and everyday wear.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Customizer({ colorKey, setColorKey }) {
  return (
    <section
      id="customizer"
      className="relative min-h-screen flex flex-col items-center justify-end pb-24 px-6 pointer-events-none"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl px-8 py-6">
        <p className="font-display text-xl text-white">Make it yours</p>
        <div className="flex items-center gap-5">
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setColorKey(opt.key)}
              className="flex flex-col items-center gap-2 group"
              aria-label={opt.label}
            >
              <span
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  colorKey === opt.key
                    ? "border-white scale-110"
                    : "border-white/30 group-hover:scale-105"
                }`}
                style={{ backgroundColor: opt.hex }}
              />
              <span className="font-body text-xs text-white/60">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                   */
/* ------------------------------------------------------------------ */

export default function App() {
  const [colorKey, setColorKey] = useState("onyx");
  const mouseRef = useMouseParallax();
  const scrollRef = useScrollSections(3);
  const activeColor = COLOR_OPTIONS.find((c) => c.key === colorKey).hex;

  return (
    <div className="relative bg-[#0a0a0a] font-body">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Scene colorHex={activeColor} scrollRef={scrollRef} mouseRef={mouseRef} />
      </div>
      <div className="relative z-10">
        <Hero />
        <Features />
        <Customizer colorKey={colorKey} setColorKey={setColorKey} />
      </div>
    </div>
  );
}
