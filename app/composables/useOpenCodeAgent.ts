export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<Record<string, any>>;
  runId?: string | null;
}

export interface BrowserAgentBudget {
  maxBrowserAgents: number;
  activeBrowserTasks: number;
  remainingBrowserTasks: number;
}

interface ViewportState {
  agentId: string | null;
  agentType?: string | null;
  browserSessionId: string | null;
  contextId: string | null;
  targetId: string | null;
  browserSessionName: string | null;
}

interface ViewportDebugInfo {
  viewport: ViewportState | null;
  processing: boolean;
  browserAgentBudget: {
    maxBrowserAgents: number;
    activeBrowserAgents: number;
    remainingBrowserAgents: number;
  };
  agents: Array<Record<string, any>>;
  browserSessions: Array<Record<string, any>>;
}

export interface RunState {
  runId: string;
  contextId: string | null;
  browserSessionName?: string | null;
  browserContextId?: string | null;
  targetId?: string | null;
  latestBrowserTaskId?: string | null;
  browserAgentBudget?: BrowserAgentBudget | null;
  browserTasks: Record<
    string,
    {
      browserTaskId: string;
      label: string | null;
      messageId: string | null;
      contextId: string | null;
      browserSessionName: string | null;
      browserContextId: string | null;
      targetId: string | null;
      status: string | null;
    }
  >;
  status:
    | "created"
    | "submitted"
    | "streaming"
    | "completed"
    | "failed"
    | "cancelled";
  usesBrowser: boolean;
}

interface AssistantBuffer {
  messageID: string;
  uiId: string;
  runId: string | null;
  parts: Array<Record<string, any>>;
}

import { useUsage } from "~/composables/useUsage";
import { reportUserLocationNow } from "~/composables/useUserLocationReporting";

interface StreamEvent {
  type: string;
  run_id: string | null;
  context_id: string | null;
  properties?: Record<string, any>;
}

interface SessionEventMessage {
  type: string;
  data?: Record<string, any>;
}

interface PendingResponse<T> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

function isBrowserTaskInput(
  input: Record<string, any> | null | undefined,
): boolean {
  if (!input) return false;
  if (input.subagent_type === "browser") return true;
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  return /browser session|playwright-cli|subagent_type":"browser|subagent_type: browser/i.test(
    prompt,
  );
}

function browserTaskLabel(
  input: Record<string, any> | null | undefined,
): string | null {
  if (!input) return null;
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (description) return description;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) return null;
  const sentence = (prompt.split(/[\n.!?]/)[0] || "").trim();
  return sentence || null;
}

function browserAgentBudgetFromPayload(
  input: Record<string, any> | null | undefined,
): BrowserAgentBudget | null {
  if (!input) return null;

  const nested = input.browserAgentBudget;
  if (
    nested &&
    typeof nested.maxBrowserAgents === "number" &&
    (typeof nested.activeBrowserTasks === "number"
      || typeof nested.activeBrowserAgents === "number") &&
    (typeof nested.remainingBrowserTasks === "number"
      || typeof nested.remainingBrowserAgents === "number")
  ) {
    return {
      maxBrowserAgents: nested.maxBrowserAgents,
      activeBrowserTasks:
        typeof nested.activeBrowserTasks === "number"
          ? nested.activeBrowserTasks
          : nested.activeBrowserAgents,
      remainingBrowserTasks:
        typeof nested.remainingBrowserTasks === "number"
          ? nested.remainingBrowserTasks
          : nested.remainingBrowserAgents,
    };
  }

  if (
    typeof input.maxBrowserAgents === "number" &&
    (typeof input.activeBrowserTasks === "number"
      || typeof input.activeBrowserAgents === "number") &&
    (typeof input.remainingBrowserTasks === "number"
      || typeof input.remainingBrowserAgents === "number")
  ) {
    return {
      maxBrowserAgents: input.maxBrowserAgents,
      activeBrowserTasks:
        typeof input.activeBrowserTasks === "number"
          ? input.activeBrowserTasks
          : input.activeBrowserAgents,
      remainingBrowserTasks:
        typeof input.remainingBrowserTasks === "number"
          ? input.remainingBrowserTasks
          : input.remainingBrowserAgents,
    };
  }

  return null;
}

