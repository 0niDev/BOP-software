/**
 * Shared motion vocabulary.
 *
 * Every widget enters with the same fade-and-slide-up, staggered down the page,
 * and every animation is skipped for users who ask for reduced motion. The
 * durations are deliberately short (< 0.5s including the stagger): the browser
 * audit measures a page half a second after it opens, and a widget that is still
 * sliding at that point would be measured mid-flight.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

interface MotionProps {
  children: ReactNode;
  className?: string;
}

/** Wraps a row of widgets so each one enters just after the previous. */
export function StaggerGroup({ children, className }: MotionProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={staggerParent}>
      {children}
    </motion.div>
  );
}

/** A child of `StaggerGroup`. */
export function StaggerItem({ children, className }: MotionProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}
