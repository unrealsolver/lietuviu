import {useState} from "react";
import classes from "./App.module.css";
import {
  ActionIcon,
  Center,
  SegmentedControl,
  Stack,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import {SwipeExperiment} from "./SwipeExperiment";
import {FlipExperiment} from "./FlipExperiement";

function App() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const [mode, setMode] = useState("Swipe")

  return (
    <Stack p="sm" h="100vh" style={{ overflow: "hidden" }}>
      <ActionIcon
        ml="auto"
        size="xl"
        aria-aria-label="Toggle color scheme"
        variant="transparent"
        onClick={() =>
          setColorScheme(computedColorScheme === "light" ? "dark" : "light")
        }
      >
        <IconSun className={classes.light} />
        <IconMoon className={classes.dark} />
      </ActionIcon>
      <Center flex={1} pos='relative'>
        {mode === 'Swipe' ? <SwipeExperiment /> : <FlipExperiment />}
      </Center>
      <Center>
        <SegmentedControl data={["Swipe", "Flip"]} value={mode} onChange={setMode}></SegmentedControl>
      </Center>
    </Stack>
  );
}

export default App;
