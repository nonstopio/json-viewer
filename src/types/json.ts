export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export interface ParseResult {
  success: boolean;
  data?: JsonValue;
  error?: string;
  // True when the input didn't parse as-is and was auto-corrected before
  // succeeding. The result may differ from what the user pasted.
  wasModified?: boolean;
  errorDetails?: {
    line?: number;
    column?: number;
    position?: number;
  };
}

export interface JsonNode {
  key?: string;
  value: JsonValue;
  type: "string" | "number" | "boolean" | "null" | "object" | "array";
  path: string;
  depth: number;
  isExpanded?: boolean;
  childCount?: number;
}

export interface JsonStats {
  totalNodes: number;
  maxDepth: number;
  typeDistribution: Record<string, number>;
  arrayLengths: number[];
  objectSizes: number[];
}
