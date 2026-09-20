import {useState, useCallback, useEffect, useRef, lazy, Suspense} from "react";
import {
  FileCode,
  ClipboardPaste,
  Copy,
  AlignLeft,
  Minimize2,
  Trash2,
  FileText,
  FoldVertical,
  UnfoldVertical,
  ChevronUp,
  ChevronDown,
  X,
  Github,
  Linkedin,
  Twitter,
  Globe,
  Bug,
  Maximize,
  Info,
  Share2,
  Layers,
} from "lucide-react";
// Lazy-loaded so the CodeMirror editor bundle stays off the initial load.
const JsonInput = lazy(() =>
  import("./components/JsonInput").then((m) => ({default: m.JsonInput}))
);
// Lazy-loaded so the React Flow / dagre bundle stays off the initial load and
// the Tree experience isn't slowed down (PRD §6).
const JsonGraph = lazy(() =>
  import("./components/JsonGraph").then((m) => ({default: m.JsonGraph}))
);
import {JsonTree} from "./components/JsonTree";
import {ThemeToggle} from "./components/ThemeToggle";
import {ShareHint} from "./components/ShareHint";
import {JsonNavigator} from "./components/JsonNavigator";
import {ResizablePanel} from "./components/ResizablePanel";
import {Tooltip} from "./components/Tooltip";
import {ancestorPaths, jsonParser} from "./utils/jsonParser";
import {AUTHOR, brand, brandAsset} from "./brand";
import {complexSample} from "./data/complexSample";
import {
  buildShareLink,
  CLIPBOARD_PAYLOAD,
  decodePayload,
  DeepLinkView,
  readDeepLink,
} from "./utils/deepLink";
import {JsonNode, JsonValue} from "./types/json";

// Injected at build time from package.json (see vite.config.ts).
declare const __APP_VERSION__: string;

// Named in src/brand.ts so a brand can declare links without importing lucide.
const SOCIAL_ICONS = {
  github: Github,
  linkedin: Linkedin,
  twitter: Twitter,
  globe: Globe,
} as const;

// ponytail: unfolding a subtree one node at a time is a splice per node, so
// it stops at this many rows. Expand-all is there for the rest.
const SUBTREE_ROWS = 2000;

