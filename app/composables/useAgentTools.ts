export function useAgentTools(cdp: ReturnType<typeof useCDP>) {
  async function getPageState() {
    const [urlResult, titleResult, a11yResult] = await Promise.all([
      cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
        expression: 'window.location.href',
      }),
      cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
        expression: 'document.title',
      }),
      cdp.send<{ nodes: any[] }>('Accessibility.getFullAXTree'),
    ])

    const tree = formatAccessibilityTree(a11yResult.nodes)

    return {
      url: urlResult.result.value,
      title: titleResult.result.value,
      accessibilityTree: tree,
    }
  }

  async function safeGetPageState() {
    try {
      return await getPageState()
    } catch (err: any) {
      console.error('[AgentTools] getPageState failed:', err?.message)
      return { url: 'unknown', title: 'unknown', accessibilityTree: '(page state unavailable)' }
    }
  }

  async function waitForPageLoad(timeoutMs = 10_000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const result = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
          expression: 'document.readyState',
        })
        if (result.result.value === 'complete') return
      } catch {}
      await new Promise(r => setTimeout(r, 300))
    }
  }

  async function dispatchClick(x: number, y: number) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
  }

  async function navigate(url: string) {
    let targetUrl = url
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }
    await cdp.send('Page.navigate', { url: targetUrl })
    await waitForPageLoad()
    const state = await safeGetPageState()
    return {
      action: 'navigate',
      url: targetUrl,
      result: `Navigated to ${state.url} - "${state.title}"`,
      pageState: state.accessibilityTree,
    }
  }

  async function clickElement(description: string) {
    const result = await cdp.send<{ result: { value: any } }>('Runtime.evaluate', {
      expression: `
        (function() {
          const query = ${JSON.stringify(description)}.toLowerCase();
          const all = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [onclick], [tabindex]');
          let best = null;
          let bestScore = 0;

          for (const el of all) {
            const text = (el.textContent || '').trim().toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
            const alt = (el.getAttribute('alt') || '').toLowerCase();
            const name = (el.getAttribute('name') || '').toLowerCase();

            let score = 0;
            for (const attr of [text, ariaLabel, title, placeholder, alt, name]) {
              if (attr === query) score = Math.max(score, 10);
              else if (attr.includes(query)) score = Math.max(score, 5);
              else if (query.split(' ').some(w => attr.includes(w))) score = Math.max(score, 2);
            }

            if (score > bestScore) {
              bestScore = score;
              best = el;
            }
          }

          if (best) {
            const rect = best.getBoundingClientRect();
            return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, tag: best.tagName, text: best.textContent?.trim().substring(0, 50) };
          }
          return { found: false };
        })()
      `,
      returnByValue: true,
    })

    const match = result.result.value

    if (!match?.found) {
      return { action: 'clickElement', success: false, message: `Could not find element matching "${description}"` }
    }

    await dispatchClick(match.x, match.y)
    await new Promise(r => setTimeout(r, 500))
    const state = await safeGetPageState()

    return {
      action: 'clickElement',
      success: true,
      message: `Clicked <${match.tag}> "${match.text}" at (${Math.round(match.x)}, ${Math.round(match.y)})`,
      pageState: state.accessibilityTree,
    }
  }

  async function clickCoordinates(x: number, y: number) {
    await dispatchClick(x, y)
    await new Promise(r => setTimeout(r, 500))
    const state = await safeGetPageState()
    return { action: 'clickCoordinates', x, y, pageState: state.accessibilityTree }
  }

  async function typeText(text: string) {
    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char })
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp' })
    }
    return { action: 'typeText', text, result: `Typed "${text}"` }
  }

  async function pressKey(key: string) {
    const keyCodes: Record<string, number> = {
      Enter: 13,
      Tab: 9,
      Escape: 27,
      Backspace: 8,
      ArrowDown: 40,
      ArrowUp: 38,
      ArrowLeft: 37,
      ArrowRight: 39,
    }
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      windowsVirtualKeyCode: keyCodes[key] || 0,
    })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key })
    await new Promise(r => setTimeout(r, 300))
    return { action: 'pressKey', key, result: `Pressed ${key}` }
  }

  async function scroll(direction: 'up' | 'down') {
    const amount = 400
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 640,
      y: 360,
      deltaX: 0,
      deltaY: direction === 'down' ? amount : -amount,
    })
    await new Promise(r => setTimeout(r, 300))
    const state = await safeGetPageState()
    return { action: 'scroll', direction, pageState: state.accessibilityTree }
  }

  async function waitForLoad(seconds: number) {
    await new Promise(r => setTimeout(r, seconds * 1000))
    const state = await safeGetPageState()
    return {
      action: 'waitForLoad',
      waited: seconds,
      url: state.url,
      title: state.title,
      pageState: state.accessibilityTree,
    }
  }

  async function executeTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'navigate':
        return navigate(args.url)
      case 'clickElement':
        return clickElement(args.description)
      case 'clickCoordinates':
        return clickCoordinates(args.x, args.y)
      case 'typeText':
        return typeText(args.text)
      case 'pressKey':
        return pressKey(args.key)
      case 'scroll':
        return scroll(args.direction)
      case 'getPageState': {
        const state = await getPageState()
        return { action: 'getPageState', url: state.url, title: state.title, pageState: state.accessibilityTree }
      }
      case 'waitForLoad':
        return waitForLoad(args.seconds ?? 2)
      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  }

  return { executeTool }
}

function formatAccessibilityTree(nodes: any[], maxDepth = 5): string {
  if (!nodes?.length) return '(empty page)'

  const lines: string[] = []
  const seen = new Set<string>()
  const ignoredRoles = new Set(['none', 'generic', 'InlineTextBox', 'LineBreak'])

  function walk(node: any, depth: number) {
    if (depth > maxDepth) return
    if (seen.has(node.nodeId)) return
    seen.add(node.nodeId)

    const role = node.role?.value || ''
    const name = node.name?.value || ''
    const value = node.value?.value || ''

    if (ignoredRoles.has(role) && !name) {
      for (const childId of node.childIds || []) {
        const child = nodes.find((n: any) => n.nodeId === childId)
        if (child) walk(child, depth)
      }
      return
    }

    const indent = '  '.repeat(depth)
    let line = `${indent}[${role}]`
    if (name) line += ` "${name}"`
    if (value) line += ` value="${value}"`

    const backendId = node.backendDOMNodeId
    if (backendId) line += ` (nodeId:${backendId})`

    lines.push(line)

    for (const childId of node.childIds || []) {
      const child = nodes.find((n: any) => n.nodeId === childId)
      if (child) walk(child, depth + 1)
    }
  }

  if (nodes[0]) walk(nodes[0], 0)

  const truncated = lines.slice(0, 200)
  if (lines.length > 200) {
    truncated.push(`... (${lines.length - 200} more nodes truncated)`)
  }

  return truncated.join('\n')
}
