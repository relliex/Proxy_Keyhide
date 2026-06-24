import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import http from 'http'
import https from 'https'
import { URL } from 'url'
import { randomBytes } from 'crypto'
import type { RequestLog, UpstreamPlatform, UpstreamKey } from '../shared/types'
import { loadData, addLog, updatePlatformModels } from './database'
import {
  selectUpstream,
  markKeySuccess,
  markKeyError,
  getAllAvailableModels,
  findPlatformsByModel
} from './upstream/manager'

/** 生成唯一 ID */
function generateId(): string {
  return randomBytes(12).toString('hex')
}

let server: FastifyInstance | null = null
let serverInstance: http.Server | null = null

/** 发送事件到渲染进程 */
let emitLog: ((log: RequestLog) => void) | null = null
let emitStatus: ((running: boolean) => void) | null = null

export function setEmitCallbacks(logFn: (log: RequestLog) => void, statusFn: (running: boolean) => void): void {
  emitLog = logFn
  emitStatus = statusFn
}

/** 验证 API Key */
function validateApiKey(req: FastifyRequest): boolean {
  const data = loadData()
  const auth = req.headers.authorization
  const xApiKey = req.headers['x-api-key'] as string | undefined

  const providedKey =
    auth?.replace('Bearer ', '').trim() || xApiKey?.trim()

  return providedKey === data.proxy.maskedApiKey
}

/** 解析请求体中的 model */
function extractModel(body: any): string {
  if (!body) return ''
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return ''
    }
  }
  return body.model || ''
}

/** 检测是否为流式请求 */
function isStreamRequest(body: any): boolean {
  if (!body) return false
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return false
    }
  }
  return body.stream === true
}

/** 构造上游请求头 */
function buildUpstreamHeaders(
  platform: UpstreamPlatform,
  key: UpstreamKey,
  originalHeaders: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'keyhide/1.0.0',
    ...platform.customHeaders
  }

  if (platform.type === 'anthropic') {
    headers['x-api-key'] = key.key
    headers['anthropic-version'] = originalHeaders['anthropic-version'] || '2023-06-01'
  } else {
    headers['Authorization'] = `Bearer ${key.key}`
  }

  return headers
}

/** 转发请求到上游 */
function forwardToUpstream(
  method: string,
  targetUrl: string,
  headers: Record<string, string>,
  body: Buffer | null,
  isStream: boolean,
  reply: FastifyReply,
  timeoutMs: number
): Promise<{ statusCode: number; responseBody: Buffer; error: string | null }> {
  return new Promise((resolve) => {
    const url = new URL(targetUrl)
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: headers,
      timeout: timeoutMs
    }

    const startTime = Date.now()

    const upReq = transport.request(options, (upRes) => {
      const chunks: Buffer[] = []
      const statusCode = upRes.statusCode || 500
      const isSuccess = statusCode >= 200 && statusCode < 300

      if (isStream && isSuccess) {
        // 流式成功响应：直接管道转发
        reply.raw.writeHead(statusCode, upRes.headers)
        upRes.pipe(reply.raw)

        upRes.on('data', (chunk) => {
          chunks.push(chunk)
        })

        upRes.on('end', () => {
          resolve({
            statusCode,
            responseBody: Buffer.concat(chunks),
            error: null
          })
        })

        upRes.on('error', (err) => {
          resolve({
            statusCode,
            responseBody: Buffer.concat(chunks),
            error: err.message
          })
        })
      } else {
        // 非流式响应：收集完整响应
        upRes.on('data', (chunk) => chunks.push(chunk))
        upRes.on('end', () => {
          const responseBody = Buffer.concat(chunks)
          resolve({
            statusCode: upRes.statusCode || 200,
            responseBody,
            error: null
          })
        })
        upRes.on('error', (err) => {
          resolve({
            statusCode: upRes.statusCode || 500,
            responseBody: Buffer.concat(chunks),
            error: err.message
          })
        })
      }
    })

    // 超时处理：上游响应超时则中止请求并返回 504
    upReq.on('timeout', () => {
      upReq.destroy()
      resolve({
        statusCode: 504,
        responseBody: Buffer.from(JSON.stringify({ error: { message: `Upstream timeout after ${timeoutMs}ms` } })),
        error: `Timeout after ${timeoutMs}ms`
      })
    })

    upReq.on('error', (err) => {
      resolve({
        statusCode: 502,
        responseBody: Buffer.from(JSON.stringify({ error: { message: err.message } })),
        error: err.message
      })
    })

    if (body) {
      upReq.write(body)
    }
    upReq.end()
  })
}

