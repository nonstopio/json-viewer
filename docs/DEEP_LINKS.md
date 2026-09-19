# Deep links

Open [json.nonstopio.com](https://json.nonstopio.com) with a document already
loaded. Point a button, a CLI, a log viewer or a Slack bot at a URL and the JSON
is on screen — no upload, no paste, no account.

Nothing is sent to a server. The document is encoded in the browser and decoded
in the browser; there is no backend to store it.

---

## The URL

```
https://json.nonstopio.com/#data=<payload>          ← use this one
https://json.nonstopio.com/?data=<payload>          ← works too, see Privacy
https://json.nonstopio.com/?data=clipboard          ← for large documents
https://json.nonstopio.com/#data=<payload>&view=graph
```

### `data`

| Value | Meaning |
|---|---|
| starts with `{`, `[` or `"` | raw JSON, percent-encoded |
| `clipboard` | read the document from the user's clipboard |
| anything else | base64url of raw-deflate ("compacted") JSON |

The form is detected from the first character — base64url can never begin with
`{`, `[` or `"` — so there is no mode flag to set and no wrong combination to
get wrong. Hand-written links can use raw JSON; generated links should compact.

### `view`

Which tab to land on. Optional, defaults to the tree.

| Value | Tab |
|---|---|
| `text`, `json`, `raw` | JSON editor |
| `tree`, `viewer` | Viewer (default) |
| `graph`, `visualizer` | Visualizer |

### Size

A compacted payload is capped at **4000 characters**. Browsers accept far more,
but CDN and proxy request-line limits start rejecting above roughly 8KB. JSON
compacts about 4–8×, so 4000 characters carries something like 16–30KB of JSON —
enough for most API responses. Past that, use the clipboard hand-off.

---

## Use it

### As a script tag

```html
<script src="https://json.nonstopio.com/open.js"></script>
<button onclick="openInJsonViewer(response)">View JSON</button>
```

```js
openInJsonViewer(data)                       // opens a new tab
openInJsonViewer(data, {view: "graph"})      // ...on the Visualizer
openInJsonViewer(data, {target: "self"})     // navigate instead of opening a tab
openInJsonViewer(data, {base: "..."})        // point at another deployment
openInJsonViewer.link(data)                  // -> {url, needsClipboard}
```

`data` is an object, an array, or a string of JSON. `openInJsonViewer` handles
the clipboard hand-off for you; `openInJsonViewer.link` opens and copies
nothing, so you stay in control:

```js
const {url, needsClipboard} = await openInJsonViewer.link(bigResponse);
if (needsClipboard) await navigator.clipboard.writeText(JSON.stringify(bigResponse));
window.open(url, "_blank");
```

### Without the script tag

The whole producer is ten lines of standard platform API — no dependency, works
in browsers and Node 18+:

```js
export async function jsonViewerLink(data, {view, base = "https://json.nonstopio.com/"} = {}) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const payload = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const suffix = view ? `&view=${view}` : "";

  return payload.length <= 4000
    ? `${base}#data=${payload}${suffix}`            // fits in the URL
    : `${base}?data=clipboard${suffix}`;            // caller puts `text` on the clipboard
}
```

### From a shell

```sh
payload=$(python3 -c "
import sys, zlib, base64
d = zlib.compressobj(9, zlib.DEFLATED, -15)   # -15 = raw deflate, no zlib header
raw = d.compress(sys.stdin.buffer.read()) + d.flush()
print(base64.urlsafe_b64encode(raw).decode().rstrip('='))
" < response.json)

open "https://json.nonstopio.com/#data=$payload"
```

Note the `-15`: the viewer expects **raw** deflate, so a plain `gzip` or zlib
wrapper won't decode. Or skip compaction entirely for a small document:

```sh
open "https://json.nonstopio.com/?data=$(jq -c . small.json | jq -sRr @uri)"
```

---

## The clipboard hand-off

When a document is too large for a URL, the sending system puts the JSON on the
clipboard and opens `?data=clipboard`. The viewer reads it from there.

Two things to know:

- **It needs the clipboard write to happen inside a user gesture.** Call it from
  the click handler, not from a timer or a fetch callback.
- **The viewer cannot always read the clipboard automatically.** Chromium reads
  it unprompted once permission is granted; Firefox and Safari require a click.
  When the read is refused the viewer shows a **Load from clipboard** button, so
  the link still works — it just costs one extra click.

---

## Privacy

Prefer `#data=`. A URL fragment is never transmitted: it stays in the browser,
so the document keeps out of server and CDN access logs, `Referer` headers, and
analytics. `?data=` is supported because it is what most systems reach for
first, but the query string *is* sent to the server on every request.

The viewer strips `data` from the address bar as soon as it has loaded the
document, so a refresh won't replay it and copying the URL afterwards won't
re-share it.

Documents are capped at 10MB once decompressed, and oversized ones are abandoned
mid-stream rather than inflated into memory.
