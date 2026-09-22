var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// test/security-hardening.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path2 from "node:path";
import fs4 from "node:fs";

// test/_electron-mock.mjs
var tempUserData = "C:\\Users\\aliss\\AppData\\Local\\Temp\\jasper-test-userdata";
var app = {
  getPath: (name) => tempUserData,
  getAppPath: () => "C:\\Users\\aliss\\Desktop\\Antigravity\\jasper-avatar",
  whenReady: () => Promise.resolve(),
  quit: () => {
  }
};
var safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (str) => Buffer.from(str, "utf-8"),
  decryptString: (buf) => buf.toString("utf-8")
};
var clipboard = {
  readText: () => Promise.resolve(""),
  writeText: () => Promise.resolve()
};

// src/main/autonomous/webhook-manager.ts
import { join } from "path";
import fs from "fs";
import dns from "dns";
function isPrivateOrLoopbackIP(ip) {
  const cleanIp = ip.trim().toLowerCase();
  if (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "0.0.0.0" || cleanIp === "::") {
    return true;
  }
  if (cleanIp === "169.254.169.254" || cleanIp.startsWith("169.254.")) {
    return true;
  }
  if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd") || cleanIp.startsWith("fe80:")) {
    return true;
  }
  const ipParts = cleanIp.split(".").map(Number);
  if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    if (ipParts[0] === 0) return true;
    if (ipParts[0] === 10) return true;
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true;
    if (ipParts[0] === 192 && ipParts[1] === 168) return true;
    if (ipParts[0] === 127) return true;
    if (ipParts[0] === 100 && ipParts[1] >= 64 && ipParts[1] <= 127) return true;
    if (ipParts[0] >= 224) return true;
  }
  return false;
}
function isPrivateOrLoopbackHost(hostname) {
  const host = hostname.toLowerCase().trim();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") {
    return true;
  }
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  return isPrivateOrLoopbackIP(host);
}
async function resolveAndCheckSSRF(hostname) {
  if (isPrivateOrLoopbackHost(hostname)) {
    return { isSafe: false, resolvedIps: [hostname], reason: `Hostname loopback ou privado detectado: "${hostname}".` };
  }
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    const resolvedIps = lookupResults.map((r) => r.address);
    for (const res of lookupResults) {
      if (isPrivateOrLoopbackIP(res.address)) {
        return {
          isSafe: false,
          resolvedIps,
          reason: `DNS Rebinding detectado: O hostname "${hostname}" resolve para o endere\xE7o IP privado/local "${res.address}".`
        };
      }
    }
    return { isSafe: true, resolvedIps };
  } catch (err) {
    return { isSafe: false, resolvedIps: [], reason: `Falha ao resolver DNS do host "${hostname}": ${err.message}` };
  }
}
var WebhookManager = class {
  enabled = true;
  storageFile;
  webhooks = /* @__PURE__ */ new Map();
  constructor() {
    this.storageFile = join(app.getPath("userData"), "jasper-webhooks.json");
    this.loadWebhooks();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  isEnabled() {
    return this.enabled;
  }
  loadWebhooks() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, "utf-8");
        const arr = JSON.parse(raw);
        arr.forEach((w) => this.webhooks.set(w.name.toLowerCase(), w));
      } else {
        const defaults = [
          {
            name: "slack-canal",
            url: "https://hooks.slack.com/services/sample/webhook",
            method: "POST",
            description: "Notifica\xE7\xE3o para o canal do Slack"
          }
        ];
        defaults.forEach((w) => this.webhooks.set(w.name.toLowerCase(), w));
        this.saveWebhooks();
      }
    } catch (err) {
      console.warn("[WebhookManager] Error loading webhooks:", err);
    }
  }
  saveWebhooks() {
    try {
      const arr = Array.from(this.webhooks.values());
      fs.writeFileSync(this.storageFile, JSON.stringify(arr, null, 2), "utf-8");
    } catch (err) {
      console.warn("[WebhookManager] Error saving webhooks:", err);
    }
  }
  listWebhooks() {
    return Array.from(this.webhooks.values());
  }
  registerWebhook(config) {
    this.webhooks.set(config.name.toLowerCase(), config);
    this.saveWebhooks();
  }
  removeWebhook(name) {
    if (this.webhooks.delete(name.toLowerCase())) {
      this.saveWebhooks();
      return true;
    }
    return false;
  }
  async triggerWebhook(nameOrUrl, payload = {}, customMethod) {
    if (!this.enabled) {
      return {
        success: false,
        status: 0,
        responseBody: "",
        executionTimeMs: 0,
        error: "Disparador de Webhooks desativado nas configura\xE7\xF5es."
      };
    }
    const start = Date.now();
    const lowerName = nameOrUrl.toLowerCase().trim();
    const registered = this.webhooks.get(lowerName);
    const targetUrl = registered ? registered.url : nameOrUrl;
    const method = customMethod || (registered?.method || "POST");
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          success: false,
          status: 0,
          responseBody: "",
          executionTimeMs: 0,
          error: `[SSRF Bloqueado] Protocolo n\xE3o suportado: "${parsed.protocol}". Apenas http e https s\xE3o permitidos.`
        };
      }
      if (!registered) {
        const check = await resolveAndCheckSSRF(parsed.hostname);
        if (!check.isSafe) {
          return {
            success: false,
            status: 0,
            responseBody: "",
            executionTimeMs: 0,
            error: `[SSRF Bloqueado] ${check.reason} Requisi\xE7\xF5es para redes locais s\xF3 s\xE3o permitidas para Webhooks pr\xE9-cadastrados nas configura\xE7\xF5es.`
          };
        }
      }
    } catch (urlErr) {
      return {
        success: false,
        status: 0,
        responseBody: "",
        executionTimeMs: 0,
        error: `URL inv\xE1lida para disparo de Webhook: "${targetUrl}".`
      };
    }
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Jasper-AI-HUD/2.0",
      ...registered?.headers || {}
    };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15e3);
      const options = {
        method,
        headers,
        signal: controller.signal
      };
      if (method !== "GET") {
        options.body = JSON.stringify({
          ...payload,
          _jasperTimestamp: Date.now(),
          _source: "Jasper AI HUD"
        });
      }
      const response = await fetch(targetUrl, options);
      clearTimeout(timeout);
      const executionTimeMs = Date.now() - start;
      const text = await response.text();
      return {
        success: response.ok,
        status: response.status,
        responseBody: text.slice(0, 1e3),
        executionTimeMs
      };
    } catch (err) {
      return {
        success: false,
        status: 0,
        responseBody: "",
        executionTimeMs: Date.now() - start,
        error: err.message || "Falha ao disparar webhook"
      };
    }
  }
};
var webhookManager = new WebhookManager();

