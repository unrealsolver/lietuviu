import { Group, Stack } from "@mantine/core";
import { Link, Outlet } from "react-router";

export function TablesPage() {
  return (
    <Stack gap="xs">
      <Group gap="md" m="xs">
        <Link to="/tables/cases">Linksniai</Link>
        <Link to="/tables/personal-pronouns">Asmeniniai įvardžiai</Link>
      </Group>
      <Outlet />
    </Stack>
  );
}
