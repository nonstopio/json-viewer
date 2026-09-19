/**
 * Open JSON in https://json.nonstopio.com from any web app.
 *
 *   <script src="https://json.nonstopio.com/open.js"></script>
 *   openInJsonViewer(payload)                  // opens a new tab
 *   openInJsonViewer(payload, {view: "graph"}) // ...on a given tab
 *   openInJsonViewer.link(payload)             // -> {url, needsClipboard}
 *
 * `payload` is an object, an array, or a string of JSON. No dependencies, no
 * build step, no network call — the link is built in the browser and the
 * document never leaves the machine. See docs/DEEP_LINKS.md.
 */
(function (global) {
  "use strict";

  var BASE = "https://json.nonstopio.com/";
  // Past this the URL starts tripping CDN and proxy request-line limits, so
  // the document travels by clipboard instead.
  var MAX_PAYLOAD_LENGTH = 4000;

  function toText(input) {
    return typeof input === "string" ? input : JSON.stringify(input);
  }

  function toBase64Url(bytes) {
    var binary = "";
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function compress(text) {
    if (typeof CompressionStream === "undefined") return Promise.resolve(null);
    var stream = new Blob([text])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer().then(function (buffer) {
      return toBase64Url(new Uint8Array(buffer));
    });
  }

  /**
   * Resolve the link for `input` without opening or copying anything.
   * `needsClipboard` means the document is too big for a URL: put it on the
   * clipboard yourself before sending the user to `url`.
   */
  function link(input, options) {
    var opts = options || {};
    var base = opts.base || BASE;
    var view = opts.view ? "&view=" + encodeURIComponent(opts.view) : "";

    return compress(toText(input)).then(function (payload) {
      if (payload && payload.length <= MAX_PAYLOAD_LENGTH) {
        // A fragment is never sent to the server, so the document stays out of
        // access logs, Referer headers and analytics.
        return {url: base + "#data=" + payload + view, needsClipboard: false};
      }
      return {url: base + "?data=clipboard" + view, needsClipboard: true};
    });
  }

  function open(input, options) {
    var opts = options || {};
    var text = toText(input);
    var wantsTab = opts.target !== "self";

    // The tab has to be claimed inside the click that triggered it; opening it
    // after the compression await would be eaten by the popup blocker.
    var tab = wantsTab ? global.open("", "_blank") : null;

    return link(text, opts)
      .then(function (result) {
        if (!result.needsClipboard) return result.url;
        var clipboard = global.navigator.clipboard;
        if (!clipboard || !clipboard.writeText) {
          // No clipboard API at all — almost always a page served over plain
          // HTTP, since the API requires a secure context.
          throw new Error(
            "Document too large for a URL and no clipboard API is available " +
              "(this page must be served over HTTPS). Call " +
              "openInJsonViewer.link() and hand the document over yourself."
          );
        }
        return clipboard
          .writeText(text)
          .then(function () {
            return result.url;
          })
          .catch(function () {
            throw new Error(
              "Document too large for a URL and the clipboard was refused. " +
                "Call openInJsonViewer.link() and handle the clipboard yourself."
            );
          });
      })
      .then(function (url) {
        if (tab) {
          tab.location = url;
        } else if (wantsTab) {
          // The popup was blocked. Navigating the host page away instead would
          // throw away whatever the user was doing, so report it rather than
          // silently hijacking the tab.
          throw new Error(
            "Popup blocked — call openInJsonViewer() from a click handler, " +
              'or pass {target: "self"} to navigate this tab instead.'
          );
        } else {
          global.location.href = url;
        }
        return url;
      })
      .catch(function (error) {
        if (tab) tab.close();
        throw error;
      });
  }

  open.link = link;
  open.MAX_PAYLOAD_LENGTH = MAX_PAYLOAD_LENGTH;

  global.openInJsonViewer = open;
})(window);
