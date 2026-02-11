import headerGridData from "../../tables/cases/header.html?grid";
import _pluralGridData from "../../tables/cases/plural.html?grid";
import _singularGridData from "../../tables/cases/singular.html?grid";
import classes from "./TablesPage.module.css";
import {
  Table,
  Box,
  SegmentedControl,
  Group,
  Text,
  Title,
  Paper,
  Switch,
} from "@mantine/core";
import { useField } from "@mantine/form";
import cx from "clsx";
import { Children, useState } from "react";

type ColumnBand = {
  id: string;
  label: string;
  children?: ColumnBand[];
};

const columnBands: ColumnBand[] = [
  {
    id: "decl1",
    label: "I declension",
    children: [
      {
        id: "m",
        label: "Mas.",
        children: [
          {
            id: "a",
            label: "-ă-",
          },
          {
            id: "i",
            label: "-i-",
          },
        ],
      },
    ],
  },
];

const cases = ["nom", "gen", "dat", "acc", "ins", "loc", "voc"] as const;
const sgPlNumbers = ["sg", "pl"] as const;

type RowBand = {
  number: "sg" | "pl";
  case: "nom" | "gen" | "dat" | "acc" | "ins" | "loc" | "voc";
  label: string; // displayed label: "Nom.", "Gen.", etc.
};

const rowBands: RowBand[] = [
  { number: "sg", case: "nom", label: "Nom." },
  { number: "sg", case: "gen", label: "Gen." },
  { number: "sg", case: "dat", label: "Dat." },
  { number: "pl", case: "nom", label: "Nom." },
  // ...
];

type TableCell = {
  row: string; // RowBand.id
  col: string; // ColumnBand.id (leaf)
  value: string; // "-as", "-ų", "-oms", empty, etc.
};

const cells: TableCell[] = [
  { row: "sg-nom", col: "decl1-m-a", value: "-as" },
  { row: "sg-nom", col: "decl1-f-i", value: "-is" },
  { row: "sg-nom", col: "decl2-m-o", value: "-us" },
  { row: "sg-nom", col: "decl3-mf-e", value: "-is" },
  { row: "sg-nom", col: "decl3-n-uo", value: "-uo" },
  // …
];

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

