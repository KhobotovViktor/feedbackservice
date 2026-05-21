"use client";

import { motion } from "framer-motion";

const COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#10b981", "#fbbf24", "#f43f5e"];

// Pre-computed burst so the layout is stable across renders.
const PIECES = Array.from({ length: 44 }, (_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 520,
  y: -(Math.random() * 220 + 220),
  rot: Math.random() * 720 - 360,
  color: COLORS[i % COLORS.length],
  delay: Math.random() * 0.25,
  size: 6 + Math.random() * 6,
}));

// Lightweight one-shot confetti burst (no dependency). Render it inside a
// `relative` container; it's decorative and ignores pointer events.
export function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible" aria-hidden="true">
      {PIECES.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rot }}
          transition={{ duration: 1.7, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: p.color, width: p.size, height: p.size * 1.4 }}
          className="absolute top-1/4 rounded-[2px]"
        />
      ))}
    </div>
  );
}
