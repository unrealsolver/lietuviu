import { parseFragment, serializeOuter } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import type { Plugin } from "vite";

// Define aliases for clarity
type NodeT = DefaultTreeAdapterMap["node"];
type ElementT = DefaultTreeAdapterMap["element"];
type DocumentFragmentT = DefaultTreeAdapterMap["documentFragment"];

export type GridCell = {
  key: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  content: GridContentNode[];
};

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

export type GridModel = {
  rowCount: number;
  colCount: number;
  cells: GridCell[];
};

export function htmlTableToGridPlugin(): Plugin {
  return {
    name: "html-table-to-grid",
    enforce: "pre",
    transform(code, id) {
      const [filepath, rawQuery = ""] = id.split("?");
      const query = new URLSearchParams(rawQuery);

      if (!query.has("grid") || !filepath.endsWith(".html")) return null;

      const model = tableHtmlToGridModel(code);

      return {
        code: `export default ${JSON.stringify(model)};`,
        // Fix: Use null for map instead of 'as any'
        map: { mappings: "" },
      };
    },
  };
}

function tableHtmlToGridModel(html: string): GridModel {
  const normalizedHtml = expandSelfClosingComponents(html);
  const wrapped = /<\s*table[\s>]/i.test(normalizedHtml)
    ? normalizedHtml
    : `<table><tbody>${normalizedHtml}</tbody></table>`;

  // Explicitly cast the result of parseFragment
  const fragment = parseFragment(wrapped) as DocumentFragmentT;

  const table = findFirstElement(fragment, "table");
  if (!table) return { rowCount: 0, colCount: 0, cells: [] };

  const rows = findAllElements(table, "tr");
  const occupancy: boolean[][] = [];
  const cells: GridCell[] = [];

  const ensureRow = (r: number) => {
    while (occupancy.length <= r) occupancy.push([]);
  };
  const isFree = (r: number, c: number) => !(occupancy[r] && occupancy[r][c]);
  const mark = (r0: number, c0: number, rs: number, cs: number) => {
    for (let r = r0; r < r0 + rs; r++) {
      ensureRow(r);
      for (let c = c0; c < c0 + cs; c++) occupancy[r][c] = true;
    }
  };

  let maxCol = 0;

  rows.forEach((tr, r) => {
    ensureRow(r);

    const cellEls = getChildNodes(tr).filter(
      (n): n is ElementT =>
        isElement(n) && (n.tagName === "td" || n.tagName === "th"),
    );

    let c = 0;
    for (const el of cellEls) {
      while (!isFree(r, c)) c++;

      const colSpan = clampInt(getAttr(el, "colspan"), 1);
      const rowSpan = clampInt(getAttr(el, "rowspan"), 1);

      mark(r, c, rowSpan, colSpan);
      maxCol = Math.max(maxCol, c + colSpan);

      const rowStart = r + 1;
      const colStart = c + 1;

      const id = getAttr(el, "id");
      const key = id || `r${rowStart}c${colStart}`;

      const content = gridContentFromChildren(el, key);

      cells.push({
        key,
        rowStart,
        rowEnd: rowStart + rowSpan,
        colStart,
        colEnd: colStart + colSpan,
        content,
      });

      c += colSpan;
    }
  });

  return { rowCount: occupancy.length, colCount: maxCol, cells };
}

/* ---------------- helpers ---------------- */

function clampInt(value: string | null, min: number): number {
  if (!value) return min;
  const n = parseInt(value, 10);
  return isNaN(n) ? min : Math.max(min, n);
}

// Type guard for Elements
function isElement(n: NodeT): n is ElementT {
  return "tagName" in n;
}

function getAttr(el: ElementT, name: string): string | null {
  // parse5 elements have an 'attrs' array of { name, value }
  const found = el.attrs.find(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

function getAttrs(el: ElementT): Record<string, string> {
  return Object.fromEntries(el.attrs.map(({ name, value }) => [name, value]));
}

function getChildNodes(n: NodeT): NodeT[] {
  return "childNodes" in n ? n.childNodes : [];
}

function expandSelfClosingComponents(html: string): string {
  return html.replace(
    /<component\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/\s*>/gi,
    "<component$1></component>",
  );
}

function gridContentFromChildren(
  parent: ElementT,
  cellKey: string,
): GridContentNode[] {
  return coalesceHtmlNodes(
    getChildNodes(parent).map((child) => gridContentFromNode(child, cellKey)),
  );
}

function gridContentFromNode(node: NodeT, cellKey: string): GridContentNode {
  if (isElement(node) && node.tagName.toLowerCase() === "component") {
    return gridComponentFromElement(node, cellKey);
  }

  const nestedComponent = findFirstElement(node, "component");
  if (nestedComponent) {
    throw new Error(
      `<component> in table cell "${cellKey}" must be a direct child of the cell or another <component>.`,
    );
  }

  return { type: "html", html: serializeOuter(node) };
}

function gridComponentFromElement(
  el: ElementT,
  cellKey: string,
): GridContentNode {
  const dataComponent = getAttr(el, "data-component");
  const legacyName = getAttr(el, "_name");

  if (dataComponent && legacyName) {
    throw new Error(
      `<component> in table cell "${cellKey}" must use either data-component or _name, not both.`,
    );
  }

  const name = dataComponent ?? legacyName;
  if (!name) {
    throw new Error(
      `<component> in table cell "${cellKey}" is missing required data-component attribute.`,
    );
  }

  const props = getAttrs(el);
  delete props["data-component"];
  delete props["_name"];

  return {
    type: "component",
    name,
    props,
    children: gridContentFromChildren(el, cellKey),
  };
}

function coalesceHtmlNodes(nodes: GridContentNode[]): GridContentNode[] {
  const out: GridContentNode[] = [];

  for (const node of nodes) {
    const previous = out[out.length - 1];
    if (node.type === "html" && previous?.type === "html") {
      previous.html += node.html;
      continue;
    }

    out.push(node);
  }

  return out;
}

function findFirstElement(root: NodeT, tagName: string): ElementT | null {
  const needle = tagName.toLowerCase();
  const stack: NodeT[] = [root];

  while (stack.length) {
    const node = stack.pop()!;
    if (isElement(node) && node.tagName.toLowerCase() === needle) return node;

    const kids = getChildNodes(node);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return null;
}

function findAllElements(root: NodeT, tagName: string): ElementT[] {
  const needle = tagName.toLowerCase();
  const out: ElementT[] = [];
  const stack: NodeT[] = [root];

  while (stack.length) {
    const node = stack.pop()!;
    if (isElement(node) && node.tagName.toLowerCase() === needle)
      out.push(node);

    const kids = getChildNodes(node);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}
