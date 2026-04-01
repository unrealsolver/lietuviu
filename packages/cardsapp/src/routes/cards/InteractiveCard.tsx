import cardClasses from "./Card.module.css";
import { SwipeIndicator } from "./SwipeIndicator";
import { Box, RingProgress, ThemeIcon } from "@mantine/core";
import { useSpring, animated, config, to } from "@react-spring/web";
import {
  IconLock,
  IconThumbDownFilled,
  IconThumbUpFilled,
} from "@tabler/icons-react";
import { useDrag } from "@use-gesture/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type SwipeDirection = "left" | "right";
// Determines swipe animation completeness state. Higher value - longer delay
const SWIPE_COMPLETE_DISTANCE_RATIO = 0.82;

type InteractiveCardProps = {
  front: ReactNode;
  back: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPullDownComplete?: (nextFlipped: boolean) => void;
  allowSwipeLeft?: boolean;
  allowSwipeRight?: boolean;
  allowPullDown?: boolean;
  lockKey?: string | number;
  lockDurationMs?: number;
};

export function InteractiveCard({
  front,
  back,
  onSwipeLeft,
  onSwipeRight,
  onPullDownComplete,
  allowSwipeLeft = true,
  allowSwipeRight = true,
  allowPullDown = true,
  lockKey,
  lockDurationMs = 0,
}: InteractiveCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { isLocked, lockProgress } = useInteractionLock(
    lockKey,
    lockDurationMs,
  );
  const pendingPullDownRef = useRef<boolean | null>(null);

  const [{ opacity, rot, ...style }, api] = useSpring(() => ({
    from: { opacity: 0, scale: 0.5, y: 0, x: 0, rot: 0 },
    to: { opacity: 1, scale: 1 },
    config: config.default,
  }));

  // x axis drag before threshold, -1..<0>..+1
  const xDrag = to(style.x, (val) => Math.max(-1, Math.min(1, val / 200)));
  const rightDragStrength = to(xDrag, (val) => Math.max(val, 0));
  const leftDragStrength = to(xDrag, (val) => Math.max(-val, 0));
  const xDragStrength = to(xDrag, (val) => Math.abs(val));

  const { rotateY } = useSpring({
    rotateY: Number(isFlipped) * 180,
    config: config.default,
    onRest: () => {
      if (pendingPullDownRef.current == null) {
        return;
      }

      const nextFlipped = pendingPullDownRef.current;
      pendingPullDownRef.current = null;
      onPullDownComplete?.(nextFlipped);
    },
  });

  const frontStyle = {
    transform: to(
      [rotateY, rot],
      (r, currentRot) =>
        `perspective(1000px) rotateY(${r}deg) rotateZ(${currentRot}deg)`,
    ),
    opacity: to([rotateY, opacity], (r, currentOpacity) =>
      Math.min(+(r < 90), currentOpacity),
    ),
  };

  const backStyle = {
    transform: to(
      [rotateY, rot],
      (r, currentRot) =>
        `perspective(1000px) rotateY(${r + 180}deg) rotateZ(${currentRot}deg)`,
    ),
    opacity: to([rotateY, opacity], (r, currentOpacity) =>
      Math.min(+(r > 90), currentOpacity),
    ),
  };

  function resetPosition() {
    api.start({ x: 0, y: 0, scale: 1, rot: 0 });
  }

  function completeSwipe(direction: SwipeDirection) {
    if (direction === "right") {
      onSwipeRight?.();
    } else {
      onSwipeLeft?.();
    }
  }

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx] }) => {
      if (isLocked) {
        resetPosition();
        return;
      }

      if (down) {
        api.start({
          x: mx,
          rot: mx / 100,
          y: my,
          scale: 1.05,
          immediate: false,
        });
        return;
      }

      if (Math.abs(vx) > 0.35) {
        const swipeDirection: SwipeDirection = dx > 0 ? "right" : "left";
        const swipeAllowed =
          (swipeDirection === "left" && allowSwipeLeft) ||
          (swipeDirection === "right" && allowSwipeRight);

        if (!swipeAllowed) {
          resetPosition();
          return;
        }

        const targetDirection = swipeDirection === "right" ? 1 : -1;
        let didTriggerSwipe = false;
        api.start({
          // coefficient controls speed
          x: targetDirection * window.innerWidth * 1.5,
          y: 0,
          opacity: 0,
          rot: dx * vx * 10,
          onChange: (result) => {
            if (didTriggerSwipe) {
              return;
            }

            const currentX = result.value.x;
            const swipeThreshold =
              window.innerWidth * SWIPE_COMPLETE_DISTANCE_RATIO;

            if (Math.abs(currentX) < swipeThreshold) {
              return;
            }

            didTriggerSwipe = true;
            completeSwipe(swipeDirection);
          },
          onRest: () => {
            if (didTriggerSwipe) {
              return;
            }

            completeSwipe(swipeDirection);
          },
        });
        return;
      }

      if (my > 100 || vy > 0.35) {
        if (allowPullDown) {
          const nextFlipped = !isFlipped;
          pendingPullDownRef.current = nextFlipped;
          setIsFlipped(nextFlipped);
        }
        resetPosition();
        return;
      }

      resetPosition();
    },
    {
      preventDefault: true,
    },
  );

  const lockIndicator = isLocked ? (
    <div className={cardClasses.lockBadge}>
      <RingProgress
        size={48}
        thickness={5}
        roundCaps
        sections={[{ value: Math.min(lockProgress, 100), color: "yellow" }]}
        label={
          <ThemeIcon variant="transparent" color="gray" size="sm" mx="auto">
            <IconLock size={16} />
          </ThemeIcon>
        }
      />
    </div>
  ) : null;

  const rightSwipeIndicator = (
    <SwipeIndicator
      color="green"
      icon={<IconThumbUpFilled size="100%" />}
      anchor="left"
      strength={rightDragStrength}
      top={(value) => `${75 - value * 100}px`}
      rotate={(value) => `rotateZ(${-value * 10}deg)`}
    />
  );

  const leftSwipeIndicator = (
    <SwipeIndicator
      color="red"
      icon={<IconThumbDownFilled size="100%" />}
      anchor="right"
      strength={leftDragStrength}
      top={(value) => `${value * 50}px`}
      rotate={(value) => `rotateZ(${value * 10}deg)`}
    />
  );

  return (
    <div className={cardClasses.frame}>
      <animated.div
        {...bind()}
        style={{ ...style, ...frontStyle }}
        className={cardClasses.card}
      >
        {lockIndicator}
        {rightSwipeIndicator}
        {leftSwipeIndicator}
        {front}
      </animated.div>
      <animated.div
        {...bind()}
        style={{ ...style, ...backStyle }}
        className={cardClasses.card}
      >
        {lockIndicator}
        {back}
      </animated.div>
    </div>
  );
}

function useInteractionLock(
  lockKey: string | number | undefined,
  lockDurationMs: number,
) {
  const [lockProgress, setLockProgress] = useState(100);
  const [lockUntil, setLockUntil] = useState(0);

  useEffect(() => {
    if (lockDurationMs <= 0) {
      setLockUntil(0);
      setLockProgress(100);
      return;
    }

    const nextLockUntil = Date.now() + lockDurationMs;
    setLockUntil(nextLockUntil);
    setLockProgress(0);

    let frameId = 0;

    const tick = () => {
      const remaining = nextLockUntil - Date.now();
      if (remaining <= 0) {
        setLockProgress(100);
        return;
      }

      setLockProgress(100 * (1 - remaining / lockDurationMs));
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [lockDurationMs, lockKey]);

  return {
    isLocked: lockUntil > Date.now(),
    lockProgress,
  };
}
