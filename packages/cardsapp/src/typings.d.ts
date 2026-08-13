declare module "*.html?grid" {
  export type GridContentNode =
    | {
        type: "html";
        html: string;
      }
    | {
        type: "component";
        name: string;
        props: Record<string, string>;
        children: GridContentNode[];
      };

  export type GridCell = {
    key: string;
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
    content: GridContentNode[];
  };

  const model: {
    rowCount: number;
    colCount: number;
    cells: GridCell[];
  };

  export default model;
}
