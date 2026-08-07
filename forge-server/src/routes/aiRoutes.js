const Router = require('koa-router')
const https = require('https')

const router = new Router({ prefix: '/api/ai' })

const requestJson = (url, body, apiKey) => new Promise((resolve, reject) => {
  const target = new URL(url)
  const request = https.request(target, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  }, response => {
    let data = ''
    response.setEncoding('utf8')
    response.on('data', chunk => { data += chunk })
    response.on('end', () => {
      let parsed
      try { parsed = JSON.parse(data) } catch { reject(new Error(`AI 返回了无效 JSON（${response.statusCode}）`)); return }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(parsed.error?.message || `AI 请求失败（${response.statusCode}）`))
        return
      }
      resolve(parsed)
    })
  })
  request.setTimeout(45000, () => request.destroy(new Error('AI 请求超时')))
  request.on('error', reject)
  request.write(JSON.stringify(body))
  request.end()
})

const normalizeBase = value => String(value || '').trim().replace(/\/$/, '')
const extractContent = response => {
  if (typeof response?.choices?.[0]?.message?.content === 'string') return response.choices[0].message.content
  if (typeof response?.output_text === 'string') return response.output_text
  const output = response?.output?.flatMap(item => item.content || []) || []
  return output.map(item => item.text || '').join('')
}
const parseJsonContent = content => {
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try { return JSON.parse(text) } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)) } catch {}
    }
    return null
  }
}
const toArray = value => Array.isArray(value) ? value.filter(Boolean).map(item => typeof item === 'string' ? item : JSON.stringify(item)) : value ? [String(value)] : []
const normalizeAnalysis = (value, rawText = '') => {
  const source = value || {}
  return {
    marketBias: ['bullish', 'bearish', 'neutral', 'unknown'].includes(source.marketBias) ? source.marketBias : 'unknown',
    score: Number.isFinite(Number(source.score)) ? Math.max(0, Math.min(10, Number(source.score))) : null,
    confidence: ['high', 'medium', 'low'].includes(source.confidence) ? source.confidence : 'unknown',
    marketConclusion: String(source.marketConclusion || source.summary || rawText || '暂无市场结论'),
    trendAnalysis: toArray(source.trendAnalysis),
    ictStructure: {
      marketStructure: String(source.ictStructure?.marketStructure || source.marketStructure || '暂无'),
      liquidity: toArray(source.ictStructure?.liquidity || source.liquidity),
      zones: Array.isArray(source.ictStructure?.zones) ? source.ictStructure.zones : Array.isArray(source.zones) ? source.zones : [],
      premiumDiscount: String(source.ictStructure?.premiumDiscount || source.premiumDiscount || '暂无')
    },
    opportunity: {
      status: String(source.opportunity?.status || source.opportunityStatus || '等待确认'),
      direction: String(source.opportunity?.direction || source.direction || '观望'),
      trigger: String(source.opportunity?.trigger || source.trigger || '等待结构确认'),
      invalidation: String(source.opportunity?.invalidation || source.invalidation || '暂无')
    },
    tradingPlan: {
      direction: String(source.tradingPlan?.direction || source.direction || '观望'),
      entryCondition: String(source.tradingPlan?.entryCondition || source.entryCondition || '等待更明确的结构确认'),
      invalidCondition: String(source.tradingPlan?.invalidCondition || source.invalidCondition || '暂无'),
      nextAction: String(source.tradingPlan?.nextAction || source.nextAction || '继续观察')
    },
    keyLevels: Array.isArray(source.keyLevels) ? source.keyLevels : [],
    riskWarnings: toArray(source.riskWarnings)
  }
}
const parseAnalysis = content => {
  const rawText = String(content || '').trim()
  const parsed = parseJsonContent(rawText)
  if (parsed) return normalizeAnalysis(parsed)
  return normalizeAnalysis({ marketConclusion: '模型未按约定的结构化格式返回结果，请重新分析。', riskWarnings: ['本次 AI 返回格式异常，未将原始长文本直接展示。'] })
}
const buildPrompt = context => `你是一名严格、保守的技术分析助手，只能根据提供的行情数据进行盘面分析，不得编造新闻、基本面或实时数据。不要直接替用户下单，不要承诺收益。\n\n你必须严格按照下面的 JSON 结构返回，禁止返回 Markdown、解释文字、代码块或任何 JSON 以外的内容。请优先使用行情上下文中已经计算出的 ICT/SMC 结构，不要凭空创造 BOS、CHOCH、FVG 或 OB；如果上下文没有确认，必须返回“暂无”或“等待确认”。所有字段都必须存在，数组没有内容时返回空数组，字符串没有内容时返回“暂无”。\n{\n  "marketBias": "bullish|bearish|neutral|unknown",\n  "score": 0,\n  "confidence": "high|medium|low",\n  "marketConclusion": "A. 市场结论：用 2-3 句话总结当前市场状态、方向和是否适合立即交易。",\n  "trendAnalysis": ["B. 多周期趋势：分别说明 M15、H1、H4、D1 的方向和依据"],\n  "ictStructure": {"marketStructure":"ICT/SMC市场结构：BOS、CHOCH及当前结构方向", "liquidity":["流动性位置与是否已扫损"], "zones":[{"type":"FVG|OB", "range":"价格区间", "status":"有效|已回补|失效"}], "premiumDiscount":"溢价区|折价区|无法判断"},\n  "opportunity": {"status":"等待确认|形成中|已确认|失效", "direction":"做多|做空|观望", "trigger":"触发条件", "invalidation":"失效条件"},\n  "tradingPlan": {\n    "direction": "C. 交易计划方向：做多|做空|观望",\n    "entryCondition": "C. 入场条件：必须满足什么条件才观察入场",\n    "invalidCondition": "C. 失效条件：什么情况出现后计划失效",\n    "nextAction": "C. 下一步动作：现在应该观察什么"\n  },\n  "keyLevels": [{"type":"支撑|阻力|入场参考|止损参考|目标参考", "price": 0, "note":"说明"}],\n  "riskWarnings": ["D. 风险提示：列出当前最重要的风险"]\n}\n\n行情上下文：\n${JSON.stringify(context, null, 2)}`

router.post('/analyze-market', async ctx => {
  const body = ctx.request.body || {}
  const apiBase = normalizeBase(body.apiBase)
  const apiKey = String(body.apiKey || '').trim()
  const model = String(body.model || '').trim()
  const apiMethod = body.apiMethod === 'responses' ? 'responses' : 'chat-completions'
  if (!apiBase || !apiKey || !model) {
    ctx.status = 400
    ctx.body = { success: false, message: '请先配置 AI Base URL、API Key 和模型' }
    return
  }
  try {
    const isV1 = /\/v1$/i.test(apiBase)
    const endpoint = apiMethod === 'responses'
      ? `${apiBase}${isV1 ? '/responses' : '/v1/responses'}`
      : `${apiBase}${isV1 ? '/chat/completions' : '/v1/chat/completions'}`
    const prompt = buildPrompt(body.context || {})
    const requestBody = apiMethod === 'responses'
      ? { model, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }], temperature: 0.2 }
      : { model, messages: [{ role: 'system', content: '你是保守的技术分析助手。' }, { role: 'user', content: prompt }], temperature: 0.2, response_format: { type: 'json_object' } }
    const response = await requestJson(endpoint, requestBody, apiKey)
    ctx.body = { success: true, data: parseAnalysis(extractContent(response)) }
  } catch (error) {
    ctx.status = 502
    ctx.body = { success: false, message: error.message || 'AI 分析失败' }
  }
})

module.exports = router
