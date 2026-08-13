import classes from "./GridTable.module.css";
import { Box } from "@mantine/core";
import cx from "clsx";
import { type ElementType, type ReactNode } from "react";

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

export type GridComponentRegistry = Record<string, ElementType>;

export function GridTable({
  cells,
  components = {},
}: {
  cells: GridCell[];
  components?: GridComponentRegistry;
}) {
  return (
    <Box className={classes.tableFrame}>
      <Box display="grid" className={classes.tableContainer}>
        {cells.map((cell) => {
          const htmlContent = getStaticHtml(cell.content);
          const cellProps = {
            className: cx(classes.cell, {
              [classes.stickyCell]: cell.colStart === 1,
            }),
            key: cell.key,
            style: {
              gridRow: `${cell.rowStart} / ${cell.rowEnd}`,
              gridColumn: `${cell.colStart} / ${cell.colEnd}`,
            },
          };

          return htmlContent === null ? (
            <div {...cellProps}>
              {renderContent(cell.content, components, cell.key)}
            </div>
          ) : (
            <div
              {...cellProps}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

function getStaticHtml(content: GridContentNode[]): string | null {
  let html = "";

  for (const node of content) {
    if (node.type !== "html") return null;
    html += node.html;
  }

  return html;
}

function renderContent(
  content: GridContentNode[],
  components: GridComponentRegistry,
  keyPrefix: string,
): ReactNode {
  return content.map((node, index) => {
    const key = `${keyPrefix}:${index}`;

    if (node.type === "html") {
      return <span key={key} dangerouslySetInnerHTML={{ __html: node.html }} />;
    }

    const Component = components[node.name];
    if (!Component) {
      throw new Error(`Unknown table component "${node.name}".`);
    }

    return (
      <Component {...node.props} key={key}>
        {renderContent(node.children, components, `${key}:children`)}
      </Component>
    );
  });
}
