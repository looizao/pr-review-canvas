import type { HostedConfig } from '../hosted/config.js'

export function testHostedConfig(dataDir: string): HostedConfig {
  return {
    origin: 'https://canvas.example.com',
    organization: 'acme',
    appId: '123',
    clientId: 'client',
    clientSecret: 'secret',
    privateKey: 'test-key',
    webhookSecret: 'w'.repeat(32),
    sessionKey: 'f'.repeat(64),
    dataDir,
    port: 10000,
    generationTimeoutSec: 900,
  }
}
