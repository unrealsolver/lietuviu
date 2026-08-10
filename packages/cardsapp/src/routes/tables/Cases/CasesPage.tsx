import headerGridData from "../../../tables/cases/header.html?grid";
import _pluralGridData from "../../../tables/cases/plural.html?grid";
import _singularGridData from "../../../tables/cases/singular.html?grid";
import { GridTable } from "../GridTable";
import type { GridCell } from "../GridTable";
import { SegmentedControl } from "@mantine/core";
import { useField } from "@mantine/form";

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

export function CasesPage() {
  const mode = useField<"singular" | "plural">({ initialValue: "singular" });

  const data = headerGridData.cells.concat(
    mode.getValue() == "singular" ? singularGridCells : pluralGridCells,
  );

  return (
    <>
      <GridTable cells={data} />
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
    </>
  );
}
