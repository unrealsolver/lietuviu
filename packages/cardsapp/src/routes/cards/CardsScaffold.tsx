import classes from "./CardsScaffold.module.css";
import {
  ActionIcon,
  Center,
  Group,
  Stack,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import type { ReactNode } from "react";

type CardsScaffoldProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

export function CardsScaffold({
  children,
  header,
  footer,
}: CardsScaffoldProps) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return (
    <Stack p="sm" pb="xs" h="100vh" style={{ overflow: "hidden" }}>
      <Group gap={0}>
        <div
          className={classes.headerSlot}
          data-visible={header != null}
          aria-hidden={header == null}
        >
          {header}
        </div>
        <ActionIcon
          ml="auto"
          size="xl"
          aria-label="Toggle color scheme"
          variant="transparent"
          onClick={() =>
            setColorScheme(computedColorScheme === "light" ? "dark" : "light")
          }
        >
          <IconSun className={classes.light} />
          <IconMoon className={classes.dark} />
        </ActionIcon>
      </Group>
      <Center flex={1} className={classes.contentArea}>
        <div className={classes.contentColumn}>{children}</div>
      </Center>
      {footer != null ? <Center>{footer}</Center> : null}
    </Stack>
  );
}
