import {JsonValue, JsonNode, JsonStats, ParseResult} from "../types/json";
import {trackEvent} from "./analytics";

export class JsonParser {
  private stats: JsonStats = {
    totalNodes: 0,
    maxDepth: 0,
    typeDistribution: {},
    arrayLengths: [],
    objectSizes: [],
  };

  parseJson(input: string): ParseResult {
    if (!input.trim()) {
      return {
        success: false,
        error: "Input is empty",
      };
    }

    try {
      const startTime = performance.now();

      // Try parsing as-is first
      let cleanedInput = input;
      let data: JsonValue;

      try {
        data = JSON.parse(input) as JsonValue;
      } catch (firstError) {
        // Apply comprehensive cleaning
        cleanedInput = this.cleanJsonString(input);

        try {
          data = JSON.parse(cleanedInput) as JsonValue;

          // Track that we had to clean the JSON but don't show error to user
          trackEvent("json_parse_error", {
            errorType: "json_auto_fixed",
            fileSize: input.length,
            errorMessage: `JSON was automatically fixed. Issues: quotes, URLs, control chars`,
          });
        } catch (secondError) {
          // Try even more aggressive fixes
          cleanedInput = this.aggressiveCleanup(cleanedInput);

          try {
            data = JSON.parse(cleanedInput) as JsonValue;

            trackEvent("json_parse_error", {
              errorType: "json_aggressively_fixed",
              fileSize: input.length,
              errorMessage: `JSON required aggressive fixes but succeeded`,
            });
          } catch (thirdError) {
            // Last resort: try to extract JSON from the string if it's wrapped
            const extracted = this.extractJsonFromString(input);
            if (extracted) {
              try {
                data = JSON.parse(extracted) as JsonValue;

                trackEvent("json_parse_error", {
                  errorType: "json_extracted_and_fixed",
                  fileSize: input.length,
                  errorMessage: `JSON was extracted from string wrapper and fixed`,
                });
              } catch {
                // Final fallback - if we still can't parse, show error
                throw new Error(
                  `Unable to parse JSON after all cleanup attempts. This may not be valid JSON data.`
                );
              }
            } else {
              // Final fallback - if we still can't parse, show error
              throw new Error(
                `Unable to parse JSON after all cleanup attempts. This may not be valid JSON data.`
              );
            }
          }
        }
      }

      const parseTime = performance.now() - startTime;

      trackEvent("json_parsed", {
        fileSize: input.length,
        nodeCount: this.countNodes(data),
        parseTime,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = this.getDetailedError(error as SyntaxError, input);

      trackEvent("json_parse_error", {
        errorType: "final_parse_failure",
        fileSize: input.length,
        errorMessage: errorMessage.error,
      });

      return errorMessage;
    }
  }

  private getDetailedError(error: SyntaxError, input: string): ParseResult {
    const message = error.message;
    const errorDetails: {line?: number; column?: number; position?: number} =
      {};

    // Extract position information from common JSON error messages
    const positionMatch = message.match(/position (\d+)/i);
    if (positionMatch) {
      const position = parseInt(positionMatch[1], 10);
      errorDetails.position = position;

      // Calculate line and column
      const lines = input.substring(0, position).split("\n");
      errorDetails.line = lines.length;
      errorDetails.column = lines[lines.length - 1].length + 1;
    }

    // Extract line information
    const lineMatch = message.match(/line (\d+)/i);
    if (lineMatch) {
      errorDetails.line = parseInt(lineMatch[1], 10);
    }

    // Extract column information
    const columnMatch = message.match(/column (\d+)/i);
    if (columnMatch) {
      errorDetails.column = parseInt(columnMatch[1], 10);
    }

    let friendlyError = this.getFriendlyErrorMessage(message);

    if (errorDetails.line && errorDetails.column) {
      friendlyError += ` (Line ${errorDetails.line}, Column ${errorDetails.column})`;
    }

    return {
      success: false,
      error: friendlyError,
      errorDetails,
    };
  }

  private cleanJsonString(input: string): string {
    let cleaned = input.trim();

    // Check if this is a JSON string that's been serialized (starts and ends with quotes)
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      try {
        // Try to parse it as a JSON string first
        cleaned = JSON.parse(cleaned);
      } catch {
        // If that fails, manually unescape it
        cleaned = cleaned.slice(1, -1); // Remove outer quotes
        cleaned = cleaned.replace(/\\"/g, '"'); // Unescape quotes
        cleaned = cleaned.replace(/\\\\/g, "\\"); // Unescape backslashes
      }
    }

    // Handle multiple levels of quote escaping (like ""status"" or """status""")
    cleaned = cleaned.replace(/"{2,}/g, '"'); // Replace multiple quotes with single quote

    // Remove single-line comments (// ...)
    cleaned = cleaned.replace(/\/\/.*$/gm, "");

    // Remove multi-line comments (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");

    // Remove trailing commas before closing brackets/braces
    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

    // Remove control characters that can break JSON parsing (except newlines and tabs)
    cleaned = cleaned.replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
      ""
    );

    // Fix unquoted URLs - be more aggressive and comprehensive
    // Handle URLs that may have parentheses in CSS imports or other contexts
    cleaned = cleaned.replace(
      /:\s*(https?:\/\/[^\s,"}\]]+(?:\([^)]*\))?[^\s,"}\]]*)/g,
      ': "$1"'
    );

    // Fix unquoted email addresses
    cleaned = cleaned.replace(
      /:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?=\s*[,}\]])/g,
      ': "$1"'
    );

    // Fix unquoted CSS/style values that contain URLs
    cleaned = cleaned.replace(/(@import\s+url\()([^)]+)(\))/g, '$1"$2"$3');

    // Fix unquoted file paths and URLs in HTML/CSS content
    cleaned = cleaned.replace(
      /(src=|href=|url\()\s*([^"'\s>,}]+\.[a-zA-Z0-9]+)/g,
      '$1"$2"'
    );

    // Fix CSS color values that aren't quoted (like color:8f8f8f)
    cleaned = cleaned.replace(/:\s*([a-fA-F0-9]{6})(?=\s*[;"}\]])/g, ': "$1"');

    // Fix any remaining unquoted values that look like identifiers after colons
    // But be careful not to break boolean/number values
    cleaned = cleaned.replace(
      /:\s*([a-zA-Z][a-zA-Z0-9._-]*(?:\.[a-zA-Z0-9._-]+)*(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)(?=\s*[,}\]])/g,
      (match, value) => {
        // Don't quote boolean values, numbers, or null
        if (
          ["true", "false", "null"].includes(value.toLowerCase()) ||
          /^\d+(\.\d+)?$/.test(value)
        ) {
          return match;
        }
        return `: "${value}"`;
      }
    );

    // Clean up extra whitespace but preserve structure
    cleaned = cleaned.replace(/\n\s*\n/g, "\n");

    return cleaned;
  }

  private aggressiveCleanup(input: string): string {
    let cleaned = input;

    // Remove any BOM or weird Unicode characters
    cleaned = cleaned.replace(/^\uFEFF/, ""); // Remove BOM
    // eslint-disable-next-line no-control-regex
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove all control chars

    // Fix common issues with nested quotes in HTML/CSS content
    cleaned = cleaned.replace(/(['"]).+?\1/g, (match) => {
      // Replace inner quotes with escaped quotes
      return match.replace(/(["'])(.*?)\1/g, (_, quote, content) => {
        return (
          quote + content.replace(/"/g, '\\"').replace(/'/g, "\\'") + quote
        );
      });
    });

    // Try to fix malformed JSON structure issues
    // Fix missing commas between object properties
    cleaned = cleaned.replace(/"\s*\n\s*"/g, '",\n    "');

    // Fix missing commas between array elements
    cleaned = cleaned.replace(/}\s*\n\s*{/g, "},\n    {");

    // Remove any remaining problematic characters
    cleaned = cleaned.replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u00FF]/g,
      ""
    );

    return cleaned;
  }

  private extractJsonFromString(input: string): string | null {
    // Try to find JSON content within the string
    const jsonMatch = input.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return this.cleanJsonString(jsonMatch[0]);
    }

    // Try to find array content
    const arrayMatch = input.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return this.cleanJsonString(arrayMatch[0]);
    }

    return null;
  }

  private getFriendlyErrorMessage(message: string): string {
    const errorMappings: Array<[RegExp, string]> = [
      [
        /unexpected token.*in JSON at position/i,
        "Invalid character found - possibly escaped JSON string, unquoted URLs, or control characters",
      ],
      [
        /unexpected end of JSON input/i,
        "JSON appears to be incomplete - missing closing brackets or quotes",
      ],
      [
        /expected property name or '}'/i,
        "Missing property name or invalid object syntax - property names must be quoted",
      ],
      [/expected ',' or '}'/i, "Missing comma between object properties"],
      [/expected ',' or ']'/i, "Missing comma between array elements"],
      [/trailing comma/i, "Remove the trailing comma"],
      [/duplicate.*key/i, "Duplicate property names are not allowed"],
      [
        /control character/i,
        "Invalid control characters found - these have been automatically removed",
      ],
      [
        /unterminated string/i,
        "String is missing closing quote - possibly escaped JSON string",
      ],
      [
        /unexpected token '\/'/,
        "JSON does not support comments. Please remove // or /* */ comments",
      ],
      [
        /invalid character/i,
        "Invalid characters detected - URLs and emails must be quoted",
      ],
    ];

    for (const [pattern, friendlyMessage] of errorMappings) {
      if (pattern.test(message)) {
        return friendlyMessage;
      }
    }

    return "Invalid JSON format - this may be an escaped JSON string or API response with formatting issues. Automatic cleanup attempted.";
  }

  convertToNodes(data: JsonValue, rootKey = "root"): JsonNode[] {
    this.resetStats();
    const nodes: JsonNode[] = [];
    this.processValue(data, rootKey, "", 0, nodes);
    return nodes;
  }

  private resetStats(): void {
    this.stats = {
      totalNodes: 0,
      maxDepth: 0,
      typeDistribution: {},
      arrayLengths: [],
      objectSizes: [],
    };
  }

  private processValue(
    value: JsonValue,
    key: string,
    path: string,
    depth: number,
    nodes: JsonNode[]
  ): void {
    const currentPath = path ? `${path}.${key}` : key;
    const type = this.getValueType(value);

    this.stats.totalNodes++;
    this.stats.maxDepth = Math.max(this.stats.maxDepth, depth);
    this.stats.typeDistribution[type] =
      (this.stats.typeDistribution[type] || 0) + 1;

    const node: JsonNode = {
      key,
      value,
      type,
      path: currentPath,
      depth,
      isExpanded: depth < 2, // Auto-expand first 2 levels
    };

    if (type === "array" && Array.isArray(value)) {
      node.childCount = value.length;
      this.stats.arrayLengths.push(value.length);
      nodes.push(node);

      if (node.isExpanded) {
        value.forEach((item, index) => {
          this.processValue(item, `[${index}]`, currentPath, depth + 1, nodes);
        });
      }
    } else if (
      type === "object" &&
      value !== null &&
      typeof value === "object"
    ) {
      const objectValue = value as Record<string, JsonValue>;
      const keys = Object.keys(objectValue);
      node.childCount = keys.length;
      this.stats.objectSizes.push(keys.length);
      nodes.push(node);

      if (node.isExpanded) {
        keys.forEach((objKey) => {
          this.processValue(
            objectValue[objKey],
            objKey,
            currentPath,
            depth + 1,
            nodes
          );
        });
      }
    } else {
      nodes.push(node);
    }
  }

  private getValueType(value: JsonValue): JsonNode["type"] {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value as "string" | "number" | "boolean";
  }

  expandNode(nodes: JsonNode[], targetPath: string): JsonNode[] {
    const result = [...nodes];
    const nodeIndex = result.findIndex((node) => node.path === targetPath);

    if (nodeIndex === -1) return result;

    const node = result[nodeIndex];
    if (node.isExpanded) return result;

    node.isExpanded = true;
    result[nodeIndex] = {...node};

    // Insert child nodes
    const childNodes: JsonNode[] = [];

    if (node.type === "array" && Array.isArray(node.value)) {
      node.value.forEach((item, index) => {
        this.processValue(
          item,
          `[${index}]`,
          node.path,
          node.depth + 1,
          childNodes
        );
      });
    } else if (
      node.type === "object" &&
      node.value !== null &&
      typeof node.value === "object"
    ) {
      const objectValue = node.value as Record<string, JsonValue>;
      Object.keys(objectValue).forEach((key) => {
        this.processValue(
          objectValue[key],
          key,
          node.path,
          node.depth + 1,
          childNodes
        );
      });
    }

    result.splice(nodeIndex + 1, 0, ...childNodes);

    trackEvent("node_expanded", {
      nodeType: node.type,
      nodeDepth: node.depth,
      childCount: node.childCount,
    });

    return result;
  }

  collapseNode(nodes: JsonNode[], targetPath: string): JsonNode[] {
    const result = [...nodes];
    const nodeIndex = result.findIndex((node) => node.path === targetPath);

    if (nodeIndex === -1) return result;

    const node = result[nodeIndex];
    if (!node.isExpanded) return result;

    node.isExpanded = false;
    result[nodeIndex] = {...node};

    // Remove child nodes
    let removeCount = 0;
    for (let i = nodeIndex + 1; i < result.length; i++) {
      if (
        result[i].path.startsWith(targetPath + ".") ||
        result[i].path.startsWith(targetPath + "[")
      ) {
        removeCount++;
      } else {
        break;
      }
    }

    result.splice(nodeIndex + 1, removeCount);

    trackEvent("node_collapsed", {
      nodeType: node.type,
      nodeDepth: node.depth,
      childCount: node.childCount,
    });

    return result;
  }

  getStats(): JsonStats {
    return {...this.stats};
  }

  private countNodes(value: JsonValue): number {
    let count = 1;

    if (Array.isArray(value)) {
      count += value.reduce(
        (sum: number, item: JsonValue) => sum + this.countNodes(item),
        0
      );
    } else if (value !== null && typeof value === "object") {
      count += Object.values(value as Record<string, JsonValue>).reduce(
        (sum: number, item: JsonValue) => sum + this.countNodes(item),
        0
      );
    }

    return count;
  }

  searchNodes(
    nodes: JsonNode[],
    query: string,
    caseSensitive = false
  ): {nodes: JsonNode[]; matchIndices: number[]} {
    if (!query.trim()) return {nodes, matchIndices: []};

    // Get the root data to search against the complete structure
    const rootNode = nodes.find((node) => node.key === "root");
    if (!rootNode) return {nodes, matchIndices: []};

    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const matchingPaths = new Set<string>();

    // Search through the complete data structure to find all matches
    this.findMatchingPaths(
      rootNode.value,
      "root",
      "",
      searchQuery,
      caseSensitive,
      matchingPaths
    );

    // If no matches found, return original nodes
    if (matchingPaths.size === 0) {
      trackEvent("search_performed", {
        searchQuery: query,
        searchResultCount: 0,
        caseSensitive,
      });
      return {nodes, matchIndices: []};
    }

    // Find all parent paths that need to be expanded
    const pathsToExpand = new Set<string>();
    matchingPaths.forEach((matchPath) => {
      let currentPath = "";
      const pathParts = matchPath.split(".");
      pathParts.forEach((part, index) => {
        if (index === 0) {
          currentPath = part;
        } else {
          currentPath += "." + part;
        }
        if (currentPath !== matchPath) {
          pathsToExpand.add(currentPath);
        }
      });
    });

    // Rebuild the tree with necessary nodes expanded
    const expandedNodes: JsonNode[] = [];
    this.processValueWithSearch(
      rootNode.value,
      "root",
      "",
      0,
      expandedNodes,
      pathsToExpand,
      matchingPaths
    );

    // Find match indices in the new expanded tree
    const matchIndices: number[] = [];
    expandedNodes.forEach((node, index) => {
      if (matchingPaths.has(node.path)) {
        matchIndices.push(index);
      }
    });

    trackEvent("search_performed", {
      searchQuery: query,
      searchResultCount: matchIndices.length,
      caseSensitive,
    });

    return {nodes: expandedNodes, matchIndices};
  }

  private findMatchingPaths(
    value: JsonValue,
    key: string,
    path: string,
    searchQuery: string,
    caseSensitive: boolean,
    matchingPaths: Set<string>
  ): void {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if current key or value matches
    const keyMatch = caseSensitive
      ? key.includes(searchQuery)
      : key.toLowerCase().includes(searchQuery);

    const searchableValue = this.getSearchableValue(value);
    const valueMatch = caseSensitive
      ? searchableValue.includes(searchQuery)
      : searchableValue.toLowerCase().includes(searchQuery);

    if (keyMatch || valueMatch) {
      matchingPaths.add(currentPath);
    }

    // Recursively check children
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        this.findMatchingPaths(
          item,
          `[${index}]`,
          currentPath,
          searchQuery,
          caseSensitive,
          matchingPaths
        );
      });
    } else if (value !== null && typeof value === "object") {
      const objectValue = value as Record<string, JsonValue>;
      Object.keys(objectValue).forEach((objKey) => {
        this.findMatchingPaths(
          objectValue[objKey],
          objKey,
          currentPath,
          searchQuery,
          caseSensitive,
          matchingPaths
        );
      });
    }
  }

  private processValueWithSearch(
    value: JsonValue,
    key: string,
    path: string,
    depth: number,
    nodes: JsonNode[],
    pathsToExpand: Set<string>,
    matchingPaths: Set<string>
  ): void {
    const currentPath = path ? `${path}.${key}` : key;
    const type = this.getValueType(value);

    const shouldExpand =
      pathsToExpand.has(currentPath) || matchingPaths.has(currentPath);

    const node: JsonNode = {
      key,
      value,
      type,
      path: currentPath,
      depth,
      isExpanded: shouldExpand && (type === "object" || type === "array"),
    };

    if (type === "array" && Array.isArray(value)) {
      node.childCount = value.length;
      nodes.push(node);

      if (node.isExpanded) {
        value.forEach((item, index) => {
          this.processValueWithSearch(
            item,
            `[${index}]`,
            currentPath,
            depth + 1,
            nodes,
            pathsToExpand,
            matchingPaths
          );
        });
      }
    } else if (
      type === "object" &&
      value !== null &&
      typeof value === "object"
    ) {
      const objectValue = value as Record<string, JsonValue>;
      const keys = Object.keys(objectValue);
      node.childCount = keys.length;
      nodes.push(node);

      if (node.isExpanded) {
        keys.forEach((objKey) => {
          this.processValueWithSearch(
            objectValue[objKey],
            objKey,
            currentPath,
            depth + 1,
            nodes,
            pathsToExpand,
            matchingPaths
          );
        });
      }
    } else {
      nodes.push(node);
    }
  }

  private getSearchableValue(value: JsonValue): string {
    if (value === null) return "null";
    if (typeof value === "object") return "";
    return String(value);
  }

  expandAllNodes(nodes: JsonNode[]): JsonNode[] {
    // Get the root data from the first node
    const rootNode = nodes.find((node) => node.key === "root");
    if (!rootNode) return nodes;

    // Rebuild the entire tree with all nodes expanded
    const expandedNodes: JsonNode[] = [];
    this.processValueWithExpandAll(
      rootNode.value,
      "root",
      "",
      0,
      expandedNodes
    );

    trackEvent("expand_all_nodes", {
      totalNodes: expandedNodes.length,
      expandedCount: expandedNodes.filter(
        (node) => node.type === "object" || node.type === "array"
      ).length,
    });

    return expandedNodes;
  }

  private processValueWithExpandAll(
    value: JsonValue,
    key: string,
    path: string,
    depth: number,
    nodes: JsonNode[]
  ): void {
    const currentPath = path ? `${path}.${key}` : key;
    const type = this.getValueType(value);

    const node: JsonNode = {
      key,
      value,
      type,
      path: currentPath,
      depth,
      isExpanded: type === "object" || type === "array", // Expand all container types
    };

    if (type === "array" && Array.isArray(value)) {
      node.childCount = value.length;
      nodes.push(node);

      // Always process children since we're expanding all
      value.forEach((item, index) => {
        this.processValueWithExpandAll(
          item,
          `[${index}]`,
          currentPath,
          depth + 1,
          nodes
        );
      });
    } else if (
      type === "object" &&
      value !== null &&
      typeof value === "object"
    ) {
      const objectValue = value as Record<string, JsonValue>;
      const keys = Object.keys(objectValue);
      node.childCount = keys.length;
      nodes.push(node);

      // Always process children since we're expanding all
      keys.forEach((objKey) => {
        this.processValueWithExpandAll(
          objectValue[objKey],
          objKey,
          currentPath,
          depth + 1,
          nodes
        );
      });
    } else {
      nodes.push(node);
    }
  }

  collapseAllNodes(nodes: JsonNode[]): JsonNode[] {
    const result = [...nodes];
    const collapsibleNodes = result.filter(
      (node) =>
        (node.type === "object" || node.type === "array") && node.isExpanded
    );

    for (const node of collapsibleNodes) {
      const collapsedNodes = this.collapseNode(result, node.path);
      result.splice(0, result.length, ...collapsedNodes);
    }

    trackEvent("collapse_all_nodes", {
      totalNodes: result.length,
      collapsedCount: collapsibleNodes.length,
    });

    return result;
  }
}

export const jsonParser = new JsonParser();