// src/main/autonomous/policy-engine.ts
import path from "path";
var BANNED_PYTHON_PATTERNS = [
  { pattern: /\b(subprocess|ctypes|pty|socket)\b/i, description: "M\xF3dulos de baixo n\xEDvel de rede ou cria\xE7\xE3o de subprocessos" },
  { pattern: /\bos\.(system|popen|spawn|fork|exec|kill)\b/i, description: "Chamadas diretas de execu\xE7\xE3o de comandos do sistema operacional (os.*)" },
  { pattern: /\bshutil\.(rmtree|move)\b/i, description: "Exclus\xE3o ou movimenta\xE7\xE3o de diret\xF3rios inteiros via shutil" },
  { pattern: /\b(eval|exec)\s*\(/i, description: "Execu\xE7\xE3o din\xE2mica de strings arbitr\xE1rias (eval/exec)" },
  { pattern: /__import__\s*\(/i, description: "Importa\xE7\xE3o din\xE2mica obscura (__import__)" },
  { pattern: /\bos\.(remove|unlink)\b/i, description: "Exclus\xE3o direta de arquivos fora de controle" },
  { pattern: /\b(\.\.[/\\]|[A-Za-z]:[/\\](windows|winnt|system32|program files))/i, description: "Tentativa de escape do diret\xF3rio sandbox ou acesso a pastas do sistema" }
];
var BANNED_NODE_PATTERNS = [
  { pattern: /\b(child_process|worker_threads|cluster)\b/i, description: "Cria\xE7\xE3o de novos processos filhos ou threads em Node.js" },
  { pattern: /\b(eval|Function)\s*\(/i, description: "Gera\xE7\xE3o e execu\xE7\xE3o din\xE2mica de c\xF3digo a partir de strings" },
  { pattern: /\bprocess\.(exit|kill|abort)\b/i, description: "Interrup\xE7\xE3o for\xE7ada do processo hospedeiro" },
  { pattern: /\bfs\.(rmSync|rmdirSync|unlinkSync)\b/i, description: "Exclus\xE3o s\xEDncrona n\xE3o contida de arquivos do sistema" },
  { pattern: /\b(net|dgram)\b/i, description: "Cria\xE7\xE3o de sockets TCP/UDP de baixo n\xEDvel" },
  { pattern: /\b(\.\.[/\\]|[A-Za-z]:[/\\](windows|winnt|system32|program files))/i, description: "Tentativa de escape de diret\xF3rio ou acesso ao sistema Windows" }
];
var SYSTEM_PATH_BLACKLIST = [
  /[/\\]windows([/\\]|$)/i,
  /[/\\]system32([/\\]|$)/i,
  /[/\\]syswow64([/\\]|$)/i,
  /[/\\]program files([/\\]|$)/i,
  /[/\\]program files \(x86\)([/\\]|$)/i,
  /[/\\]appdata[/\\]local[/\\]microsoft([/\\]|$)/i
];
var SAFE_SMART_HOME_DOMAINS = /* @__PURE__ */ new Set(["light", "switch", "climate"]);
var ToolPolicyEngine = class {
  /**
   * Static scan for arbitrary code execution in CodeInterpreter.
   */
  validateCode(language, code) {
    if (language === "bash") {
      return {
        allowed: false,
        riskLevel: "CRITICAL",
        reason: "Execu\xE7\xE3o direta de shell/bash arbitr\xE1rio \xE9 estritamente bloqueada pelo Zero-Trust Policy Engine.",
        requiresConfirmation: true
      };
    }
    const patterns = language === "python" ? BANNED_PYTHON_PATTERNS : BANNED_NODE_PATTERNS;
    for (const { pattern, description } of patterns) {
      if (pattern.test(code)) {
        return {
          allowed: false,
          riskLevel: "HIGH",
          reason: `Padr\xE3o de c\xF3digo perigoso detectado: ${description}.`,
          requiresConfirmation: true
        };
      }
    }
    return {
      allowed: true,
      riskLevel: "SAFE",
      requiresConfirmation: false
    };
  }
  /**
   * Validates if a file or directory path is safe and contained.
   */
  validatePathContainment(targetPath, allowedBaseDir) {
    const normalized = path.resolve(targetPath);
    for (const sysPattern of SYSTEM_PATH_BLACKLIST) {
      if (sysPattern.test(normalized)) {
        return {
          allowed: false,
          riskLevel: "CRITICAL",
          reason: `Acesso \xE0 pasta protegida do sistema operacional ("${normalized}") \xE9 estritamente proibido.`
        };
      }
    }
    if (allowedBaseDir) {
      const normalizedBase = path.resolve(allowedBaseDir);
      const relative = path.relative(normalizedBase, normalized);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return {
          allowed: false,
          riskLevel: "HIGH",
          reason: `Caminho fora do diret\xF3rio delimitado ("${normalizedBase}"). Tentativa de traversal bloqueada.`
        };
      }
    }
    return {
      allowed: true,
      riskLevel: "SAFE"
    };
  }
  /**
   * Validates Git operations.
   */
  validateGitCommit(message, specificFiles) {
    const lower = message.toLowerCase();
    if (lower.includes("--force") || lower.includes("-f") || lower.includes("--amend")) {
      return {
        allowed: false,
        riskLevel: "HIGH",
        reason: "Opera\xE7\xF5es de commit destrutivo (--force, --amend) s\xE3o bloqueadas pelo Policy Engine.",
        requiresConfirmation: true
      };
    }
    if (specificFiles && specificFiles.length > 0) {
      for (const file of specificFiles) {
        if (file.includes("..") || path.isAbsolute(file)) {
          return {
            allowed: false,
            riskLevel: "HIGH",
            reason: `Arquivo inv\xE1lido ou com escape de reposit\xF3rio: "${file}".`
          };
        }
        if (file.includes(".env") || file.includes("credentials") || file.includes("id_rsa")) {
          return {
            allowed: false,
            riskLevel: "CRITICAL",
            reason: `Tentativa de comitar arquivo sens\xEDvel ou credencial detectada: "${file}".`,
            requiresConfirmation: true
          };
        }
      }
    }
    return {
      allowed: true,
      riskLevel: "MODERATE",
      requiresConfirmation: !specificFiles || specificFiles.length === 0
    };
  }
  /**
   * Validates Smart Home domain and service call.
   */
  validateSmartHomeDomain(domain) {
    const d = domain.toLowerCase().trim();
    if (!SAFE_SMART_HOME_DOMAINS.has(d)) {
      return {
        allowed: false,
        riskLevel: "HIGH",
        reason: `Dom\xEDnio de automa\xE7\xE3o "${d}" n\xE3o est\xE1 na allowlist segura. Acesso a trancas, alarmes e port\xF5es \xE9 bloqueado.`
      };
    }
    return {
      allowed: true,
      riskLevel: "SAFE"
    };
  }
  /**
   * Validates URL for Headless Browser (preventing intranet scanning/SSRF).
   */
  validateBrowserUrl(targetUrl) {
    try {
      const parsed = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return {
          allowed: false,
          riskLevel: "HIGH",
          reason: `Protocolo "${parsed.protocol}" n\xE3o suportado para navega\xE7\xE3o web.`
        };
      }
      if (isPrivateOrLoopbackHost(parsed.hostname)) {
        return {
          allowed: false,
          riskLevel: "HIGH",
          reason: `Acesso a endere\xE7os locais ou privados (${parsed.hostname}) pelo Headless Browser \xE9 bloqueado para prevenir SSRF interno.`
        };
      }
      return {
        allowed: true,
        riskLevel: "SAFE"
      };
    } catch {
      return {
        allowed: false,
        riskLevel: "HIGH",
        reason: `URL inv\xE1lida para navega\xE7\xE3o: "${targetUrl}".`
      };
    }
  }
};
var toolPolicyEngine = new ToolPolicyEngine();

// src/main/autonomous/clipboard-watcher.ts
function redactSecrets(text) {
  return text.replace(/\bAIzaSy[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_API_KEY]").replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_SECRET_KEY]").replace(/\bBearer\s+[A-Za-z0-9_.-]{20,}\b/gi, "Bearer [REDACTED_TOKEN]").replace(/\bpassword\s*[:=]\s*["'][^"']+["']/gi, 'password: "[REDACTED]"');
}
var ClipboardWatcherService = class {
  isEnabled = true;
  pollIntervalMs = 1500;
  timer = null;
  lastClipboardText = "";
  onInterestingContent;
  constructor(enabled = true) {
    this.isEnabled = enabled;
  }
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }
  getIsEnabled() {
    return this.isEnabled;
  }
  setOnInterestingContent(cb) {
    this.onInterestingContent = cb;
  }
  async start() {
    if (this.timer) return;
    try {
      this.lastClipboardText = (await clipboard.readText()).trim();
    } catch {
      this.lastClipboardText = "";
    }
    this.timer = setInterval(() => this.check(), this.pollIntervalMs);
    console.log("[ClipboardWatcher] Service started");
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[ClipboardWatcher] Service stopped");
    }
  }
  async readClipboard() {
    try {
      const text = await clipboard.readText();
      return redactSecrets(text);
    } catch {
      return "";
    }
  }
  analyzeText(text) {
    const sanitized = redactSecrets(text.trim());
    const trimmed = sanitized;
    const errorRegex = /(Exception|Error:|Traceback \(most recent call last\)|NullReferenceException|TypeError|ReferenceError|SyntaxError|UnhandledPromiseRejection|FATAL|panic:)/i;
    if (errorRegex.test(trimmed)) {
      const firstLine = trimmed.split("\n")[0].slice(0, 100);
      return {
        text: trimmed,
        type: "error_trace",
        summary: `Erro copiado: ${firstLine}`,
        timestamp: Date.now()
      };
    }
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        return {
          text: trimmed,
          type: "url",
          summary: `Link copiado: ${parsed.hostname}`,
          timestamp: Date.now()
        };
      } catch {
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        JSON.parse(trimmed);
        return {
          text: trimmed,
          type: "json",
          summary: `Objeto JSON v\xE1lido copiado (${trimmed.length} caracteres)`,
          timestamp: Date.now()
        };
      } catch {
      }
    }
    if (/(import\s+.*from|const\s+\w+\s*=|let\s+\w+\s*=|function\s+\w+|def\s+\w+\(|public\s+static\s+void|async\s+function)/.test(trimmed)) {
      return {
        text: trimmed,
        type: "code",
        summary: `Trecho de c\xF3digo copiado (${trimmed.split("\n").length} linhas)`,
        timestamp: Date.now()
      };
    }
    return {
      text: trimmed,
      type: "text",
      summary: `Texto copiado (${trimmed.length} caracteres)`,
      timestamp: Date.now()
    };
  }
  async check() {
    if (!this.isEnabled) return;
    try {
      const raw = await clipboard.readText();
      const currentText = raw.trim();
      if (!currentText || currentText === this.lastClipboardText) return;
      this.lastClipboardText = currentText;
      const analysis = this.analyzeText(currentText);
      if (analysis.type === "error_trace" || analysis.type === "url") {
        const notification = {
          id: `clip-${Date.now()}`,
          type: "clipboard",
          title: analysis.type === "error_trace" ? "Erro Copiado no Clipboard" : "Link Detectado",
          message: analysis.summary,
          timestamp: Date.now(),
          data: { analysis }
        };
        this.onInterestingContent?.(notification);
      }
    } catch (err) {
      console.warn("[ClipboardWatcher] Check error:", err);
    }
  }
  async summarizeClipboard(action = "summarize") {
    const raw = await this.readClipboard();
    if (!raw || !raw.trim()) {
      return "A \xE1rea de transfer\xEAncia est\xE1 vazia ou n\xE3o cont\xE9m texto copi\xE1vel.";
    }
    const analysis = this.analyzeText(raw);
    const preview = raw.length > 2500 ? raw.slice(0, 2500) + "... [truncado]" : raw;
    let actionLabel = "Resumo Executivo do Conte\xFAdo Copiado";
    if (action === "translate") actionLabel = "Tradu\xE7\xE3o do Conte\xFAdo da \xC1rea de Transfer\xEAncia";
    if (action === "explain") actionLabel = "Explica\xE7\xE3o T\xE9cnica do Conte\xFAdo Copiado";
    return `${actionLabel} (${analysis.type.toUpperCase()} - ${raw.length} caracteres):
"""
${preview}
"""
Diagn\xF3stico inicial: ${analysis.summary}. Pronto para detalhar.`;
  }
};
var clipboardWatcher = new ClipboardWatcherService();