export const headerAndRowHeaders: GridCell[] = [
  // --- ROW 1 ---
  {
    key: "header-empty",
    rowStart: 1,
    rowEnd: 4, // rowspan=3
    colStart: 1,
    colEnd: 2,
    content: "",
    isHeader: true,
    stickyCol: true,
  },
  {
    key: "dec-1",
    rowStart: 1,
    rowEnd: 2,
    colStart: 2,
    colEnd: 6, // colspan=4
    content: "first declension",
    isHeader: true,
  },
  {
    key: "dec-2",
    rowStart: 1,
    rowEnd: 2,
    colStart: 6,
    colEnd: 9, // colspan=3
    content: "second declension",
    isHeader: true,
  },
  {
    key: "dec-3",
    rowStart: 1,
    rowEnd: 2,
    colStart: 9,
    colEnd: 11, // colspan=2
    content: "third d.",
    isHeader: true,
  },
  {
    key: "dec-4",
    rowStart: 1,
    rowEnd: 2,
    colStart: 11,
    colEnd: 13, // colspan=2
    content: "fourth d.",
    isHeader: true,
  },
  {
    key: "dec-5",
    rowStart: 1,
    rowEnd: 2,
    colStart: 13,
    colEnd: 15, // colspan=2
    content: "fifth d.",
    isHeader: true,
  },

  // --- ROW 2 ---
  {
    key: "gen-m-1",
    rowStart: 2,
    rowEnd: 3,
    colStart: 2,
    colEnd: 6, // colspan=4
    content: "masculine",
    isHeader: true,
  },
  {
    key: "gen-f-1",
    rowStart: 2,
    rowEnd: 3,
    colStart: 6,
    colEnd: 9, // colspan=3
    content: "feminine",
    isHeader: true,
  },
  {
    key: "gen-f-2",
    rowStart: 2,
    rowEnd: 3,
    colStart: 9,
    colEnd: 10,
    content: "f",
    isHeader: true,
  },
  {
    key: "gen-m-2",
    rowStart: 2,
    rowEnd: 3,
    colStart: 10,
    colEnd: 11,
    content: "m",
    isHeader: true,
  },
  {
    key: "gen-m-3",
    rowStart: 2,
    rowEnd: 3,
    colStart: 11,
    colEnd: 13, // colspan=2
    content: "m",
    isHeader: true,
  },
  {
    key: "gen-m-4",
    rowStart: 2,
    rowEnd: 3,
    colStart: 13,
    colEnd: 14,
    content: "m",
    isHeader: true,
  },
  {
    key: "gen-f-3",
    rowStart: 2,
    rowEnd: 3,
    colStart: 14,
    colEnd: 15,
    content: "f",
    isHeader: true,
  },

  // --- ROW 3 ---
  {
    key: "stem-a",
    rowStart: 3,
    rowEnd: 4,
    colStart: 2,
    colEnd: 4,
    content: "-a-",
    isHeader: true,
  },
  {
    key: "stem-i-1",
    rowStart: 3,
    rowEnd: 4,
    colStart: 4,
    colEnd: 6,
    content: "-i-",
    isHeader: true,
  },
  {
    key: "stem-o",
    rowStart: 3,
    rowEnd: 4,
    colStart: 6,
    colEnd: 8,
    content: "-o-",
    isHeader: true,
  },
  {
    key: "stem-e",
    rowStart: 3,
    rowEnd: 4,
    colStart: 8,
    colEnd: 9,
    content: "-ė-",
    isHeader: true,
  },
  {
    key: "stem-i-2",
    rowStart: 3,
    rowEnd: 4,
    colStart: 9,
    colEnd: 11,
    content: "-i-",
    isHeader: true,
  },
  {
    key: "stem-u",
    rowStart: 3,
    rowEnd: 4,
    colStart: 11,
    colEnd: 13,
    content: "-u-",
    isHeader: true,
  },
  {
    key: "stem-i-3",
    rowStart: 3,
    rowEnd: 4,
    colStart: 13,
    colEnd: 15,
    content: "-i-",
    isHeader: true,
  },

  // Row headers (cases) in first column (sticky)
  {
    key: "r_nom",
    rowStart: 4,
    rowEnd: 5,
    colStart: 1,
    colEnd: 2,
    content: "Nominative",
    stickyCol: true,
    isHeader: true,
  },
  {
    key: "r_gen",
    rowStart: 5,
    rowEnd: 6,
    colStart: 1,
    colEnd: 2,
    content: "Genitive",
    stickyCol: true,
    isHeader: true,
  },
  {
    key: "r_dat",
    rowStart: 6,
    rowEnd: 7,
    colStart: 1,
    colEnd: 2,
    content: "Dative",
    stickyCol: true,
    isHeader: true,
  },
  {
    key: "r_acc",
    rowStart: 7,
    rowEnd: 8,
    colStart: 1,
    colEnd: 2,
    content: "Accusative",
    stickyCol: true,
    isHeader: true,
  },
  {
    key: "r_ins",
    rowStart: 8,
    rowEnd: 9,
    colStart: 1,
    colEnd: 2,
    content: "Instrumental",
    stickyCol: true,
    isHeader: true,
  },
  {
    key: "r_loc",
    rowStart: 9,
    rowEnd: 10,
    colStart: 1,
    colEnd: 2,
    content: "Locative",
    stickyCol: true,
    isHeader: true,
  },
  {
    key: "r_voc",
    rowStart: 10,
    rowEnd: 11,
    colStart: 1,
    colEnd: 2,
    content: "Vocative",
    stickyCol: true,
    isHeader: true,
  },
];

