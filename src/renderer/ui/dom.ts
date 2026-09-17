/**
 * Centralized, typed DOM Element references for Jasper AI HUD
 */
export const DOM = {
  // Main Viewport & Layout
  app: document.getElementById('app') as HTMLElement | null,
  canvasContainer: document.getElementById('canvas-container') as HTMLElement,

  // Status & Brand
  statusBadge: document.getElementById('status-badge') as HTMLElement | null,
  statusText: document.getElementById('status-text') as HTMLElement | null,
  brandName: document.querySelector('.brand-name') as HTMLElement | null,

  // Transcript Box
  transcriptBox: document.getElementById('transcript-box') as HTMLElement,
  transcriptText: document.getElementById('transcript-text') as HTMLElement,
  transcriptSpeaker: document.querySelector('.transcript-speaker') as HTMLElement | null,

  // Visualizer & Microphone
  visualizerCanvas: document.getElementById('visualizer-canvas') as HTMLCanvasElement,
  btnMic: document.getElementById('btn-mic') as HTMLButtonElement,
  micStatusLabel: document.getElementById('mic-status-label') as HTMLElement | null,

  // Chat Drawer
  btnToggleChat: document.getElementById('btn-toggle-chat') as HTMLButtonElement | null,
  chatInputDrawer: document.getElementById('chat-input-drawer') as HTMLElement | null,
  inputChatText: document.getElementById('input-chat-text') as HTMLInputElement | null,
  btnSendText: document.getElementById('btn-send-text') as HTMLButtonElement | null,

  // Window Controls & PIP
  btnFullscreen: document.getElementById('btn-fullscreen') as HTMLButtonElement | null,
  btnPip: document.getElementById('btn-pip') as HTMLButtonElement | null,
  btnMinimize: document.getElementById('btn-minimize') as HTMLButtonElement | null,
  btnMaximize: document.getElementById('btn-maximize') as HTMLButtonElement | null,
  btnClose: document.getElementById('btn-close') as HTMLButtonElement | null,

  // Settings Modal Elements
  btnSettings: document.getElementById('btn-settings') as HTMLButtonElement,
  btnSettingsFullscreen: document.getElementById('btn-settings-fullscreen') as HTMLButtonElement | null,
  settingsModal: document.getElementById('settings-modal') as HTMLElement,
  btnCloseSettings: document.getElementById('btn-close-settings') as HTMLButtonElement,
  btnCancelSettings: document.getElementById('btn-cancel-settings') as HTMLButtonElement | null,
  btnSaveSettings: document.getElementById('btn-save-settings') as HTMLButtonElement,
  settingsStatus: document.getElementById('settings-status') as HTMLElement,
  agentNamePreview: document.getElementById('agent-name-preview') as HTMLElement | null,

  // Settings Form Inputs
  inputAgentName: document.getElementById('input-agent-name') as HTMLInputElement | null,
  inputApiKey: document.getElementById('input-api-key') as HTMLInputElement,
  btnToggleKey: document.getElementById('btn-toggle-key') as HTMLButtonElement,
  selectVoice: document.getElementById('select-voice') as HTMLSelectElement,
  selectModel: document.getElementById('select-model') as HTMLSelectElement,
  checkWakeWord: document.getElementById('check-wake-word') as HTMLInputElement | null,
  checkBloom: document.getElementById('check-bloom') as HTMLInputElement | null,
  checkNeuralBg: document.getElementById('check-neural-bg') as HTMLInputElement | null,
  checkSystemTools: document.getElementById('check-system-tools') as HTMLInputElement | null,
  checkMediaTools: document.getElementById('check-media-tools') as HTMLInputElement | null,

  // Autonomy Checkbox Elements
  checkScreenAwareness: document.getElementById('check-screen-awareness') as HTMLInputElement | null,
  checkWindowTracker: document.getElementById('check-window-tracker') as HTMLInputElement | null,
  checkClipboardWatcher: document.getElementById('check-clipboard-watcher') as HTMLInputElement | null,
  checkCronEngine: document.getElementById('check-cron-engine') as HTMLInputElement | null,
  checkDailyBriefing: document.getElementById('check-daily-briefing') as HTMLInputElement | null,
  checkSystemHealth: document.getElementById('check-system-health') as HTMLInputElement | null,
  checkSemanticMemory: document.getElementById('check-semantic-memory') as HTMLInputElement | null,
  checkKnowledgeGraph: document.getElementById('check-knowledge-graph') as HTMLInputElement | null,
  checkCodeInterpreter: document.getElementById('check-code-interpreter') as HTMLInputElement | null,
  checkHeadlessBrowser: document.getElementById('check-headless-browser') as HTMLInputElement | null,
  checkGitWatcher: document.getElementById('check-git-watcher') as HTMLInputElement | null,
  checkFolderOrganizer: document.getElementById('check-folder-organizer') as HTMLInputElement | null,
  checkSubagents: document.getElementById('check-subagents') as HTMLInputElement | null,
  checkReflexionLoop: document.getElementById('check-reflexion-loop') as HTMLInputElement | null,
  checkCalendarEmail: document.getElementById('check-calendar-email') as HTMLInputElement | null,
  checkWebhooks: document.getElementById('check-webhooks') as HTMLInputElement | null,
  checkSmartHome: document.getElementById('check-smart-home') as HTMLInputElement | null,

  // Toast Container
  hudToastContainer: document.getElementById('hud-toast-container') as HTMLElement | null,

  // Memory Elements
  memoryCountBadge: document.getElementById('memory-count-badge') as HTMLElement | null,
  memoryFactsList: document.getElementById('memory-facts-list') as HTMLElement | null,
  btnClearMemory: document.getElementById('btn-clear-memory') as HTMLButtonElement | null,

  // Voice Trainer Elements
  badgeModelState: document.getElementById('badge-model-state') as HTMLElement | null,
  wakeStatusTitle: document.getElementById('wake-status-title') as HTMLElement | null,
  wakeStatusDesc: document.getElementById('wake-status-desc') as HTMLElement | null,
  wakeStatusIcon: document.getElementById('wake-status-icon') as HTMLElement | null,
  countNameSamples: document.getElementById('count-name-samples') as HTMLElement | null,
  countNoiseSamples: document.getElementById('count-noise-samples') as HTMLElement | null,
  btnSampleName: document.getElementById('btn-sample-name') as HTMLButtonElement | null,
  btnSampleNoise: document.getElementById('btn-sample-noise') as HTMLButtonElement | null,
  btnTrainCustomModel: document.getElementById('btn-train-custom-model') as HTMLButtonElement | null,
  btnResetCustomModel: document.getElementById('btn-reset-custom-model') as HTMLButtonElement | null,
  trainerFeedback: document.getElementById('trainer-feedback-msg') as HTMLElement | null
}

