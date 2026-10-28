import { useEffect, useRef, useState } from "react";

const DURATION_MS = 800;

// Matches --ease-smooth (cubic-bezier(0.16, 1, 0.3, 1)) closely enough for a
// numeric tween without pulling framer-motion's animate() in for one value.
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;
    if (from === to) return;

    let frame: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setDisplay(Math.round(from + (to - from) * easeOutExpo(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}
