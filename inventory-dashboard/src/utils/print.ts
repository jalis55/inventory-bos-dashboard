/**
 * Prints a generated HTML document inline in the current page instead of
 * opening a new tab/window. The document is mounted into a hidden container
 * and a page-level print stylesheet makes ONLY that container visible, so
 * `window.print()` prints just the document (browser print dialog opens
 * over the app).
 */

const ROOT_ID = 'inline-print-root'
const STYLE_ID = 'inline-print-style'

function ensurePrintStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #${ROOT_ID}, #${ROOT_ID} * { visibility: visible !important; }
      #${ROOT_ID} {
        position: absolute !important;
        left: 0; top: 0;
        width: 100%;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        box-shadow: none !important;
      }
    }
  `
  document.head.appendChild(style)
}

/** Strip the full-document wrappers, toolbar and auto-print script so the
 * fragment can be safely mounted into the live page. */
function toFragment(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head>/gi, '')
    .replace(/<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<div\s+class="toolbar"[\s\S]*?<\/div>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
}

export function printInBrowser(html: string): void {
  ensurePrintStyles()
  let root = document.getElementById(ROOT_ID) as HTMLDivElement | null
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    document.body.appendChild(root)
  }
  root.innerHTML = toFragment(html)
  // Let the injected <style> take effect before showing the print dialog.
  setTimeout(() => window.print(), 60)
}