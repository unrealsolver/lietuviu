import cardClasses from "./Card.module.css";
import { Box } from "@mantine/core";
import { animated, Interpolation, to } from "@react-spring/web";
import type { ReactNode } from "react";

type SwipeIndicatorProps = {
  anchor: "left" | "right";
  color: string;
  icon: ReactNode;
  strength: Interpolation<number>;
  /** interpolated CSS */
  top: (value: number) => string;
  /** interpolated CSS */
  rotate: (value: number) => string;
};

export function SwipeIndicator({
  anchor,
  color,
  icon,
  strength,
  top,
  rotate,
}: SwipeIndicatorProps) {
  const anchorStyle =
    anchor === "left"
      ? { left: to(strength, (value) => `${50 - value * 100}px`) }
      : { right: to(strength, (value) => `${50 - value * 100}px`) };

  return (
    <animated.div
      style={{
        opacity: to(strength, (value) => value * value * value),
        top: to(strength, top),
        height: to(strength, (value) => `${3 + value * 5}rem`),
        width: to(strength, (value) => `${3 + value * 5}rem`),
        transform: to(strength, rotate),
        ...anchorStyle,
      }}
      className={cardClasses.swipeIndicator}
    >
      <Box c={color}>{icon}</Box>
    </animated.div>
  );
}