/** 记录请求日志 */
function logRequest(
  req: FastifyRequest,
  platform: UpstreamPlatform | null,
  key: UpstreamKey | null,
  model: string,
  format: 'openai' | 'anthropic',
  statusCode: number,
  duration: number,
  stream: boolean,
  error: string | null,
  promptTokens: number,
  completionTokens: number
): void {
  const data = loadData()
  if (!data.proxy.logRequests) return

  const log: RequestLog = {
    id: generateId(),
    timestamp: Date.now(),
    method: req.method,
    path: req.url,
    format,
    model,
    platformId: platform?.id || '',
    platformName: platform?.name || '',
    keyLabel: key?.label || '',
    statusCode,
    duration,
    promptTokens,
    completionTokens,
    stream,
    error,
    clientIp: req.ip
  }

  addLog(log)
  emitLog?.(log)
}

/** 从响应中提取 token 用量 */
function extractTokens(responseBody: Buffer, format: 'openai' | 'anthropic'): { prompt: number; completion: number } {
  try {
    const body = JSON.parse(responseBody.toString())
    if (format === 'openai') {
      return {
        prompt: body.usage?.prompt_tokens || 0,
        completion: body.usage?.completion_tokens || 0
      }
    } else {
      return {
        prompt: body.usage?.input_tokens || 0,
        completion: body.usage?.output_tokens || 0
      }
    }
  } catch {
    return { prompt: 0, completion: 0 }
  }
}

/** 处理代理请求 */
async function handleProxy(
  req: FastifyRequest,
  reply: FastifyReply,
  format: 'openai' | 'anthropic',
  preferredPlatformId?: string
): Promise<void> {
  const startTime = Date.now()
  const data = loadData()

  // 鉴权
  if (!validateApiKey(req)) {
    reply.code(401).send({ error: { message: 'Invalid API key', type: 'authentication_error' } })
    return
  }

  // 解析请求体
  const body = req.body ? Buffer.from(JSON.stringify(req.body)) : null
  const bodyObj = req.body as any
  const model = extractModel(bodyObj)
  const stream = isStreamRequest(bodyObj)

  // 选择上游
  const selection = selectUpstream(
    model,
    data.settings.routeMode,
    data.settings.defaultPlatformId,
    preferredPlatformId
  )

  if (!selection) {
    reply.code(503).send({
      error: {
        message: `No available upstream platform for model: ${model}`,
        type: 'server_error'
      }
    })
    logRequest(req, null, null, model, format, 503, Date.now() - startTime, stream, 'No available upstream', 0, 0)
    return
  }

  const { platform, key } = selection

  // 构造上游 URL - 去掉可能的平台前缀，保留 /v1/... 路径
  const pathSuffix = req.url.replace(/^\/[^/]+(?=\/v1\/)/, '')
  const targetUrl = `${platform.baseUrl.replace(/\/$/, '')}${pathSuffix}`

  // 构造上游请求头
  const headers = buildUpstreamHeaders(platform, key, req.headers as Record<string, string>)
  if (body) {
    headers['Content-Length'] = String(body.length)
  }

  // 转发请求
  const result = await forwardToUpstream(req.method, targetUrl, headers, body, stream, reply, data.proxy.timeout)

  const duration = Date.now() - startTime
  const tokens = extractTokens(result.responseBody, format)

  if (result.statusCode >= 200 && result.statusCode < 300) {
    // 成功
    markKeySuccess(platform.id, key.id, tokens.prompt + tokens.completion)

    if (!stream || !isStreamPiped(result.statusCode, stream)) {
      // 非流式或未 pipe 的响应：发送响应体
      const respHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      reply.code(result.statusCode).headers(respHeaders).send(result.responseBody)
    }
    // 流式成功响应已经通过 pipe 发送

    logRequest(req, platform, key, model, format, result.statusCode, duration, stream, result.error, tokens.prompt, tokens.completion)
  } else {
    // 失败 - 无论是否流式，都通过 reply 发送（因为未 pipe）
    markKeyError(platform.id, key.id, result.error || `HTTP ${result.statusCode}`, result.statusCode)

    reply.code(result.statusCode).send(result.responseBody)

    logRequest(req, platform, key, model, format, result.statusCode, duration, stream, result.error || `HTTP ${result.statusCode}`, 0, 0)
  }
}

