"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  /** Optional label used to build aria-labels like "<label>: 3 of 5 stars". */
  label?: string;
}

export function StarRating({ value, onChange, max = 5, label }: StarRatingProps) {
  const [hover, setHover] = useState(0);

  // Render with role="radiogroup" so screen readers announce this as a rating
  // input; each star becomes a "radio" with a clear aria-label.
  return (
    <div
      className="flex gap-2"
      role="radiogroup"
      aria-label={label ? `Оценка: ${label}` : "Оценка"}
    >
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1;
        const selected = value === starValue;
        return (
          <motion.button
            type="button"
            key={i}
            role="radio"
            aria-checked={selected}
            aria-label={`${starValue} из ${max}`}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(0)}
            onKeyDown={(e) => {
              // Keyboard support: arrow keys move within the group.
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                onChange(Math.min(max, starValue + 1));
              } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                onChange(Math.max(1, starValue - 1));
              }
            }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
          >
            <Star
              className={cn(
                "w-8 h-8 transition-colors",
                (hover || value) >= starValue
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              )}
              aria-hidden="true"
            />
          </motion.button>
        );
      })}
    </div>
  );
}
