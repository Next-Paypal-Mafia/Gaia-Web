export function useBrowserActions(cdp: ReturnType<typeof useCDP>) {
  const currentUrl = ref('')
  const pageTitle = ref('')
  const isLoading = ref(false)

  cdp.on('Page.frameNavigated', (params: any) => {
    if (!params.frame.parentId) {
      currentUrl.value = params.frame.url
    }
  })

  cdp.on('Page.loadEventFired', () => {
    isLoading.value = false
  })

  cdp.on('Page.frameStartedLoading', () => {
    isLoading.value = true
  })

  async function navigate(url: string) {
    let targetUrl = url
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }
    isLoading.value = true
    await cdp.send('Page.navigate', { url: targetUrl })
  }

  async function goBack() {
    const history = await cdp.send<{ currentIndex: number; entries: any[] }>('Page.getNavigationHistory')
    if (history.currentIndex > 0) {
      await cdp.send('Page.navigateToHistoryEntry', {
        entryId: history.entries[history.currentIndex - 1].id,
      })
    }
  }

  async function goForward() {
    const history = await cdp.send<{ currentIndex: number; entries: any[] }>('Page.getNavigationHistory')
    if (history.currentIndex < history.entries.length - 1) {
      await cdp.send('Page.navigateToHistoryEntry', {
        entryId: history.entries[history.currentIndex + 1].id,
      })
    }
  }

  async function reload() {
    await cdp.send('Page.reload')
  }

  async function click(x: number, y: number) {
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

  async function typeText(text: string) {
    for (const char of text) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
      })
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
      })
    }
  }

  async function pressKey(key: string, code?: string) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code: code || key,
      windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0,
    })
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code: code || key,
    })
  }

  async function scroll(direction: 'up' | 'down', amount = 300) {
    const deltaY = direction === 'down' ? amount : -amount
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 640,
      y: 360,
      deltaX: 0,
      deltaY,
    })
  }

  async function getPageTitle(): Promise<string> {
    const result = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
      expression: 'document.title',
    })
    pageTitle.value = result.result.value
    return result.result.value
  }

  async function evaluateJS(expression: string): Promise<any> {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    })
    return result.result?.value
  }

  return {
    currentUrl: readonly(currentUrl),
    pageTitle: readonly(pageTitle),
    isLoading: readonly(isLoading),
    navigate,
    goBack,
    goForward,
    reload,
    click,
    typeText,
    pressKey,
    scroll,
    getPageTitle,
    evaluateJS,
  }
}