const pCells: GridCell[] = [
  // --- ROW 4 (First Body Row) ---
  {
    key: "r4-c2",
    rowStart: 4,
    rowEnd: 5,
    colStart: 2,
    colEnd: 4,
    content: "-ai",
  },
  {
    key: "r4-c4",
    rowStart: 4,
    rowEnd: 5,
    colStart: 4,
    colEnd: 6,
    content: "-iai",
  },
  {
    key: "r4-c6",
    rowStart: 4,
    rowEnd: 5,
    colStart: 6,
    colEnd: 7,
    content: "-os",
  },
  {
    key: "r4-c7",
    rowStart: 4,
    rowEnd: 5,
    colStart: 7,
    colEnd: 8,
    content: "-ios",
  },
  {
    key: "r4-c8",
    rowStart: 4,
    rowEnd: 5,
    colStart: 8,
    colEnd: 9,
    content: "-ės",
  },
  {
    key: "r4-c9",
    rowStart: 4,
    rowEnd: 5,
    colStart: 9,
    colEnd: 11,
    content: "-ys",
  },
  {
    key: "r4-c11",
    rowStart: 4,
    rowEnd: 5,
    colStart: 11,
    colEnd: 12,
    content: "-ūs",
  },
  {
    key: "r4-c12",
    rowStart: 4,
    rowEnd: 5,
    colStart: 12,
    colEnd: 13,
    content: "-iai",
  },
  {
    key: "r4-c13",
    rowStart: 4,
    rowEnd: 5,
    colStart: 13,
    colEnd: 14,
    content: "-en-ys",
  },
  {
    key: "r4-c14",
    rowStart: 4,
    rowEnd: 5,
    colStart: 14,
    colEnd: 15,
    content: "-er-ys",
  },

  // --- ROW 5 ---
  {
    key: "r5-c2",
    rowStart: 5,
    rowEnd: 6,
    colStart: 2,
    colEnd: 4,
    content: "-ų",
  },
  {
    key: "r5-c4",
    rowStart: 5,
    rowEnd: 6,
    colStart: 4,
    colEnd: 6,
    content: "-ių",
  },
  {
    key: "r5-c6",
    rowStart: 5,
    rowEnd: 6,
    colStart: 6,
    colEnd: 7,
    content: "-ų",
  },
  {
    key: "r5-c7",
    rowStart: 5,
    rowEnd: 6,
    colStart: 7,
    colEnd: 8,
    content: "-ių",
  },
  {
    key: "r5-c8",
    rowStart: 5,
    rowEnd: 6,
    colStart: 8,
    colEnd: 9,
    content: "-ių",
  },
  {
    key: "r5-c9",
    rowStart: 5,
    rowEnd: 6,
    colStart: 9,
    colEnd: 11,
    content: "-ių³",
  },
  {
    key: "r5-c11",
    rowStart: 5,
    rowEnd: 6,
    colStart: 11,
    colEnd: 12,
    content: "-ų",
  },
  {
    key: "r5-c12",
    rowStart: 5,
    rowEnd: 6,
    colStart: 12,
    colEnd: 13,
    content: "-ių",
  },
  {
    key: "r5-c13",
    rowStart: 5,
    rowEnd: 6,
    colStart: 13,
    colEnd: 14,
    content: "-en-ų",
  },
  {
    key: "r5-c14",
    rowStart: 5,
    rowEnd: 6,
    colStart: 14,
    colEnd: 15,
    content: "-er-ų",
  },

  // --- ROW 6 ---
  {
    key: "r6-c2",
    rowStart: 6,
    rowEnd: 7,
    colStart: 2,
    colEnd: 4,
    content: "-ams",
  },
  {
    key: "r6-c4",
    rowStart: 6,
    rowEnd: 7,
    colStart: 4,
    colEnd: 6,
    content: "-iams",
  },
  {
    key: "r6-c6",
    rowStart: 6,
    rowEnd: 7,
    colStart: 6,
    colEnd: 7,
    content: "-oms",
  },
  {
    key: "r6-c7",
    rowStart: 6,
    rowEnd: 7,
    colStart: 7,
    colEnd: 8,
    content: "-ioms",
  },
  {
    key: "r6-c8",
    rowStart: 6,
    rowEnd: 7,
    colStart: 8,
    colEnd: 9,
    content: "-ėms",
  },
  {
    key: "r6-c9",
    rowStart: 6,
    rowEnd: 7,
    colStart: 9,
    colEnd: 11,
    content: "-ims",
  },
  {
    key: "r6-c11",
    rowStart: 6,
    rowEnd: 7,
    colStart: 11,
    colEnd: 12,
    content: "-ums",
  },
  {
    key: "r6-c12",
    rowStart: 6,
    rowEnd: 7,
    colStart: 12,
    colEnd: 13,
    content: "-iams",
  },
  {
    key: "r6-c13",
    rowStart: 6,
    rowEnd: 7,
    colStart: 13,
    colEnd: 14,
    content: "-en-ims",
  },
  {
    key: "r6-c14",
    rowStart: 6,
    rowEnd: 7,
    colStart: 14,
    colEnd: 15,
    content: "-er-ims",
  },

  // --- ROW 7 ---
  {
    key: "r7-c2",
    rowStart: 7,
    rowEnd: 8,
    colStart: 2,
    colEnd: 4,
    content: "-us",
  },
  {
    key: "r7-c4",
    rowStart: 7,
    rowEnd: 8,
    colStart: 4,
    colEnd: 6,
    content: "-ius",
  },
  {
    key: "r7-c6",
    rowStart: 7,
    rowEnd: 8,
    colStart: 6,
    colEnd: 7,
    content: "-as",
  },
  {
    key: "r7-c7",
    rowStart: 7,
    rowEnd: 8,
    colStart: 7,
    colEnd: 8,
    content: "-ias",
  },
  {
    key: "r7-c8",
    rowStart: 7,
    rowEnd: 8,
    colStart: 8,
    colEnd: 9,
    content: "-es",
  },
  {
    key: "r7-c9",
    rowStart: 7,
    rowEnd: 8,
    colStart: 9,
    colEnd: 11,
    content: "-is",
  },
  {
    key: "r7-c11",
    rowStart: 7,
    rowEnd: 8,
    colStart: 11,
    colEnd: 12,
    content: "-us",
  },
  {
    key: "r7-c12",
    rowStart: 7,
    rowEnd: 8,
    colStart: 12,
    colEnd: 13,
    content: "-ius",
  },
  {
    key: "r7-c13",
    rowStart: 7,
    rowEnd: 8,
    colStart: 13,
    colEnd: 14,
    content: "-en-is",
  },
  {
    key: "r7-c14",
    rowStart: 7,
    rowEnd: 8,
    colStart: 14,
    colEnd: 15,
    content: "-er-is",
  },

  // --- ROW 8 ---
  {
    key: "r8-c2",
    rowStart: 8,
    rowEnd: 9,
    colStart: 2,
    colEnd: 4,
    content: "-ais",
  },
  {
    key: "r8-c4",
    rowStart: 8,
    rowEnd: 9,
    colStart: 4,
    colEnd: 6,
    content: "-iais",
  },
  {
    key: "r8-c6",
    rowStart: 8,
    rowEnd: 9,
    colStart: 6,
    colEnd: 7,
    content: "-omis",
  },
  {
    key: "r8-c7",
    rowStart: 8,
    rowEnd: 9,
    colStart: 7,
    colEnd: 8,
    content: "-iomis",
  },
  {
    key: "r8-c8",
    rowStart: 8,
    rowEnd: 9,
    colStart: 8,
    colEnd: 9,
    content: "-ėmis",
  },
  {
    key: "r8-c9",
    rowStart: 8,
    rowEnd: 9,
    colStart: 9,
    colEnd: 11,
    content: "-imis",
  },
  {
    key: "r8-c11",
    rowStart: 8,
    rowEnd: 9,
    colStart: 11,
    colEnd: 12,
    content: "-umis",
  },
  {
    key: "r8-c12",
    rowStart: 8,
    rowEnd: 9,
    colStart: 12,
    colEnd: 13,
    content: "-iamis",
  },
  {
    key: "r8-c13",
    rowStart: 8,
    rowEnd: 9,
    colStart: 13,
    colEnd: 14,
    content: "-en-imis",
  },
  {
    key: "r8-c14",
    rowStart: 8,
    rowEnd: 9,
    colStart: 14,
    colEnd: 15,
    content: "-er-imis",
  },

  // --- ROW 9 ---
  {
    key: "r9-c2",
    rowStart: 9,
    rowEnd: 10,
    colStart: 2,
    colEnd: 4,
    content: "-uose",
  },
  {
    key: "r9-c4",
    rowStart: 9,
    rowEnd: 10,
    colStart: 4,
    colEnd: 6,
    content: "-iuose",
  },
  {
    key: "r9-c6",
    rowStart: 9,
    rowEnd: 10,
    colStart: 6,
    colEnd: 7,
    content: "-ose",
  },
  {
    key: "r9-c7",
    rowStart: 9,
    rowEnd: 10,
    colStart: 7,
    colEnd: 8,
    content: "-iose",
  },
  {
    key: "r9-c8",
    rowStart: 9,
    rowEnd: 10,
    colStart: 8,
    colEnd: 9,
    content: "-ėse",
  },
  {
    key: "r9-c9",
    rowStart: 9,
    rowEnd: 10,
    colStart: 9,
    colEnd: 11,
    content: "-yse",
  },
  {
    key: "r9-c11",
    rowStart: 9,
    rowEnd: 10,
    colStart: 11,
    colEnd: 12,
    content: "-uose",
  },
  {
    key: "r9-c12",
    rowStart: 9,
    rowEnd: 10,
    colStart: 12,
    colEnd: 13,
    content: "-iuose",
  },
  {
    key: "r9-c13",
    rowStart: 9,
    rowEnd: 10,
    colStart: 13,
    colEnd: 14,
    content: "-en-yse",
  },
  {
    key: "r9-c14",
    rowStart: 9,
    rowEnd: 10,
    colStart: 14,
    colEnd: 15,
    content: "-er-yse",
  },

  // --- ROW 10 ---
  {
    key: "r10-c2",
    rowStart: 10,
    rowEnd: 11,
    colStart: 2,
    colEnd: 4,
    content: "-ai",
  },
  {
    key: "r10-c4",
    rowStart: 10,
    rowEnd: 11,
    colStart: 4,
    colEnd: 6,
    content: "-iai",
  },
  {
    key: "r10-c6",
    rowStart: 10,
    rowEnd: 11,
    colStart: 6,
    colEnd: 7,
    content: "-os",
  },
  {
    key: "r10-c7",
    rowStart: 10,
    rowEnd: 11,
    colStart: 7,
    colEnd: 8,
    content: "-ios",
  },
  {
    key: "r10-c8",
    rowStart: 10,
    rowEnd: 11,
    colStart: 8,
    colEnd: 9,
    content: "-ės",
  },
  {
    key: "r10-c9",
    rowStart: 10,
    rowEnd: 11,
    colStart: 9,
    colEnd: 11,
    content: "-ys",
  },
  {
    key: "r10-c11",
    rowStart: 10,
    rowEnd: 11,
    colStart: 11,
    colEnd: 12,
    content: "-ūs",
  },
  {
    key: "r10-c12",
    rowStart: 10,
    rowEnd: 11,
    colStart: 12,
    colEnd: 13,
    content: "-iai",
  },
  {
    key: "r10-c13",
    rowStart: 10,
    rowEnd: 11,
    colStart: 13,
    colEnd: 14,
    content: "-en-ys",
  },
  {
    key: "r10-c14",
    rowStart: 10,
    rowEnd: 11,
    colStart: 14,
    colEnd: 15,
    content: "-er-ys",
  },
];

