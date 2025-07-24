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
  errorDetails?: {
    line?: number;
    column?: number;
    position?: number;
  };
}

export interface JsonNode {
  key?: string;
  value: JsonValue;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
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