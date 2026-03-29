import { describe, expect, it } from 'vitest'
import { applyOpenClawSettingsToConfig, applyPluginPresetToConfig, expandHomePath, getDefaultOpenClawSettings, isTextBuffer, readOpenClawSettingsFromConfig, shouldSkipBundlePath, slugifyName, type OpenClawPaths } from './openclaw-config'

const paths: OpenClawPaths = {
  configPath: '/Users/tester/.openclaw/openclaw.json',
  configDir: '/Users/tester/.openclaw',
  defaultWorkspacePath: '/Users/tester/.openclaw/workspace',
  homedir: '/Users/tester'
}

describe('openclaw-config helpers', () => {
  it('reads normalized settings from an OpenClaw config object', () => {
    const settings = readOpenClawSettingsFromConfig({
      models: {
        providers: {
          'custom-openai': {
            baseUrl: ' https://api.example.com/v1 ',
            apiKey: ' sk-test ',
            api: 'openai-completions'
          }
        }
      },
      agents: {
        defaults: {
          workspace: '~/agents/demo',
          model: {
            primary: 'custom-openai/gpt-4.1',
            fallbacks: ['custom-openai/gpt-4.1-mini']
          }
        }
      },
      channels: {
        telegram: { enabled: false },
        discord: { enabled: false },
        slack: {
          enabled: true,
          botToken: ' xoxb-token ',
          appToken: 'xapp-token',
          userToken: 'xoxp-token',
          userTokenReadOnly: false,
          dmPolicy: 'open',
          groupPolicy: 'allowlist'
        }
      }
    }, paths)

    expect(settings).toMatchObject({
      configPath: '/Users/tester/.openclaw/openclaw.json',
      configDir: '/Users/tester/.openclaw',
      workspacePath: '/Users/tester/agents/demo',
      modelProviderId: 'custom-openai',
      modelBaseUrl: 'https://api.example.com/v1',
      modelApiKey: 'sk-test',
      modelApi: 'openai-completions',
      modelId: 'gpt-4.1',
      fallbackModelIds: ['gpt-4.1-mini'],
      channelType: 'slack',
      slackBotToken: 'xoxb-token',
      slackUserTokenReadOnly: false
    })
  })

  it('writes workspace and channel settings back to the expected config shape', () => {
    const settings = {
      ...getDefaultOpenClawSettings(paths),
      workspacePath: '/Users/tester/projects/openclaw-agent',
      modelProviderId: 'custom-openai',
      modelId: 'gpt-4.1',
      fallbackModelIds: ['gpt-4.1-mini', 'gpt-4.1-nano'],
      channelType: 'telegram' as const,
      telegramBotToken: 'bot-token'
    }

    const config = applyOpenClawSettingsToConfig({
      agents: {
        defaults: {
          workspace: '/tmp/old-workspace'
        }
      }
    }, settings)

    expect(config).toMatchObject({
      agents: {
        defaults: {
          workspace: '/Users/tester/projects/openclaw-agent',
          model: {
            primary: 'custom-openai/gpt-4.1',
            fallbacks: ['custom-openai/gpt-4.1-mini', 'custom-openai/gpt-4.1-nano']
          }
        }
      },
      channels: {
        telegram: {
          enabled: true,
          botToken: 'bot-token'
        },
        discord: {
          enabled: false
        },
        slack: {
          enabled: false
        }
      }
    })
  })

  it('applies plugin presets and bundle helpers predictably', () => {
    expect(applyPluginPresetToConfig({}, 'memory-lancedb')).toMatchObject({
      plugins: {
        slots: {
          memory: 'memory-lancedb'
        },
        entries: {
          'memory-lancedb': {
            config: {
              embedding: {
                apiKey: '${OPENAI_API_KEY}',
                model: 'text-embedding-3-small'
              }
            },
            enabled: true
          }
        }
      }
    })

    expect(expandHomePath('~/workspace', paths.homedir)).toBe('/Users/tester/workspace')
    expect(slugifyName('  My OpenClaw Agent!  ')).toBe('my-openclaw-agent')
    expect(shouldSkipBundlePath('node_modules/react/index.js')).toBe(true)
    expect(shouldSkipBundlePath('src/index.ts')).toBe(false)
    expect(isTextBuffer(Buffer.from('hello world'))).toBe(true)
    expect(isTextBuffer(Buffer.from([0, 1, 2]))).toBe(false)
  })

  it('falls back to defaults for minimal config and non-managed presets', () => {
    const defaults = getDefaultOpenClawSettings(paths)

    expect(readOpenClawSettingsFromConfig({}, paths)).toEqual(defaults)
    expect(applyPluginPresetToConfig({ plugins: { entries: {} } }, 'control-ui')).toEqual({ plugins: { entries: {} } })
  })
})
