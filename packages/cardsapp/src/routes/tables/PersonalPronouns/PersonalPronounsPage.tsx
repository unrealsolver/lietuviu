import personalPronounsGridData from "../../../tables/personal-pronouns.html?grid";
import { GridTable, type GridComponentRegistry } from "../GridTable";
import classes from "../GridTable.module.css";
import type { ReactNode } from "react";

function CaseName({ children }: { children: ReactNode }) {
  return <span className={classes.caseName}>{children}</span>;
}

function CaseQuestion({ children }: { children: ReactNode }) {
  return <span className={classes.caseQuestion}>{children}</span>;
}

const personalPronounsComponents = {
  CaseName,
  CaseQuestion,
} satisfies GridComponentRegistry;

export function PersonalPronounsPage() {
  return (
    <GridTable
      cells={personalPronounsGridData.cells}
      components={personalPronounsComponents}
    />
  );
}
