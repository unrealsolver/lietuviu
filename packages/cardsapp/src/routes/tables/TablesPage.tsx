import headerGridData from "../../tables/cases/header.html?grid";
import _pluralGridData from "../../tables/cases/plural.html?grid";
import _singularGridData from "../../tables/cases/singular.html?grid";
import classes from "./TablesPage.module.css";
import { Box, SegmentedControl } from "@mantine/core";
import { useField } from "@mantine/form";
import cx from "clsx";

type GridCell = {
  key: string;

  // CSS Grid coordinates
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;

  // Content
  content: string;

  // Flags
  stickyCol?: boolean; // first column
  isHeader?: boolean; // for headers
};

const mapper = (prefix: string) => (d: GridCell) => ({
  ...d,
  key: prefix + d.key,
  colStart: d.colStart + 1,
  colEnd: d.colEnd + 1,
  rowStart: d.rowStart + 3,
  rowEnd: d.rowEnd + 3,
});
const singularGridCells = _singularGridData.cells.map(mapper("pl-"));
const pluralGridCells = _pluralGridData.cells.map(mapper("sg-"));

export function TablesPage() {
  const mode = useField<"singular" | "plural">({ initialValue: "singular" });

  const data = headerGridData.cells.concat(
    mode.getValue() == "singular" ? singularGridCells : pluralGridCells,
  );

  return (
    <div>
      <Box p="xs" display="grid" className={classes.tableContainer}>
        {data.map((cell) => (
          <div
            className={cx({
              [classes.cell]: true,
              [classes.stickyCell]: cell.colStart === 1,
            })}
            key={cell.key}
            style={{
              gridRow: `${cell.rowStart} / ${cell.rowEnd}`,
              gridColumn: `${cell.colStart} / ${cell.colEnd}`,
            }}
          >
            {cell.content}
          </div>
        ))}
      </Box>
      <SegmentedControl
        m="xs"
        data={[
          {
            label: "Singular",
            value: "singular",
          },
          {
            label: "Plural",
            value: "plural",
          },
        ]}
        {...mode.getInputProps()}
      />
    </div>
  );
}
