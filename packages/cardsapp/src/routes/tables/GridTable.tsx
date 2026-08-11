import classes from "./GridTable.module.css";
import { Box } from "@mantine/core";
import cx from "clsx";

export type GridCell = {
  key: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  content: string;
};

export function GridTable({ cells }: { cells: GridCell[] }) {
  return (
    <Box className={classes.tableFrame}>
      <Box display="grid" className={classes.tableContainer}>
        {cells.map((cell) => (
          <div
            className={cx(classes.cell, {
              [classes.stickyCell]: cell.colStart === 1,
            })}
            key={cell.key}
            style={{
              gridRow: `${cell.rowStart} / ${cell.rowEnd}`,
              gridColumn: `${cell.colStart} / ${cell.colEnd}`,
            }}
            dangerouslySetInnerHTML={{ __html: cell.content }}
          />
        ))}
      </Box>
    </Box>
  );
}