/** 判断流式响应是否已通过 pipe 发送 */
function isStreamPiped(statusCode: number, stream: boolean): boolean {
  return stream && statusCode >= 200 && statusCode < 300
}

/** 创建 Fastify 服务器 */
function createServer(): FastifyInstance {
  const data = loadData()
  const app = Fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024 // 50MB
  })

  // CORS
  if (data.proxy.cors) {
    app.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: '*'
    })
  }

  // ============ OpenAI 格式路由 ============

  // 模型列表
  app.get('/v1/models', async (req, reply) => {
    if (!validateApiKey(req)) {
      reply.code(401).send({ error: { message: 'Invalid API key' } })
      return
    }
    const models = getAllAvailableModels()
    reply.send({
      object: 'list',
      data: models.map((id) => ({
        id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'keyhide'
      }))
    })
  })

  // 获取单个模型详情 (OpenAI 格式)
  app.get('/v1/models/:modelId', async (req, reply) => {
    if (!validateApiKey(req)) {
      reply.code(401).send({ error: { message: 'Invalid API key' } })
      return
    }
    const { modelId } = req.params as { modelId: string }
    reply.send({
      id: modelId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'keyhide'
    })
  })

  // Chat Completions
  app.post('/v1/chat/completions', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Completions (legacy)
  app.post('/v1/completions', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Embeddings
  app.post('/v1/embeddings', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Images - Generations / Edits / Variations
  app.post('/v1/images/generations', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/images/edits', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/images/variations', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Audio - Transcriptions / Translations / Speech
  app.post('/v1/audio/transcriptions', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/audio/translations', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/audio/speech', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Moderations
  app.post('/v1/moderations', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Responses API (OpenAI 新格式)
  app.post('/v1/responses', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Files API
  app.get('/v1/files', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/files', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.delete('/v1/files/:fileId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/files/:fileId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/files/:fileId/content', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Fine-tuning API
  app.post('/v1/fine_tuning/jobs', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/fine_tuning/jobs', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/fine_tuning/jobs/:jobId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/fine_tuning/jobs/:jobId/cancel', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/fine_tuning/events', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Assistants API
  app.post('/v1/assistants', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/assistants', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/assistants/:assistantId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/assistants/:assistantId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.delete('/v1/assistants/:assistantId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Threads API
  app.post('/v1/threads', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/threads/:threadId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/threads/:threadId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.delete('/v1/threads/:threadId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/threads/:threadId/messages', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/threads/:threadId/messages', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/threads/runs', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/threads/:threadId/runs', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/threads/:threadId/runs', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // Batch API (OpenAI)
  app.post('/v1/batches', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/batches', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.get('/v1/batches/:batchId', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })
  app.post('/v1/batches/:batchId/cancel', async (req, reply) => {
    await handleProxy(req, reply, 'openai')
  })

  // ============ Anthropic 格式路由 ============

  // Messages
  app.post('/v1/messages', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })

  // Count Tokens
  app.post('/v1/messages/count_tokens', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })

  // Message Batches API
  app.post('/v1/messages/batches', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })
  app.get('/v1/messages/batches', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })
  app.get('/v1/messages/batches/:batchId', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })
  app.post('/v1/messages/batches/:batchId/cancel', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })
  app.get('/v1/messages/batches/:batchId/results', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })

  // Complete (legacy)
  app.post('/v1/complete', async (req, reply) => {
    await handleProxy(req, reply, 'anthropic')
  })

  // ============ 通配符路由 - 兜底处理其他 /v1/* 请求 ============
  app.all('/v1/*', async (req, reply) => {
    // 根据路径判断格式
    const path = req.url.toLowerCase()
    const format: 'openai' | 'anthropic' = path.includes('/messages') ? 'anthropic' : 'openai'
    await handleProxy(req, reply, format)
  })

  // ============ 指定平台的路由 ============
  app.all('/:platformId/v1/*', async (req, reply) => {
    const { platformId } = req.params as { platformId: string }
    const path = req.url.toLowerCase()
    const format: 'openai' | 'anthropic' = path.includes('/messages') ? 'anthropic' : 'openai'
    await handleProxy(req, reply, format, platformId)
  })

  // ============ 健康检查 ============
  app.get('/health', async (req, reply) => {
    reply.send({ status: 'ok', service: 'keyhide', version: '1.0.0' })
  })

  // ============ 全局错误处理 ============
  app.setErrorHandler((error, req, reply) => {
    console.error('Proxy error:', error)
    reply.code(500).send({
      error: {
        message: error.message,
        type: 'server_error'
      }
    })
  })

  return app
}

/** 启动代理服务 */
export async function startProxy(): Promise<{ success: boolean; message: string }> {
  if (server) {
    return { success: false, message: '服务已在运行' }
  }

  try {
    const data = loadData()
    server = createServer()

    await server.ready()

    serverInstance = await server.listen({
      port: data.proxy.port,
      host: data.proxy.host
    })

    emitStatus?.(true)
    return { success: true, message: `代理服务已启动: http://${data.proxy.host}:${data.proxy.port}` }
  } catch (err: any) {
    server = null
    serverInstance = null
    return { success: false, message: `启动失败: ${err.message}` }
  }
}

/** 停止代理服务 */
export async function stopProxy(): Promise<{ success: boolean; message: string }> {
  if (!server) {
    return { success: false, message: '服务未运行' }
  }

  try {
    await server.close()
    server = null
    serverInstance = null
    emitStatus?.(false)
    return { success: true, message: '代理服务已停止' }
  } catch (err: any) {
    return { success: false, message: `停止失败: ${err.message}` }
  }
}

/** 获取服务状态 */
export function isProxyRunning(): boolean {
  return server !== null
}

/** 获取上游模型列表（用于刷新平台模型） */
export async function fetchUpstreamModels(platformId: string): Promise<string[]> {
  const data = loadData()
  const platform = data.platforms.find((p) => p.id === platformId)
  if (!platform || platform.keys.length === 0) {
    throw new Error('平台不存在或没有可用的 API Key')
  }

  const key = platform.keys.find((k) => k.status === 'active') || platform.keys[0]
  const modelsUrl = `${platform.baseUrl.replace(/\/$/, '')}/v1/models`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (platform.type === 'anthropic') {
    headers['x-api-key'] = key.key
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['Authorization'] = `Bearer ${key.key}`
  }

  return new Promise((resolve, reject) => {
    const url = new URL(modelsUrl)
    const transport = url.protocol === 'https:' ? https : http

    const upReq = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        headers
      },
      (upRes) => {
        const chunks: Buffer[] = []
        upRes.on('data', (chunk) => chunks.push(chunk))
        upRes.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString())
            if (platform.type === 'anthropic') {
              // Anthropic 格式: { data: [{ id: "claude-3-opus-20240229", ... }] }
              const models = (body.data || []).map((m: any) => m.id || m.name).filter(Boolean)
              updatePlatformModels(platformId, models)
              resolve(models)
            } else {
              // OpenAI 格式: { data: [{ id: "gpt-4", ... }] }
              const models = (body.data || []).map((m: any) => m.id).filter(Boolean)
              updatePlatformModels(platformId, models)
              resolve(models)
            }
          } catch (err: any) {
            reject(new Error(`解析模型列表失败: ${err.message}`))
          }
        })
        upRes.on('error', (err) => reject(err))
      }
    )

    upReq.on('error', (err) => reject(err))
    upReq.end()
  })
}

/** 测试平台连接 */
export async function testConnection(platformId: string): Promise<{ success: boolean; message: string }> {
  try {
    const models = await fetchUpstreamModels(platformId)
    return {
      success: true,
      message: `连接成功，共获取到 ${models.length} 个模型`
    }
  } catch (err: any) {
    return {
      success: false,
      message: `连接失败: ${err.message}`
    }
  }
}