// src/main/autonomous/smart-home.ts
var ALLOWED_DOMAINS = /* @__PURE__ */ new Set(["light", "switch", "climate", "fan", "media_player"]);
var BLOCKED_DOMAINS = /* @__PURE__ */ new Set(["lock", "alarm_control_panel", "cover", "garage", "camera"]);
var SmartHomeService = class {
  enabled = true;
  baseUrl = process.env.HASS_URL || "http://homeassistant.local:8123";
  token = process.env.HASS_TOKEN || "";
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  isEnabled() {
    return this.enabled;
  }
  setConfig(url, token) {
    if (url) this.baseUrl = url.trim().replace(/\/$/, "");
    if (token !== void 0) this.token = token.trim();
  }
  async testConnection(url, token) {
    const targetUrl = (url || this.baseUrl).trim().replace(/\/$/, "");
    const targetToken = token !== void 0 ? token.trim() : this.token;
    if (!targetUrl) {
      return { success: false, message: "URL do Home Assistant n\xE3o informada." };
    }
    if (!targetToken) {
      return { success: false, message: "Token de Acesso n\xE3o informado." };
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6e3);
      const res = await fetch(`${targetUrl}/api/`, {
        headers: {
          Authorization: `Bearer ${targetToken}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: `Conectado com sucesso ao Home Assistant! (${data.message || "API ativa"})`
        };
      } else {
        return {
          success: false,
          message: `Home Assistant retornou erro HTTP ${res.status}: ${res.statusText}`
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Falha na conex\xE3o: ${err.message || "Servidor inacess\xEDvel"}`
      };
    }
  }
  async getEntities(filterDomain) {
    if (!this.enabled) return [];
    if (this.token) {
      try {
        const res = await fetch(`${this.baseUrl}/api/states`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
          }
        });
        if (res.ok) {
          const raw = await res.json();
          let list = raw.map((item) => ({
            entityId: item.entity_id,
            domain: item.entity_id.split(".")[0],
            friendlyName: item.attributes?.friendly_name || item.entity_id,
            state: item.state,
            attributes: item.attributes
          }));
          list = list.filter((e) => !BLOCKED_DOMAINS.has(e.domain));
          if (filterDomain) {
            list = list.filter((e) => e.domain === filterDomain);
          }
          return list;
        }
      } catch (err) {
        console.warn("[SmartHome] Error connecting to Home Assistant API:", err);
      }
    }
    const sampleDevices = [
      {
        entityId: "light.escritorio_principal",
        domain: "light",
        friendlyName: "Luz do Escrit\xF3rio",
        state: "on",
        attributes: { brightness: 255, color_mode: "rgb" }
      },
      {
        entityId: "climate.ar_condicionado",
        domain: "climate",
        friendlyName: "Ar Condicionado",
        state: "cool",
        attributes: { temperature: 22, current_temperature: 24 }
      },
      {
        entityId: "switch.tomada_computador",
        domain: "switch",
        friendlyName: "Tomada do Setup",
        state: "on"
      }
    ];
    return filterDomain ? sampleDevices.filter((e) => e.domain === filterDomain) : sampleDevices;
  }
  async executeCommand(domain, service, entityId, serviceData = {}) {
    if (!this.enabled) {
      return {
        success: false,
        entityId,
        action: `${domain}.${service}`,
        message: "Servi\xE7o de Casa Inteligente desativado nas configura\xE7\xF5es."
      };
    }
    const cleanDomain = domain.toLowerCase().trim();
    const cleanService = service.toLowerCase().trim();
    const cleanEntity = entityId.trim();
    if (BLOCKED_DOMAINS.has(cleanDomain)) {
      return {
        success: false,
        entityId: cleanEntity,
        action: `${cleanDomain}.${cleanService}`,
        message: `[SEGURAN\xC7A BLOQUEADA] O dom\xEDnio "${cleanDomain}" controla acessos f\xEDsicos (portas/travas/garagens) e est\xE1 restrito por pol\xEDtica Zero-Trust.`
      };
    }
    if (!ALLOWED_DOMAINS.has(cleanDomain)) {
      return {
        success: false,
        entityId: cleanEntity,
        action: `${cleanDomain}.${cleanService}`,
        message: `[DOM\xCDNIO N\xC3O PERMITIDO] Somente os dom\xEDnios [${Array.from(ALLOWED_DOMAINS).join(", ")}] s\xE3o autorizados.`
      };
    }
    if (this.token) {
      try {
        const res = await fetch(`${this.baseUrl}/api/services/${cleanDomain}/${cleanService}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            entity_id: cleanEntity,
            ...serviceData
          })
        });
        if (res.ok) {
          return {
            success: true,
            entityId: cleanEntity,
            action: `${cleanDomain}.${cleanService}`,
            message: `[EXECUTED] Comando executado no Home Assistant: ${cleanEntity} -> ${cleanService}`
          };
        } else {
          return {
            success: false,
            entityId: cleanEntity,
            action: `${cleanDomain}.${cleanService}`,
            message: `Home Assistant retornou erro ${res.status}: ${res.statusText}`
          };
        }
      } catch (err) {
        return {
          success: false,
          entityId: cleanEntity,
          action: `${cleanDomain}.${cleanService}`,
          message: `Falha ao conectar no Home Assistant: ${err.message}`
        };
      }
    }
    const friendlyAction = cleanService === "turn_on" ? "ligado" : cleanService === "turn_off" ? "desligado" : cleanService;
    return {
      success: true,
      entityId: cleanEntity,
      action: `${cleanDomain}.${cleanService}`,
      message: `[SIMULATED] Dispositivo "${cleanEntity}" foi ${friendlyAction} com sucesso em modo de demonstra\xE7\xE3o local (sem Home Assistant conectado).`
    };
  }
};
var smartHome = new SmartHomeService();

// src/main/autonomous/knowledge-graph.ts
import { join as join2 } from "path";
import fs2 from "fs";
function atomicWriteFileSync(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  fs2.writeFileSync(tmpPath, data, "utf-8");
  try {
    fs2.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs2.copyFileSync(tmpPath, filePath);
      fs2.unlinkSync(tmpPath);
    } catch {
      fs2.writeFileSync(filePath, data, "utf-8");
    }
  }
}
var KnowledgeGraphService = class {
  isEnabled = true;
  data = { nodes: [], edges: [] };
  constructor(enabled = true) {
    this.isEnabled = enabled;
    this.loadGraph();
  }
  getFilePath() {
    return join2(app.getPath("userData"), "jasper-knowledge-graph.json");
  }
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }
  getIsEnabled() {
    return this.isEnabled;
  }
  loadGraph() {
    try {
      const p = this.getFilePath();
      if (fs2.existsSync(p)) {
        this.data = JSON.parse(fs2.readFileSync(p, "utf-8"));
      } else {
        this.initDefaultGraph();
      }
    } catch (err) {
      console.warn("[KnowledgeGraph] Error loading graph:", err);
      this.initDefaultGraph();
    }
  }
  initDefaultGraph() {
    this.data = {
      nodes: [
        { id: "user", label: "Comandante", type: "Person", createdAt: Date.now() },
        { id: "jasper", label: "Jasper", type: "Concept", properties: { role: "AI HUD Assistant" }, createdAt: Date.now() }
      ],
      edges: [
        { id: "e1", source: "jasper", target: "user", relation: "assiste", createdAt: Date.now() }
      ]
    };
    this.saveGraph();
  }
  saveGraph() {
    try {
      const p = this.getFilePath();
      atomicWriteFileSync(p, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.warn("[KnowledgeGraph] Error saving graph:", err);
    }
  }
  normalizeId(str) {
    return str.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_");
  }
  addEntity(label, type = "Concept", properties) {
    const id = this.normalizeId(label);
    let node = this.data.nodes.find((n) => n.id === id);
    if (!node) {
      node = {
        id,
        label: label.trim(),
        type,
        properties: properties || {},
        createdAt: Date.now()
      };
      this.data.nodes.push(node);
      this.saveGraph();
      console.log(`[KnowledgeGraph] Added entity: ${label} [${type}]`);
    } else if (properties) {
      node.properties = { ...node.properties, ...properties };
      this.saveGraph();
    }
    return node;
  }
  addRelation(sourceLabel, relation, targetLabel, weight = 1) {
    const sourceNode = this.addEntity(sourceLabel);
    const targetNode = this.addEntity(targetLabel);
    const edgeId = `${sourceNode.id}-${this.normalizeId(relation)}-${targetNode.id}`;
    let edge = this.data.edges.find((e) => e.id === edgeId);
    if (!edge) {
      edge = {
        id: edgeId,
        source: sourceNode.id,
        target: targetNode.id,
        relation: relation.trim(),
        weight,
        createdAt: Date.now()
      };
      this.data.edges.push(edge);
      this.saveGraph();
      console.log(`[KnowledgeGraph] Added relation: (${sourceLabel}) -[${relation}]-> (${targetLabel})`);
    }
    return edge;
  }
  queryEntity(query) {
    const norm = this.normalizeId(query);
    const entity = this.data.nodes.find((n) => n.id === norm || n.label.toLowerCase().includes(query.toLowerCase()));
    if (!entity) {
      return {
        outgoing: [],
        incoming: [],
        summaryText: `Nenhuma entidade encontrada no grafo para "${query}".`
      };
    }
    const outgoing = this.data.edges.filter((e) => e.source === entity.id).map((e) => {
      const target = this.data.nodes.find((n) => n.id === e.target);
      return target ? { relation: e.relation, target } : null;
    }).filter(Boolean);
    const incoming = this.data.edges.filter((e) => e.target === entity.id).map((e) => {
      const source = this.data.nodes.find((n) => n.id === e.source);
      return source ? { relation: e.relation, source } : null;
    }).filter(Boolean);
    const outLines = outgoing.map((o) => `\u2192 ${o.relation} \u2192 ${o.target.label} (${o.target.type})`);
    const inLines = incoming.map((i) => `\u2190 ${i.relation} \u2190 ${i.source.label} (${i.source.type})`);
    const summaryText = `[Grafo: ${entity.label} (${entity.type})]
${[...outLines, ...inLines].join("\n") || "Sem conex\xF5es adicionais."}`;
    return {
      entity,
      outgoing,
      incoming,
      summaryText
    };
  }
  getGraphData() {
    return { ...this.data };
  }
  clear() {
    this.initDefaultGraph();
  }
};
var knowledgeGraph = new KnowledgeGraphService();

// src/renderer/scene/avatar.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
function buildMorphCacheMap(morphDictionary) {
  const map = /* @__PURE__ */ new Map();
  for (const [key, idx] of Object.entries(morphDictionary)) {
    map.set(key, idx);
    map.set(key.toLowerCase(), idx);
    if (key.endsWith("_L")) {
      const alt = key.slice(0, -2) + "Left";
      map.set(alt, idx);
      map.set(alt.toLowerCase(), idx);
    } else if (key.endsWith("_R")) {
      const alt = key.slice(0, -2) + "Right";
      map.set(alt, idx);
      map.set(alt.toLowerCase(), idx);
    } else if (key.endsWith("Left")) {
      const alt = key.slice(0, -4) + "_L";
      map.set(alt, idx);
      map.set(alt.toLowerCase(), idx);
    } else if (key.endsWith("Right")) {
      const alt = key.slice(0, -5) + "_R";
      map.set(alt, idx);
      map.set(alt.toLowerCase(), idx);
    }
  }
  return map;
}

// src/main/autonomous/reflexion-engine.ts
var DANGEROUS_CODE_PATTERNS = [
  /rmdir\s+\/s/i,
  /rm\s+-rf/i,
  /shutil\.rmtree/i,
  /os\.remove/i,
  /os\.unlink/i,
  /drop\s+database/i,
  /drop\s+table/i,
  /format\s+[c-z]:/i,
  /while\s+True:\s*pass/i,
  /while\s*\(\s*true\s*\)\s*\{\s*\}/i,
  /process\.env\.(GOOGLE_API_KEY|GEMINI_API_KEY|PASSWORD|SECRET)/i,
  /os\.environ\[['"](GOOGLE_API_KEY|PASSWORD|SECRET)['"]\]/i
];
var ReflexionEngine = class {
  enabled = true;
  onNotification;
  pendingConfirmations = /* @__PURE__ */ new Map();
  authorizedActions = /* @__PURE__ */ new Set();
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  isEnabled() {
    return this.enabled;
  }
  setOnNotification(cb) {
    this.onNotification = cb;
  }
  getActionSignature(toolName, args) {
    return `${toolName}:${JSON.stringify(args || {})}`;
  }
  preExecutionCheck(toolName, args) {
    if (!this.enabled) {
      return {
        allowed: true,
        riskLevel: "SAFE",
        requiresConfirmation: false
      };
    }
    const safeArgs = args || {};
    const sig = this.getActionSignature(toolName, safeArgs);
    if (this.authorizedActions.has(sig)) {
      this.authorizedActions.delete(sig);
      return {
        allowed: true,
        riskLevel: "MODERATE",
        requiresConfirmation: false
      };
    }
    if (toolName === "execute_code") {
      const code = String(safeArgs.code || "");
      for (const pattern of DANGEROUS_CODE_PATTERNS) {
        if (pattern.test(code)) {
          const confirmationId = `conf-${Date.now()}`;
          this.pendingConfirmations.set(confirmationId, { toolName, args: safeArgs, timestamp: Date.now() });
          const reason = `O c\xF3digo cont\xE9m instru\xE7\xF5es potencialmente destrutivas ou de alto risco (${pattern.source}).`;
          if (this.onNotification) {
            this.onNotification({
              id: confirmationId,
              type: "warning",
              title: "Auto-Reflex\xE3o: Bloqueio de Seguran\xE7a",
              message: `${reason} Deseja autorizar a execu\xE7\xE3o?`,
              timestamp: Date.now(),
              data: { confirmationId, toolName, args: safeArgs }
            });
          }
          return {
            allowed: false,
            riskLevel: "HIGH",
            reason,
            requiresConfirmation: true
          };
        }
      }
      return {
        allowed: true,
        riskLevel: "MODERATE",
        requiresConfirmation: false
      };
    }
    if (toolName === "git_commit_changes") {
      const msg = String(safeArgs.message || "");
      const specificFiles = Array.isArray(safeArgs.files) ? safeArgs.files : [];
      const fileNotice = specificFiles.length > 0 ? `Arquivos a serem comitados: ${specificFiles.join(", ")}` : "Todos os arquivos rastreados modificados";
      const confirmationId = `conf-git-${Date.now()}`;
      this.pendingConfirmations.set(confirmationId, { toolName, args: safeArgs, timestamp: Date.now() });
      const reason = `Opera\xE7\xE3o de commit Git solicitada ("${msg}"). Alvo: ${fileNotice}.`;
      if (this.onNotification) {
        this.onNotification({
          id: confirmationId,
          type: "info",
          title: "Git Watcher: Confirma\xE7\xE3o de Commit",
          message: `${reason} Confirme a grava\xE7\xE3o das altera\xE7\xF5es.`,
          timestamp: Date.now(),
          data: { confirmationId, toolName, args: safeArgs }
        });
      }
      return {
        allowed: false,
        riskLevel: "MODERATE",
        reason,
        requiresConfirmation: true
      };
    }
    if (toolName === "organize_directory") {
      const target = String(safeArgs.target || "").toLowerCase();
      if (target.includes("system32") || target.includes("windows") || target.includes("program files")) {
        return {
          allowed: false,
          riskLevel: "HIGH",
          reason: "Organiza\xE7\xE3o em pastas de sistema do Windows \xE9 estritamente proibida.",
          requiresConfirmation: false
        };
      }
    }
    if (toolName === "trigger_webhook") {
      const url = String(safeArgs.webhookNameOrUrl || "");
      if (!/^https?:\/\//i.test(url) && !url.includes("-") && !url.includes("_")) {
        return {
          allowed: false,
          riskLevel: "HIGH",
          reason: `Destino de webhook inv\xE1lido: "${url}". Deve ser uma URL HTTP v\xE1lida ou nome de webhook cadastrado.`,
          requiresConfirmation: false
        };
      }
    }
    return {
      allowed: true,
      riskLevel: "SAFE",
      requiresConfirmation: false
    };
  }
  postExecutionCritique(toolName, output) {
    if (!this.enabled) return { needsCorrection: false };
    const lower = output.toLowerCase();
    if (lower.includes("syntaxerror") || lower.includes("filenotfounderror") || lower.includes("permission denied") || lower.includes("tempo limite excedido")) {
      return {
        needsCorrection: true,
        critique: `[Auto-Reflex\xE3o]: Falha detectada na ferramenta "${toolName}". Recomenda-se ajustar os par\xE2metros ou validar a sintaxe antes de responder ao usu\xE1rio.`
      };
    }
    return { needsCorrection: false };
  }
  confirmAction(confirmationId) {
    const item = this.pendingConfirmations.get(confirmationId);
    if (item) {
      this.pendingConfirmations.delete(confirmationId);
      const sig = this.getActionSignature(item.toolName, item.args || {});
      this.authorizedActions.add(sig);
      setTimeout(() => this.authorizedActions.delete(sig), 12e4);
      console.log(`[ReflexionEngine] Action authorized by user: ${sig}`);
      return true;
    }
    return false;
  }
};
var reflexionEngine = new ReflexionEngine();

// test/security-hardening.test.ts
import http from "node:http";

// src/main/services/hwid.ts
import { execSync } from "child_process";
import crypto from "crypto";
import os from "os";
var cachedHardwareInfo = null;
function getHardwareInfo() {
  if (cachedHardwareInfo) {
    return cachedHardwareInfo;
  }
  const platform = process.platform;
  const machineName = os.hostname() || "JASPER-PC";
  const rawParts = [];
  if (platform === "win32") {
    try {
      const psScript = `
        $u = (Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue).UUID;
        $c = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).ProcessorId;
        $d = (Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object DeviceID -eq 'C:').VolumeSerialNumber;
        $g = (Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid -ErrorAction SilentlyContinue).MachineGuid;
        "$u|$c|$d|$g"
      `.trim();
      const encoded = Buffer.from(psScript, "utf16le").toString("base64");
      const output = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
        timeout: 4e3,
        encoding: "utf-8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();
      if (output && output.includes("|")) {
        rawParts.push(output);
      }
    } catch {
      try {
        const wmicUuid = execSync("wmic csproduct get uuid", { timeout: 2500, encoding: "utf-8", windowsHide: true }).replace("UUID", "").trim();
        if (wmicUuid) rawParts.push(wmicUuid);
      } catch {
      }
    }
  } else if (platform === "darwin") {
    try {
      const macSerial = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep -E '(IOPlatformSerialNumber)'", {
        timeout: 2e3,
        encoding: "utf-8"
      }).trim();
      if (macSerial) rawParts.push(macSerial);
    } catch {
    }
  } else {
    try {
      const fs5 = __require("fs");
      if (fs5.existsSync("/etc/machine-id")) {
        rawParts.push(fs5.readFileSync("/etc/machine-id", "utf-8").trim());
      } else if (fs5.existsSync("/var/lib/dbus/machine-id")) {
        rawParts.push(fs5.readFileSync("/var/lib/dbus/machine-id", "utf-8").trim());
      }
    } catch {
    }
  }
  if (rawParts.length === 0) {
    rawParts.push(`${os.hostname()}|${os.arch()}|${os.cpus().length}|${os.userInfo().username}`);
  }
  const sha = crypto.createHash("sha256").update(rawParts.join("::")).digest("hex").toUpperCase();
  const chunk1 = sha.substring(0, 4);
  const chunk2 = sha.substring(4, 8);
  const chunk3 = sha.substring(8, 12);
  const machineId = `HWID-${chunk1}-${chunk2}-${chunk3}`;
  cachedHardwareInfo = {
    machineId,
    machineName,
    platform
  };
  return cachedHardwareInfo;
}

// src/main/config/config-store.ts
import { join as join3 } from "path";
import fs3 from "fs";
import dotenv from "dotenv";
dotenv.config();
function encryptSecret(val) {
  if (!val) return "";
  if (val.startsWith("enc:")) return val;
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(val).toString("base64")}`;
    }
  } catch (err) {
    console.error("[ConfigStore] [FAIL-CLOSED] safeStorage encryption failed:", err);
    return "";
  }
  console.warn("[ConfigStore] [FAIL-CLOSED] safeStorage is unavailable. Secret cannot be saved in plaintext.");
  return "";
}
function decryptSecret(val) {
  if (!val) return "";
  if (val.startsWith("enc:")) {
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(val.slice(4), "base64");
        return safeStorage.decryptString(buf);
      } else {
        console.warn("[ConfigStore] [FAIL-CLOSED] safeStorage is not available yet to decrypt secret.");
        return "";
      }
    } catch (err) {
      console.warn("[ConfigStore] [FAIL-CLOSED] safeStorage decryption failed:", err);
      return "";
    }
  }
  return val;
}
function atomicWriteFileSync2(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  fs3.writeFileSync(tmpPath, data, "utf-8");
  try {
    fs3.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs3.copyFileSync(tmpPath, filePath);
      fs3.unlinkSync(tmpPath);
    } catch {
      fs3.writeFileSync(filePath, data, "utf-8");
    }
  }
}
var ConfigStore = class {
  config = {
    apiKey: process.env.GOOGLE_API_KEY || "",
    voiceName: process.env.GEMINI_VOICE || "Charon",
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-live-preview",
    enableSystemTools: true,
    enableMediaTools: true,
    agentName: process.env.AGENT_NAME || "Jasper",
    enableWakeWord: true,
    enableBloom: true,
    enableNeuralBg: true,
    enableEyeTracking: true,
    // Autonomy services
    enableScreenAwareness: true,
    enableWindowTracker: true,
    enableClipboardWatcher: true,
    enableCronEngine: true,
    enableDailyBriefing: true,
    enableSystemHealth: true,
    enableSemanticMemory: true,
    enableKnowledgeGraph: true,
    enableCodeInterpreter: false,
    // Security: Disabled by default
    enableHeadlessBrowser: true,
    enableGitWatcher: true,
    enableFolderOrganizer: true,
    enableSubagents: true,
    enableReflexionLoop: true,
    enableCalendarEmail: true,
    enableWebhooks: true,
    enableSmartHome: true,
    enableProcessManager: true,
    enableUiAutomation: true,
    enableMediaController: true,
    enableReportGenerator: true,
    enableFileSummarizer: true,
    enableQrService: true,
    enableOcrService: true,
    enablePresentationMode: true,
    enableFocusMode: true,
    // Module specific configurations
    hassUrl: process.env.HASS_URL || "http://homeassistant.local:8123",
    hassToken: process.env.HASS_TOKEN || "",
    gitRepoPath: process.cwd(),
    webhookDefaultUrl: "",
    emailUser: "",
    emailImapHost: "imap.gmail.com",
    emailImapPort: 993,
    emailPassword: "",
    folderDefaultTarget: "downloads"
  };
  isInitialized = false;
  constructor() {
    this.loadEnvDefaults();
  }
  loadEnvDefaults() {
    this.config.apiKey = process.env.GOOGLE_API_KEY || "";
    this.config.voiceName = process.env.GEMINI_VOICE || "Charon";
    this.config.model = process.env.GEMINI_MODEL || "gemini-2.5-flash-native-audio-latest";
    this.config.agentName = process.env.AGENT_NAME || "Jasper";
    this.config.hassUrl = process.env.HASS_URL || "http://homeassistant.local:8123";
    this.config.hassToken = process.env.HASS_TOKEN || "";
  }
  initialize() {
    if (this.isInitialized) return this.config;
    console.log("[ConfigStore] Initializing ConfigStore and decrypting credentials after app.ready...");
    this.loadPersistedConfig();
    this.isInitialized = true;
    return this.config;
  }
  getConfigFilePath() {
    return join3(app.getPath("userData"), "jasper-config.json");
  }
  loadPersistedConfig() {
    this.loadEnvDefaults();
    try {
      const cfgPath = this.getConfigFilePath();
      if (fs3.existsSync(cfgPath)) {
        const data = JSON.parse(fs3.readFileSync(cfgPath, "utf-8"));
        if (data.apiKey !== void 0) this.config.apiKey = decryptSecret(data.apiKey);
        if (data.voiceName) this.config.voiceName = data.voiceName;
        if (data.model) this.config.model = data.model;
        if (data.enableSystemTools !== void 0) this.config.enableSystemTools = data.enableSystemTools;
        if (data.enableMediaTools !== void 0) this.config.enableMediaTools = data.enableMediaTools;
        if (data.agentName) this.config.agentName = data.agentName;
        if (data.enableWakeWord !== void 0) this.config.enableWakeWord = data.enableWakeWord;
        if (data.enableBloom !== void 0) this.config.enableBloom = data.enableBloom;
        if (data.enableNeuralBg !== void 0) this.config.enableNeuralBg = data.enableNeuralBg;
        if (data.enableEyeTracking !== void 0) this.config.enableEyeTracking = data.enableEyeTracking;
        if (data.enableScreenAwareness !== void 0) this.config.enableScreenAwareness = data.enableScreenAwareness;
        if (data.enableWindowTracker !== void 0) this.config.enableWindowTracker = data.enableWindowTracker;
        if (data.enableClipboardWatcher !== void 0) this.config.enableClipboardWatcher = data.enableClipboardWatcher;
        if (data.enableCronEngine !== void 0) this.config.enableCronEngine = data.enableCronEngine;
        if (data.enableDailyBriefing !== void 0) this.config.enableDailyBriefing = data.enableDailyBriefing;
        if (data.enableSystemHealth !== void 0) this.config.enableSystemHealth = data.enableSystemHealth;
        if (data.enableSemanticMemory !== void 0) this.config.enableSemanticMemory = data.enableSemanticMemory;
        if (data.enableKnowledgeGraph !== void 0) this.config.enableKnowledgeGraph = data.enableKnowledgeGraph;
        if (data.enableCodeInterpreter !== void 0) this.config.enableCodeInterpreter = data.enableCodeInterpreter;
        if (data.enableHeadlessBrowser !== void 0) this.config.enableHeadlessBrowser = data.enableHeadlessBrowser;
        if (data.enableGitWatcher !== void 0) this.config.enableGitWatcher = data.enableGitWatcher;
        if (data.enableFolderOrganizer !== void 0) this.config.enableFolderOrganizer = data.enableFolderOrganizer;
        if (data.enableSubagents !== void 0) this.config.enableSubagents = data.enableSubagents;
        if (data.enableReflexionLoop !== void 0) this.config.enableReflexionLoop = data.enableReflexionLoop;
        if (data.enableCalendarEmail !== void 0) this.config.enableCalendarEmail = data.enableCalendarEmail;
        if (data.enableWebhooks !== void 0) this.config.enableWebhooks = data.enableWebhooks;
        if (data.enableSmartHome !== void 0) this.config.enableSmartHome = data.enableSmartHome;
        if (data.enableProcessManager !== void 0) this.config.enableProcessManager = data.enableProcessManager;
        if (data.enableUiAutomation !== void 0) this.config.enableUiAutomation = data.enableUiAutomation;
        if (data.enableMediaController !== void 0) this.config.enableMediaController = data.enableMediaController;
        if (data.enableReportGenerator !== void 0) this.config.enableReportGenerator = data.enableReportGenerator;
        if (data.enableFileSummarizer !== void 0) this.config.enableFileSummarizer = data.enableFileSummarizer;
        if (data.enableQrService !== void 0) this.config.enableQrService = data.enableQrService;
        if (data.enableOcrService !== void 0) this.config.enableOcrService = data.enableOcrService;
        if (data.enablePresentationMode !== void 0) this.config.enablePresentationMode = data.enablePresentationMode;
        if (data.enableFocusMode !== void 0) this.config.enableFocusMode = data.enableFocusMode;
        if (data.hassUrl !== void 0) this.config.hassUrl = data.hassUrl;
        if (data.hassToken !== void 0) this.config.hassToken = decryptSecret(data.hassToken);
        if (data.gitRepoPath !== void 0) this.config.gitRepoPath = data.gitRepoPath;
        if (data.webhookDefaultUrl !== void 0) this.config.webhookDefaultUrl = data.webhookDefaultUrl;
        if (data.emailUser !== void 0) this.config.emailUser = data.emailUser;
        if (data.emailImapHost !== void 0) this.config.emailImapHost = data.emailImapHost;
        if (data.emailImapPort !== void 0) this.config.emailImapPort = data.emailImapPort;
        if (data.emailPassword !== void 0) this.config.emailPassword = decryptSecret(data.emailPassword);
        if (data.folderDefaultTarget !== void 0) this.config.folderDefaultTarget = data.folderDefaultTarget;
        if (data.licenseKey !== void 0) this.config.licenseKey = decryptSecret(data.licenseKey);
        if (data.licenseStatus !== void 0) this.config.licenseStatus = data.licenseStatus;
        if (data.licenseClientName !== void 0) this.config.licenseClientName = data.licenseClientName;
        if (data.licenseClientEmail !== void 0) this.config.licenseClientEmail = data.licenseClientEmail;
        if (data.licenseMachineId !== void 0) this.config.licenseMachineId = data.licenseMachineId;
        if (data.licenseActivatedAt !== void 0) this.config.licenseActivatedAt = data.licenseActivatedAt;
        if (data.licenseLastCheckedAt !== void 0) this.config.licenseLastCheckedAt = data.licenseLastCheckedAt;
        console.log("[ConfigStore] Loaded settings from userData/jasper-config.json");
      }
    } catch (err) {
      console.warn("[ConfigStore] Error reading config from userData:", err);
    }
    return this.config;
  }
  savePersistedConfig() {
    try {
      const cfgPath = this.getConfigFilePath();
      const dataToPersist = {
        ...this.config,
        apiKey: encryptSecret(this.config.apiKey),
        hassToken: encryptSecret(this.config.hassToken || ""),
        emailPassword: encryptSecret(this.config.emailPassword || ""),
        licenseKey: encryptSecret(this.config.licenseKey || "")
      };
      const content = JSON.stringify(dataToPersist, null, 2);
      atomicWriteFileSync2(cfgPath, content);
      console.log("[ConfigStore] Saved configuration successfully to", cfgPath);
    } catch (err) {
      console.warn("[ConfigStore] Error saving config to userData:", err);
    }
  }
  getConfig() {
    return { ...this.config };
  }
  updateConfig(payload) {
    if (payload.apiKey !== void 0) this.config.apiKey = payload.apiKey.trim();
    if (payload.voiceName !== void 0) this.config.voiceName = payload.voiceName.trim();
    if (payload.model !== void 0) this.config.model = payload.model.trim();
    if (payload.enableSystemTools !== void 0) this.config.enableSystemTools = payload.enableSystemTools;
    if (payload.enableMediaTools !== void 0) this.config.enableMediaTools = payload.enableMediaTools;
    if (payload.agentName !== void 0) this.config.agentName = payload.agentName.trim();
    if (payload.enableWakeWord !== void 0) this.config.enableWakeWord = payload.enableWakeWord;
    if (payload.enableBloom !== void 0) this.config.enableBloom = payload.enableBloom;
    if (payload.enableNeuralBg !== void 0) this.config.enableNeuralBg = payload.enableNeuralBg;
    if (payload.enableEyeTracking !== void 0) this.config.enableEyeTracking = payload.enableEyeTracking;
    if (payload.enableScreenAwareness !== void 0) this.config.enableScreenAwareness = payload.enableScreenAwareness;
    if (payload.enableWindowTracker !== void 0) this.config.enableWindowTracker = payload.enableWindowTracker;
    if (payload.enableClipboardWatcher !== void 0) this.config.enableClipboardWatcher = payload.enableClipboardWatcher;
    if (payload.enableCronEngine !== void 0) this.config.enableCronEngine = payload.enableCronEngine;
    if (payload.enableDailyBriefing !== void 0) this.config.enableDailyBriefing = payload.enableDailyBriefing;
    if (payload.enableSystemHealth !== void 0) this.config.enableSystemHealth = payload.enableSystemHealth;
    if (payload.enableSemanticMemory !== void 0) this.config.enableSemanticMemory = payload.enableSemanticMemory;
    if (payload.enableKnowledgeGraph !== void 0) this.config.enableKnowledgeGraph = payload.enableKnowledgeGraph;
    if (payload.enableCodeInterpreter !== void 0) this.config.enableCodeInterpreter = payload.enableCodeInterpreter;
    if (payload.enableHeadlessBrowser !== void 0) this.config.enableHeadlessBrowser = payload.enableHeadlessBrowser;
    if (payload.enableGitWatcher !== void 0) this.config.enableGitWatcher = payload.enableGitWatcher;
    if (payload.enableFolderOrganizer !== void 0) this.config.enableFolderOrganizer = payload.enableFolderOrganizer;
    if (payload.enableSubagents !== void 0) this.config.enableSubagents = payload.enableSubagents;
    if (payload.enableReflexionLoop !== void 0) this.config.enableReflexionLoop = payload.enableReflexionLoop;
    if (payload.enableCalendarEmail !== void 0) this.config.enableCalendarEmail = payload.enableCalendarEmail;
    if (payload.enableWebhooks !== void 0) this.config.enableWebhooks = payload.enableWebhooks;
    if (payload.enableSmartHome !== void 0) this.config.enableSmartHome = payload.enableSmartHome;
    if (payload.enableProcessManager !== void 0) this.config.enableProcessManager = payload.enableProcessManager;
    if (payload.enableUiAutomation !== void 0) this.config.enableUiAutomation = payload.enableUiAutomation;
    if (payload.enableMediaController !== void 0) this.config.enableMediaController = payload.enableMediaController;
    if (payload.enableReportGenerator !== void 0) this.config.enableReportGenerator = payload.enableReportGenerator;
    if (payload.enableFileSummarizer !== void 0) this.config.enableFileSummarizer = payload.enableFileSummarizer;
    if (payload.enableQrService !== void 0) this.config.enableQrService = payload.enableQrService;
    if (payload.enableOcrService !== void 0) this.config.enableOcrService = payload.enableOcrService;
    if (payload.enablePresentationMode !== void 0) this.config.enablePresentationMode = payload.enablePresentationMode;
    if (payload.enableFocusMode !== void 0) this.config.enableFocusMode = payload.enableFocusMode;
    if (payload.hassUrl !== void 0) this.config.hassUrl = payload.hassUrl.trim();
    if (payload.hassToken !== void 0) this.config.hassToken = payload.hassToken.trim();
    if (payload.gitRepoPath !== void 0) this.config.gitRepoPath = payload.gitRepoPath.trim();
    if (payload.webhookDefaultUrl !== void 0) this.config.webhookDefaultUrl = payload.webhookDefaultUrl.trim();
    if (payload.emailUser !== void 0) this.config.emailUser = payload.emailUser.trim();
    if (payload.emailImapHost !== void 0) this.config.emailImapHost = payload.emailImapHost.trim();
    if (payload.emailImapPort !== void 0) this.config.emailImapPort = payload.emailImapPort;
    if (payload.emailPassword !== void 0) this.config.emailPassword = payload.emailPassword.trim();
    if (payload.folderDefaultTarget !== void 0) this.config.folderDefaultTarget = payload.folderDefaultTarget.trim();
    if (payload.licenseKey !== void 0) this.config.licenseKey = payload.licenseKey.trim();
    if (payload.licenseStatus !== void 0) this.config.licenseStatus = payload.licenseStatus;
    if (payload.licenseClientName !== void 0) this.config.licenseClientName = payload.licenseClientName.trim();
    if (payload.licenseClientEmail !== void 0) this.config.licenseClientEmail = payload.licenseClientEmail.trim();
    if (payload.licenseMachineId !== void 0) this.config.licenseMachineId = payload.licenseMachineId.trim();
    if (payload.licenseActivatedAt !== void 0) this.config.licenseActivatedAt = payload.licenseActivatedAt;
    if (payload.licenseLastCheckedAt !== void 0) this.config.licenseLastCheckedAt = payload.licenseLastCheckedAt;
    this.savePersistedConfig();
    return this.getConfig();
  }
  getConfigSummary(isConnected) {
    const hw = getHardwareInfo();
    return {
      apiKey: this.config.apiKey ? `${this.config.apiKey.slice(0, 6)}...${this.config.apiKey.slice(-4)}` : "",
      hasFullKey: Boolean(this.config.apiKey && this.config.apiKey.length > 10),
      voiceName: this.config.voiceName,
      model: this.config.model,
      enableSystemTools: this.config.enableSystemTools,
      enableMediaTools: this.config.enableMediaTools,
      agentName: this.config.agentName,
      enableWakeWord: this.config.enableWakeWord,
      enableBloom: this.config.enableBloom,
      enableNeuralBg: this.config.enableNeuralBg,
      enableEyeTracking: this.config.enableEyeTracking,
      enableScreenAwareness: this.config.enableScreenAwareness,
      enableWindowTracker: this.config.enableWindowTracker,
      enableClipboardWatcher: this.config.enableClipboardWatcher,
      enableCronEngine: this.config.enableCronEngine,
      enableDailyBriefing: this.config.enableDailyBriefing,
      enableSystemHealth: this.config.enableSystemHealth,
      enableSemanticMemory: this.config.enableSemanticMemory,
      enableKnowledgeGraph: this.config.enableKnowledgeGraph,
      enableCodeInterpreter: this.config.enableCodeInterpreter,
      enableHeadlessBrowser: this.config.enableHeadlessBrowser,
      enableGitWatcher: this.config.enableGitWatcher,
      enableFolderOrganizer: this.config.enableFolderOrganizer,
      enableSubagents: this.config.enableSubagents,
      enableReflexionLoop: this.config.enableReflexionLoop,
      enableCalendarEmail: this.config.enableCalendarEmail,
      enableWebhooks: this.config.enableWebhooks,
      enableSmartHome: this.config.enableSmartHome,
      enableProcessManager: this.config.enableProcessManager,
      enableUiAutomation: this.config.enableUiAutomation,
      enableMediaController: this.config.enableMediaController,
      enableReportGenerator: this.config.enableReportGenerator,
      enableFileSummarizer: this.config.enableFileSummarizer,
      enableQrService: this.config.enableQrService,
      enableOcrService: this.config.enableOcrService,
      enablePresentationMode: this.config.enablePresentationMode,
      enableFocusMode: this.config.enableFocusMode,
      // Module-specific configs
      hassUrl: this.config.hassUrl || "http://homeassistant.local:8123",
      hasHassToken: Boolean(this.config.hassToken && this.config.hassToken.length > 5),
      gitRepoPath: this.config.gitRepoPath || process.cwd(),
      webhookDefaultUrl: this.config.webhookDefaultUrl || "http://localhost:5678/webhook/jasper",
      emailUser: this.config.emailUser || "",
      emailImapHost: this.config.emailImapHost || "imap.gmail.com",
      emailImapPort: this.config.emailImapPort || 993,
      hasEmailPassword: Boolean(this.config.emailPassword && this.config.emailPassword.length > 0),
      folderDefaultTarget: this.config.folderDefaultTarget || "downloads",
      isConnected,
      // License & Node-Locking
      hasLicense: Boolean(this.config.licenseKey && this.config.licenseStatus === "active"),
      licenseKeyMasked: this.config.licenseKey ? `${this.config.licenseKey.slice(0, 10)}...${this.config.licenseKey.slice(-4)}` : void 0,
      licenseStatus: this.config.licenseStatus || "unlicensed",
      licenseClientName: this.config.licenseClientName,
      licenseMachineId: this.config.licenseMachineId,
      hwid: hw.machineId
    };
  }
};
var configStore = new ConfigStore();

