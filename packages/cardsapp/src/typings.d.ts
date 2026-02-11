declare module "*.html?grid" {
  export type GridCell = {
    key: string;
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
    content: string;
  };

  const model: {
    rowCount: number;
    colCount: number;
    cells: GridCell[];
  };

  export default model;
}
