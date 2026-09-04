import { useEffect } from 'react'

const BASE_TITLE = 'Dashboard'
const ICON_ID = 'task-favicon'

/**
 * Draws a 32x32 favicon: a rounded accent tile, plus a critical-coloured dot
 * when something is overdue. Returns null wherever canvas is unavailable — a
 * headless context, or a browser refusing the 2d context — so the caller falls
 * back to the title alone.
 *
 * The two colours are duplicated from index.css deliberately: canvas cannot
 * read CSS custom properties without a getComputedStyle round trip per repaint.
 */
function drawFavicon(overdue: number): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#8b72ee'
    context.beginPath()
    context.roundRect(2, 2, 28, 28, 8)
    context.fill()

    context.fillStyle = '#f4f4f5'
    context.font = 'bold 18px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('D', 16, 17)

    if (overdue > 0) {
      context.fillStyle = '#e66767'
      context.beginPath()
      context.arc(24, 8, 7, 0, Math.PI * 2)
      context.fill()
    }

    return canvas.toDataURL('image/png')
  } catch {
    // No canvas, or a browser refusing toDataURL — the title still carries it.
    return null
  }
}

/**
 * Puts the overdue count where it is visible without switching to the tab,
 * which matters because this dashboard opens automatically at the start of a
 * session and then sits in a background tab.
 */
export function useTaskBadge(overdue: number): void {
  useEffect(() => {
    document.title = overdue > 0 ? `(${overdue}) ${BASE_TITLE}` : BASE_TITLE

    const href = drawFavicon(overdue)
    if (!href) return

    let link = document.getElementById(ICON_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = ICON_ID
      link.rel = 'icon'
      document.head.append(link)
    }
    link.href = href
  }, [overdue])
}