const singularCells: GridCell[] = [
  // --- ROW 4 ---
  {
    key: "s-r4-c2",
    rowStart: 4,
    rowEnd: 5,
    colStart: 2,
    colEnd: 3,
    content: "-as",
  },
  {
    key: "s-r4-c3",
    rowStart: 4,
    rowEnd: 5,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r4-c4",
    rowStart: 4,
    rowEnd: 5,
    colStart: 4,
    colEnd: 5,
    content: "-is -ys",
  },
  {
    key: "s-r4-c5",
    rowStart: 4,
    rowEnd: 5,
    colStart: 5,
    colEnd: 6,
    content: "-ias",
  },
  {
    key: "s-r4-c6",
    rowStart: 4,
    rowEnd: 5,
    colStart: 6,
    colEnd: 7,
    content: "-a",
  },
  {
    key: "s-r4-c7",
    rowStart: 4,
    rowEnd: 5,
    colStart: 7,
    colEnd: 8,
    content: "-ia",
  },
  {
    key: "s-r4-c8",
    rowStart: 4,
    rowEnd: 5,
    colStart: 8,
    colEnd: 9,
    content: "-ė",
  },
  {
    key: "s-r4-c9",
    rowStart: 4,
    rowEnd: 5,
    colStart: 9,
    colEnd: 10,
    content: "-is",
  },
  {
    key: "s-r4-c10",
    rowStart: 4,
    rowEnd: 5,
    colStart: 10,
    colEnd: 11,
    content: "",
  },
  {
    key: "s-r4-c11",
    rowStart: 4,
    rowEnd: 5,
    colStart: 11,
    colEnd: 12,
    content: "-us",
  },
  {
    key: "s-r4-c12",
    rowStart: 4,
    rowEnd: 5,
    colStart: 12,
    colEnd: 13,
    content: "-ius",
  },
  {
    key: "s-r4-c13",
    rowStart: 4,
    rowEnd: 5,
    colStart: 13,
    colEnd: 14,
    content: "-uo",
  },
  {
    key: "s-r4-c14",
    rowStart: 4,
    rowEnd: 5,
    colStart: 14,
    colEnd: 15,
    content: "",
  },

  // --- ROW 5 ---
  {
    key: "s-r5-c2",
    rowStart: 5,
    rowEnd: 6,
    colStart: 2,
    colEnd: 3,
    content: "-o",
  },
  {
    key: "s-r5-c3",
    rowStart: 5,
    rowEnd: 6,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r5-c4",
    rowStart: 5,
    rowEnd: 6,
    colStart: 4,
    colEnd: 5,
    content: "-io",
  },
  {
    key: "s-r5-c5",
    rowStart: 5,
    rowEnd: 6,
    colStart: 5,
    colEnd: 6,
    content: "",
  },
  {
    key: "s-r5-c6",
    rowStart: 5,
    rowEnd: 6,
    colStart: 6,
    colEnd: 7,
    content: "-os",
  },
  {
    key: "s-r5-c7",
    rowStart: 5,
    rowEnd: 6,
    colStart: 7,
    colEnd: 8,
    content: "-ios",
  },
  {
    key: "s-r5-c8",
    rowStart: 5,
    rowEnd: 6,
    colStart: 8,
    colEnd: 9,
    content: "-ės",
  },
  {
    key: "s-r5-c9",
    rowStart: 5,
    rowEnd: 6,
    colStart: 9,
    colEnd: 10,
    content: "-ies",
  },
  {
    key: "s-r5-c10",
    rowStart: 5,
    rowEnd: 6,
    colStart: 10,
    colEnd: 11,
    content: "",
  },
  {
    key: "s-r5-c11",
    rowStart: 5,
    rowEnd: 6,
    colStart: 11,
    colEnd: 12,
    content: "-aus",
  },
  {
    key: "s-r5-c12",
    rowStart: 5,
    rowEnd: 6,
    colStart: 12,
    colEnd: 13,
    content: "-iaus",
  },
  {
    key: "s-r5-c13",
    rowStart: 5,
    rowEnd: 6,
    colStart: 13,
    colEnd: 14,
    content: "-en-s",
  },
  {
    key: "s-r5-c14",
    rowStart: 5,
    rowEnd: 6,
    colStart: 14,
    colEnd: 15,
    content: "-er-s",
  },

  // --- ROW 6 ---
  {
    key: "s-r6-c2",
    rowStart: 6,
    rowEnd: 7,
    colStart: 2,
    colEnd: 3,
    content: "-ui",
  },
  {
    key: "s-r6-c3",
    rowStart: 6,
    rowEnd: 7,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r6-c4",
    rowStart: 6,
    rowEnd: 7,
    colStart: 4,
    colEnd: 5,
    content: "-iui",
  },
  {
    key: "s-r6-c5",
    rowStart: 6,
    rowEnd: 7,
    colStart: 5,
    colEnd: 6,
    content: "",
  },
  {
    key: "s-r6-c6",
    rowStart: 6,
    rowEnd: 7,
    colStart: 6,
    colEnd: 7,
    content: "-ai",
  },
  {
    key: "s-r6-c7",
    rowStart: 6,
    rowEnd: 7,
    colStart: 7,
    colEnd: 8,
    content: "-iai",
  },
  {
    key: "s-r6-c8",
    rowStart: 6,
    rowEnd: 7,
    colStart: 8,
    colEnd: 9,
    content: "-ei",
  },
  {
    key: "s-r6-c9",
    rowStart: 6,
    rowEnd: 7,
    colStart: 9,
    colEnd: 10,
    content: "-iai",
  },
  {
    key: "s-r6-c10",
    rowStart: 6,
    rowEnd: 7,
    colStart: 10,
    colEnd: 11,
    content: "-iui",
  },
  {
    key: "s-r6-c11",
    rowStart: 6,
    rowEnd: 7,
    colStart: 11,
    colEnd: 12,
    content: "-ui",
  },
  {
    key: "s-r6-c12",
    rowStart: 6,
    rowEnd: 7,
    colStart: 12,
    colEnd: 13,
    content: "-iui",
  },
  {
    key: "s-r6-c13",
    rowStart: 6,
    rowEnd: 7,
    colStart: 13,
    colEnd: 14,
    content: "-en-iui",
  },
  {
    key: "s-r6-c14",
    rowStart: 6,
    rowEnd: 7,
    colStart: 14,
    colEnd: 15,
    content: "-er-iai",
  },

  // --- ROW 7 ---
  {
    key: "s-r7-c2",
    rowStart: 7,
    rowEnd: 8,
    colStart: 2,
    colEnd: 3,
    content: "-ą",
  },
  {
    key: "s-r7-c3",
    rowStart: 7,
    rowEnd: 8,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r7-c4",
    rowStart: 7,
    rowEnd: 8,
    colStart: 4,
    colEnd: 5,
    content: "-į",
  },
  {
    key: "s-r7-c5",
    rowStart: 7,
    rowEnd: 8,
    colStart: 5,
    colEnd: 6,
    content: "-ią",
  },
  {
    key: "s-r7-c6",
    rowStart: 7,
    rowEnd: 8,
    colStart: 6,
    colEnd: 7,
    content: "-ą",
  },
  {
    key: "s-r7-c7",
    rowStart: 7,
    rowEnd: 8,
    colStart: 7,
    colEnd: 8,
    content: "-ią",
  },
  {
    key: "s-r7-c8",
    rowStart: 7,
    rowEnd: 8,
    colStart: 8,
    colEnd: 9,
    content: "-ę",
  },
  {
    key: "s-r7-c9",
    rowStart: 7,
    rowEnd: 8,
    colStart: 9,
    colEnd: 10,
    content: "-į",
  },
  {
    key: "s-r7-c10",
    rowStart: 7,
    rowEnd: 8,
    colStart: 10,
    colEnd: 11,
    content: "",
  },
  {
    key: "s-r7-c11",
    rowStart: 7,
    rowEnd: 8,
    colStart: 11,
    colEnd: 12,
    content: "-ų",
  },
  {
    key: "s-r7-c12",
    rowStart: 7,
    rowEnd: 8,
    colStart: 12,
    colEnd: 13,
    content: "-ių",
  },
  {
    key: "s-r7-c13",
    rowStart: 7,
    rowEnd: 8,
    colStart: 13,
    colEnd: 14,
    content: "-en-į",
  },
  {
    key: "s-r7-c14",
    rowStart: 7,
    rowEnd: 8,
    colStart: 14,
    colEnd: 15,
    content: "-er-į",
  },

  // --- ROW 8 ---
  {
    key: "s-r8-c2",
    rowStart: 8,
    rowEnd: 9,
    colStart: 2,
    colEnd: 3,
    content: "-u",
  },
  {
    key: "s-r8-c3",
    rowStart: 8,
    rowEnd: 9,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r8-c4",
    rowStart: 8,
    rowEnd: 9,
    colStart: 4,
    colEnd: 5,
    content: "-iu",
  },
  {
    key: "s-r8-c5",
    rowStart: 8,
    rowEnd: 9,
    colStart: 5,
    colEnd: 6,
    content: "",
  },
  {
    key: "s-r8-c6",
    rowStart: 8,
    rowEnd: 9,
    colStart: 6,
    colEnd: 7,
    content: "-a",
  },
  {
    key: "s-r8-c7",
    rowStart: 8,
    rowEnd: 9,
    colStart: 7,
    colEnd: 8,
    content: "-ia",
  },
  {
    key: "s-r8-c8",
    rowStart: 8,
    rowEnd: 9,
    colStart: 8,
    colEnd: 9,
    content: "-e",
  },
  {
    key: "s-r8-c9",
    rowStart: 8,
    rowEnd: 9,
    colStart: 9,
    colEnd: 10,
    content: "-imi",
  },
  {
    key: "s-r8-c10",
    rowStart: 8,
    rowEnd: 9,
    colStart: 10,
    colEnd: 11,
    content: "",
  },
  {
    key: "s-r8-c11",
    rowStart: 8,
    rowEnd: 9,
    colStart: 11,
    colEnd: 12,
    content: "-umi",
  },
  {
    key: "s-r8-c12",
    rowStart: 8,
    rowEnd: 9,
    colStart: 12,
    colEnd: 13,
    content: "-iumi",
  },
  {
    key: "s-r8-c13",
    rowStart: 8,
    rowEnd: 9,
    colStart: 13,
    colEnd: 14,
    content: "-en-iu",
  },
  {
    key: "s-r8-c14",
    rowStart: 8,
    rowEnd: 9,
    colStart: 14,
    colEnd: 15,
    content: "-er-imi",
  },

  // --- ROW 9 ---
  {
    key: "s-r9-c2",
    rowStart: 9,
    rowEnd: 10,
    colStart: 2,
    colEnd: 3,
    content: "-e",
  },
  {
    key: "s-r9-c3",
    rowStart: 9,
    rowEnd: 10,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r9-c4",
    rowStart: 9,
    rowEnd: 10,
    colStart: 4,
    colEnd: 5,
    content: "-yje",
  },
  {
    key: "s-r9-c5",
    rowStart: 9,
    rowEnd: 10,
    colStart: 5,
    colEnd: 6,
    content: "",
  },
  {
    key: "s-r9-c6",
    rowStart: 9,
    rowEnd: 10,
    colStart: 6,
    colEnd: 7,
    content: "-oje",
  },
  {
    key: "s-r9-c7",
    rowStart: 9,
    rowEnd: 10,
    colStart: 7,
    colEnd: 8,
    content: "-ioje",
  },
  {
    key: "s-r9-c8",
    rowStart: 9,
    rowEnd: 10,
    colStart: 8,
    colEnd: 9,
    content: "-ėje",
  },
  {
    key: "s-r9-c9",
    rowStart: 9,
    rowEnd: 10,
    colStart: 9,
    colEnd: 10,
    content: "-yje",
  },
  {
    key: "s-r9-c10",
    rowStart: 9,
    rowEnd: 10,
    colStart: 10,
    colEnd: 11,
    content: "",
  },
  {
    key: "s-r9-c11",
    rowStart: 9,
    rowEnd: 10,
    colStart: 11,
    colEnd: 12,
    content: "-uje",
  },
  {
    key: "s-r9-c12",
    rowStart: 9,
    rowEnd: 10,
    colStart: 12,
    colEnd: 13,
    content: "-iuje",
  },
  {
    key: "s-r9-c13",
    rowStart: 9,
    rowEnd: 10,
    colStart: 13,
    colEnd: 14,
    content: "-en-yje",
  },
  {
    key: "s-r9-c14",
    rowStart: 9,
    rowEnd: 10,
    colStart: 14,
    colEnd: 15,
    content: "-er-yje",
  },

  // --- ROW 10 ---
  {
    key: "s-r10-c2",
    rowStart: 10,
    rowEnd: 11,
    colStart: 2,
    colEnd: 3,
    content: "-e¹",
  },
  {
    key: "s-r10-c3",
    rowStart: 10,
    rowEnd: 11,
    colStart: 3,
    colEnd: 4,
    content: "",
  },
  {
    key: "s-r10-c4",
    rowStart: 10,
    rowEnd: 11,
    colStart: 4,
    colEnd: 5,
    content: "-i -y",
  },
  {
    key: "s-r10-c5",
    rowStart: 10,
    rowEnd: 11,
    colStart: 5,
    colEnd: 6,
    content: "-y²",
  },
  {
    key: "s-r10-c6",
    rowStart: 10,
    rowEnd: 11,
    colStart: 6,
    colEnd: 7,
    content: "-a",
  },
  {
    key: "s-r10-c7",
    rowStart: 10,
    rowEnd: 11,
    colStart: 7,
    colEnd: 8,
    content: "-ia",
  },
  {
    key: "s-r10-c8",
    rowStart: 10,
    rowEnd: 11,
    colStart: 8,
    colEnd: 9,
    content: "-e",
  },
  {
    key: "s-r10-c9",
    rowStart: 10,
    rowEnd: 11,
    colStart: 9,
    colEnd: 10,
    content: "-ie.",
  },
  {
    key: "s-r10-c10",
    rowStart: 10,
    rowEnd: 11,
    colStart: 10,
    colEnd: 11,
    content: "",
  },
  {
    key: "s-r10-c11",
    rowStart: 10,
    rowEnd: 11,
    colStart: 11,
    colEnd: 12,
    content: "-au",
  },
  {
    key: "s-r10-c12",
    rowStart: 10,
    rowEnd: 11,
    colStart: 12,
    colEnd: 13,
    content: "-iau",
  },
  {
    key: "s-r10-c13",
    rowStart: 10,
    rowEnd: 11,
    colStart: 13,
    colEnd: 14,
    content: "-en-ie.",
  },
  {
    key: "s-r10-c14",
    rowStart: 10,
    rowEnd: 11,
    colStart: 14,
    colEnd: 15,
    content: "-er-ie",
  },
];

