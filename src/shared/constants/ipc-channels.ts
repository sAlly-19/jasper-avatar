export const IPC_CHANNELS = {
  // Audio streaming
  AUDIO_CHUNK: 'audio:chunk',
  AUDIO_STREAM_END: 'audio:stream-end',

  // Chat
  CHAT_SEND: 'chat:send',

  // Gemini Connection
  GEMINI_CONNECT: 'gemini:connect',
  GEMINI_DISCONNECT: 'gemini:disconnect',

  // Configuration
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  CONFIG_AGENT_NAME_UPDATED: 'config:agent-name-updated',

  // Memory
  MEMORY_GET: 'memory:get',
  MEMORY_CLEAR: 'memory:clear',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_TOGGLE_PIP: 'window:toggle-pip',
  WINDOW_PIP_CHANGE: 'window:pip-change',
  WINDOW_TOGGLE_FULLSCREEN: 'window:toggle-fullscreen',
  WINDOW_FULLSCREEN_CHANGE: 'window:fullscreen-change',

  // Gemini Server Events (Main -> Renderer)
  GEMINI_AUDIO_CHUNK: 'gemini:audio-chunk',
  GEMINI_INTERRUPTED: 'gemini:interrupted',
  GEMINI_TURN_COMPLETE: 'gemini:turn-complete',
  GEMINI_TEXT_CHUNK: 'gemini:text-chunk',
  GEMINI_STATUS: 'gemini:status',

  // Autonomy & Proactive Services
  AUTONOMY_NOTIFICATION: 'autonomy:notification',
  AUTONOMY_GET_SYSTEM_HEALTH: 'autonomy:get-system-health',
  AUTONOMY_GET_SCHEDULES: 'autonomy:get-schedules',
  AUTONOMY_ADD_SCHEDULE: 'autonomy:add-schedule',
  AUTONOMY_REMOVE_SCHEDULE: 'autonomy:remove-schedule',
  AUTONOMY_CAPTURE_SCREEN: 'autonomy:capture-screen',
  AUTONOMY_GET_ACTIVE_WINDOW: 'autonomy:get-active-window',
  AUTONOMY_GET_KNOWLEDGE_GRAPH: 'autonomy:get-knowledge-graph',
  AUTONOMY_GET_BRIEFING: 'autonomy:get-briefing',
  AUTONOMY_EXECUTE_CODE: 'autonomy:execute-code',
  AUTONOMY_BROWSE_PAGE: 'autonomy:browse-page',
  AUTONOMY_GIT_CHECK: 'autonomy:git-check',
  AUTONOMY_GIT_SUGGEST_COMMIT: 'autonomy:git-suggest-commit',
  AUTONOMY_SCAN_FOLDER: 'autonomy:scan-folder',
  AUTONOMY_ORGANIZE_FOLDER: 'autonomy:organize-folder',
  AUTONOMY_SPAWN_SUBAGENT: 'autonomy:spawn-subagent',
  AUTONOMY_GET_SUBAGENTS: 'autonomy:get-subagents',
  AUTONOMY_CALENDAR_ADD_EVENT: 'autonomy:calendar-add-event',
  AUTONOMY_CALENDAR_GET_EVENTS: 'autonomy:calendar-get-events',
  AUTONOMY_EMAIL_CHECK: 'autonomy:email-check',
  AUTONOMY_WEBHOOK_TRIGGER: 'autonomy:webhook-trigger',
  AUTONOMY_WEBHOOK_LIST: 'autonomy:webhook-list',
  AUTONOMY_SMART_HOME_GET_DEVICES: 'autonomy:smart-home-get-devices',
  AUTONOMY_SMART_HOME_EXECUTE: 'autonomy:smart-home-execute',
  AUTONOMY_SMART_HOME_TEST_CONNECTION: 'autonomy:smart-home-test-connection',
  AUTONOMY_REFLEXION_CONFIRMATION: 'autonomy:reflexion-confirmation',
  AUTONOMY_WEBHOOK_TEST: 'autonomy:webhook-test',
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',

  // License & Node-Locking
  LICENSE_GET_STATUS: 'license:get-status',
  LICENSE_ACTIVATE: 'license:activate',
  LICENSE_GET_HWID: 'license:get-hwid'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]

