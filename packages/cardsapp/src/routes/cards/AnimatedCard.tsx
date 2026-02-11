import cardClasses from "./Card.module.css";
import { MyCard } from "./MyCard";
import type { WordStat } from "./util";
import { Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useSpring, animated, to, config } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";

type AnimatedCardProps = {
  word: string;
  wordObj: { word: string; accent: string; translate: { rus: string } };
  onSwipeLeft: (word: string) => void;
  onSwipeRight: (word: string) => void;
  stat: WordStat;
};

export function AnimatedCard({
  word,
  wordObj,
  onSwipeLeft,
  onSwipeRight,
  stat,
}: AnimatedCardProps) {
  const [isFlipped, { toggle }] = useDisclosure(false);
  console.log(wordObj);

  const [{ opacity, rot, ...style }, api] = useSpring(() => ({
    from: { opacity: 0, scale: 0.5, y: 0, x: 0, rot: 0 },
    to: { opacity: 1, scale: 1 },
    config: config.default,
  }));

  const { rotateY } = useSpring({
    rotateY: Number(isFlipped) * 180,
    config: config.default,
  });

  const frontStyle = {
    transform: to(
      [rotateY, rot],
      (r, rot) => `perspective(1000px) rotateY(${r}deg) rotateZ(${rot}deg)`,
    ),
    opacity: to([rotateY, opacity], (r, opacity) =>
      Math.min(+(r < 90), opacity),
    ),
  };

  const backStyle = {
    transform: to(
      [rotateY, rot],
      (r, rot) =>
        `perspective(1000px) rotateY(${r + 180}deg) rotateZ(${rot}deg)`,
    ),
    opacity: to([rotateY, opacity], (r, opacity) =>
      Math.min(+(r > 90), opacity),
    ),
  };

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx] }) => {
      if (down) {
        api.start({
          x: mx,
          rot: mx / 100,
          y: my,
          scale: 1.05,
          immediate: false,
        });
      } else {
        if (Math.abs(vx) > 0.35) {
          // swipe left or right → fly out
          const dir = dx > 0 ? 1 : -1;
          const goneAt = 0.9;
          // X axis boundry for card despawn trigger. Smaller than screen a little
          const goneXDist = goneAt * window.innerWidth;
          api.start({
            x: dir * window.innerWidth * 2,
            y: 0,
            opacity: 0,
            rot: dx * vx * 10,
            onChange: (result) => {
              const x = result.value.x;
              if (Math.abs(x) > goneXDist) {
                // Load new data here
                //api.start({ opacity: 0, scale: 0.5, x: 0, y: 0, rotateY: 0 });
                if (dx > 0) {
                  onSwipeRight(word);
                } else {
                  onSwipeLeft(word);
                }
              }
            },
          });
        } else {
          if (my > 100 || vy > 0.35) {
            // vertical swipe → flip
            toggle();
          }
          // snap back
          api.start({ x: 0, y: 0, scale: 1 });
        }
      }
    },
    {
      preventDefault: true,
    },
  );

  return (
    <>
      <animated.div
        {...bind()}
        style={{ ...style, ...frontStyle }}
        className={cardClasses.card}
      >
        <MyCard>
          <Title ta="center" order={1}>
            {word}
          </Title>
        </MyCard>
      </animated.div>
      <animated.div
        {...bind()}
        style={{ ...style, ...backStyle }}
        className={cardClasses.card}
      >
        <MyCard>
          <Stack align="center">
            <Title order={1}>{wordObj.accent}</Title>
            <Title order={2}>{wordObj.translate.rus}</Title>
            <Title order={1}>
              {stat.accepts} / {stat.rejects}
            </Title>
          </Stack>
        </MyCard>
      </animated.div>
    </>
  );
}
