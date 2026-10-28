import { motion, useSpring } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";

interface TiltCardOwnProps {
  as?: "div" | "li";
  children: ReactNode;
}

type TiltCardProps = TiltCardOwnProps & Omit<HTMLMotionProps<"div">, "ref" | "children">;

const SPRING = { stiffness: 300, damping: 25, mass: 0.5 };
const MAX_TILT_DEG = 2.5;

/** Wraps content in a card that tilts toward the cursor and lifts slightly on
 * hover — the "tactile depth" micro-interaction, done with spring-eased motion
 * values so it settles smoothly instead of snapping. Drops in for a plain
 * motion.div/motion.li (forwards initial/animate/whileInView/etc. and any HTML
 * attributes like role/tabIndex) — the pointer tracking only adds hover/move
 * listeners, so keyboard/touch use is unaffected. */
export function TiltCard({ children, className, style, as = "div", ...rest }: TiltCardProps) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);

  // Touch browsers fire synthetic mouse events on tap inconsistently (often
  // enter+move but no matching leave until something else is tapped), which
  // would leave a card visibly stuck mid-tilt/scaled-up. The pointer tracking
  // is a desktop-hover nicety anyway, so skip it entirely without a fine
  // pointer; the card still renders, just flat.
  const canHover =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement | HTMLLIElement>) {
    if (!canHover) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * MAX_TILT_DEG * 2);
    rotateX.set(-py * MAX_TILT_DEG * 2);
  }

  function handleMouseEnter() {
    if (!canHover) return;
    scale.set(1.015);
  }

  function handleMouseLeave() {
    if (!canHover) return;
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  }

  const sharedProps = {
    className: `tilt-card${className ? ` ${className}` : ""}`,
    style: {
      ...style,
      transformPerspective: 800,
      transformStyle: "preserve-3d" as const,
      rotateX,
      rotateY,
      scale,
    },
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  if (as === "li") {
    return (
      <motion.li ref={ref} {...sharedProps} {...(rest as HTMLMotionProps<"li">)}>
        {children}
      </motion.li>
    );
  }

  return (
    <motion.div ref={ref} {...sharedProps} {...rest}>
      {children}
    </motion.div>
  );
}