function rowKey(rowBand: RowBand) {
  return `${rowBand.number}-${rowBand.case}`;
}

function normalizeColBands(
  colBand: ColumnBand,
  path: string[] = [],
): [number, Record<string, GridCell>] {
  const selfKey = path.join("-");

  if (colBand.children == null || colBand.children.length === 0) {
    const cell: GridCell = {
      key: selfKey,
      content: colBand.label,
      isHeader: true,
      rowStart: path.length,
      rowEnd: path.length,
      headerLevel: path.length,
    };
    return [1, { [selfKey]: cell }];
  }

  let totalWidth = 0;
  const widths: Record<string, number> = {};

  for (const child of colBand.children) {
    const [childWidth, childWidths] = normalizeColBands(
      child,
      path.concat(child.id),
    );
    totalWidth += childWidth;
    Object.assign(widths, childWidths);
  }

  widths[selfKey] = totalWidth;

  return [totalWidth, widths];
}

function normalize(): GridCell[] {
  const headerOffset = 3;
  const r = normalizeColBands(columnBands[0], [columnBands[0].id]);
  const rowCells = rowBands.map((d, idx) => {
    return {
      key: rowKey(d),
      colStart: 1,
      colEnd: 1,
      content: d.label,
      rowStart: headerOffset + idx,
      rowEnd: headerOffset + idx,
      stickyCol: true,
    };
  });

  return rowCells;
}

console.log(headerGridData);

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
  const isPlural = useField({ initialValue: false, type: "checkbox" });

  const data = headerGridData.cells.concat(
    isPlural.getValue() ? singularGridCells : pluralGridCells,
  );

  return (
    <div>
      <Box display="grid" className={classes.tableContainer}>
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
      <Switch label="Plural/Singular" {...isPlural.getInputProps()} />
    </div>
  );
}