function App() {
  const [jsonData, setJsonData] = useState<JsonValue | null>(null);
  // The arrival animations run once per page load. They are gated on this
  // rather than simply declared once, because the bands and panels carrying
  // them are conditionally rendered: a remount restarts a CSS animation, so a
  // tab switch would replay the beam. Dropping the class closes that door.
  const [intro, setIntro] = useState(true);

  const [nodes, setNodes] = useState<JsonNode[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<JsonNode[]>([]);
  const [originalNodes, setOriginalNodes] = useState<JsonNode[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchMatchIndices, setSearchMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"viewer" | "text" | "graph">(
    "text"
  );
  const [inputText, setInputText] = useState<string>("");
  const [lastParsedInput, setLastParsedInput] = useState<string>("");
  const [selectedNodePath, setSelectedNodePath] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wasModified, setWasModified] = useState(false);
  const [errorDetails, setErrorDetails] = useState<
    {line?: number; column?: number; position?: number} | undefined
  >();
  // Set when a `?data=clipboard` link arrives but the browser won't read the
  // clipboard without a click; holds the tab that link asked for.
  const [clipboardPrompt, setClipboardPrompt] = useState<DeepLinkView | null>(
    null
  );
  const [shareLabel, setShareLabel] = useState("Share");
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();
  const shareLabelReset = useRef<ReturnType<typeof setTimeout>>();

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Fullscreen functions
  const enterFullscreen = useCallback(async () => {
    try {
      const fullscreenElement = document.getElementById("json-tree-fullscreen");
      if (fullscreenElement && fullscreenElement.requestFullscreen) {
        await fullscreenElement.requestFullscreen();
      }
    } catch (error) {
      console.warn("Failed to enter fullscreen:", error);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Failed to exit fullscreen:", error);
    }
  }, []);

  const handleJsonSubmit = useCallback(
    async (jsonText: string, shouldSwitchTab = false): Promise<boolean> => {
      setIsLoading(true);
      setError("");
      setErrorDetails(undefined);
      setInputText(jsonText);

      try {
        const result = jsonParser.parseJson(jsonText);

        if (result.success && result.data !== undefined) {
          setJsonData(result.data);
          setWasModified(!!result.wasModified);
          const newNodes = jsonParser.convertToNodes(result.data);
          setNodes(newNodes);
          setFilteredNodes(newNodes);
          setOriginalNodes(newNodes);
          // Track the input that was successfully parsed
          setLastParsedInput(jsonText);
          // Auto-select root node when data is loaded
          setSelectedNodePath("root");
          // Switch to viewer tab only if parsing was successful and requested
          if (shouldSwitchTab) {
            setActiveTab("viewer");
          }
          return true;
        } else {
          setError(result.error || "Failed to parse JSON");
          setErrorDetails(result.errorDetails);
          setJsonData(null);
          setWasModified(false);
          setNodes([]);
          setFilteredNodes([]);
          setOriginalNodes([]);
          return false;
        }
      } catch {
        setError("Unexpected error occurred while parsing JSON");
        setErrorDetails(undefined);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleToggleNode = useCallback(
    (path: string) => {
      // When searching, we don't allow manual toggle to maintain search results
      if (searchQuery) return;

      const targetNode = nodes.find((node) => node.path === path);
      if (!targetNode) return;

      let updatedNodes: JsonNode[];

      if (targetNode.isExpanded) {
        updatedNodes = jsonParser.collapseNode(nodes, path);
      } else {
        updatedNodes = jsonParser.expandNode(nodes, path);
      }

      setNodes(updatedNodes);
      setOriginalNodes(updatedNodes);
      setFilteredNodes(updatedNodes);
    },
    [nodes, searchQuery]
  );

  const handleSelectNode = useCallback((path: string) => {
    setSelectedNodePath(path);
  }, []);

  const applyNodes = useCallback((list: JsonNode[]) => {
    setNodes(list);
    setOriginalNodes(list);
    setFilteredNodes(list);
  }, []);

  // The Navigator's one action. Everything folds, then the picked node's own
  // chain reopens with its whole subtree, so the tree shows exactly what the
  // panel says is open — and picking the root (nothing ticked) leaves the top
  // level open and nothing more.
  const handleOpenNode = useCallback(
    (path: string) => {
      setSelectedNodePath(path);
      // While searching the list is a search result; don't rebuild it.
      if (searchQuery) return;

      let next = jsonParser.collapseAllNodes(originalNodes);
      if (path === "root") {
        // Nothing ticked is not a closed document: the top level stays open,
        // so the tree still shows what the panel is listing.
        next = jsonParser.expandNode(next, "root");
        for (let i = 0; i < next.length; i++) {
          const node = next[i];
          if (node.isExpanded && node.path !== "root") {
            next = jsonParser.collapseNode(next, node.path);
          }
        }
      } else {
        // `startsWith` alone would also match a sibling named `orders2`, so
        // the separator has to be part of the test.
        const under = (candidate: string) =>
          candidate.startsWith(`${path}.`) || candidate.startsWith(`${path}[`);
        const onPath = (candidate: string) =>
          candidate === path ||
          under(candidate) ||
          path.startsWith(`${candidate}.`) ||
          path.startsWith(`${candidate}[`);

        for (const ancestor of [...ancestorPaths(path), path]) {
          next = jsonParser.expandNode(next, ancestor);
        }
        // Expanding a node re-creates its children with the parser's own
        // "first two levels open" default, so the branches beside the picked
        // one come back open unless they are folded again here.
        for (let i = 0; i < next.length; i++) {
          const node = next[i];
          if (node.isExpanded && !onPath(node.path)) {
            next = jsonParser.collapseNode(next, node.path);
          }
        }
        for (let i = 0; i < next.length && next.length < SUBTREE_ROWS; i++) {
          const node = next[i];
          if (under(node.path) && !node.isExpanded && node.childCount) {
            next = jsonParser.expandNode(next, node.path);
          }
        }
      }
      applyNodes(next);
    },
    [applyNodes, originalNodes, searchQuery]
  );

  const handleSearch = useCallback(
    (query: string, isCaseSensitive: boolean) => {
      // Keep the input responsive; debounce the expensive tree walk/rebuild so
      // typing on a large document doesn't run searchNodes on every keystroke.
      setSearchQuery(query);
      setCaseSensitive(isCaseSensitive);
      clearTimeout(searchDebounce.current);

      if (!query.trim()) {
        // Restore to current state of nodes (which may have been manually expanded/collapsed)
        setFilteredNodes(nodes);
        setSearchMatchIndices([]);
        setCurrentMatchIndex(0);
        return;
      }

      searchDebounce.current = setTimeout(() => {
        const searchResult = jsonParser.searchNodes(
          originalNodes,
          query,
          isCaseSensitive
        );
        // Update both nodes and filtered nodes since search may expand the tree
        setNodes(searchResult.nodes);
        setFilteredNodes(searchResult.nodes);
        setSearchMatchIndices(searchResult.matchIndices);
        setCurrentMatchIndex(0);

        // Auto-select the first match if available
        if (searchResult.matchIndices.length > 0) {
          const firstMatchNode =
            searchResult.nodes[searchResult.matchIndices[0]];
          if (firstMatchNode) {
            setSelectedNodePath(firstMatchNode.path);
          }
        }
      }, 250);
    },
    [originalNodes, nodes]
  );

  // Shared by the Paste button and by `?data=clipboard` links. `view` is the
  // tab to land on once the document parses; omitted, we stay put.
  const loadFromClipboard = useCallback(
    async (view?: DeepLinkView) => {
      try {
        // Check if clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          setError(
            "Clipboard API not available. Please use Ctrl+V or Cmd+V to paste."
          );
          return;
        }

        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          setError("Clipboard is empty or contains no text.");
          return;
        }

        const parsed = await handleJsonSubmit(text, false);
        if (parsed && view) {
          setActiveTab(view);
        }
      } catch (err) {
        console.warn("Failed to read clipboard:", err);
        setError(
          "Failed to read from clipboard. Make sure you have given permission to access clipboard, or try using Ctrl+V or Cmd+V to paste directly into the text area."
        );
      }
    },
    [handleJsonSubmit]
  );

  const handlePaste = useCallback(() => {
    void loadFromClipboard();
  }, [loadFromClipboard]);

  const handleClipboardPrompt = useCallback(() => {
    const view = clipboardPrompt ?? "viewer";
    setClipboardPrompt(null);
    void loadFromClipboard(view);
  }, [clipboardPrompt, loadFromClipboard]);

  // Deep link: open with a document already loaded (see utils/deepLink.ts).
  useEffect(() => {
    const openDeepLink = () => {
      const link = readDeepLink(window.location.search, window.location.hash);
      if (!link) return;

      // Strip the payload from the address bar immediately: it shouldn't
      // survive a refresh, ride along in a screenshot, or get re-shared by
      // copying the URL after the document has been edited.
      window.history.replaceState(null, "", window.location.pathname);

      const open = async (text: string) => {
        const parsed = await handleJsonSubmit(text, false);
        if (parsed) setActiveTab(link.view ?? "viewer");
      };

      if (link.payload === CLIPBOARD_PAYLOAD) {
        // Only Chromium reads the clipboard without a gesture, and only once
        // permission is granted. Try it — then fall back to a button, because
        // everywhere else this rejects and doing nothing would look broken.
        navigator.clipboard
          ?.readText()
          .then((text) =>
            text.trim() ? open(text) : setClipboardPrompt(link.view ?? "viewer")
          )
          .catch(() => setClipboardPrompt(link.view ?? "viewer"));
        return;
      }

      decodePayload(link.payload)
        .then(open)
        .catch((err: Error) => setError(err.message));
    };

    openDeepLink();
    // A `#data=` link pasted into an already-open tab is a same-document
    // navigation — nothing remounts, so without this the link would silently
    // do nothing.
    window.addEventListener("hashchange", openDeepLink);
    return () => window.removeEventListener("hashchange", openDeepLink);
  }, [handleJsonSubmit]);

  const handleShareLink = useCallback(async () => {
    if (!inputText.trim()) return;
    const result = jsonParser.parseJson(inputText);
    // Share the compacted, valid document rather than whatever is half-typed
    // in the editor — the link is meant to reopen cleanly somewhere else.
    const text =
      result.success && result.data !== undefined
        ? JSON.stringify(result.data)
        : inputText;

    let label: string;
    try {
      // A link opens on the parsed view by default — that is the thing worth
      // showing someone. The Visualizer is the one view that carries over,
      // because a graph you chose to share is the point of sharing it; a link
      // made from the editor still opens parsed rather than dropping the
      // recipient in front of the raw text they were sent to avoid reading.
      const url = await buildShareLink(
        text,
        activeTab === "graph" ? "graph" : undefined
      );
      if (url) {
        await navigator.clipboard.writeText(url);
        label = "Link copied!";
      } else {
        // A document too big for a URL travels by clipboard instead, which only
        // the sending system can arrange — docs/DEEP_LINKS.md covers that path.
        label = "Too large to link";
      }
    } catch (err) {
      // Denied clipboard permission, or an insecure context with no clipboard
      // API at all. Say so — silently doing nothing reads as a broken button.
      console.warn("Failed to copy share link:", err);
      label = "Couldn't copy link";
    }

    setShareLabel(label);
    clearTimeout(shareLabelReset.current);
    shareLabelReset.current = setTimeout(() => setShareLabel("Share"), 2500);
  }, [inputText, activeTab]);

  const handleCopy = useCallback(() => {
    if (!inputText.trim()) return;
    const result = jsonParser.parseJson(inputText);
    // Copy formatted JSON when valid, otherwise copy the raw text as-is.
    const text =
      result.success && result.data !== undefined
        ? JSON.stringify(result.data, null, 2)
        : inputText;
    navigator.clipboard.writeText(text);
  }, [inputText]);

  const handleFormat = useCallback(() => {
    if (!inputText.trim()) return;
    const result = jsonParser.parseJson(inputText);
    if (result.success && result.data !== undefined) {
      setInputText(JSON.stringify(result.data, null, 2));
    }
  }, [inputText]);

  const handleRemoveWhitespace = useCallback(() => {
    if (!inputText.trim()) return;
    const result = jsonParser.parseJson(inputText);
    if (result.success && result.data !== undefined) {
      setInputText(JSON.stringify(result.data));
    }
  }, [inputText]);

  const handleParsedTabClick = useCallback(
    async (targetTab: "viewer" | "graph") => {
      // Check if there's unparsed text or text that has changed since last parse
      const currentInputText = inputText.trim();

      if (currentInputText && currentInputText !== lastParsedInput) {
        // Auto-parse the text when switching to viewer tab if:
        // 1. There's input text AND it's different from what was last successfully parsed
        setIsLoading(true);
        setError("");
        setErrorDetails(undefined);

        try {
          const result = jsonParser.parseJson(currentInputText);

          if (result.success && result.data !== undefined) {
            setJsonData(result.data);
            setWasModified(!!result.wasModified);
            const newNodes = jsonParser.convertToNodes(result.data);
            setNodes(newNodes);
            setFilteredNodes(newNodes);
            setOriginalNodes(newNodes);
            setLastParsedInput(currentInputText);
            setSelectedNodePath("root");
            setActiveTab(targetTab);
          } else {
            // If parsing fails, show error and redirect back to JSON tab
            setError(result.error || "Failed to parse JSON");
            setErrorDetails(result.errorDetails);
            setJsonData(null);
            setWasModified(false);
            setNodes([]);
            setFilteredNodes([]);
            setOriginalNodes([]);
            setActiveTab("text"); // Redirect back to JSON tab on error
          }
        } catch {
          // If unexpected error occurs, show error and redirect back to JSON tab
          setError("Unexpected error occurred while parsing JSON");
          setErrorDetails(undefined);
          setActiveTab("text"); // Redirect back to JSON tab on error
        } finally {
          setIsLoading(false);
        }
      } else {
        // Input unchanged since last parse (or empty) — just switch tabs.
        setActiveTab(targetTab);
      }
    },
    [inputText, lastParsedInput]
  );

  const handleClear = useCallback(() => {
    setJsonData(null);
    setNodes([]);
    setFilteredNodes([]);
    setOriginalNodes([]);
    setInputText("");
    setLastParsedInput("");
    setError("");
    setErrorDetails(undefined);
    setWasModified(false);
    setSearchQuery("");
    setSearchMatchIndices([]);
    setCurrentMatchIndex(0);
    setSelectedNodePath("");
  }, []);

  useEffect(() => {
    // Longest gated animation: the footer beam, 6.5s on a 5s delay.
    const done = setTimeout(() => setIntro(false), 12_000);
    return () => clearTimeout(done);
  }, []);

  const handleLoadComplexData = useCallback(() => {
    const jsonText = JSON.stringify(complexSample, null, 2);
    setInputText(jsonText);
    handleJsonSubmit(jsonText, false); // Don't switch tabs for load data
  }, [handleJsonSubmit]);

  const handleLoadData = useCallback(() => {
    const sampleData = {
      company: {
        version: "1.0.0",
        name: brand.sample.name,
        description: brand.sample.description,
        website: brand.sample.website,
      },
      user: {
        id: 104,
        firstName: "Ajay",
        lastName: "Kumar",
        email: brand.sample.email,
        github: "https://github.com/projectaj14",
        bio: "Software expert with 9+ years in the field.",
        account: {
          status: "active",
          type: "premium",
          created: "2019-03-15T10:30:00Z",
          lastLogin: "2024-01-23T14:22:00Z",
          preferences: {
            theme: "dark",
            language: "en-IN",
            currency: "INR",
            notifications: {
              email: true,
              push: false,
              sms: true,
            },
          },
        },
      },
    };
    const jsonText = JSON.stringify(sampleData, null, 2);
    setInputText(jsonText);
    handleJsonSubmit(jsonText, false); // Don't switch tabs for load data
  }, [handleJsonSubmit]);

  const handleExpandAll = useCallback(() => {
    const expandedNodes = jsonParser.expandAllNodes(originalNodes);
    setOriginalNodes(expandedNodes);

    if (searchQuery) {
      const searchResult = jsonParser.searchNodes(
        expandedNodes,
        searchQuery,
        caseSensitive
      );
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
    } else {
      setNodes(expandedNodes);
      setFilteredNodes(expandedNodes);
    }
  }, [originalNodes, searchQuery, caseSensitive]);

  const handleCollapseAll = useCallback(() => {
    const collapsedNodes = jsonParser.collapseAllNodes(originalNodes);
    setOriginalNodes(collapsedNodes);

    if (searchQuery) {
      const searchResult = jsonParser.searchNodes(
        collapsedNodes,
        searchQuery,
        caseSensitive
      );
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
    } else {
      setNodes(collapsedNodes);
      setFilteredNodes(collapsedNodes);
    }
  }, [originalNodes, searchQuery, caseSensitive]);

  const handleNavigateToNextMatch = useCallback(() => {
    if (searchMatchIndices.length > 0) {
      const nextIndex = (currentMatchIndex + 1) % searchMatchIndices.length;
      setCurrentMatchIndex(nextIndex);
      const nodeIndex = searchMatchIndices[nextIndex];
      const node = filteredNodes[nodeIndex];
      if (node) {
        setSelectedNodePath(node.path);
      }
    }
  }, [searchMatchIndices, currentMatchIndex, filteredNodes]);

  const handleNavigateToPrevMatch = useCallback(() => {
    if (searchMatchIndices.length > 0) {
      const prevIndex =
        currentMatchIndex === 0
          ? searchMatchIndices.length - 1
          : currentMatchIndex - 1;
      setCurrentMatchIndex(prevIndex);
      const nodeIndex = searchMatchIndices[prevIndex];
      const node = filteredNodes[nodeIndex];
      if (node) {
        setSelectedNodePath(node.path);
      }
    }
  }, [searchMatchIndices, currentMatchIndex, filteredNodes]);

  // Shared by the panel header and the fullscreen header so expand/collapse
  // stay reachable in both.
  const treeFoldButtons = (
    <>
      <button
        onClick={handleExpandAll}
        aria-label="Expand all nodes"
        data-tooltip="Expand all nodes - Shows all nested objects and arrays"
        className="btn btn--quiet"
      >
        <UnfoldVertical size={16} className="text-current" />
        <span className="text-xs leading-none">Expand all</span>
      </button>
      <button
        onClick={handleCollapseAll}
        aria-label="Collapse all nodes"
        data-tooltip="Collapse all nodes - Hides all nested objects and arrays"
        className="btn btn--quiet"
      >
        <FoldVertical size={16} className="text-current" />
        <span className="text-xs leading-none">Collapse all</span>
      </button>
    </>
  );

  return (
    <>
      <Tooltip />
      {/* Fullscreen styles */}
      <style>{`
        #json-tree-fullscreen:fullscreen {
          background: var(--bg);
          padding: 0;
          margin: 0;
        }
      `}</style>

      {/* The living ground: two glows drifting behind everything. They are
          fixed and inert, and every band below is transparent, so this is
          what gives the app depth instead of a stack of flat greys. */}
      <div className="grid-layer" aria-hidden="true" />
      <div className="glow glow--hi" aria-hidden="true" />
      <div className="glow glow--lo" aria-hidden="true" />

      <div
        className={`relative z-10 flex h-screen flex-col overflow-hidden ${
          intro ? "intro" : ""
        }`}
      >
        {/* Top Tab Bar - Fixed */}
        <div className="band seam flex-shrink-0 border-b border-line-2">
          <div className="flex items-center">
            <div className="flex">
              <button
                onClick={() => setActiveTab("text")}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "text"
                    ? "border-spot text-ink"
                    : "border-transparent text-faint hover:text-ink"
                }`}
              >
                JSON
              </button>
              <button
                onClick={() => handleParsedTabClick("viewer")}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "viewer"
                    ? "border-spot text-ink"
                    : "border-transparent text-faint hover:text-ink"
                }`}
              >
                Viewer
              </button>
              <button
                onClick={() => handleParsedTabClick("graph")}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "graph"
                    ? "border-spot text-ink"
                    : "border-transparent text-faint hover:text-ink"
                }`}
              >
                Visualizer
              </button>
            </div>
            {/* Beside the theme selector rather than in the JSON toolbar, so
                sharing is reachable from the Viewer and Visualizer too. Fixed
                width keeps the bar from jumping when the label changes to its
                confirmation or failure text. */}
            <div className="ml-auto flex items-center gap-2 pr-4">
              <ThemeToggle />
              <div className="relative">
                <button
                  onClick={handleShareLink}
                  disabled={!inputText.trim()}
                  data-tooltip={
                    activeTab === "graph"
                      ? "Copy a link that opens this JSON in the Visualizer"
                      : activeTab === "text"
                        ? "Copy a link that opens this JSON in the editor"
                        : "Copy a link that opens this JSON for anyone"
                  }
                  className="btn btn--ghost btn--sm min-w-[9.5rem]"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{shareLabel}</span>
                </button>
                {/* Waits for the first successful parse: before that there
                    is nothing to share, and a pointer at a disabled button
                    teaches nothing. */}
                <ShareHint active={jsonData !== null} />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar - Only show for text tab - Fixed */}
        {activeTab === "text" && (
          <div className="band seam seam--delay-1 flex-shrink-0 border-b border-line-2 px-4 py-2">
            <div className="flex items-center space-x-3">
              <button onClick={handlePaste} className="btn btn--ghost">
                <ClipboardPaste size={14} />
                <span>Paste</span>
              </button>

              <button
                onClick={handleCopy}
                disabled={!inputText.trim()}
                className="btn btn--ghost"
              >
                <Copy size={14} />
                <span>Copy</span>
              </button>

              <button
                onClick={handleFormat}
                disabled={!inputText.trim()}
                className="btn btn--ghost"
              >
                <AlignLeft size={14} />
                <span>Format</span>
              </button>

              <button
                onClick={handleRemoveWhitespace}
                disabled={!inputText.trim()}
                className="btn btn--ghost"
              >
                <Minimize2 size={14} />
                <span>Remove white space</span>
              </button>

              <button onClick={handleClear} className="btn btn--ghost">
                <Trash2 size={14} />
                <span>Clear</span>
              </button>

              <button onClick={handleLoadData} className="btn btn--ghost">
                <FileText size={14} />
                <span>Load Test JSON</span>
              </button>

              <button
                onClick={handleLoadComplexData}
                className="btn btn--ghost"
              >
                <Layers size={14} />
                <span>Load Complex Test JSON</span>
              </button>
            </div>
          </div>
        )}

        {/* Clipboard deep link - the browser wouldn't read it without a click */}
        {clipboardPrompt && (
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-line-2 bg-spot-soft px-4 py-3">
            <ClipboardPaste size={16} className="flex-shrink-0 text-spot" />
            <span className="text-sm text-ink">
              This link carries its JSON on your clipboard — your browser needs
              a click before it can read it.
            </span>
            <button onClick={handleClipboardPrompt} className="btn btn--brand">
              <ClipboardPaste size={14} />
              <span>Load from clipboard</span>
            </button>
            <button
              onClick={() => setClipboardPrompt(null)}
              aria-label="Dismiss"
              className="btn btn--quiet btn--icon ml-auto !text-spot"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Search Bar - Only show for viewer tab - Fixed */}
        {activeTab === "viewer" && jsonData && (
          <div className="band seam seam--delay-1 flex-shrink-0 border-b border-line-2 px-4 py-3">
            <div className="flex items-center justify-start space-x-2">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value, caseSensitive)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (e.shiftKey) {
                        handleNavigateToPrevMatch();
                      } else {
                        handleNavigateToNextMatch();
                      }
                      e.preventDefault();
                    } else if (e.key === "F3") {
                      if (e.shiftKey) {
                        handleNavigateToPrevMatch();
                      } else {
                        handleNavigateToNextMatch();
                      }
                      e.preventDefault();
                    }
                  }}
                  placeholder="Search JSON... (Enter: next, Shift+Enter: prev)"
                  className="w-full rounded-sm border border-line-2 bg-mass px-3 py-2 pr-10 text-sm text-ink placeholder:text-faint-2 focus:border-spot focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearch("", caseSensitive)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
                    data-tooltip="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={() => handleSearch(searchQuery, !caseSensitive)}
                className={`btn ${caseSensitive ? "btn--on" : "btn--ghost"}`}
                data-tooltip="Toggle case sensitivity - Match exact case when enabled"
              >
                Aa
              </button>
              {searchQuery && searchMatchIndices.length > 0 && (
                <>
                  <div className="whitespace-nowrap font-mono text-sm text-dim">
                    {currentMatchIndex + 1} of {searchMatchIndices.length}
                  </div>
                  <button
                    onClick={handleNavigateToPrevMatch}
                    className="btn btn--ghost btn--icon"
                    data-tooltip="Previous match (Shift+Enter or Shift+F3)"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={handleNavigateToNextMatch}
                    className="btn btn--ghost btn--icon"
                    data-tooltip="Next match (Enter or F3)"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Content Area - Scrollable */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel - Text Input */}
          {activeTab === "text" && (
            <div className="w-full p-4 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-faint">
                    Loading editor…
                  </div>
                }
              >
                <JsonInput
                  onJsonSubmit={handleJsonSubmit}
                  isLoading={isLoading}
                  error={error}
                  initialValue={inputText}
                  onError={setError}
                  onChange={setInputText}
                  errorDetails={errorDetails}
                  wasModified={wasModified}
                />
              </Suspense>
            </div>
          )}

          {/* Viewer Tab Content */}
          {activeTab === "viewer" && (
            <ResizablePanel
              initialLeftWidth={70}
              minLeftWidth={50}
              minRightWidth={30}
              className="fade-up flex-1"
            >
              {/* Left Panel - Tree View */}
              <div className="h-full min-w-0 overflow-hidden">
                {jsonData ? (
                  <div className="h-full flex flex-col">
                    {/* Tree Header */}
                    <div className="flex items-center justify-between border-b border-line-2 p-2">
                      <div className="flex items-center gap-2">
                        <span className="eyebrow mr-1">JSON Tree</span>
                        {treeFoldButtons}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={handleCopy} className="btn btn--quiet">
                          <Copy size={16} className="text-current" />
                          <span className="text-xs">Copy</span>
                        </button>
                        <button
                          onClick={enterFullscreen}
                          className="btn btn--quiet"
                        >
                          <Maximize size={16} className="text-current" />
                          <span className="text-xs">Fullscreen</span>
                        </button>
                      </div>
                    </div>
                    {/* Tree Content - virtual list scrolls internally */}
                    <div className="flex-1 min-h-0 p-2">
                      <JsonTree
                        nodes={filteredNodes}
                        onToggleNode={handleToggleNode}
                        onSelectNode={handleSelectNode}
                        selectedNodePath={selectedNodePath}
                        searchQuery={searchQuery}
                        caseSensitive={caseSensitive}
                        searchMatchIndices={searchMatchIndices}
                        currentMatchIndex={currentMatchIndex}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-faint">
                      <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg mb-2">No JSON data loaded</p>
                      <p className="text-sm">
                        Use the JSON tab or toolbar buttons to load JSON
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - Structural navigation */}
              <div className="h-full min-w-0 overflow-hidden border-l border-line-2">
                <JsonNavigator
                  data={jsonData}
                  selectedNodePath={selectedNodePath}
                  onSelectNode={handleOpenNode}
                />
              </div>
            </ResizablePanel>
          )}

          {/* Graph Tab Content */}
          {activeTab === "graph" && (
            <div className="fade-up h-full w-full min-w-0 overflow-hidden">
              {jsonData ? (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-faint">
                      Loading graph…
                    </div>
                  }
                >
                  <JsonGraph
                    data={jsonData}
                    selectedNodePath={selectedNodePath}
                    onSelectNode={handleSelectNode}
                  />
                </Suspense>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-faint">
                    <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No JSON data loaded</p>
                    <p className="text-sm">
                      Use the JSON tab or toolbar buttons to load JSON
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="band seam seam--top seam--delay-2 border-t border-line-2 py-4">
          <div className="px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Logo, Company Name and Social Links */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <img
                    src={brandAsset("favicon.png")}
                    alt={`${brand.siteName} logo`}
                    className="h-6 w-6 rounded-sm"
                  />
                  <span className="text-sm text-dim">{brand.ownerName}</span>
                </div>

                <div className="flex items-center space-x-3">
                  {brand.social.map(({label, href, icon}) => {
                    const Icon = SOCIAL_ICONS[icon];
                    return (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-faint transition-colors hover:text-ink"
                        data-tooltip={label}
                        aria-label={`${brand.ownerName} on ${label}`}
                      >
                        <Icon size={16} />
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Version and Report Issues - Right */}
              <div className="flex items-center space-x-4">
                <span className="font-mono text-xs text-faint-2">
                  v{__APP_VERSION__}
                </span>
                {/* Opens the About dialog (the crawlable content in index.html)
                    via the delegated handler there — no React state needed. */}
                <button
                  type="button"
                  data-about-open
                  className="flex items-center space-x-2 text-faint transition-colors hover:text-ink"
                >
                  <Info size={16} />
                  <span className="text-xs">About</span>
                </button>
                <a
                  href={brand.issuesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-faint transition-colors hover:text-ink"
                >
                  <Bug size={16} />
                  <span className="text-xs">Report Issues</span>
                </a>
                {/* Built by: the author's GitHub picture, linking to the
                    profile. Last in the row, hard right — it is a signature,
                    and a signature goes at the end. */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-faint">Built by</span>
                  <a
                    href={AUTHOR.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-tooltip={`${AUTHOR.name} (@${AUTHOR.login})`}
                    aria-label={`${AUTHOR.name} on GitHub`}
                    className="block"
                  >
                    {/* Round, against the square rule everything else follows:
                        this is a face, not a box. */}
                    <img
                      src={AUTHOR.avatar}
                      alt={AUTHOR.name}
                      loading="lazy"
                      width={24}
                      height={24}
                      className="avatar h-6 w-6 rounded-full border border-line-2 transition-colors hover:border-spot"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* Fullscreen Tree Container */}
        <div
          id="json-tree-fullscreen"
          className={`${isFullscreen ? "bg-bg" : "hidden"}`}
          style={
            isFullscreen
              ? {
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  zIndex: 9999,
                }
              : {}
          }
        >
          {isFullscreen && (
            <div className="h-full flex flex-col">
              {/* Fullscreen Header */}
              <div className="flex items-center justify-between border-b border-line-2 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-disp text-lg font-extrabold tracking-tight text-ink">
                    JSON Tree - Fullscreen View
                  </h2>
                  {treeFoldButtons}
                </div>
                <button
                  onClick={exitFullscreen}
                  className="btn btn--quiet btn--icon"
                  data-tooltip="Exit fullscreen (ESC)"
                >
                  <X size={20} className="text-faint" />
                </button>
              </div>

              {/* Fullscreen Tree Content - virtual list scrolls internally */}
              <div className="flex-1 min-h-0 p-4">
                {jsonData ? (
                  <JsonTree
                    nodes={filteredNodes}
                    onToggleNode={handleToggleNode}
                    onSelectNode={handleSelectNode}
                    selectedNodePath={selectedNodePath}
                    searchQuery={searchQuery}
                    caseSensitive={caseSensitive}
                    searchMatchIndices={searchMatchIndices}
                    currentMatchIndex={currentMatchIndex}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-faint">
                      <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg mb-2">No JSON data loaded</p>
                      <p className="text-sm">
                        Use the JSON tab or toolbar buttons to load JSON
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