// src/main/services/license-manager.ts
var DEFAULT_FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || "jasper-avatar";
var DEFAULT_FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBkvZHEAr0Vn32I6Qcr4TW958L5nhHSx_0";
function parseFirestoreFields(fields = {}) {
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    if (!val || typeof val !== "object") continue;
    if (val.stringValue !== void 0) result[key] = val.stringValue;
    else if (val.integerValue !== void 0) result[key] = Number(val.integerValue);
    else if (val.doubleValue !== void 0) result[key] = Number(val.doubleValue);
    else if (val.booleanValue !== void 0) result[key] = val.booleanValue;
    else if (val.nullValue !== void 0) result[key] = null;
    else if (val.timestampValue !== void 0) result[key] = val.timestampValue;
    else result[key] = val;
  }
  return result;
}
var LicenseManager = class {
  projectId = DEFAULT_FIREBASE_PROJECT;
  apiKey = DEFAULT_FIREBASE_API_KEY;
  customBaseUrl = null;
  setCustomBaseUrl(url) {
    this.customBaseUrl = url;
  }
  setProjectId(id) {
    this.projectId = id;
  }
  setApiKey(key) {
    this.apiKey = key;
  }
  validateKeyFormat(key) {
    if (!key || typeof key !== "string") return false;
    const pattern = /^(JASPER-LT|JSPR-V1)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    return pattern.test(key.trim());
  }
  /**
   * Valida a licença e aplica a restrição de máquina única (Node-Locking) diretamente no Google Firestore.
   * Não depende de Cloud Functions ou servidores intermediários.
   */
  async activateLicense(key) {
    const cleanKey = key.trim().toUpperCase();
    if (!this.validateKeyFormat(cleanKey)) {
      return {
        valid: false,
        error: "INVALID_FORMAT",
        message: "Formato de chave inv\xE1lido. Padr\xE3o esperado: JASPER-LT-XXXX-XXXX-XXXX"
      };
    }
    const hw = getHardwareInfo();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const baseUrl = this.customBaseUrl || `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/licenses`;
    const docUrl = `${baseUrl}/${cleanKey}?key=${this.apiKey}`;
    try {
      const getRes = await fetch(docUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8e3)
      });
      if (getRes.status === 404) {
        configStore.updateConfig({ licenseStatus: "unlicensed" });
        return {
          valid: false,
          error: "LICENSE_NOT_FOUND",
          message: "Chave de licen\xE7a inexistente ou incorreta."
        };
      }
      if (getRes.status === 403) {
        configStore.updateConfig({ licenseStatus: "disabled" });
        return {
          valid: false,
          error: "PERMISSION_DENIED",
          message: "Acesso negado pelas regras de seguran\xE7a da licen\xE7a."
        };
      }
      if (!getRes.ok) {
        return {
          valid: false,
          error: "SERVER_ERROR",
          message: `Falha ao consultar banco de dados (HTTP ${getRes.status}).`
        };
      }
      const docData = await getRes.json();
      const fields = parseFirestoreFields(docData.fields);
      const status = fields.status || "active";
      const clientName = fields.name || "Cliente Autorizado";
      const clientEmail = fields.email || "";
      const boundHwid = fields.machineId || null;
      const boundMachineName = fields.machineName || null;
      if (status === "disabled") {
        configStore.updateConfig({ licenseStatus: "disabled" });
        return {
          valid: false,
          error: "LICENSE_DISABLED",
          message: "Esta licen\xE7a foi temporariamente suspensa pelo administrador."
        };
      }
      if (status === "revoked") {
        configStore.updateConfig({ licenseStatus: "revoked" });
        return {
          valid: false,
          error: "LICENSE_REVOKED",
          message: "Esta licen\xE7a foi permanentemente revogada pelo administrador."
        };
      }
      if (!boundHwid) {
        const patchUrl = `${baseUrl}/${cleanKey}?updateMask.fieldPaths=machineId&updateMask.fieldPaths=machineName&updateMask.fieldPaths=activatedAt&updateMask.fieldPaths=lastSeenAt&updateMask.fieldPaths=lastClientVersion&key=${this.apiKey}`;
        const patchBody = {
          fields: {
            machineId: { stringValue: hw.machineId },
            machineName: { stringValue: hw.machineName || "Computador Pessoal" },
            activatedAt: { stringValue: now },
            lastSeenAt: { stringValue: now },
            lastClientVersion: { stringValue: "1.0.0" }
          }
        };
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
          signal: AbortSignal.timeout(8e3)
        });
        if (!patchRes.ok) {
          const errData = await patchRes.json().catch(() => ({}));
          console.warn("[LicenseManager] Falha ao vincular HWID no Firestore:", patchRes.status, errData);
          return {
            valid: false,
            error: "ACTIVATION_FAILED",
            message: "N\xE3o foi poss\xEDvel vincular o hardware da m\xE1quina ao registro da licen\xE7a."
          };
        }
        configStore.updateConfig({
          licenseKey: cleanKey,
          licenseStatus: "active",
          licenseClientName: clientName,
          licenseClientEmail: clientEmail,
          licenseMachineId: hw.machineId,
          licenseActivatedAt: now,
          licenseLastCheckedAt: now
        });
        console.log(`[LicenseManager] Licen\xE7a vinculada e ativada com sucesso nesta m\xE1quina para ${clientName}!`);
        return {
          valid: true,
          status: "ACTIVATED",
          message: `Licen\xE7a vinculada e ativada com sucesso nesta m\xE1quina (${hw.machineName})!`,
          client: { name: clientName, email: clientEmail },
          machineId: hw.machineId,
          activatedAt: now
        };
      }
      if (boundHwid === hw.machineId) {
        const heartbeatUrl = `${baseUrl}/${cleanKey}?updateMask.fieldPaths=lastSeenAt&updateMask.fieldPaths=machineName&updateMask.fieldPaths=lastClientVersion&key=${this.apiKey}`;
        const heartbeatBody = {
          fields: {
            lastSeenAt: { stringValue: now },
            machineName: { stringValue: hw.machineName || boundMachineName || "Computador Pessoal" },
            lastClientVersion: { stringValue: "1.0.0" }
          }
        };
        fetch(heartbeatUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(heartbeatBody),
          signal: AbortSignal.timeout(8e3)
        }).catch((err) => console.warn("[LicenseManager] Falha ao registrar heartbeat:", err.message));
        configStore.updateConfig({
          licenseKey: cleanKey,
          licenseStatus: "active",
          licenseClientName: clientName,
          licenseClientEmail: clientEmail,
          licenseMachineId: hw.machineId,
          licenseActivatedAt: fields.activatedAt || now,
          licenseLastCheckedAt: now
        });
        console.log(`[LicenseManager] Licen\xE7a ativa e autorizada nesta m\xE1quina (${clientName}).`);
        return {
          valid: true,
          status: "ACTIVE",
          message: "Licen\xE7a ativa e autorizada nesta m\xE1quina.",
          client: { name: clientName, email: clientEmail },
          machineId: hw.machineId,
          lastSeenAt: now
        };
      }
      configStore.updateConfig({ licenseStatus: "disabled" });
      console.warn(`[LicenseManager] [NODE-LOCKING] Tentativa de uso em m\xE1quina diferente. Vinculada a "${boundMachineName}".`);
      return {
        valid: false,
        error: "MACHINE_MISMATCH",
        message: `Esta licen\xE7a \xE9 exclusiva e j\xE1 est\xE1 vinculada a outro computador ("${boundMachineName || "Dispositivo Anterior"}"). Para transferir o acesso, solicite a libera\xE7\xE3o ao administrador.`
      };
    } catch (err) {
      console.warn("[LicenseManager] Erro de comunica\xE7\xE3o com o Firestore:", err.message);
      return {
        valid: false,
        error: "NETWORK_ERROR",
        message: "N\xE3o foi poss\xEDvel comunicar com o banco de dados do Jasper. Verifique sua conex\xE3o com a internet."
      };
    }
  }
  /**
   * Verifica a licença atualmente salva no computador (Boot ou Check Periódico)
   */
  async verifyCurrentLicense() {
    const cfg = configStore.getConfig();
    const hw = getHardwareInfo();
    if (!cfg.licenseKey) {
      return {
        valid: false,
        error: "NO_LICENSE",
        message: "Nenhuma chave de licen\xE7a ativa configurada nesta esta\xE7\xE3o."
      };
    }
    if (cfg.licenseMachineId && cfg.licenseMachineId !== hw.machineId) {
      configStore.updateConfig({ licenseStatus: "disabled" });
      return {
        valid: false,
        error: "MACHINE_MISMATCH",
        message: "O hardware atual n\xE3o corresponde \xE0 m\xE1quina originalmente vinculada a esta licen\xE7a."
      };
    }
    const result = await this.activateLicense(cfg.licenseKey);
    if (!result.valid && (result.error === "NETWORK_ERROR" || result.error === "SERVER_ERROR")) {
      if (cfg.licenseStatus === "active" && cfg.licenseLastCheckedAt) {
        const diffMs = Date.now() - new Date(cfg.licenseLastCheckedAt).getTime();
        const diffHours = diffMs / (1e3 * 60 * 60);
        if (diffHours <= 24) {
          console.log("[LicenseManager] Modo offline tempor\xE1rio autorizado (dentro da janela de 24h).");
          return {
            valid: true,
            status: "ACTIVE",
            message: "Licen\xE7a v\xE1lida em modo offline tempor\xE1rio (janela de 24h)."
          };
        } else {
          console.warn("[LicenseManager] Limite de 24 horas sem conex\xE3o atingido. Acesso suspenso.");
          configStore.updateConfig({ licenseStatus: "disabled" });
          const expiredResult = {
            valid: false,
            error: "EXPIRED_24H",
            message: "\xC9 necess\xE1ria a verifica\xE7\xE3o de acesso a cada 24 horas. Conecte-se \xE0 internet para continuar usando o Jasper."
          };
          this.notifyRevoked(expiredResult);
          return expiredResult;
        }
      }
    }
    if (!result.valid) {
      this.notifyRevoked(result);
    }
    return result;
  }
  revocationListeners = [];
  onRevoked(listener) {
    this.revocationListeners.push(listener);
    return () => {
      this.revocationListeners = this.revocationListeners.filter((l) => l !== listener);
    };
  }
  notifyRevoked(result) {
    for (const listener of this.revocationListeners) {
      try {
        listener(result);
      } catch (err) {
        console.error("[LicenseManager] Erro no listener de revoga\xE7\xE3o:", err);
      }
    }
  }
  /**
   * Executa a checagem periódica de 24 horas com o Firestore.
   * Se a chave foi revogada, desativada ou se a máquina não confere, bloqueia imediatamente.
   */
  async checkAccess24h(force = false) {
    const cfg = configStore.getConfig();
    if (!cfg.licenseKey) {
      const res = {
        valid: false,
        error: "NO_LICENSE",
        message: "Nenhuma chave de licen\xE7a ativa configurada nesta esta\xE7\xE3o."
      };
      this.notifyRevoked(res);
      return res;
    }
    if (!force && cfg.licenseLastCheckedAt) {
      const diffMs = Date.now() - new Date(cfg.licenseLastCheckedAt).getTime();
      const diffHours = diffMs / (1e3 * 60 * 60);
      if (diffHours < 24 && cfg.licenseStatus === "active") {
        return {
          valid: true,
          status: "ACTIVE",
          message: "Licen\xE7a verificada recentemente (menos de 24 horas)."
        };
      }
    }
    console.log("[LicenseManager] Executando verifica\xE7\xE3o de acesso das 24 horas com o Firestore...");
    return this.verifyCurrentLicense();
  }
  /**
   * Retorna resumo público da licença para a UI
   */
  getLicenseInfo() {
    const cfg = configStore.getConfig();
    const hw = getHardwareInfo();
    const isLicensed = Boolean(cfg.licenseKey && cfg.licenseStatus === "active");
    const keyMasked = cfg.licenseKey ? `${cfg.licenseKey.slice(0, 10)}...${cfg.licenseKey.slice(-4)}` : void 0;
    return {
      isLicensed,
      status: cfg.licenseStatus || "unlicensed",
      keyMasked,
      clientName: cfg.licenseClientName,
      clientEmail: cfg.licenseClientEmail,
      machineId: cfg.licenseMachineId,
      currentHwid: hw.machineId,
      activatedAt: cfg.licenseActivatedAt,
      lastSeenAt: cfg.licenseLastCheckedAt
    };
  }
};
var licenseManager = new LicenseManager();

