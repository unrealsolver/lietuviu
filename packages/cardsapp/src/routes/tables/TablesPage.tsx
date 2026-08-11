import { Group, Stack } from "@mantine/core";
import { Link, Outlet } from "react-router";

export function TablesPage() {
  return (
    <Stack gap="xs" p="xs">
      <Group gap="md">
        <Link to="/tables/cases">Linksniai</Link>
        <Link to="/tables/personal-pronouns">Asmeniniai įvardžiai</Link>
      </Group>
      <Outlet />
    </Stack>
  );
}
