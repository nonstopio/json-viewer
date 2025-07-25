export interface AnalyticsEvent {
  event: string;
  timestamp: string;
  sessionId: string;
  userId: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsProperties extends Record<string, unknown> {
  fileSize?: number;
  nodeCount?: number;
  searchQuery?: string;
  theme?: "light" | "dark";
  errorType?: string;
  featureName?: string;
  nodeType?: string;
  nodeDepth?: number;
  searchResultCount?: number;
  copyType?: "value" | "path";
  userAgent?: string;
  viewport?: {width: number; height: number};
  referrer?: string;
  url?: string;
  fileName?: string;
  fileType?: string;
  source?: string;
  valueLength?: number;
  pathLength?: number;
  caseSensitive?: boolean;
  queryLength?: number;
  previousTheme?: string;
  isSystemMode?: boolean;
  errorMessage?: string;
  parseTime?: number;
  childCount?: number;
  direction?: string;
  totalNodes?: number;
  currentIndex?: number;
  expandedCount?: number;
  collapsedCount?: number;
  totalMatches?: number;
  property?: string;
  errorLine?: number;
  errorColumn?: number;
  errorPosition?: number;
  calculatedPosition?: number;
}

export type AnalyticsEventType =
  | "app_loaded"
  | "json_parsed"
  | "json_parse_error"
  | "auto_parse_error"
  | "error_cursor_positioned"
  | "file_uploaded"
  | "json_pasted"
  | "node_expanded"
  | "node_collapsed"
  | "search_performed"
  | "search_navigation"
  | "expand_all_nodes"
  | "collapse_all_nodes"
  | "value_copied"
  | "property_detail_copied"
  | "theme_changed"
  | "session_started"
  | "feature_used"
  | "error_encountered";