// test/security-hardening.test.ts
describe("Su\xEDte de Testes de Integra\xE7\xE3o com Classes e M\xF3dulos Reais", () => {
  describe("WebhookManager & SSRF / DNS Rebinding (M\xF3dulo Real)", () => {
    test("isPrivateOrLoopbackHost bloqueia loopback e metadados de nuvem", () => {
      assert.equal(isPrivateOrLoopbackHost("localhost"), true);
      assert.equal(isPrivateOrLoopbackHost("127.0.0.1"), true);
      assert.equal(isPrivateOrLoopbackHost("::1"), true);
      assert.equal(isPrivateOrLoopbackHost("0.0.0.0"), true);
      assert.equal(isPrivateOrLoopbackHost("169.254.169.254"), true);
    });
    test("isPrivateOrLoopbackIP bloqueia faixas privadas RFC1918 e CGNAT", () => {
      assert.equal(isPrivateOrLoopbackIP("10.0.0.1"), true);
      assert.equal(isPrivateOrLoopbackIP("172.16.0.1"), true);
      assert.equal(isPrivateOrLoopbackIP("172.31.255.255"), true);
      assert.equal(isPrivateOrLoopbackIP("192.168.1.1"), true);
      assert.equal(isPrivateOrLoopbackIP("100.64.0.1"), true);
      assert.equal(isPrivateOrLoopbackIP("8.8.8.8"), false);
      assert.equal(isPrivateOrLoopbackIP("1.1.1.1"), false);
    });
    test("resolveAndCheckSSRF detecta hosts que resolvem para loopback", async () => {
      const result = await resolveAndCheckSSRF("127.0.0.1");
      assert.equal(result.isSafe, false);
      assert.ok(result.reason?.includes("loopback ou privado"));
    });
    test("WebhookManager gerencia registro e bloqueia SSRF n\xE3o cadastrado", async () => {
      const manager = new WebhookManager();
      manager.registerWebhook({
        name: "test-hook",
        url: "https://httpbin.org/post",
        method: "POST",
        description: "Webhook de teste"
      });
      const list = manager.listWebhooks();
      assert.ok(list.some((w) => w.name === "test-hook"));
      const ssrfRes = await manager.triggerWebhook("http://127.0.0.1:9999/admin");
      assert.equal(ssrfRes.success, false);
      assert.ok(ssrfRes.error?.includes("SSRF Bloqueado"));
      manager.removeWebhook("test-hook");
      assert.ok(!manager.listWebhooks().some((w) => w.name === "test-hook"));
    });
  });
  describe("ToolPolicyEngine (Pol\xEDticas Zero-Trust Reais)", () => {
    test("bloqueia c\xF3digo Python perigoso com subprocessos, ctypes e traversal", () => {
      const r1 = toolPolicyEngine.validateCode("python", 'import subprocess; subprocess.Popen(["calc"])');
      assert.equal(r1.allowed, false);
      assert.equal(r1.riskLevel, "HIGH");
      const r2 = toolPolicyEngine.validateCode("python", 'import os; os.system("dir")');
      assert.equal(r2.allowed, false);
      const r3 = toolPolicyEngine.validateCode("python", 'import ctypes; ctypes.cdll.LoadLibrary("kernel32")');
      assert.equal(r3.allowed, false);
      const r4 = toolPolicyEngine.validateCode("python", `x = eval("__import__('os')")`);
      assert.equal(r4.allowed, false);
    });
    test("permite c\xF3digo matem\xE1tico/cient\xEDfico leg\xEDtimo em Python", () => {
      const safe = toolPolicyEngine.validateCode("python", "import math\ndef calc(n):\n    return math.sqrt(n)\nprint(calc(16))");
      assert.equal(safe.allowed, true);
      assert.equal(safe.riskLevel, "SAFE");
    });
    test("bloqueia c\xF3digo Node.js com child_process, worker_threads e eval", () => {
      const r1 = toolPolicyEngine.validateCode("javascript", 'const { exec } = require("child_process"); exec("calc");');
      assert.equal(r1.allowed, false);
      const r2 = toolPolicyEngine.validateCode("javascript", 'eval("process.exit(1)")');
      assert.equal(r2.allowed, false);
    });
    test("bloqueia execu\xE7\xE3o de shell / bash arbitr\xE1rio", () => {
      const r = toolPolicyEngine.validateCode("bash", "rm -rf /");
      assert.equal(r.allowed, false);
      assert.equal(r.riskLevel, "CRITICAL");
    });
    test("bloqueia acesso a diret\xF3rios de sistema do Windows", () => {
      assert.equal(toolPolicyEngine.validatePathContainment("C:\\Windows\\System32\\cmd.exe").allowed, false);
      assert.equal(toolPolicyEngine.validatePathContainment("C:\\Program Files\\app\\config.json").allowed, false);
    });
    test("valida conten\xE7\xE3o de caminhos e bloqueia directory traversal", () => {
      const base = "C:\\temp\\sandbox";
      assert.equal(toolPolicyEngine.validatePathContainment("C:\\temp\\sandbox\\out.txt", base).allowed, true);
      assert.equal(toolPolicyEngine.validatePathContainment("C:\\temp\\sandbox\\..\\secret.key", base).allowed, false);
    });
  });
  describe("ClipboardWatcher (Reda\xE7\xE3o de Segredos Real)", () => {
    test("redige Google Gemini API keys reais", () => {
      const text = "Erro ao usar AIzaSyB1234567890123456789012345678901 na conex\xE3o";
      const sanitized = redactSecrets(text);
      assert.ok(!sanitized.includes("AIzaSyB"));
      assert.ok(sanitized.includes("[REDACTED_API_KEY]"));
    });
    test("redige Bearer Tokens e senhas no clipboard", () => {
      const text = "Authorization: Bearer mySecretToken123456789012345";
      const sanitized = redactSecrets(text);
      assert.ok(sanitized.includes("Bearer [REDACTED_TOKEN]"));
    });
  });
  describe("SmartHomeService (Allowlist de Dom\xEDnios Real)", () => {
    test("permite eletrodom\xE9sticos seguros (light, climate, switch)", async () => {
      const service = new SmartHomeService();
      const res = await service.executeCommand("light", "turn_on", "light.sala");
      assert.equal(res.success, true);
      assert.ok(res.message.includes("Simulado") || res.message.includes("sucesso"));
    });
    test("bloqueia expressamente dom\xEDnios de seguran\xE7a f\xEDsica (lock, alarm, garage)", async () => {
      const service = new SmartHomeService();
      const lockRes = await service.executeCommand("lock", "unlock", "lock.porta_entrada");
      assert.equal(lockRes.success, false);
      assert.ok(lockRes.message.includes("SEGURAN\xC7A BLOQUEADA"));
      const alarmRes = await service.executeCommand("alarm_control_panel", "disarm", "alarm.casa");
      assert.equal(alarmRes.success, false);
      assert.ok(alarmRes.message.includes("SEGURAN\xC7A BLOQUEADA"));
    });
  });
  describe("KnowledgeGraphService (Grafo e Grava\xE7\xE3o At\xF4mica Real)", () => {
    test("adiciona n\xF3s, rela\xE7\xF5es e persiste atomicamente", () => {
      const kg = new KnowledgeGraphService();
      const node = kg.addEntity("TypeScript", "Technology", { version: "5.7" });
      assert.equal(node.label, "TypeScript");
      const edge = kg.addRelation("user", "estuda", "TypeScript");
      assert.equal(edge.relation, "estuda");
      const query = kg.queryEntity("TypeScript");
      assert.ok(query.entity !== void 0);
      assert.equal(query.entity?.label, "TypeScript");
    });
  });
  describe("Avatar 3D Morph Target O(1) Cache Real", () => {
    test("buildMorphCacheMap mapeia varia\xE7\xF5es ARKit Left/Right e caixa alta/baixa", () => {
      const dict = {
        mouthSmile_L: 0,
        mouthSmile_R: 1,
        eyeBlinkLeft: 2,
        eyeBlinkRight: 3,
        jawOpen: 4
      };
      const cache = buildMorphCacheMap(dict);
      assert.equal(cache.get("mouthSmile_L"), 0);
      assert.equal(cache.get("mouthSmileLeft"), 0);
      assert.equal(cache.get("mouthsmileleft"), 0);
      assert.equal(cache.get("eyeBlinkLeft"), 2);
      assert.equal(cache.get("eyeBlink_L"), 2);
      assert.equal(cache.get("jawopen"), 4);
    });
  });
  describe("GitWatcher & Reflexion Guard (Seguran\xE7a de Commit Real)", () => {
    test("Policy Engine valida commit com arquivos espec\xEDficos e rejeita vazamentos", () => {
      const safe = toolPolicyEngine.validateGitCommit("feat: adicionar suporte", ["src/index.ts"]);
      assert.equal(safe.allowed, true);
      assert.equal(safe.requiresConfirmation, false);
      const sensitive = toolPolicyEngine.validateGitCommit("chore: salvar dados", [".env"]);
      assert.equal(sensitive.allowed, false);
      assert.equal(sensitive.riskLevel, "CRITICAL");
      const traversal = toolPolicyEngine.validateGitCommit("chore: salvar dados", ["../../etc/passwd"]);
      assert.equal(traversal.allowed, false);
    });
    test("ReflexionEngine intercepta commit e exige confirma\xE7\xE3o pr\xE9via", () => {
      const engine = new ReflexionEngine();
      const check = engine.preExecutionCheck("git_commit_changes", {
        message: "feat: nova funcionalidade",
        files: ["src/app.ts"]
      });
      assert.equal(check.allowed, false);
      assert.equal(check.requiresConfirmation, true);
      assert.ok(check.reason?.includes("Opera\xE7\xE3o de commit Git solicitada"));
    });
  });
  describe("WakeWordManager & Chamada de Agente Exclusiva via TensorFlow", () => {
    test("c\xF3digo fonte de wake-word-manager e speech-commands n\xE3o possui refer\xEAncias a Web Speech API", () => {
      const wakeWordManagerSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/audio/wake-word-manager.ts"),
        "utf-8"
      );
      assert.equal(wakeWordManagerSrc.includes("SpeechRecognition"), false);
      assert.equal(wakeWordManagerSrc.includes("webkitSpeechRecognition"), false);
      assert.equal(wakeWordManagerSrc.includes("startPhoneticFallback"), false);
      assert.equal(wakeWordManagerSrc.includes("isPhoneticFallbackActive"), false);
      assert.ok(wakeWordManagerSrc.includes("mode: isCalibrated ? 'tensorflow' : 'disabled'"));
      assert.ok(wakeWordManagerSrc.includes("syncRunningState"));
      assert.ok(wakeWordManagerSrc.includes("[TensorFlow]"));
      const speechCommandsSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/audio/speech-commands.ts"),
        "utf-8"
      );
      assert.ok(speechCommandsSrc.includes("tr.secondLastBaseDenseLayer = null"));
      assert.ok(speechCommandsSrc.includes("tr.model = null"));
      assert.ok(speechCommandsSrc.includes("tr.model.dispose()"));
    });
    test("speech-commands implementa modelo neural de 3 classes com amostras negativas e threshold de 0.85", () => {
      const speechCommandsSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/audio/speech-commands.ts"),
        "utf-8"
      );
      assert.ok(speechCommandsSrc.includes("detectedWord === '_other_'"));
      assert.ok(speechCommandsSrc.includes("detectedWord === '_background_noise_'"));
      assert.ok(speechCommandsSrc.includes("probabilityThreshold: options.probabilityThreshold ?? 0.85"));
      assert.ok(speechCommandsSrc.includes("overlapFactor: 0.25"));
      assert.ok(speechCommandsSrc.includes("hasNegativeSpeechSamples()"));
      assert.ok(speechCommandsSrc.includes("isLegacyModel()"));
      assert.ok(speechCommandsSrc.includes("labels.includes('_other_')"));
    });
    test("wake-trainer-ui e index.html exigem calibra\xE7\xE3o de 3 classes (nome, sil\xEAncio e outras palavras)", () => {
      const trainerUiSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/ui/wake-trainer-ui.ts"),
        "utf-8"
      );
      const indexHtmlSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/index.html"),
        "utf-8"
      );
      assert.ok(trainerUiSrc.includes("nameCount >= 3 && noiseCount >= 2 && otherCount >= 2"));
      assert.ok(trainerUiSrc.includes("engine.collectCustomSample('_other_')"));
      assert.ok(trainerUiSrc.includes("btnSampleOther"));
      assert.ok(trainerUiSrc.includes("countOtherSamples"));
      assert.ok(indexHtmlSrc.includes('id="btn-sample-other"'));
      assert.ok(indexHtmlSrc.includes('id="count-other-samples"'));
      assert.ok(indexHtmlSrc.includes("Gravar Outras Palavras"));
    });
  });
  describe("Modo Chamada Cont\xEDnuo & Zero-Latency Audio Pipeline", () => {
    test("MicRecorder possui suporte nativo a Modo Chamada Full-Duplex e timeout de 30s", () => {
      const micRecorderSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/audio/mic-recorder.ts"),
        "utf-8"
      );
      assert.ok(micRecorderSrc.includes("CALL_INACTIVITY_TIMEOUT_MS = 30000"));
      assert.ok(micRecorderSrc.includes("onCallInactivityTimeout: (() => void) | null = null"));
      assert.ok(micRecorderSrc.includes("notifyAssistantActivity()"));
      assert.ok(micRecorderSrc.includes("getRemainingInactivitySeconds()"));
      assert.ok(micRecorderSrc.includes("SPEECH_RMS_THRESHOLD = 0.025"));
      assert.ok(micRecorderSrc.includes("MIN_SPEECH_CHUNKS = 18"));
      assert.ok(micRecorderSrc.includes("Full-Duplex"));
    });
    test("main.ts implementa Modo Chamada Full-Duplex, sauda\xE7\xE3o proativa e barge-in", () => {
      const mainSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/main.ts"),
        "utf-8"
      );
      assert.ok(mainSrc.includes("async function enterCallMode(withGreeting = true)"));
      assert.ok(mainSrc.includes("async function exitCallMode()"));
      assert.ok(mainSrc.includes("enterCallMode(true)"));
      assert.ok(mainSrc.includes("O usu\xE1rio acabou de chamar voc\xEA. Cumprimente-o com eleg\xE2ncia e brevidade em portugu\xEAs e pergunte o que deseja."));
      assert.ok(mainSrc.includes("Barge-in: Interrup\xE7\xE3o por voz detectada"));
      assert.ok(mainSrc.includes("micRecorder.onCallInactivityTimeout = () => {"));
    });
    test("AudioPlayer gerencia fontes de \xE1udio com desconex\xE3o imediata e callback de t\xE9rmino", () => {
      const audioPlayerSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/renderer/audio/audio-player.ts"),
        "utf-8"
      );
      assert.ok(audioPlayerSrc.includes("public onPlaybackEnded: (() => void) | null = null"));
      assert.ok(audioPlayerSrc.includes("source.disconnect()"));
      assert.ok(audioPlayerSrc.includes("this.onPlaybackEnded?.()"));
    });
    test("Gemini Live client utiliza o modelo oficial gemini-3.1-flash-live-preview", () => {
      const liveClientSrc = fs4.readFileSync(
        path2.join(process.cwd(), "src/main/gemini-live.ts"),
        "utf-8"
      );
      assert.ok(liveClientSrc.includes("gemini-3.1-flash-live-preview"));
    });
  });
  describe("Sistema de Licenciamento Criptogr\xE1fico & Node-Locking (M\xF3dulo Real)", () => {
    test("getHardwareInfo gera identificador \xFAnico est\xE1vel no formato HWID-XXXX-XXXX-XXXX", () => {
      const hw1 = getHardwareInfo();
      assert.ok(hw1.machineId);
      assert.match(hw1.machineId, /^HWID-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
      assert.ok(hw1.machineName.length > 0);
      assert.ok(hw1.platform.length > 0);
      const hw2 = getHardwareInfo();
      assert.equal(hw1.machineId, hw2.machineId);
    });
    test("LicenseManager valida formato de chaves JASPER-LT e legado JSPR-V1", () => {
      assert.equal(licenseManager.validateKeyFormat("JASPER-LT-ZJV8-DVLK-942B"), true);
      assert.equal(licenseManager.validateKeyFormat("JSPR-V1-ABCD-1234-EF56"), true);
      assert.equal(licenseManager.validateKeyFormat("jasper-lt-1234-5678-90ab"), true);
      assert.equal(licenseManager.validateKeyFormat("JASPER-LT-INVALID-KEY"), false);
      assert.equal(licenseManager.validateKeyFormat(""), false);
      assert.equal(licenseManager.validateKeyFormat(null), false);
    });
    test("LicenseManager realiza handshake com Firestore REST e processa ativa\xE7\xE3o, heartbeat e Node-Locking", async () => {
      let mockGetResponse = {
        name: "projects/jasper-avatar/databases/(default)/documents/licenses/JASPER-LT-ABCD-1234-EF56",
        fields: {
          key: { stringValue: "JASPER-LT-ABCD-1234-EF56" },
          name: { stringValue: "Empresa Teste Ltda" },
          email: { stringValue: "contato@empresa.com" },
          status: { stringValue: "active" },
          machineId: { nullValue: null }
        }
      };
      let mockGetStatus = 200;
      let mockPatchStatus = 200;
      const server = http.createServer((req, res) => {
        if (req.method === "GET") {
          res.writeHead(mockGetStatus, { "Content-Type": "application/json" });
          res.end(JSON.stringify(mockGetResponse));
          return;
        }
        if (req.method === "PATCH") {
          let raw = "";
          req.on("data", (chunk) => {
            raw += chunk;
          });
          req.on("end", () => {
            res.writeHead(mockPatchStatus, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ name: "updated-doc" }));
          });
          return;
        }
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
      const address = server.address();
      const testBaseUrl = `http://127.0.0.1:${address.port}/licenses`;
      const manager = new LicenseManager();
      manager.setCustomBaseUrl(testBaseUrl);
      try {
        const resA = await manager.activateLicense("JASPER-LT-ABCD-1234-EF56");
        assert.equal(resA.valid, true);
        assert.equal(resA.status, "ACTIVATED");
        assert.equal(configStore.getConfig().licenseStatus, "active");
        assert.equal(configStore.getConfig().licenseClientName, "Empresa Teste Ltda");
        const info = manager.getLicenseInfo();
        assert.equal(info.isLicensed, true);
        assert.equal(info.clientName, "Empresa Teste Ltda");
        assert.ok(info.keyMasked?.startsWith("JASPER-LT-"));
        const hw = getHardwareInfo();
        mockGetResponse.fields.machineId = { stringValue: hw.machineId };
        mockGetResponse.fields.machineName = { stringValue: hw.machineName };
        const resSame = await manager.activateLicense("JASPER-LT-ABCD-1234-EF56");
        assert.equal(resSame.valid, true);
        assert.equal(resSame.status, "ACTIVE");
        mockGetResponse.fields.machineId = { stringValue: "HWID-OUTRO-COMPUTADOR-9999" };
        mockGetResponse.fields.machineName = { stringValue: "PC-DO-CLIENTE-ANTERIOR" };
        const resMismatch = await manager.activateLicense("JASPER-LT-ABCD-1234-EF56");
        assert.equal(resMismatch.valid, false);
        assert.equal(resMismatch.error, "MACHINE_MISMATCH");
        assert.equal(configStore.getConfig().licenseStatus, "disabled");
        mockGetResponse.fields.status = { stringValue: "disabled" };
        const resDisabled = await manager.activateLicense("JASPER-LT-ABCD-1234-EF56");
        assert.equal(resDisabled.valid, false);
        assert.equal(resDisabled.error, "LICENSE_DISABLED");
        mockGetResponse.fields.status = { stringValue: "revoked" };
        const resRevoked = await manager.activateLicense("JASPER-LT-ABCD-1234-EF56");
        assert.equal(resRevoked.valid, false);
        assert.equal(resRevoked.error, "LICENSE_REVOKED");
        mockGetStatus = 404;
        mockGetResponse = { error: { code: 404, status: "NOT_FOUND" } };
        const resNotFound = await manager.activateLicense("JASPER-LT-ABCD-1234-EF56");
        assert.equal(resNotFound.valid, false);
        assert.equal(resNotFound.error, "LICENSE_NOT_FOUND");
      } finally {
        server.close();
      }
    });
    test("LicenseManager n\xE3o aceita chaves de desenvolvimento em modo offline (modo dev removido)", async () => {
      const manager = new LicenseManager();
      manager.setCustomBaseUrl("http://127.0.0.1:59999/non-existent");
      const devResult = await manager.activateLicense("JASPER-LT-DEV0-0000-0001");
      assert.equal(devResult.valid, false);
      assert.equal(devResult.error, "NETWORK_ERROR");
    });
    test("LicenseManager checkAccess24h e onRevoked notificam quando licen\xE7a \xE9 suspensa ou revogada", async () => {
      const manager = new LicenseManager();
      let revocationNotified = false;
      manager.onRevoked(() => {
        revocationNotified = true;
      });
      configStore.updateConfig({ licenseKey: "", licenseStatus: "unlicensed" });
      const res = await manager.checkAccess24h(true);
      assert.equal(res.valid, false);
      assert.equal(revocationNotified, true);
    });
    test("UI e arquivos fonte cont\xEAm elementos e prote\xE7\xF5es de licenciamento obrigat\xF3rias e onboarding Gemini", () => {
      const htmlSrc = fs4.readFileSync(path2.join(process.cwd(), "src/renderer/index.html"), "utf-8");
      assert.ok(htmlSrc.includes('id="modal-license-activation"'));
      assert.ok(htmlSrc.includes('id="step-license-activation"'));
      assert.ok(htmlSrc.includes('id="step-gemini-onboarding"'));
      assert.ok(htmlSrc.includes('id="gemini-key-masked-display"'));
      assert.ok(htmlSrc.includes('id="input-onboarding-gemini-key"'));
      assert.ok(htmlSrc.includes('id="tab-license"'));
      assert.ok(htmlSrc.includes('id="input-license-key"'));
      assert.ok(htmlSrc.includes('id="tab-btn-activate-key"'));
      const ipcSrc = fs4.readFileSync(path2.join(process.cwd(), "src/main/ipc/register-ipc.ts"), "utf-8");
      assert.ok(ipcSrc.includes("cfg.licenseStatus !== 'active'"));
      assert.ok(ipcSrc.includes("LICENSE_GET_STATUS"));
      assert.ok(ipcSrc.includes("LICENSE_ACTIVATE"));
      assert.ok(ipcSrc.includes("LICENSE_GET_HWID"));
      const mainSrc = fs4.readFileSync(path2.join(process.cwd(), "src/renderer/main.ts"), "utf-8");
      assert.ok(mainSrc.includes("licenseModal.checkOnStartup()"));
      assert.ok(mainSrc.includes("!lic.isLicensed"));
      assert.ok(mainSrc.includes("onLicenseRevoked"));
    });
  });
});
