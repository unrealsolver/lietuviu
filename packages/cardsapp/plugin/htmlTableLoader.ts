import { parseFragment, serialize } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import type { Plugin } from "vite";

// Define aliases for clarity
type NodeT = DefaultTreeAdapterMap["node"];
type ElementT = DefaultTreeAdapterMap["element"];
type TextNodeT = DefaultTreeAdapterMap["textNode"];
type DocumentFragmentT = DefaultTreeAdapterMap["documentFragment"];

export type GridCell = {
  key: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  content: string;
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
  const wrapped = /<\s*table[\s>]/i.test(html)
    ? html
    : `<table><tbody>${html}</tbody></table>`;

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

      // FIX: Passing the element to serialize() returns its inner HTML.
      const content = serialize(el);

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

// Type guard for TextNodes (if you need n.value)
function isTextNode(n: NodeT): n is TextNodeT {
  return "value" in n;
}

function getAttr(el: ElementT, name: string): string | null {
  // parse5 elements have an 'attrs' array of { name, value }
  const found = el.attrs.find(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

function getChildNodes(n: NodeT): NodeT[] {
  return "childNodes" in n ? n.childNodes : [];
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
