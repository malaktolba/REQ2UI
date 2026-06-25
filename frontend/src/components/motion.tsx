import {
  motion,
  useReducedMotion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/* ------------------------------------------------------------------
   Scroll-driven reveal primitives (blueprint aesthetic).
   Dependency: `motion` (Framer Motion). All effects respect the user's
   prefers-reduced-motion setting and degrade to an instant, static render.
   ------------------------------------------------------------------ */

type Dir = "up" | "down" | "left" | "right" | "none";

const OFFSET: Record<Dir, { x?: number; y?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 28 },
  right: { x: -28 },
  none: {},
};

const EASE = [0.16, 0.84, 0.24, 1] as const;

interface RevealProps {
  children: ReactNode;
  /** Direction the element travels in FROM. Default "up". */
  from?: Dir;
  /** Seconds to wait before animating. Default 0. */
  delay?: number;
  /** Seconds the animation runs. Default 0.6. */
  duration?: number;
  /** Re-animate every time it scrolls into view (default: once). */
  repeat?: boolean;
  className?: string;
  as?: "div" | "section" | "li" | "span" | "h1" | "h2" | "h3" | "p";
}

/** Fades + slides a block into view as it scrolls into the viewport. */
export function Reveal({
  children,
  from = "up",
  delay = 0,
  duration = 0.6,
  repeat = false,
  className,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  if (reduce) {
    const Static = as as "div";
    return <Static className={className}>{children}</Static>;
  }

  return (
    <Comp
      className={className}
      initial={{ opacity: 0, ...OFFSET[from] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: !repeat, amount: 0.3, margin: "0px 0px -10% 0px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/**
 * Wrap a grid/list so its direct <Stagger.Item> children reveal one after
 * another as the group scrolls into view.
 */
export function Stagger({
  children,
  className,
  repeat = false,
}: {
  children: ReactNode;
  className?: string;
  repeat?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/** Animated number that counts up from 0 → `to` the first time it scrolls in. */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const count = useMotionValue(0);
  const text = useTransform(count, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      count.set(to);
      return;
    }
    const controls = animate(count, to, { duration, ease: [0.16, 0.84, 0.24, 1] });
    return () => controls.stop();
  }, [inView, to, duration, count, reduce]);

  return (
    <motion.span ref={ref}>{reduce ? `${prefix}${to.toFixed(decimals)}${suffix}` : text}</motion.span>
  );
}

Stagger.Item = function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
};