export function useOpenCodeAgent() {
  const usage = useUsage();
  const messages = shallowRef<UIMessage[]>([]);
  const isAgentRunning = ref(false);
  const status = ref<"ready" | "submitted" | "streaming" | "error">("ready");
  const sessionId = ref<string | null>(null);
  const activeRunId = ref<string | null>(null);
  const focusedBrowserRunId = ref<string | null>(null);
  const focusedBrowserTaskId = ref<string | null>(null);
  const runs = ref<Record<string, RunState>>({});

  let _baseUrl = "";
  let _token: string | undefined;
  let _mainSocket: WebSocket | null = null;
  let _mainSocketReady: Promise<void> | null = null;
  let _mainSocketIntentionalClose = false;
  let _presenceTimer: ReturnType<typeof setInterval> | null = null;
  let _assistantBuffer: AssistantBuffer | null = null;
  let _acceptParts = false;
  let _pendingViewportState: PendingResponse<ViewportState | null> | null = null;
  let _pendingViewportDebug: PendingResponse<ViewportDebugInfo | null> | null = null;

  function _httpToWs(baseUrl: string): string {
    return baseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
  }

  function _upsertMessage(message: UIMessage) {
    const nextMessages: UIMessage[] = [];
    let replaced = false;

    for (const existing of messages.value) {
      if (existing.id !== message.id) {
        nextMessages.push(existing);
        continue;
      }

      if (!replaced) {
        nextMessages.push(message);
        replaced = true;
      }
    }

    if (!replaced) {
      nextMessages.push(message);
    }

    messages.value = nextMessages;
  }

  function _clearPendingResponse<T>(
    pending: PendingResponse<T> | null,
    reason: string,
  ): null {
    if (!pending) return null;
    clearTimeout(pending.timer);
    pending.reject(new Error(reason));
    return null;
  }

  function _closeMainSocket() {
    _pendingViewportState = _clearPendingResponse(
      _pendingViewportState,
      "Viewport request cancelled",
    );
    _pendingViewportDebug = _clearPendingResponse(
      _pendingViewportDebug,
      "Viewport debug request cancelled",
    );

    if (_mainSocket) {
      _mainSocketIntentionalClose = true;
      _mainSocket.close();
      _mainSocket = null;
    }

    _mainSocketReady = null;
  }

  function _findRunIdForAgent(agentId: string | null): string | null {
    if (!agentId) return null;

    for (const [runId, run] of Object.entries(runs.value)) {
      if (run.latestBrowserTaskId === agentId) return runId;
      for (const browserTask of Object.values(run.browserTasks)) {
        if (browserTask.browserTaskId === agentId) return runId;
      }
    }

    return null;
  }

  function _syncFocusedBrowserFromViewport(viewport: ViewportState | null) {
    const agentId = viewport?.agentId ?? null;
    if (!agentId) {
      focusedBrowserRunId.value = null;
      focusedBrowserTaskId.value = null;
      return;
    }

    const runId = _findRunIdForAgent(agentId);
    focusedBrowserRunId.value = runId;
    focusedBrowserTaskId.value = agentId;
  }

  function _handleViewportStateMessage(viewport: ViewportState | null) {
    _syncFocusedBrowserFromViewport(viewport);

    if (_pendingViewportState) {
      const pending = _pendingViewportState;
      _pendingViewportState = null;
      clearTimeout(pending.timer);
      pending.resolve(viewport);
    }
  }

  function _handleViewportDebugMessage(debugInfo: ViewportDebugInfo | null) {
    if (_pendingViewportDebug) {
      const pending = _pendingViewportDebug;
      _pendingViewportDebug = null;
      clearTimeout(pending.timer);
      pending.resolve(debugInfo);
    }
  }

  function _handleSocketErrorMessage(data: Record<string, any> | undefined) {
    const code = typeof data?.code === "string" ? data.code : null;
    const message =
      typeof data?.message === "string"
        ? data.message
        : "The backend rejected the request.";

    if (code === "TOO_MANY_REQUESTS") {
      _appendRunErrorMessage(activeRunId.value ?? `rate-limit-${Date.now()}`, {
        message,
      });
    }

    if (isAgentRunning.value) {
      _finaliseAssistantMessage();
      isAgentRunning.value = false;
    }

    if (activeRunId.value) {
      _upsertRun(activeRunId.value, { status: "failed" });
      activeRunId.value = null;
    }

    _acceptParts = false;
    status.value = "error";
  }

  function _handleSocketMessage(raw: string) {
    let message: SessionEventMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.type === "event" && message.data) {
      const event = message.data;
      _handleStreamEvent({
        type: typeof event.type === "string" ? event.type : "event.unknown",
        run_id: activeRunId.value,
        context_id:
          typeof event.context_id === "string" || event.context_id === null
            ? event.context_id
            : null,
        properties: (event.properties as Record<string, any> | undefined) ?? {},
      });
      return;
    }

    if (message.type === "viewport.state") {
      _handleViewportStateMessage((message.data as ViewportState | null) ?? null);
      return;
    }

    if (message.type === "viewport.debug_info") {
      _handleViewportDebugMessage(
        (message.data as ViewportDebugInfo | null) ?? null,
      );
      return;
    }

    if (message.type === "error") {
      _handleSocketErrorMessage(message.data);
    }
  }

  async function _openMainSocket(): Promise<void> {
    if (!sessionId.value) {
      throw new Error("Cannot open WebSocket without a session");
    }

    _closeMainSocket();
    _mainSocketIntentionalClose = false;

    const wsBase = _httpToWs(_baseUrl.replace(/\/$/, ""));
    const url = new URL(`${wsBase}/sessions/${sessionId.value}`);
    if (_token) url.searchParams.set("token", _token);

    _mainSocketReady = new Promise((resolve, reject) => {
      const ws = new WebSocket(url.toString());
      _mainSocket = ws;

      ws.onopen = () => {
        resolve();
      };

      ws.onmessage = (event) => {
        _handleSocketMessage(String(event.data));
      };

      ws.onerror = (event) => {
        console.error("[useOpenCodeAgent] Main WebSocket error", event);
      };

      ws.onclose = (event) => {
        const wasIntentional = _mainSocketIntentionalClose;
        _mainSocket = null;
        _mainSocketReady = null;

        if (wasIntentional) {
          _mainSocketIntentionalClose = false;
          return;
        }

        reject(
          new Error(
            event.reason
              || `Main WebSocket closed unexpectedly (${event.code})`,
          ),
        );

        console.warn(
          "[useOpenCodeAgent] Main WebSocket closed unexpectedly:",
          event.code,
          event.reason,
        );

        _pendingViewportState = _clearPendingResponse(
          _pendingViewportState,
          "Viewport request failed",
        );
        _pendingViewportDebug = _clearPendingResponse(
          _pendingViewportDebug,
          "Viewport debug request failed",
        );
        _finaliseAssistantMessage();
        _acceptParts = false;
        isAgentRunning.value = false;
        if (status.value !== "ready") status.value = "error";
      };
    });

    await _mainSocketReady;
  }

  async function _sendSocketMessage(payload: Record<string, any>): Promise<void> {
    if (!_mainSocketReady) {
      throw new Error("Main WebSocket is not connected");
    }

    await _mainSocketReady;

    if (!_mainSocket || _mainSocket.readyState !== WebSocket.OPEN) {
      throw new Error("Main WebSocket is not open");
    }

    _mainSocket.send(JSON.stringify(payload));
  }

  function _stopPresenceLease() {
    if (_presenceTimer) {
      clearInterval(_presenceTimer);
      _presenceTimer = null;
    }
  }

  async function _touchPresenceLease(): Promise<void> {
    if (!_baseUrl || !sessionId.value) return;

    const headers: Record<string, string> = {};
    if (_token) headers["Authorization"] = `Bearer ${_token}`;

    try {
      const res = await fetch(
        `${_baseUrl}/sessions/${sessionId.value}/presence`,
        {
          method: "POST",
          headers,
          credentials: _token ? "omit" : "include",
          keepalive: true,
        },
      );

      if (res.status === 404) {
        _stopPresenceLease();
        return;
      }

      if (!res.ok) {
        console.warn(
          "[useOpenCodeAgent] Presence heartbeat failed:",
          res.status,
        );
      }
    } catch (err) {
      console.warn("[useOpenCodeAgent] Presence heartbeat network error:", err);
    }
  }

  function _startPresenceLease() {
    _stopPresenceLease();
    void _touchPresenceLease();
    _presenceTimer = setInterval(() => {
      void _touchPresenceLease();
    }, 15000);
  }

  function _upsertRun(runId: string, patch: Partial<RunState>) {
    const current = runs.value[runId] ?? {
      runId,
      contextId: null,
      browserSessionName: null,
      browserContextId: null,
      targetId: null,
      latestBrowserTaskId: null,
      browserAgentBudget: null,
      browserTasks: {},
      status: "created",
      usesBrowser: false,
    };
    runs.value = {
      ...runs.value,
      [runId]: { ...current, ...patch },
    };
  }

  function _upsertBrowserTask(
    runId: string,
    browserTaskId: string,
    patch: Partial<RunState["browserTasks"][string]>,
  ) {
    const run = runs.value[runId];
    if (!run) return;
    const current = run.browserTasks[browserTaskId] ?? {
      browserTaskId,
      label: null,
      messageId: null,
      contextId: null,
      browserSessionName: null,
      browserContextId: null,
      targetId: null,
      status: null,
    };

    _upsertRun(runId, {
      latestBrowserTaskId: browserTaskId,
      browserTasks: {
        ...run.browserTasks,
        [browserTaskId]: { ...current, ...patch },
      },
    });
  }

  function _handleStreamEvent(evt: StreamEvent) {
    const runId = evt.run_id;
    const browserTaskId =
      typeof evt.properties?.browserTaskId === "string"
        ? evt.properties.browserTaskId
        : typeof evt.properties?.agentId === "string"
          ? evt.properties.agentId
         : null;
    const browserAgentBudget = browserAgentBudgetFromPayload(
      evt.properties ?? null,
    );
    if (runId) {
      _upsertRun(runId, {
        contextId: evt.context_id ?? runs.value[runId]?.contextId ?? null,
        browserSessionName:
          (evt.properties?.browserSessionName as string | null | undefined) ??
          runs.value[runId]?.browserSessionName ??
          null,
        browserContextId:
          (evt.properties?.browserContextId as string | null | undefined) ??
          runs.value[runId]?.browserContextId ??
          null,
        targetId:
          (evt.properties?.targetId as string | null | undefined) ??
          runs.value[runId]?.targetId ??
          null,
        latestBrowserTaskId:
          browserTaskId ?? runs.value[runId]?.latestBrowserTaskId ?? null,
        browserAgentBudget:
          browserAgentBudget ?? runs.value[runId]?.browserAgentBudget ?? null,
        usesBrowser:
          !!evt.context_id || runs.value[runId]?.usesBrowser === true,
      });
      if (browserTaskId) {
        _upsertBrowserTask(runId, browserTaskId, {
          label:
            (evt.properties?.browserTaskLabel as string | null | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]?.label ??
            null,
          messageId:
            (evt.properties?.browserTaskMessageId as
              | string
              | null
              | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]?.messageId ??
            null,
          contextId:
            evt.context_id ??
            runs.value[runId]?.browserTasks[browserTaskId]?.contextId ??
            null,
          browserSessionName:
            (evt.properties?.browserSessionName as string | null | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]
              ?.browserSessionName ??
            null,
          browserContextId:
            (evt.properties?.browserContextId as string | null | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]?.browserContextId ??
            null,
          targetId:
            (evt.properties?.targetId as string | null | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]?.targetId ??
            null,
          status:
            typeof evt.properties?.status === "string"
              ? evt.properties.status
              : (runs.value[runId]?.browserTasks[browserTaskId]?.status ??
                null),
        });
      }
    }

    if (evt.type === "server.connected") return;

    if (evt.type === "prompt.accepted" && runId) {
      activeRunId.value = runId;
      _upsertRun(runId, { status: "submitted" });
      return;
    }

    if (evt.type === "run.browser_context.updated" && runId) {
      _upsertRun(runId, {
        contextId: evt.context_id ?? null,
        browserSessionName:
          (evt.properties?.browserSessionName as string | null | undefined) ??
          runs.value[runId]?.browserSessionName ??
          null,
        browserContextId:
          (evt.properties?.browserContextId as string | null | undefined) ??
          null,
        targetId:
          (evt.properties?.targetId as string | null | undefined) ?? null,
        latestBrowserTaskId:
          browserTaskId ?? runs.value[runId]?.latestBrowserTaskId ?? null,
        usesBrowser: true,
      });
      if (browserTaskId) {
        _upsertBrowserTask(runId, browserTaskId, {
          label:
            (evt.properties?.browserTaskLabel as string | null | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]?.label ??
            null,
          messageId:
            (evt.properties?.browserTaskMessageId as
              | string
              | null
              | undefined) ??
            runs.value[runId]?.browserTasks[browserTaskId]?.messageId ??
            null,
          contextId: evt.context_id ?? null,
          browserSessionName:
            (evt.properties?.browserSessionName as string | null | undefined) ??
            null,
          browserContextId:
            (evt.properties?.browserContextId as string | null | undefined) ??
            null,
          targetId:
            (evt.properties?.targetId as string | null | undefined) ?? null,
          status:
            typeof evt.properties?.status === "string"
              ? evt.properties.status
              : (runs.value[runId]?.browserTasks[browserTaskId]?.status ??
                null),
        });
      }
      return;
    }

    if (evt.type === "run.browser_context.mismatch" && runId) {
      _appendBrowserMismatchMessage(runId, evt.properties ?? {});
      return;
    }

    if (evt.type === "message.part.updated" && evt.properties) {
      _handlePartUpdated(runId, evt.properties);
      return;
    }

    if (evt.type === "viewport.updated") {
      _syncFocusedBrowserFromViewport({
        agentId:
          typeof evt.properties?.agentId === "string"
            ? evt.properties.agentId
            : null,
        browserSessionId:
          typeof evt.properties?.browserSessionId === "string"
            ? evt.properties.browserSessionId
            : null,
        contextId:
          typeof evt.properties?.contextId === "string"
            ? evt.properties.contextId
            : null,
        targetId:
          typeof evt.properties?.targetId === "string"
            ? evt.properties.targetId
            : null,
        browserSessionName:
          typeof evt.properties?.browserSessionName === "string"
            ? evt.properties.browserSessionName
            : null,
      });
      return;
    }

    if (evt.type === "session.idle" && runId) {
      if (_acceptParts) _finaliseAssistantMessage();
      _acceptParts = false;
      _upsertRun(runId, { status: "completed" });
      activeRunId.value = null;
      isAgentRunning.value = false;
      status.value = "ready";
      return;
    }

    if (evt.type === "prompt.cancelled" && runId) {
      if (_acceptParts) _finaliseAssistantMessage();
      _acceptParts = false;
      _upsertRun(runId, { status: "cancelled" });
      activeRunId.value = null;
      isAgentRunning.value = false;
      status.value = "ready";
      return;
    }

    if (
      evt.type === "session.error" &&
      runId
    ) {
      if (_acceptParts) _finaliseAssistantMessage();
      _acceptParts = false;
      if (evt.type === "session.error") {
        _appendRunErrorMessage(runId, evt.properties ?? {});
      }
      _upsertRun(runId, {
        status: "failed",
      });
      activeRunId.value = null;
      isAgentRunning.value = false;
      status.value = "error";
      return;
    }
  }

  function _handlePartUpdated(
    runId: string | null,
    properties: Record<string, any>,
  ) {
    if (!_acceptParts) return;

    const part = properties.part as Record<string, any> | undefined;
    if (!part) return;

    const messageID = (part.messageID ?? properties.messageID) as
      | string
      | undefined;
    if (!messageID) return;

    if (runId && part.type === "tool") {
      const taskInput =
        part.tool === "task" || part.toolName === "task"
          ? (part.state?.input ?? part.input ?? null)
          : null;
      const browserTaskId = (part.callID ?? part.toolCallId ?? part.id) as
        | string
        | undefined;
      if (browserTaskId && isBrowserTaskInput(taskInput)) {
        _upsertBrowserTask(runId, browserTaskId, {
          label: browserTaskLabel(taskInput),
          messageId: messageID,
          status:
            typeof part.state?.status === "string" ? part.state.status : null,
          contextId:
            runs.value[runId]?.browserTasks[browserTaskId]?.contextId ??
            runs.value[runId]?.contextId ??
            null,
          browserSessionName:
            runs.value[runId]?.browserTasks[browserTaskId]
              ?.browserSessionName ??
            runs.value[runId]?.browserSessionName ??
            null,
          browserContextId:
            runs.value[runId]?.browserTasks[browserTaskId]?.browserContextId ??
            runs.value[runId]?.browserContextId ??
            null,
          targetId:
            runs.value[runId]?.browserTasks[browserTaskId]?.targetId ??
            runs.value[runId]?.targetId ??
            null,
        });
      }
    }

    if (runId) _upsertRun(runId, { status: "streaming" });

    if (status.value === "submitted") {
      status.value = "streaming";
    }

    if (_assistantBuffer && _assistantBuffer.messageID !== messageID) {
      _finaliseAssistantMessage();
    }

    if (!_assistantBuffer) {
      const uiId = `assistant-${messageID}`;
      const existingMessage = messages.value.find(
        (message) => message.id === uiId,
      );
      const nextRunId = runId ?? existingMessage?.runId ?? null;

      _assistantBuffer = {
        messageID,
        uiId,
        runId: nextRunId,
        parts: existingMessage ? [...existingMessage.parts] : [],
      };

      _upsertMessage(
        existingMessage
          ? { ...existingMessage, runId: nextRunId }
          : { id: uiId, role: "assistant", parts: [], runId: nextRunId },
      );
    }

    _mergePart(_assistantBuffer, part);
    _flushBuffer();
  }

  function _appendBrowserMismatchMessage(
    runId: string,
    properties: Record<string, any>,
  ) {
    const reason =
      typeof properties.reason === "string"
        ? properties.reason
        : "Browser session mapping could not be verified.";
    const command =
      typeof properties.command === "string" ? properties.command : null;
    const browserSessionName =
      typeof properties.browserSessionName === "string"
        ? properties.browserSessionName
        : (runs.value[runId]?.browserSessionName ?? null);

    messages.value = [
      ...messages.value,
      {
        id: `assistant-browser-mismatch-${runId}-${Date.now()}`,
        role: "assistant",
        runId,
        parts: [
          {
            type: "diagnostic-browser-mismatch",
            reason,
            command,
            browserSessionName,
          },
        ],
      },
    ];
  }

  function _appendRunErrorMessage(
    runId: string,
    properties: Record<string, any>,
  ) {
    const message =
      typeof properties.message === "string"
        ? properties.message
        : "The agent run failed.";
    const browserTaskId =
      typeof properties.browserTaskId === "string"
        ? properties.browserTaskId
        : null;
    const browserTaskLabel =
      typeof properties.browserTaskLabel === "string"
        ? properties.browserTaskLabel
        : null;
    const browserSessionName =
      typeof properties.browserSessionName === "string"
        ? properties.browserSessionName
        : (runs.value[runId]?.browserSessionName ?? null);
    const planId =
      typeof properties.planId === "string" ? properties.planId : null;
    const maxBrowserAgents =
      typeof properties.maxBrowserAgents === "number"
        ? properties.maxBrowserAgents
        : null;

    const alreadyExists = messages.value.some(
      (existing) =>
        existing.runId === runId &&
        existing.parts.some(
          (part) =>
            part.type === "diagnostic-run-error" &&
            part.message === message &&
            part.browserTaskId === browserTaskId,
        ),
    );
    if (alreadyExists) return;

    messages.value = [
      ...messages.value,
      {
        id: `assistant-run-error-${runId}-${Date.now()}`,
        role: "assistant",
        runId,
        parts: [
          {
            type: "diagnostic-run-error",
            message,
            browserTaskId,
            browserTaskLabel,
            browserSessionName,
            planId,
            maxBrowserAgents,
          },
        ],
      },
    ];
  }

  function _mergePart(buffer: AssistantBuffer, part: Record<string, any>) {
    const partType: string = part.type ?? "";

    if (partType === "text") {
      const existing = buffer.parts.find((p) => p.type === "text");
      if (existing) {
        existing.text = (existing.text ?? "") + (part.text ?? "");
      } else {
        buffer.parts.push({ type: "text", text: part.text ?? "" });
      }
      return;
    }

    if (partType === "reasoning") {
      const existing = buffer.parts.find((p) => p.type === "reasoning");
      if (existing) {
        existing.text = (existing.text ?? "") + (part.text ?? "");
      } else {
        buffer.parts.push({ type: "reasoning", text: part.text ?? "" });
      }
      return;
    }

    if (partType === "step-start") {
      buffer.parts.push({ type: "step-start" });
      return;
    }

    if (partType === "tool") {
      const toolName: string = part.tool ?? part.toolName ?? "unknown";
      const callID: string = part.callID ?? part.toolCallId ?? part.id ?? "";
      const toolUiType = `tool-${toolName}`;
      const existing = buffer.parts.find(
        (p) => p.type === toolUiType && p._callID === callID,
      );
      if (existing) {
        if (part.state !== undefined) existing.state = part.state;
      } else {
        buffer.parts.push({
          type: toolUiType,
          toolName,
          state: part.state ?? { status: "pending", input: {}, raw: "" },
          _callID: callID,
        });
      }
      return;
    }

    buffer.parts.push({ ...part });
  }

  function _flushBuffer() {
    if (!_assistantBuffer) return;
    const { uiId, parts, runId } = _assistantBuffer;
    _upsertMessage({ id: uiId, role: "assistant", parts: [...parts], runId });
  }

  function _finaliseAssistantMessage() {
    if (_assistantBuffer) {
      _flushBuffer();
      _assistantBuffer = null;
    }
  }

  async function connect(baseUrl: string, token?: string): Promise<void> {
    _stopPresenceLease();
    _baseUrl = baseUrl.replace(/\/$/, "");
    _token = token;
    status.value = "ready";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Step 1: Bootstrap guest session (only if not authenticated)
    if (!token) {
      try {
        const bootstrapRes = await fetch(`${_baseUrl}/api/guest/bootstrap`, {
          method: "POST",
          headers,
          credentials: "include",
        });

        if (!bootstrapRes.ok) {
          console.error(
            "[useOpenCodeAgent] Bootstrap failed:",
            bootstrapRes.status,
            await bootstrapRes.text(),
          );
          status.value = "error";
          return;
        }

        const bootstrapData = (await bootstrapRes.json()) as {
          status: string;
          sessionId?: string;
        };
        console.log("[useOpenCodeAgent] Bootstrap successful:", bootstrapData);

        // Small delay to ensure browser stores the cookie
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err) {
        console.error("[useOpenCodeAgent] Bootstrap network error:", err);
        status.value = "error";
        return;
      }
    }

    // Step 2: Create agent session (cookie should now be set)
    try {
      const res = await fetch(`${_baseUrl}/sessions`, {
        method: "POST",
        headers,
        credentials: token ? "omit" : "include",
      });

      // Handle 401: cookie wasn't set properly, retry bootstrap
      if (res.status === 401 && !token) {
        console.warn(
          "[useOpenCodeAgent] Session creation got 401, retrying bootstrap...",
        );
        return connect(baseUrl, token); // Recursive retry once
      }

      if (!res.ok) {
        console.error(
          "[useOpenCodeAgent] Session creation failed:",
          res.status,
          await res.text(),
        );
        status.value = "error";
        return;
      }

      const data = (await res.json()) as { sessionId: string };
      sessionId.value = data.sessionId;
      await _openMainSocket();
      _startPresenceLease();
      status.value = "ready";
      console.log("[useOpenCodeAgent] Connected with session:", data.sessionId);
    } catch (err) {
      console.error("[useOpenCodeAgent] Failed to create session:", err);
      status.value = "error";
    }
  }

  async function _retryWith401Handling(
    fetchFn: () => Promise<Response>,
    operationName: string,
  ): Promise<Response | null> {
    try {
      const res = await fetchFn();

      // If 401 and not authenticated, re-bootstrap and retry
      if (res.status === 401 && !_token && _baseUrl) {
        console.warn(
          `[useOpenCodeAgent] ${operationName} got 401, re-bootstrapping...`,
        );

        // Re-bootstrap
        try {
          await fetch(`${_baseUrl}/api/guest/bootstrap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err) {
          console.error(
            `[useOpenCodeAgent] Re-bootstrap failed for ${operationName}:`,
            err,
          );
          return null;
        }

        // Retry original request
        try {
          return await fetchFn();
        } catch (retryErr) {
          console.error(
            `[useOpenCodeAgent] Retry failed for ${operationName}:`,
            retryErr,
          );
          return null;
        }
      }

      return res;
    } catch (err) {
      console.error(
        `[useOpenCodeAgent] Network error in ${operationName}:`,
        err,
      );
      return null;
    }
  }

  async function disconnect(): Promise<void> {
    _stopPresenceLease();
    _closeMainSocket();

    if (sessionId.value) {
      const headers: Record<string, string> = {};
      if (_token) headers["Authorization"] = `Bearer ${_token}`;

      try {
        await fetch(`${_baseUrl}/sessions/${sessionId.value}`, {
          method: "DELETE",
          headers,
          credentials: _token ? "omit" : "include",
        });
      } catch (err) {
        console.warn("[useOpenCodeAgent] Failed to delete session:", err);
      }
    }

    sessionId.value = null;
    activeRunId.value = null;
    focusedBrowserRunId.value = null;
    focusedBrowserTaskId.value = null;
    runs.value = {};
    isAgentRunning.value = false;
    status.value = "ready";
    _assistantBuffer = null;
    _acceptParts = false;
    _baseUrl = "";
    _token = undefined;
  }

  async function sendInstruction(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!usage.canRequest.value) {
      console.error("[useOpenCodeAgent] Usage limit reached");
      messages.value = [
        ...messages.value,
        {
          id: `assistant-limit-${Date.now()}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `Usage limit reached. ${usage.limit.value === 1 ? "Anonymous users" : "Authenticated users"} are limited to ${usage.limit.value} ${usage.limit.value === 1 ? "request" : "requests"}. Please ${usage.limit.value === 1 ? "sign in" : "upgrade your plan"} to continue.`,
            },
          ],
        },
      ];
      isAgentRunning.value = false;
      status.value = "error";
      return;
    }

    if (!sessionId.value) {
      status.value = "error";
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (_token) headers["Authorization"] = `Bearer ${_token}`;

    try {
      await reportUserLocationNow({
        maximumAgeMs: 60_000,
        timeoutMs: 5_000,
      });

      usage.incrementUsage();

      const runId = crypto.randomUUID();
      activeRunId.value = runId;
      _upsertRun(runId, {
        status: "submitted",
        contextId: null,
        latestBrowserTaskId: null,
        browserSessionName: null,
        browserContextId: null,
        targetId: null,
        browserAgentBudget: null,
        usesBrowser: false,
      });

      messages.value = [
        ...messages.value,
        {
          id: `user-${Date.now()}`,
          role: "user",
          parts: [{ type: "text", text: trimmed }],
          runId,
        },
      ];

      _assistantBuffer = null;
      _acceptParts = true;
      isAgentRunning.value = true;
      status.value = "submitted";
      await _sendSocketMessage({
        type: "prompt",
        parts: [{ type: "text", text: trimmed }],
      });
    } catch (err) {
      console.error("[useOpenCodeAgent] Network error sending message:", err);
      if (activeRunId.value) {
        _upsertRun(activeRunId.value, { status: "failed" });
        activeRunId.value = null;
      }
      status.value = "error";
      isAgentRunning.value = false;
      _acceptParts = false;
    }
  }

  async function stop(): Promise<void> {
    if (!activeRunId.value || !sessionId.value || !isAgentRunning.value) {
      isAgentRunning.value = false;
      status.value = "ready";
      return;
    }

    try {
      await _sendSocketMessage({ type: "cancel" });
    } catch (err) {
      console.warn("[useOpenCodeAgent] Abort request failed:", err);
    }

    _finaliseAssistantMessage();
    isAgentRunning.value = false;
    status.value = "ready";
    activeRunId.value = null;
  }

  async function focusBrowserRun(
    runId: string,
    browserTaskId?: string | null,
  ): Promise<boolean> {
    if (!sessionId.value) return false;
    const run = runs.value[runId];
    if (!run?.usesBrowser) return false;

    const resolvedBrowserTaskId =
      browserTaskId ?? run.latestBrowserTaskId ?? null;

    const browserTask = resolvedBrowserTaskId
      ? run.browserTasks[resolvedBrowserTaskId]
      : null;
    if (resolvedBrowserTaskId && !browserTask?.contextId) return false;

    if (
      focusedBrowserRunId.value === runId &&
      focusedBrowserTaskId.value === resolvedBrowserTaskId
    ) {
      return true;
    }

    try {
      _pendingViewportState = _clearPendingResponse(
        _pendingViewportState,
        "Viewport request replaced",
      );

      const responsePromise = new Promise<ViewportState | null>(
        (resolve, reject) => {
          _pendingViewportState = {
            resolve,
            reject,
            timer: setTimeout(() => {
              _pendingViewportState = null;
              reject(new Error("Viewport request timed out"));
            }, 5000),
          };
        },
      );

      await _sendSocketMessage({
        type: "viewport.set",
        agentId: resolvedBrowserTaskId,
      });

      const viewport = await responsePromise;
      if (!viewport?.agentId) return false;
      focusedBrowserRunId.value = runId;
      focusedBrowserTaskId.value = viewport.agentId;
      return true;
    } catch {
      return false;
    }
  }

  async function clearBrowserFocus(): Promise<void> {
    if (!sessionId.value) return;
    await _sendSocketMessage({ type: "viewport.set", agentId: null }).catch(
      () => undefined,
    );
    focusedBrowserRunId.value = null;
    focusedBrowserTaskId.value = null;
  }

  async function requestViewportDebug(): Promise<ViewportDebugInfo | null> {
    _pendingViewportDebug = _clearPendingResponse(
      _pendingViewportDebug,
      "Viewport debug request replaced",
    );

    const responsePromise = new Promise<ViewportDebugInfo | null>(
      (resolve, reject) => {
        _pendingViewportDebug = {
          resolve,
          reject,
          timer: setTimeout(() => {
            _pendingViewportDebug = null;
            reject(new Error("Viewport debug request timed out"));
          }, 5000),
        };
      },
    );

    await _sendSocketMessage({ type: "viewport.debug" });
    return await responsePromise;
  }

  function getMessages(): UIMessage[] {
    return [...messages.value];
  }

  function resetChat(initialMessages: UIMessage[] = []) {
    _acceptParts = false;
    _assistantBuffer = null;
    activeRunId.value = null;
    focusedBrowserRunId.value = null;
    focusedBrowserTaskId.value = null;
    runs.value = {};
    isAgentRunning.value = false;
    status.value = "ready";
    messages.value = [];
    for (const message of initialMessages) {
      _upsertMessage(message);
    }
  }

  function appendBetaFeedback(sentiment: "positive" | "negative"): void {
    const displayText =
      sentiment === "positive"
        ? "Beta feedback: Yes — the agent completed my task."
        : "Beta feedback: No — the agent did not complete my task.";
    messages.value = [
      ...messages.value,
      {
        id: `user-beta-feedback-${Date.now()}`,
        role: "user",
        parts: [{ type: "beta-feedback", sentiment, displayText }],
      },
    ];
  }

  return {
    messages: readonly(messages),
    status: readonly(status),
    isAgentRunning: readonly(isAgentRunning),
    sessionId: readonly(sessionId),
    activeRunId: readonly(activeRunId),
    focusedBrowserRunId: readonly(focusedBrowserRunId),
    focusedBrowserTaskId: readonly(focusedBrowserTaskId),
    runs: readonly(runs),
    connect,
    disconnect,
    sendInstruction,
    stop,
    focusBrowserRun,
    clearBrowserFocus,
    requestViewportDebug,
    getMessages,
    resetChat,
    appendBetaFeedback,
  };
}
