export type WorkflowType = 'workflow' | 'cron'

export interface WorkflowItem {
  id: string
  title: string
  type: WorkflowType
  updatedAt: number
}

let _workflows: Ref<WorkflowItem[]> | null = null
let _pinnedIds: Ref<string[]> | null = null

const DEFAULT_WORKFLOWS: WorkflowItem[] = [
  { id: 'wf-1', title: 'Daily standup summary', type: 'workflow', updatedAt: Date.now() - 1000 },
  { id: 'wf-2', title: 'Code review checklist', type: 'workflow', updatedAt: Date.now() - 2000 },
  { id: 'wf-3', title: 'Deploy to production', type: 'cron', updatedAt: Date.now() - 3000 },
  { id: 'wf-4', title: 'Weekly analytics report', type: 'cron', updatedAt: Date.now() - 4000 },
  { id: 'wf-5', title: 'Sync CRM contacts', type: 'workflow', updatedAt: Date.now() - 5000 },
]

function loadJSON<T>(key: string, fallback: T): T {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveJSON(key: string, val: unknown) {
  if (!import.meta.client) return
  localStorage.setItem(key, JSON.stringify(val))
}

function recentThreeIds(items: WorkflowItem[]): string[] {
  return [...items]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
    .map(w => w.id)
}

export function useWorkflows() {
  if (!_workflows) {
    _workflows = ref<WorkflowItem[]>(
      loadJSON<WorkflowItem[]>('gaia:workflows', DEFAULT_WORKFLOWS),
    )
    if (import.meta.client) {
      watch(_workflows, v => saveJSON('gaia:workflows', v), { deep: true })
    }
  }

  if (!_pinnedIds) {
    const stored = loadJSON<string[] | null>('gaia:pinnedWorkflows', null)
    let initial = stored?.length ? stored : recentThreeIds(_workflows.value)
    const valid = new Set(_workflows.value.map(w => w.id))
    initial = initial.filter(id => valid.has(id))
    _pinnedIds = ref<string[]>(initial)
    if (import.meta.client) {
      watch(_pinnedIds, v => saveJSON('gaia:pinnedWorkflows', v), { deep: true })
    }
  }

  const workflows = _workflows as Ref<WorkflowItem[]>
  const pinnedIds = _pinnedIds as Ref<string[]>

  const workflowIds = computed(() => new Set(workflows.value.map(w => w.id)))

  const pinnedWorkflows = computed(() => {
    const byId = new Map(workflows.value.map(w => [w.id, w] as const))
    return pinnedIds.value.map(id => byId.get(id)).filter(Boolean) as WorkflowItem[]
  })

  const validPinnedCount = computed(() =>
    pinnedIds.value.filter(id => workflowIds.value.has(id)).length,
  )

  const canPinMore = computed(() => validPinnedCount.value < 3)

  function pruneStalePins() {
    const valid = new Set(workflows.value.map(w => w.id))
    const pruned = pinnedIds.value.filter(id => valid.has(id))
    if (pruned.length !== pinnedIds.value.length) {
      pinnedIds.value = pruned
    }
  }

  function createWorkflow(type: WorkflowType = 'workflow') {
    const id = `wf-${Date.now()}`
    workflows.value.unshift({
      id,
      title: type === 'cron' ? 'New CRON job' : 'New workflow',
      type,
      updatedAt: Date.now(),
    })
    return id
  }

  function renameWorkflow(id: string, title: string) {
    const w = workflows.value.find(x => x.id === id)
    if (!w) return
    w.title = title.trim() || (w.type === 'cron' ? 'CRON job' : 'Workflow')
    w.updatedAt = Date.now()
  }

  function deleteWorkflow(id: string) {
    workflows.value = workflows.value.filter(w => w.id !== id)
    pinnedIds.value = pinnedIds.value.filter(pid => pid !== id)
  }

  function togglePin(id: string): { ok: boolean; reason?: 'limit' } {
    pruneStalePins()
    const idx = pinnedIds.value.indexOf(id)
    if (idx !== -1) {
      pinnedIds.value = pinnedIds.value.filter(pid => pid !== id)
      return { ok: true }
    }
    if (validPinnedCount.value >= 3) return { ok: false, reason: 'limit' }
    pinnedIds.value = [...pinnedIds.value, id]
    return { ok: true }
  }

  return {
    workflows,
    pinnedIds,
    pinnedWorkflows,
    canPinMore,
    createWorkflow,
    renameWorkflow,
    deleteWorkflow,
    togglePin,
  }
}
