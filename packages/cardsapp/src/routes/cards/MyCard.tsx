import cardClasses from "./Card.module.css";
import { Card, Center } from "@mantine/core";
import type React from "react";

type MyCardProps = {
  children: React.ReactNode;
};

export function MyCard({ children }: MyCardProps) {
  return (
    <Card className={cardClasses.root} p="lg" h="100%">
      <Center h="90%">{children}</Center>
    </Card>
  );
}
