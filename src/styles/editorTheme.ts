import {EditorView} from "@uiw/react-codemirror";
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language";
import {tags as t} from "@lezer/highlight";

/* The CodeMirror editor, dressed from src/styles/tokens.css.
   Every value here is a var() naming a role, so the editor re-paints with
   the rest of the app the moment <html data-mode> flips — the theme is not
   rebuilt, the custom properties simply re-resolve. The only reason this
   depends on the ground at all is CodeMirror's `dark` flag, which decides
   how it draws its own selection and cursor layers. */

const chrome = (dark: boolean) =>
  EditorView.theme(
    {
      "&": {
        color: "var(--ink)",
        backgroundColor: "var(--code-bg)",
        fontFamily: "var(--font-mono)",
      },
      ".cm-content": {
        caretColor: "var(--spot)",
        fontFamily: "var(--font-mono)",
      },
      ".cm-cursor, .cm-dropCursor": {borderLeftColor: "var(--spot)"},
      "&.cm-focused": {outline: "none"},
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {backgroundColor: "var(--spot-soft)"},
      ".cm-activeLine": {backgroundColor: "var(--hover)"},
      ".cm-gutters": {
        backgroundColor: "var(--code-bg)",
        color: "var(--faint-2)",
        borderRight: "1px solid var(--line-2)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--hover)",
        color: "var(--dim)",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--mass)",
        border: "1px solid var(--line-2)",
        color: "var(--dim)",
      },
      ".cm-placeholder": {color: "var(--faint-2)"},
      ".cm-selectionMatch": {backgroundColor: "var(--spot-soft)"},
      ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: "var(--spot-soft)",
        outline: "1px solid var(--spot-line)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--panel)",
        border: "1px solid var(--line-2)",
        color: "var(--ink)",
      },
      ".cm-panels": {backgroundColor: "var(--panel)", color: "var(--ink)"},
    },
    {dark}
  );

/* JSON has few token kinds, so the syntax roles map almost one to one —
   the same ones the tree and the graph read, which is what keeps a value
   the same colour wherever the app shows it. */
const highlight = HighlightStyle.define([
  {
    tag: [t.propertyName, t.definition(t.propertyName)],
    color: "var(--json-key)",
  },
  {tag: [t.string, t.special(t.string)], color: "var(--json-string)"},
  {tag: [t.number, t.integer, t.float], color: "var(--json-number)"},
  {tag: [t.bool, t.atom], color: "var(--json-boolean)"},
  {tag: t.null, color: "var(--json-null)", fontStyle: "italic"},
  {tag: [t.punctuation, t.separator, t.bracket], color: "var(--json-punct)"},
  {tag: t.comment, color: "var(--faint)", fontStyle: "italic"},
  {tag: t.invalid, color: "var(--error)"},
]);

export const editorTheme = (ground: "ink" | "paper") => [
  chrome(ground === "ink"),
  syntaxHighlighting(highlight),
];
