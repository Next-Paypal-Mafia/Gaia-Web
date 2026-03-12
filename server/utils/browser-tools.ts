import { tool } from 'ai'
import { z } from 'zod'

export const browserTools = {
  navigate: tool({
    description: 'Navigate the browser to a URL. Use this to go to a specific website.',
    parameters: z.object({
      url: z.string().describe('The URL to navigate to, e.g. "https://google.com"'),
    }),
  }),

  clickElement: tool({
    description: 'Click on a page element by its visible text, label, or description. Use this for buttons, links, inputs, etc.',
    parameters: z.object({
      description: z.string().describe('What to click - describe the element by its text, label, or purpose, e.g. "Sign in button", "search input", "Next link"'),
    }),
  }),

  clickCoordinates: tool({
    description: 'Click at specific x,y pixel coordinates on the page. Use this when you know exact coordinates.',
    parameters: z.object({
      x: z.number().describe('X coordinate in pixels'),
      y: z.number().describe('Y coordinate in pixels'),
    }),
  }),

  typeText: tool({
    description: 'Type text into the currently focused input field. Click on an input first, then use this to type into it.',
    parameters: z.object({
      text: z.string().describe('The text to type'),
    }),
  }),

  pressKey: tool({
    description: 'Press a keyboard key. Use for Enter, Tab, Escape, Backspace, arrow keys, etc.',
    parameters: z.object({
      key: z.string().describe('Key name: Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, ArrowLeft, ArrowRight'),
    }),
  }),

  scroll: tool({
    description: 'Scroll the page up or down.',
    parameters: z.object({
      direction: z.enum(['up', 'down']).describe('Scroll direction'),
    }),
  }),

  getPageState: tool({
    description: 'Get the current page URL, title, and accessibility tree to understand what is on screen. Use this to observe the page before or after actions.',
    parameters: z.object({}),
  }),

  waitForLoad: tool({
    description: 'Wait for the page to finish loading. Use after navigation or actions that trigger page loads.',
    parameters: z.object({
      seconds: z.number().min(0.5).max(10).default(2).describe('How many seconds to wait'),
    }),
  }),
}
