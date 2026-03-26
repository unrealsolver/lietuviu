import cardClasses from "./Card.module.css";
import { Card, Center } from "@mantine/core";
import type { ReactNode } from "react";

type CardFaceProps = {
  children: ReactNode;
  centered?: boolean;
};

export function CardFace({ children, centered = true }: CardFaceProps) {
  return (
    <Card className={cardClasses.face} p="lg" h="100%">
      {centered ? (
        <Center className={cardClasses.centeredContent}>{children}</Center>
      ) : (
        children
      )}
    </Card>
  );
}
