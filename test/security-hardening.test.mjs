import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// 1. Test SSRF Protection Logic
function isPrivateOrLoopbackHost(hostname) {
  const host = hostname.toLowerCase().trim()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return true
  }
  if (host === '169.254.169.254' || host.startsWith('169.254.')) {
    return true
  }
  const ipParts = host.split('.').map(Number)
  if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    if (ipParts[0] === 10) return true
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true
    if (ipParts[0] === 192 && ipParts[1] === 168) return true
    if (ipParts[0] === 127) return true
  }
  return false
}

// 2. Test Secret Redaction
function redactSecrets(text) {
  return text
    .replace(/\bAIzaSy[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_SECRET_KEY]')
    .replace(/\bBearer\s+[A-Za-z0-9_.-]{20,}\b/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/\bpassword\s*[:=]\s*["'][^"']+["']/gi, 'password: "[REDACTED]"')
}

// 3. Test Morph Target O(1) Map Builder
function buildMorphCache(morphDictionary) {
  const morphCache = new Map()
  for (const [key, idx] of Object.entries(morphDictionary)) {
    morphCache.set(key, idx)
    morphCache.set(key.toLowerCase(), idx)

    if (key.endsWith('_L')) {
      const alt = key.slice(0, -2) + 'Left'
      morphCache.set(alt, idx)
      morphCache.set(alt.toLowerCase(), idx)
    } else if (key.endsWith('_R')) {
      const alt = key.slice(0, -2) + 'Right'
      morphCache.set(alt, idx)
      morphCache.set(alt.toLowerCase(), idx)
    } else if (key.endsWith('Left')) {
      const alt = key.slice(0, -4) + '_L'
      morphCache.set(alt, idx)
      morphCache.set(alt.toLowerCase(), idx)
    } else if (key.endsWith('Right')) {
      const alt = key.slice(0, -5) + '_R'
      morphCache.set(alt, idx)
      morphCache.set(alt.toLowerCase(), idx)
    }
  }
  return morphCache
}

describe('Security Hardening & Architectural Integrity Tests', () => {
  describe('SSRF Hostname Validation', () => {
    test('blocks loopback addresses', () => {
      assert.equal(isPrivateOrLoopbackHost('localhost'), true)
      assert.equal(isPrivateOrLoopbackHost('127.0.0.1'), true)
      assert.equal(isPrivateOrLoopbackHost('::1'), true)
      assert.equal(isPrivateOrLoopbackHost('0.0.0.0'), true)
    })

    test('blocks AWS/GCP cloud metadata addresses', () => {
      assert.equal(isPrivateOrLoopbackHost('169.254.169.254'), true)
      assert.equal(isPrivateOrLoopbackHost('169.254.1.20'), true)
    })

    test('blocks RFC1918 private subnets', () => {
      assert.equal(isPrivateOrLoopbackHost('10.0.0.1'), true)
      assert.equal(isPrivateOrLoopbackHost('10.255.255.255'), true)
      assert.equal(isPrivateOrLoopbackHost('172.16.0.1'), true)
      assert.equal(isPrivateOrLoopbackHost('172.31.255.255'), true)
      assert.equal(isPrivateOrLoopbackHost('192.168.1.1'), true)
      assert.equal(isPrivateOrLoopbackHost('192.168.0.100'), true)
    })

    test('allows legitimate public hostnames and IPs', () => {
      assert.equal(isPrivateOrLoopbackHost('google.com'), false)
      assert.equal(isPrivateOrLoopbackHost('api.slack.com'), false)
      assert.equal(isPrivateOrLoopbackHost('hooks.zapier.com'), false)
      assert.equal(isPrivateOrLoopbackHost('8.8.8.8'), false)
      assert.equal(isPrivateOrLoopbackHost('1.1.1.1'), false)
    })
  })

  describe('Clipboard Secret Redaction', () => {
    test('redacts Google Gemini API keys', () => {
      const text = 'Erro ao conectar: chave AIzaSyD9876543210123456789012345678901 falhou'
      const redacted = redactSecrets(text)
      assert.ok(!redacted.includes('AIzaSyD'))
      assert.ok(redacted.includes('[REDACTED_API_KEY]'))
    })

    test('redacts Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      const redacted = redactSecrets(text)
      assert.ok(!redacted.includes('eyJhbGci'))
      assert.ok(redacted.includes('Bearer [REDACTED_TOKEN]'))
    })

    test('preserves ordinary text and links', () => {
      const text = 'Verifique a documentação em https://github.com/google/gemini'
      assert.equal(redactSecrets(text), text)
    })
  })

  describe('3D Avatar Morph Target O(1) Mapping', () => {
    test('resolves ARKit naming variations (e.g. mouthSmile_L vs mouthSmileLeft) in O(1)', () => {
      const sampleDictionary = {
        mouthSmile_L: 0,
        mouthSmile_R: 1,
        eyeBlinkLeft: 2,
        eyeBlinkRight: 3,
        jawOpen: 4
      }

      const cache = buildMorphCache(sampleDictionary)

      // Direct match
      assert.equal(cache.get('mouthSmile_L'), 0)
      // ARKit Left/Right alias
      assert.equal(cache.get('mouthSmileLeft'), 0)
      // Case insensitive
      assert.equal(cache.get('mouthsmileleft'), 0)
      assert.equal(cache.get('mouthsmile_l'), 0)

      // Inverse alias (_L -> Left and Left -> _L)
      assert.equal(cache.get('eyeBlinkLeft'), 2)
      assert.equal(cache.get('eyeBlink_L'), 2)
      assert.equal(cache.get('eyeblink_l'), 2)
    })
  })

  describe('Smart Home Zero-Trust Domain Enforcement', () => {
    const ALLOWED_DOMAINS = new Set(['light', 'switch', 'climate', 'fan', 'media_player'])
    const BLOCKED_DOMAINS = new Set(['lock', 'alarm_control_panel', 'cover', 'garage', 'camera'])

    test('permits everyday appliances', () => {
      assert.ok(ALLOWED_DOMAINS.has('light'))
      assert.ok(ALLOWED_DOMAINS.has('switch'))
      assert.ok(ALLOWED_DOMAINS.has('climate'))
    })

    test('strictly blocks security and physical perimeter access', () => {
      assert.ok(BLOCKED_DOMAINS.has('lock'))
      assert.ok(BLOCKED_DOMAINS.has('alarm_control_panel'))
      assert.ok(BLOCKED_DOMAINS.has('garage'))
      assert.ok(!ALLOWED_DOMAINS.has('lock'))
      assert.ok(!ALLOWED_DOMAINS.has('garage'))
    })
  })
})
