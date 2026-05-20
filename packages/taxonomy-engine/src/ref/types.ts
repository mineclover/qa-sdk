import type { Coordinate } from "../schema/ir.js";

export type TaxonomyRef =
  | { taxonomy: string; version?: number; kind: "taxonomy" }
  | { taxonomy: string; version?: number; kind: "axis"; axis: string }
  | {
      taxonomy: string;
      version?: number;
      kind: "entry";
      axis: string;
      entry: string;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "entry-by-address";
      axis: string;
      address: number;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "entry-field";
      axis: string;
      entry: string;
      pointer: string[];
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "coordinate";
      coord: Coordinate;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "relation";
      relation: string;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "relation-rule";
      relation: string;
      ruleIdx: number;
    }
  | {
      taxonomy: string;
      version?: number;
      kind: "constraint";
      constraint: string;
    };

export type RefResult =
  | { kind: "taxonomy"; ref: TaxonomyRef; ir: unknown }
  | { kind: "axis"; ref: TaxonomyRef; axis: unknown }
  | { kind: "entry"; ref: TaxonomyRef; entry: unknown }
  | {
      kind: "coordinate";
      ref: TaxonomyRef;
      coord: Coordinate;
      addresses: number[];
    }
  | { kind: "relation"; ref: TaxonomyRef; relation: unknown }
  | { kind: "constraint"; ref: TaxonomyRef; constraint: unknown }
  | { kind: "field"; ref: TaxonomyRef; value: unknown };
