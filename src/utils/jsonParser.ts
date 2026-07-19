import {JsonValue, JsonNode, JsonStats, ParseResult} from "../types/json";
import parseJson from "json-parse-even-better-errors";

// Type definition for json-parse-even-better-errors
interface JsonParseError extends Error {
  line?: number;
  column?: number;
  position?: number;
  offset?: number;
}

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

    // Fast path: the native parser is many times faster than the lenient
    // json-parse-even-better-errors parser and covers the common case (valid
    // JSON). This is what keeps Format / Remove-whitespace / Parse snappy on
    // large input. Only fall through to the lenient + cleanup pipeline below
    // when the input isn't already valid JSON.
    try {
      const data = JSON.parse(input) as JsonValue;
      return {success: true, data, wasModified: false};
    } catch {
      // Not strict-valid JSON — fall through to the lenient/cleanup pipeline.
    }

    try {
      let data: JsonValue;
      let needsCleanup = false;

      try {
        // First try with the better error parser
        data = parseJson(input) as JsonValue;
      } catch (firstError) {
        // If that fails, try our cleanup methods
        needsCleanup = true;
        let cleanedInput = this.cleanJsonString(input);

        try {
          data = parseJson(cleanedInput) as JsonValue;
        } catch (secondError) {
          // Try even more aggressive fixes
          cleanedInput = this.aggressiveCleanup(cleanedInput);

          try {
            data = parseJson(cleanedInput) as JsonValue;
          } catch (thirdError) {
            // Last resort: try to extract JSON from the string if it's wrapped
            const extracted = this.extractJsonFromString(input);
            if (extracted) {
              try {
                data = parseJson(extracted) as JsonValue;
              } catch {
                // If all else fails, throw the original error with better details
                throw firstError;
              }
            } else {
              // If all else fails, throw the original error with better details
              throw firstError;
            }
          }
        }
      }

      return {
        success: true,
        data,
        wasModified: needsCleanup,
      };
    } catch (error) {
      const errorMessage = this.getDetailedErrorFromBetterParser(
        error as JsonParseError,
        input
      );

      return errorMessage;
    }
  }

  private getDetailedErrorFromBetterParser(
    error: JsonParseError,
    input: string
  ): ParseResult {
    const errorDetails: {line?: number; column?: number; position?: number} =
      {};
    let friendlyError = "Invalid JSON format";

    // The json-parse-even-better-errors library provides better error information
    if (error && typeof error === "object") {
      // Extract position information if available
      if (error.line !== undefined) {
        errorDetails.line = error.line;
      }
      if (error.column !== undefined) {
        errorDetails.column = error.column;
      }
      if (error.position !== undefined) {
        errorDetails.position = error.position;
      }

      // If we have position but missing line/column, calculate them
      if (
        errorDetails.position !== undefined &&
        (!errorDetails.line || !errorDetails.column)
      ) {
        const lines = input.substring(0, errorDetails.position).split("\n");
        errorDetails.line = lines.length;
        errorDetails.column = lines[lines.length - 1].length + 1;
      }

      // Use the error message from the better parser
      if (error.message) {
        friendlyError = this.getFriendlyErrorMessage(error.message);
      }
    }

    // If still no position info, try manual detection as fallback
    if (!errorDetails.position && !errorDetails.line && !errorDetails.column) {
      const manualError = this.findErrorLocationManually(input);
      if (manualError) {
        Object.assign(errorDetails, manualError);
      }
    }

    if (errorDetails.line && errorDetails.column) {
      friendlyError += ` (Line ${errorDetails.line}, Column ${errorDetails.column})`;
    }

    return {
      success: false,
      error: friendlyError,
      errorDetails,
    };
  }

  private findErrorLocationManually(
    input: string
  ): {line?: number; column?: number; position?: number} | null {
    const lines = input.split("\n");

    // Strategy 0: Look for unterminated strings (missing closing quotes)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let inString = false;
      let stringStartCol = -1;
      let escapeNext = false;

      for (let col = 0; col < line.length; col++) {
        const char = line[col];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          if (!inString) {
            inString = true;
            stringStartCol = col;
          } else {
            inString = false;
            stringStartCol = -1;
          }
        }
      }

      // If we're still in a string at the end of the line, check if it's really unterminated
      if (inString && stringStartCol !== -1) {
        // Check if this is a multiline string by looking at the next line
        const nextLine = lines[lineIndex + 1];
        if (!nextLine || !nextLine.trim().startsWith('"')) {
          // This string is unterminated
          const position = this.getPositionFromLineColumn(
            input,
            lineIndex + 1,
            line.length + 1
          );

          return {
            line: lineIndex + 1,
            column: line.length + 1,
            position,
          };
        }
      }
    }

    // Strategy 1: Look for missing commas by examining line patterns
    for (let lineIndex = 0; lineIndex < lines.length - 1; lineIndex++) {
      const currentLine = lines[lineIndex];
      const nextLine = lines[lineIndex + 1];

      // Check if current line ends with a value and next line starts with a property
      const currentTrimmed = currentLine.trim();
      const nextTrimmed = nextLine.trim();

      // Pattern: line ends with number, string, boolean, or } and next line starts with "
      if (
        currentTrimmed &&
        nextTrimmed.startsWith('"') &&
        nextTrimmed.includes(":")
      ) {
        // Check if current line should have a comma
        if (
          !currentTrimmed.endsWith(",") &&
          !currentTrimmed.endsWith("{") &&
          !currentTrimmed.endsWith("[")
        ) {
          // This line is missing a comma
          const position = this.getPositionFromLineColumn(
            input,
            lineIndex + 1,
            currentLine.length + 1
          );

          return {
            line: lineIndex + 1,
            column: currentLine.length + 1,
            position,
          };
        }
      }
    }

    // Strategy 2: Use a simple JSON validator to find the exact error position
    const validationError = this.validateJsonAndFindError(input);
    if (validationError) {
      return validationError;
    }

    // Strategy 3: Character-by-character parsing to find exact error
    try {
      const stack: string[] = [];
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\" && inString) {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{" || char === "[") {
            stack.push(char);
          } else if (char === "}" || char === "]") {
            const expected = char === "}" ? "{" : "[";
            if (stack.length === 0 || stack[stack.length - 1] !== expected) {
              const lines = input.substring(0, i).split("\n");
              const line = lines.length;
              const column = lines[lines.length - 1].length + 1;

              return {line, column, position: i};
            }
            stack.pop();
          }
        }
      }
    } catch {
      // ignore; fall through to other strategies
    }

    // Strategy 3: Look for trailing commas
    const trailingCommaRegex = /,\s*([}\]])/g;
    let match;
    while ((match = trailingCommaRegex.exec(input)) !== null) {
      const commaPosition = match.index;
      const beforeComma = input.substring(0, commaPosition);
      const lines = beforeComma.split("\n");
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;

      return {
        line,
        column,
        position: commaPosition,
      };
    }

    // Strategy 4: Look for specific patterns like "processingTime": 0.234\n    "checksum"
    const processingTimeMatch = input.match(
      /"processingTime":\s*[\d.]+\s*\n\s*"checksum"/
    );
    if (processingTimeMatch) {
      const matchStart = input.indexOf(processingTimeMatch[0]);

      // Find the position right after the number
      const numberMatch = input
        .substring(matchStart)
        .match(/"processingTime":\s*([\d.]+)/);
      if (numberMatch) {
        const numberEnd =
          matchStart + numberMatch.index! + numberMatch[0].length;
        const beforeError = input.substring(0, numberEnd);
        const lines = beforeError.split("\n");
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        return {
          line,
          column,
          position: numberEnd,
        };
      }
    }

    return null;
  }

  private validateJsonAndFindError(
    input: string
  ): {line?: number; column?: number; position?: number} | null {
    let line = 1;
    let column = 1;
    let inString = false;
    let escapeNext = false;
    const stack: Array<{char: string; line: number; column: number}> = [];

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      // Update line and column tracking
      if (char === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        if (!inString) {
          // Starting a string
          inString = true;

          // Check if we're at the end of input or if the string is never closed
          let j = i + 1;
          let foundClosingQuote = false;
          let localEscapeNext = false;

          while (j < input.length) {
            if (localEscapeNext) {
              localEscapeNext = false;
              j++;
              continue;
            }

            if (input[j] === "\\") {
              localEscapeNext = true;
              j++;
              continue;
            }

            if (input[j] === '"') {
              foundClosingQuote = true;
              break;
            }

            if (input[j] === "\n") {
              // Newline in string without closing quote
              break;
            }

            j++;
          }

          if (!foundClosingQuote) {
            return {
              line,
              column,
              position: i,
            };
          }
        } else {
          // Ending a string
          inString = false;
        }
        continue;
      }

      if (!inString) {
        if (char === "{" || char === "[") {
          stack.push({char, line, column});
        } else if (char === "}" || char === "]") {
          const expected = char === "}" ? "{" : "[";
          if (stack.length === 0) {
            return {line, column, position: i};
          }
          const last = stack[stack.length - 1];
          if (last.char !== expected) {
            return {line, column, position: i};
          }
          stack.pop();

          // Check if this might be the end of the JSON
          if (stack.length === 0) {
            // Look ahead for any non-whitespace characters
            for (let j = i + 1; j < input.length; j++) {
              if (!/\s/.test(input[j])) {
                const beforeError = input.substring(0, j);
                const errorLines = beforeError.split("\n");
                const errorLine = errorLines.length;
                const errorColumn =
                  errorLines[errorLines.length - 1].length + 1;

                return {
                  line: errorLine,
                  column: errorColumn,
                  position: j,
                };
              }
            }
          }
        } else if (char === ":" || char === ",") {
          // Valid JSON syntax characters
        } else if (!/\s/.test(char) && stack.length > 0) {
          // Found an invalid character inside JSON structure
          return {
            line,
            column,
            position: i,
          };
        }
      }
    }

    // Check for unclosed brackets
    if (stack.length > 0) {
      const unclosed = stack[stack.length - 1];
      return {
        line: unclosed.line,
        column: unclosed.column,
        position: -1,
      };
    }

    // Check if we're still in a string
    if (inString) {
      return {
        line,
        column,
        position: input.length - 1,
      };
    }

    return null;
  }

  private getPositionFromLineColumn(
    input: string,
    line: number,
    column: number
  ): number {
    const lines = input.split("\n");
    let position = 0;

    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      position += lines[i].length + 1; // +1 for newline
    }

    position += Math.max(0, column - 1);
    return Math.min(position, input.length);
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
      [/unterminated string/i, "String is missing closing quote"],
      [/expected ',' or ']'/i, "Missing comma between array elements"],
      [/trailing comma/i, "Remove the trailing comma"],
      [/unexpected token.*,/i, "Trailing comma is not allowed in JSON"],
      [
        /unexpected token.*position.*,/i,
        "Trailing comma found - JSON doesn't allow trailing commas",
      ],
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
      [
        /unexpected token/i,
        "Unexpected character found - check for invalid characters or syntax",
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

  // Build a unique, stable path segment. Normal identifier keys keep dot
  // notation (root.user.name) and array items keep bracket notation
  // (root.items[0]) so existing output is unchanged. Keys that aren't plain
  // identifiers (dots, spaces, quotes, unicode) are JSON-encoded in brackets
  // (root["a.b"]) so distinct nodes can never collide on the same path.
  private appendPath(parentPath: string, key: string): string {
    if (/^\[\d+\]$/.test(key)) return `${parentPath}${key}`;
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
      return parentPath ? `${parentPath}.${key}` : key;
    }
    return `${parentPath}[${JSON.stringify(key)}]`;
  }

  private processValue(
    value: JsonValue,
    key: string,
    path: string,
    depth: number,
    nodes: JsonNode[]
  ): void {
    const currentPath = this.appendPath(path, key);
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

    // Insert children WITHOUT spreading into splice's arguments: a spread call
    // like splice(i, 0, ...childNodes) passes each child as a function argument
    // and blows the JS arg-count limit (~130k) on large containers, throwing
    // "Maximum call stack size exceeded" — which silently aborted re-expansion
    // of big nodes. Array-literal spread iterates instead, so it has no limit.
    return [
      ...result.slice(0, nodeIndex + 1),
      ...childNodes,
      ...result.slice(nodeIndex + 1),
    ];
  }

  collapseNode(nodes: JsonNode[], targetPath: string): JsonNode[] {
    const result = [...nodes];
    const nodeIndex = result.findIndex((node) => node.path === targetPath);

    if (nodeIndex === -1) return result;

    const node = result[nodeIndex];
    if (!node.isExpanded) return result;

    node.isExpanded = false;
    result[nodeIndex] = {...node};

    // Remove child nodes. Children are always the contiguous run of deeper
    // nodes immediately after this one, so match on depth (collision-proof)
    // instead of string prefixes.
    let removeCount = 0;
    for (let i = nodeIndex + 1; i < result.length; i++) {
      if (result[i].depth > node.depth) {
        removeCount++;
      } else {
        break;
      }
    }

    result.splice(nodeIndex + 1, removeCount);

    return result;
  }

  getStats(): JsonStats {
    return {...this.stats};
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
    // Ancestor containers that must be expanded to reveal a match. Filled
    // during the walk below, so it works regardless of how paths are encoded.
    const pathsToExpand = new Set<string>();

    // Search through the complete data structure to find all matches
    this.findMatchingPaths(
      rootNode.value,
      "root",
      "",
      searchQuery,
      caseSensitive,
      matchingPaths,
      pathsToExpand
    );

    // If no matches found, return original nodes
    if (matchingPaths.size === 0) {
      return {nodes, matchIndices: []};
    }

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

    return {nodes: expandedNodes, matchIndices};
  }

  // Returns true if this node or any descendant matched. Containers with a
  // matching descendant are added to pathsToExpand so they get expanded.
  private findMatchingPaths(
    value: JsonValue,
    key: string,
    path: string,
    searchQuery: string,
    caseSensitive: boolean,
    matchingPaths: Set<string>,
    pathsToExpand: Set<string>
  ): boolean {
    const currentPath = this.appendPath(path, key);

    // Check if current key or value matches
    const keyMatch = caseSensitive
      ? key.includes(searchQuery)
      : key.toLowerCase().includes(searchQuery);

    const searchableValue = this.getSearchableValue(value);
    const valueMatch = caseSensitive
      ? searchableValue.includes(searchQuery)
      : searchableValue.toLowerCase().includes(searchQuery);

    const selfMatch = keyMatch || valueMatch;
    if (selfMatch) {
      matchingPaths.add(currentPath);
    }

    // Recursively check children
    let descendantMatch = false;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (
          this.findMatchingPaths(
            item,
            `[${index}]`,
            currentPath,
            searchQuery,
            caseSensitive,
            matchingPaths,
            pathsToExpand
          )
        ) {
          descendantMatch = true;
        }
      });
    } else if (value !== null && typeof value === "object") {
      const objectValue = value as Record<string, JsonValue>;
      Object.keys(objectValue).forEach((objKey) => {
        if (
          this.findMatchingPaths(
            objectValue[objKey],
            objKey,
            currentPath,
            searchQuery,
            caseSensitive,
            matchingPaths,
            pathsToExpand
          )
        ) {
          descendantMatch = true;
        }
      });
    }

    if (descendantMatch) {
      pathsToExpand.add(currentPath);
    }

    return selfMatch || descendantMatch;
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
    const currentPath = this.appendPath(path, key);
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

    return expandedNodes;
  }

  private processValueWithExpandAll(
    value: JsonValue,
    key: string,
    path: string,
    depth: number,
    nodes: JsonNode[]
  ): void {
    const currentPath = this.appendPath(path, key);
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
    // Collapsing everything hides all descendants, so the result is just the
    // root node collapsed. No need to walk/splice the whole array.
    const rootNode = nodes.find((node) => node.key === "root");
    if (!rootNode) return nodes;

    return [{...rootNode, isExpanded: false}];
  }
}

export const jsonParser = new JsonParser();
