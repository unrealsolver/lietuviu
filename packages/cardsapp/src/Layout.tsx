import { resolveAppLayoutGate } from "./Layout.logic";
import {
  acknowledgeFirstStartUp,
  ensureDbReady,
  hardResetAppDb,
  isFirstStartUp,
  shouldConfirmDbWipe,
} from "./db";
import {
  Text,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";

type AppDialogProps = React.PropsWithChildren;

function AppDialog({ children }: AppDialogProps) {
  return (
    <Stack h="66vh" justify="center">
      <Container size="md">
        <Paper m="lg" p="lg">
          {children}
        </Paper>
      </Container>
    </Stack>
  );
}

export function AppLayout() {
  const [isFirstStartup, setIsFirstStartup] = useState<boolean | null>(null);
  const [confirmWipe, setConfirmWipe] = useState<boolean | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGates() {
      const [firstStartupValue, confirmWipeValue] = await Promise.all([
        isFirstStartUp(),
        shouldConfirmDbWipe(),
      ]);
      if (cancelled) {
        return;
      }
      setIsFirstStartup(firstStartupValue);
      setConfirmWipe(confirmWipeValue);
    }

    loadGates().catch((error) => {
      if (cancelled) {
        return;
      }
      setInitError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAcknowledgeStartup() {
    setIsBusy(true);
    try {
      await acknowledgeFirstStartUp();
      setIsFirstStartup(false);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAcknowledgeWipe() {
    setIsBusy(true);
    try {
      await ensureDbReady();
      setConfirmWipe(false);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleManualReset() {
    setIsBusy(true);
    try {
      await hardResetAppDb();
      window.location.reload();
    } finally {
      setIsBusy(false);
    }
  }

  const gate = resolveAppLayoutGate({
    initError,
    isFirstStartup,
    confirmWipe,
  });

  if (gate === "init-error") {
    return (
      <AppDialog>
        <Title>Storage startup failed</Title>
        <Text>
          Failed to initialize local database state. You can reset local data
          and continue.
        </Text>
        <Text size="sm" c="dimmed">
          Error: {initError}
        </Text>
        <Group justify="center" mt="sm">
          <Button loading={isBusy} onClick={handleManualReset}>
            Reset local data
          </Button>
        </Group>
      </AppDialog>
    );
  }

  if (gate === "loading") {
    return (
      <AppDialog>
        <Title>Starting up</Title>
        <Text>Preparing local storage...</Text>
      </AppDialog>
    );
  }

  if (gate === "disclaimer") {
    return (
      <AppDialog>
        <Title>Disclaimer</Title>
        <Text>
          This app is in early development mode. Bugs, data loss, and
          regressions are expected.
        </Text>
        <Group justify="center" mt="sm">
          <Button loading={isBusy} onClick={handleAcknowledgeStartup}>
            Understood
          </Button>
        </Group>
      </AppDialog>
    );
  }

  if (gate === "wipe-confirm") {
    return (
      <AppDialog>
        <Title>Database reset</Title>
        <Text>
          As an early prototype, this app update requires a full local database
          reset.
        </Text>
        <Text fw="bold">
          This action is unavoidable. All local data is lost.
        </Text>
        <Group justify="center" mt="sm">
          <Button loading={isBusy} onClick={handleAcknowledgeWipe}>
            Understood
          </Button>
        </Group>
      </AppDialog>
    );
  }

  return <Outlet />;
}
