<template>
  <div class="board-page">
    <div class="page-header">
      <div class="header-actions">
        <div class="market-countdowns">
          <span>{{ sessionStatusText }}</span>
          <span>{{ sessionScheduleText }}</span>
        </div>
        <div class="market-connect">
          <div class="header-instructions">请保持 MT5 账户登录；切换品种或周期后会重新读取历史 K 线，每 <el-input-number v-model="refreshIntervalSeconds" class="refresh-interval-input" :min="1" :max="5" :step="0.1" :precision="1" size="small" controls-position="right" @change="normalizeRefreshInterval" /> 秒刷新行情。</div>
          <div class="market-connect-main"><span class="header-account">数据源 TMGM MT5 · 账户 {{ account?.login || '--' }}</span><el-tag :type="connected ? 'success' : 'danger'">{{ connected ? 'MT5 已连接' : 'MT5 未连接' }}</el-tag><el-button :loading="loading" @click="loadBars">刷新</el-button></div>
      </div>
      </div>
    </div>
    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" show-icon closable @close="errorMessage = ''" />
    <div class="toolbar"><el-select v-model="symbol" filterable class="symbol-select" @change="loadBars"><template #prefix>品种</template><el-option v-for="item in symbols" :key="item.name" :label="item.name" :value="item.name"><div class="symbol-option"><span>{{ item.name }}</span><el-button link size="small" :type="isFavoriteSymbol(item.name) ? 'danger' : 'primary'" :icon="isFavoriteSymbol(item.name) ? Minus : Plus" aria-label="切换自选" @click.stop="toggleFavoriteSymbol(item.name)" /></div></el-option></el-select><div class="favorite-symbols"><el-button v-for="item in favoriteSymbolItems" :key="item.name" size="small" :type="item.name === symbol ? 'primary' : 'default'" @click="selectSymbol(item.name)">{{ item.name }}</el-button></div></div>
    <div class="content-grid" :class="{ 'is-expanded': chartExpanded }">
      <section class="chart-card" :class="{ 'is-expanded': chartExpanded }">
        <div class="chart-toolbar">
          <div class="chart-title">{{ symbol }} · {{ timeframeLabel }}</div>
          <el-radio-group v-model="timeframe" class="chart-timeframe" @change="loadBars"><el-radio-button v-for="item in timeframes" :key="item.value" :label="item.value">{{ item.label }}</el-radio-button></el-radio-group>
          <div class="chart-actions">
            <el-button size="small" @click="chartExpanded = !chartExpanded">{{ chartExpanded ? '收起图表' : '展开图表' }}</el-button>
            <el-popover placement="bottom-end" width="390" trigger="click">
              <template #reference><el-button size="small">指标管理</el-button></template>
              <div class="indicator-panel">
                <div class="indicator-section"><strong>EMA</strong><el-button size="small" link type="primary" @click="addEma">添加</el-button></div>
                <div v-for="item in emaConfigs" :key="item.id" class="indicator-row">
                  <el-checkbox v-model="item.visible" />
                  <el-color-picker v-model="item.color" size="small" />
                  <span>EMA</span><el-input-number v-model="item.period" :min="1" :max="500" :step="1" size="small" controls-position="right" @change="normalizeEmaPeriod(item.id)" />
                  <el-button v-if="emaConfigs.length > 1" size="small" link type="danger" @click="removeEma(item.id)">删除</el-button>
                </div>
                <el-divider />
                <div class="indicator-row"><el-checkbox v-model="bollingerVisible" /><span>Bollinger Bands</span></div>
                <div class="indicator-row"><el-checkbox v-model="macdVisible" /><span>MACD</span></div><div class="indicator-row"><el-checkbox v-model="ictVisible" /><span>ICT/SMC 结构标记</span></div>
                <el-divider />
                <div class="indicator-section"><strong>自定义指标</strong><el-button size="small" link type="primary" @click="openCustomIndicatorEditor()">添加</el-button></div>
                <div v-for="item in customIndicators" :key="item.id" class="indicator-row custom-indicator-row">
                  <el-checkbox :model-value="item.visible" @change="setCustomIndicatorVisible(item, $event)" />
                  <span class="custom-indicator-name" :title="item.name">{{ item.name }}</span>
                  <el-button size="small" link type="primary" @click="openCustomIndicatorEditor(item)">编辑</el-button>
                  <el-button v-if="!item.builtin" size="small" link type="danger" @click="removeCustomIndicator(item.id)">删除</el-button>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
        <div ref="chartEl" class="chart"><div ref="priceOverlay" class="price-overlay" :style="priceOverlayStyle"><span>{{ formatPrice(tick.bid) }}</span><small v-if="!['W1', 'MN1'].includes(timeframe)">{{ countdownText }}</small></div><div v-if="activeEmaConfigs.length || bollingerVisible" class="indicator-legend"><span v-for="item in activeEmaConfigs" :key="item.id" class="legend-item"><span class="ema-dot" :style="{ borderColor: item.color }"></span>EMA{{ item.period }} <b>{{ formatPrice(item.value) }}</b></span><span v-if="bollingerVisible" class="legend-item"><span class="ema-dot" style="border-color:#a78bfa"></span>BOLL</span></div></div>
        <div v-if="macdVisible" ref="macdEl" class="macd-chart"></div>
        <div class="chart-note">指标在“指标管理”中配置；MACD显示在主图下方，布林带叠加在主图。</div>
      </section>
      <aside v-if="!chartExpanded" class="info-card">
        <div class="quote-bar"><span>Bid <b>{{ formatPrice(tick.bid) }}</b></span><span>Ask <b>{{ formatPrice(tick.ask) }}</b></span><span>点差 <b>{{ spread }}</b></span><span>更新时间 <b>{{ updatedAt || '--' }}</b></span></div>
        <el-divider />
        <div class="pattern-actions"><el-button class="pattern-entry-button" type="primary" plain @click="startPatternRecording">预设K线结构</el-button><el-button class="pattern-library-button" plain @click="openPatternLibrary">K线结构库（{{ patternTemplates.length }}）</el-button><span v-if="patternRecording" class="pattern-hint">在独立画布中编辑结构 K 线，前后趋势直接选择</span><div class="pattern-tolerance-row"><span>允许偏差值 <small>（默认值 0.18）</small></span><el-input-number v-model="patternTolerance" :min="0" :max="1" :step="0.01" :precision="2" :controls="false" size="small" @blur="normalizePatternTolerance" /></div><div class="pattern-tolerance-row"><span>扫描 K 线数量 <small>（默认值 200，最少 120）</small></span><el-input-number v-model="patternScanBarCount" :min="120" :step="10" :precision="0" :controls="false" size="small" @blur="normalizePatternScanBarCount" /></div><div class="pattern-match-status"><span>当前品种该周期，符合结构库结构的有 {{ patternMatchCount }} 处</span><el-button class="locate-pattern-button" size="small" type="primary" plain :disabled="patternMatchCount === 0" @click="locateLatestPatternMatch">定位最近结构</el-button></div><div class="pattern-scan-area" :class="{ 'has-results': patternScanResults.length || patternScanning }"><el-button class="scan-favorite-button" size="small" type="primary" plain :loading="patternScanning" @click="scanFavoriteSymbols">扫描自选品种</el-button><el-button class="scan-other-button" size="small" type="primary" plain :loading="patternScanning" @click="scanOtherSymbols">扫描其他品种</el-button><span v-if="patternScanStatus" class="pattern-scan-status">{{ patternScanStatus }}</span><div v-if="patternScanResults.length" class="pattern-scan-results"><el-button v-for="item in patternScanResults" :key="`${item.symbol}-${item.timeframe}`" size="small" @click="openScannedPattern(item)">{{ item.symbol }} · {{ timeframeLabelFor(item.timeframe) }}（{{ item.count }}）</el-button></div></div></div>
      </aside>
    </div>
    <section class="ai-analysis-card">
      <div class="ai-analysis-header"><div><strong>AI 盘面分析</strong><span>只读分析，不执行交易</span></div><div class="ai-analysis-actions"><el-select v-if="aiPresets.length" v-model="aiPreset" value-key="id" size="small" placeholder="选择 AI 预设" class="ai-preset-select" @change="selectAiPreset"><el-option v-for="item in aiPresets" :key="item.id" :label="item.name || item.model" :value="item" /></el-select><el-button size="small" @click="openAiConfig">配置 AI API</el-button><el-button type="primary" plain size="small" :loading="aiAnalyzing" :disabled="!aiReady" @click="analyzeAiMarket">{{ aiReady ? '分析当前行情' : '请先配置 AI' }}</el-button></div></div>
      <div v-if="aiError" class="ai-analysis-error">{{ aiError }}</div>
      <div v-else-if="aiResult" class="ai-analysis-content"><article class="ai-result-section ai-result-conclusion"><div class="ai-section-title"><b>A</b><strong>市场结论</strong><span>{{ aiBiasLabel }} · 评分 {{ aiResult.score ?? '--' }}/10 · 可信度 {{ aiConfidenceLabel }}</span></div><p>{{ aiResult.marketConclusion || '暂无市场结论' }}</p></article><article class="ai-result-section"><div class="ai-section-title"><b>B</b><strong>多周期趋势</strong></div><ul v-if="aiResult.trendAnalysis?.length"><li v-for="(item, index) in aiResult.trendAnalysis" :key="`trend-${index}`">{{ item }}</li></ul><p v-else class="ai-no-data">暂无多周期趋势判断</p></article><article class="ai-result-section"><div class="ai-section-title"><b>C</b><strong>ICT / SMC 结构</strong><span>{{ aiResult.ictStructure?.premiumDiscount || '暂无' }}</span></div><p>市场结构：{{ aiResult.ictStructure?.marketStructure || '暂无' }}</p><ul v-if="aiResult.ictStructure?.liquidity?.length"><li v-for="(item, index) in aiResult.ictStructure.liquidity" :key="`liquidity-${index}`">{{ item }}</li></ul><div v-if="aiResult.ictStructure?.zones?.length" class="ai-levels"><span v-for="(item, index) in aiResult.ictStructure.zones" :key="`zone-${index}`">{{ item.type }}：{{ item.range || '--' }}<small>{{ item.status || '' }}</small></span></div></article><article class="ai-result-section"><div class="ai-section-title"><b>D</b><strong>交易机会</strong><span>{{ aiResult.opportunity?.status || '等待确认' }}</span></div><p>方向：{{ aiResult.opportunity?.direction || '观望' }}</p><p>触发条件：{{ aiResult.opportunity?.trigger || '暂无' }}</p><p>失效条件：{{ aiResult.opportunity?.invalidation || '暂无' }}</p></article><article class="ai-result-section"><div class="ai-section-title"><b>E</b><strong>交易计划</strong><span>{{ aiResult.tradingPlan?.direction || '观望' }}</span></div><div class="ai-plan-grid"><p><label>入场条件</label>{{ aiResult.tradingPlan?.entryCondition || '暂无' }}</p><p><label>失效条件</label>{{ aiResult.tradingPlan?.invalidCondition || '暂无' }}</p><p><label>下一步动作</label>{{ aiResult.tradingPlan?.nextAction || '继续观察' }}</p></div><div v-if="aiResult.keyLevels?.length" class="ai-levels"><span v-for="(item, index) in aiResult.keyLevels" :key="`level-${index}`">{{ item.type }}：{{ item.price ?? '--' }}<small>{{ item.note || '' }}</small></span></div></article><article class="ai-result-section ai-result-risk"><div class="ai-section-title"><b>F</b><strong>风险提示</strong></div><ul v-if="aiResult.riskWarnings?.length"><li v-for="(item, index) in aiResult.riskWarnings" :key="`risk-${index}`">{{ item }}</li></ul><p v-else class="ai-no-data">暂无额外风险提示</p></article></div>
      <div v-else class="ai-analysis-empty">点击“分析当前行情”，让 AI 综合当前 K 线、指标和结构匹配结果。</div>
    </section>
    <el-dialog v-model="aiConfigVisible" title="AI Responses API 配置" width="560px">
      <el-form :model="aiConfigDraft" label-position="top">
        <el-form-item label="预设 API 配置"><div class="ai-preset-form-row"><el-select v-model="aiConfigDraftPreset" :loading="aiPresetsLoading" @change="applyAiPreset"><el-option v-for="preset in aiPresets" :key="preset.id" :label="preset.name" :value="preset.id" /></el-select><el-button type="success" plain @click="createAiPreset">新增</el-button><el-button type="danger" plain :disabled="!aiConfigDraftPreset" @click="deleteAiPreset">删除</el-button></div></el-form-item>
        <el-form-item label="预设名称"><el-input v-model="aiConfigDraft.name" placeholder="例如：我的 DeepSeek" /></el-form-item>
        <el-form-item label="Base URL"><el-input v-model="aiConfigDraft.apiBase" placeholder="例如：https://api.deepseek.com/v1" /></el-form-item>
        <el-form-item label="调用方法"><el-select v-model="aiConfigDraft.apiMethod" style="width:100%"><el-option label="Responses API" value="responses" /><el-option label="Chat Completions API" value="chat-completions" /></el-select></el-form-item>
        <el-form-item label="API Key"><el-input v-model="aiConfigDraft.apiKey" type="password" show-password /></el-form-item>
        <el-form-item label="模型"><div class="ai-model-form-row"><el-select v-model="aiConfigDraft.model" filterable allow-create placeholder="选择模型"><el-option v-for="model in aiModels" :key="model" :label="model" :value="model" /></el-select><el-button type="primary" :loading="aiModelsLoading" @click="loadAiModels">刷新模型</el-button></div></el-form-item>
        <el-alert type="info" :closable="false" show-icon>行情分析提示词由系统内置，会自动附带当前 K 线、指标和结构匹配数据；不复用视频笔记提示词。</el-alert>
      </el-form>
      <template #footer><el-button type="info" plain @click="aiConfigVisible = false">取消</el-button><el-button type="primary" @click="saveAiConfig">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="customIndicatorDialog" :title="editingIndicatorId ? '编辑自定义指标' : '添加自定义 Pine 指标'" width="760px">
      <el-form label-position="top">
        <el-form-item label="指标名称"><el-input v-model="customIndicatorName" placeholder="例如：Divergence for Many Indicators v4" /></el-form-item>
        <el-form-item label="Pine 源代码"><el-input v-model="customIndicatorCode" type="textarea" :rows="10" placeholder="粘贴 TradingView Pine Editor 导出的源码" /></el-form-item>
        <el-divider content-position="left">指标参数</el-divider>
        <div v-if="customIndicatorIsBarCount" class="custom-settings-grid">
          <el-form-item label="Label Size"><el-select v-model="customIndicatorSettings.labelSize"><el-option v-for="size in barCountLabelSizes" :key="size" :label="size" :value="size" /></el-select></el-form-item>
          <el-form-item label="Text Color"><el-color-picker v-model="customIndicatorSettings.labelColor" /></el-form-item>
          <el-form-item label="Display at every X bars"><el-input-number v-model="customIndicatorSettings.barInterval" :min="1" :max="1000" /></el-form-item>
        </div>
        <template v-else>
          <div class="custom-settings-grid">
            <el-form-item v-if="pineSupports('pivotPeriod')" label="Pivot Period"><el-input-number v-model="customIndicatorSettings.pivotPeriod" :min="1" :max="50" /></el-form-item>
            <el-form-item v-if="pineSupports('minDivergences')" label="最少背离数量"><el-input-number v-model="customIndicatorSettings.minDivergences" :min="1" :max="10" /></el-form-item>
            <el-form-item v-if="pineSupports('maxPivots')" label="最大 Pivot 检查数"><el-input-number v-model="customIndicatorSettings.maxPivots" :min="1" :max="10" /></el-form-item>
            <el-form-item v-if="pineSupports('maxBars')" label="最大 K 线检查数"><el-input-number v-model="customIndicatorSettings.maxBars" :min="100" :max="10000" /></el-form-item>
            <el-form-item v-if="pineSupports('divergenceType')" label="背离类型"><el-select v-model="customIndicatorSettings.divergenceType"><el-option label="常规" value="regular" /><el-option label="隐藏" value="hidden" /><el-option label="常规和隐藏" value="both" /></el-select></el-form-item>
            <el-form-item v-if="pineSupports('indicatorNames')" label="指标名称显示"><el-select v-model="customIndicatorSettings.indicatorNames"><el-option label="不显示" value="none" /><el-option label="简写" value="short" /><el-option label="完整" value="full" /></el-select></el-form-item>
          </div>
          <div class="custom-settings-checks">
            <el-checkbox v-if="pineSupports('showDivergenceNumber')" v-model="customIndicatorSettings.showDivergenceNumber">显示背离编号</el-checkbox>
            <el-checkbox v-if="pineSupports('showOnlyLast')" v-model="customIndicatorSettings.showOnlyLast">仅显示最后一个背离</el-checkbox>
            <el-checkbox v-if="pineSupports('dontWaitConfirmation')" v-model="customIndicatorSettings.dontWaitConfirmation">不等待确认</el-checkbox>
            <el-checkbox v-if="pineSupports('showDivergenceLines')" v-model="customIndicatorSettings.showDivergenceLines">显示背离连线</el-checkbox>
            <el-checkbox v-if="pineSupports('showPivotPoints')" v-model="customIndicatorSettings.showPivotPoints">显示 Pivot 点</el-checkbox>
            <el-checkbox v-if="pineSupports('showMacd')" v-model="customIndicatorSettings.showMacd">MACD</el-checkbox>
            <el-checkbox v-if="pineSupports('showMacdHistogram')" v-model="customIndicatorSettings.showMacdHistogram">MACD Histogram</el-checkbox>
            <el-checkbox v-if="pineSupports('showRsi')" v-model="customIndicatorSettings.showRsi">RSI</el-checkbox>
            <el-checkbox v-if="pineSupports('showStochastic')" v-model="customIndicatorSettings.showStochastic">Stochastic</el-checkbox>
            <el-checkbox v-if="pineSupports('showCci')" v-model="customIndicatorSettings.showCci">CCI</el-checkbox>
            <el-checkbox v-if="pineSupports('showMomentum')" v-model="customIndicatorSettings.showMomentum">Momentum</el-checkbox>
            <el-checkbox v-if="pineSupports('showObv')" v-model="customIndicatorSettings.showObv">OBV</el-checkbox>
          </div>
          <div class="custom-color-row"><span>底背离颜色</span><el-color-picker v-model="customIndicatorSettings.bullColor" /><span>顶背离颜色</span><el-color-picker v-model="customIndicatorSettings.bearColor" /></div>
        </template>
      </el-form>
      <el-alert type="info" :closable="false" title="已保存的参数会在指标管理中保留并可再次编辑；当前页面按 Pine 指标的背离参数绘制适配结果，不会直接执行任意 Pine 代码。" />
      <template #footer><el-button @click="customIndicatorDialog = false">取消</el-button><el-button type="primary" @click="saveCustomIndicator">保存并显示</el-button></template>
    </el-dialog>
    <el-dialog v-model="patternLibraryDialog" title="K 线结构库" width="760px">
      <el-empty v-if="!patternTemplates.length" description="暂无结构模板" />
      <div v-else class="pattern-library-grid">
        <article v-for="template in pagedPatternTemplates" :key="template.id" class="pattern-library-card">
          <div class="pattern-card-header"><strong>{{ template.name }}</strong><el-switch v-model="template.enabled" size="small" @change="togglePatternTemplate(template)" /></div>
          <svg class="pattern-preview" viewBox="0 0 300 150" role="img" :aria-label="`${template.name} K线结构预览`">
            <line v-for="row in 4" :key="`grid-${template.id}-${row}`" x1="8" :y1="row * 30" x2="292" :y2="row * 30" class="pattern-grid-line" />
            <g v-for="(bar, index) in patternPreviewBars(template)" :key="`${template.id}-bar-${index}`">
              <line :x1="patternPreviewX(index, patternPreviewBars(template).length)" :y1="patternPreviewY(bar.high, template)" :x2="patternPreviewX(index, patternPreviewBars(template).length)" :y2="patternPreviewY(bar.low, template)" :class="bar.close >= bar.open ? 'pattern-bull' : 'pattern-bear'" />
              <rect :x="patternPreviewX(index, patternPreviewBars(template).length) - 5" :y="Math.min(patternPreviewY(bar.open, template), patternPreviewY(bar.close, template))" width="10" :height="Math.max(3, Math.abs(patternPreviewY(bar.close, template) - patternPreviewY(bar.open, template)))" :class="bar.close >= bar.open ? 'pattern-bull-fill' : 'pattern-bear-fill'" />
            </g>
          </svg>
          <div class="pattern-card-meta"><span>{{ patternBarCount(template) }} 根 K 线</span><span>前{{ patternTrendLabel(template.beforeTrend) }} · 后{{ patternTrendLabel(template.afterTrend) }}</span></div>
          <div class="pattern-card-actions"><el-button size="small" link type="primary" @click="openPatternTemplateEditor(template)">编辑</el-button><el-button size="small" link type="danger" @click="deletePatternTemplate(template)">删除</el-button></div>
        </article>
      </div>
      <div v-if="patternTemplates.length" class="pattern-pagination"><el-pagination v-model:current-page="patternLibraryPage" layout="prev, pager, next" :page-size="6" :total="patternTemplates.length" /></div>
    </el-dialog>
    <el-dialog v-model="patternDialog" class="pattern-dialog" :title="editingPatternTemplateId ? '编辑 K 线结构' : '录入 K 线结构'" width="900px" top="40px" :close-on-click-modal="false">
      <div class="pattern-dialog-content">
        <el-alert type="info" :closable="false" title="独立录入画布：横轴固定每根 K 线的位置；拖动实体、上下影线调整 OHLC。结构前后趋势直接选择即可。" />
        <div class="pattern-recording-toolbar"><span>结构 {{ patternBars.length }} 根 K 线</span><span>前趋势：{{ patternDraft.beforeTrend === 'any' ? '不限制' : patternDraft.beforeTrend === 'up' ? '上涨' : '下跌' }}；后趋势：{{ patternDraft.afterTrend === 'any' ? '不限制' : patternDraft.afterTrend === 'up' ? '上涨' : '下跌' }}</span><el-button size="small" @click="addPatternBar">添加 K 线</el-button><el-button size="small" :disabled="patternBars.length <= 1" @click="removePatternBar">删除末根</el-button><el-button size="small" @click="resetPatternBars">重置</el-button></div>
        <div class="pattern-editor"><div class="pattern-canvas-viewport"><canvas ref="patternCanvas" class="pattern-editor-canvas" @pointerdown="beginPatternCandleDrag" @pointermove="continuePatternCandleDrag" @pointerup="finishPatternCandleDrag" @pointercancel="finishPatternCandleDrag"></canvas></div><div class="pattern-editor-help">拖动：实体上下端调整开收盘价；上影线顶端调整最高价；下影线底端调整最低价</div></div>
        <el-form label-position="top" class="pattern-form">
        <el-form-item label="结构名称"><el-input v-model="patternDraft.name" placeholder="例如：三根底部吞没" /></el-form-item>
        <el-form-item label="逆向结构名称"><el-input v-model="patternDraft.inverseName" placeholder="例如：三根底部反转" /></el-form-item>
        <div class="pattern-trend-fields"><el-form-item label="结构前趋势"><el-select v-model="patternDraft.beforeTrend"><el-option label="不限制" value="any" /><el-option label="上涨" value="up" /><el-option label="下跌" value="down" /></el-select></el-form-item><el-form-item label="结构后趋势"><el-select v-model="patternDraft.afterTrend"><el-option label="不限制" value="any" /><el-option label="上涨" value="up" /><el-option label="下跌" value="down" /></el-select></el-form-item><el-form-item label="趋势观察 K 线数"><el-input-number v-model="patternDraft.trendBars" :min="0" :max="50" /></el-form-item></div>
      </el-form>
      <el-table v-if="patternBars.length" :data="patternBars" size="small" max-height="180"><el-table-column type="index" label="#" width="55" /><el-table-column label="开盘"><template #default="scope"><el-input-number v-model="scope.row.open" size="small" :controls="false" @change="normalizePatternEditorBar(scope.row)" /></template></el-table-column><el-table-column label="最高"><template #default="scope"><el-input-number v-model="scope.row.high" size="small" :controls="false" @change="normalizePatternEditorBar(scope.row)" /></template></el-table-column><el-table-column label="最低"><template #default="scope"><el-input-number v-model="scope.row.low" size="small" :controls="false" @change="normalizePatternEditorBar(scope.row)" /></template></el-table-column><el-table-column label="收盘"><template #default="scope"><el-input-number v-model="scope.row.close" size="small" :controls="false" @change="normalizePatternEditorBar(scope.row)" /></template></el-table-column></el-table>
        <div v-if="patternBars.length" class="reverse-pattern-section"><div class="reverse-pattern-title"><strong>{{ patternDraft.inverseName || `${patternDraft.name || '当前结构'}-逆` }}</strong><span>自动生成，只读</span></div><div class="pattern-editor reverse-pattern-editor"><canvas ref="reversePatternCanvas" class="pattern-editor-canvas"></canvas><div class="pattern-editor-help">以整体价格区间的水平中线进行上下镜像：顺序不变，阳线与阴线互换</div></div></div>
      </div>
      <template #footer><el-button :disabled="patternSaving" @click="patternDialog = false">取消</el-button><el-button type="primary" :loading="patternSaving" :disabled="patternBars.length < 1 || !patternDraft.name.trim()" @click="savePatternTemplate">保存结构</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { createChart, createSeriesMarkers, CandlestickSeries, ColorType, HistogramSeries, LineSeries } from 'lightweight-charts'
import { Minus, Plus } from '@element-plus/icons-vue'

const API = 'http://127.0.0.1:5888/api/market'
const BOARD_CONFIG_API = 'http://127.0.0.1:5888/api/board-analysis/config'
const BOARD_PATTERNS_API = 'http://127.0.0.1:5888/api/board-analysis/patterns'
const AI_PRESETS_API = 'http://127.0.0.1:5888/api/video-notes/api-presets'
const AI_ANALYZE_API = 'http://127.0.0.1:5888/api/ai/analyze-market'
const AI_SELECTED_PRESET_KEY = 'forge-board-ai-selected-preset'
const timeframes = [{ value: 'M1', label: '1分' }, { value: 'M5', label: '5分' }, { value: 'M15', label: '15分' }, { value: 'M30', label: '30分' }, { value: 'H1', label: '1小时' }, { value: 'H4', label: '4小时' }, { value: 'D1', label: '1天' }, { value: 'W1', label: '1周' }, { value: 'MN1', label: '1月' }]
const symbols = ref([{ name: 'XAUUSD' }, { name: 'NAS100' }, { name: 'EURUSD' }, { name: 'ETHUSD' }])
const favoriteSymbols = ref(['XAUUSD'])
const favoriteSymbolItems = computed(() => favoriteSymbols.value.map(name => symbols.value.find(item => item.name === name) || { name }).filter(item => item.name))
const symbol = ref('XAUUSD')
const timeframe = ref('M15')
const refreshIntervalSeconds = ref(5)
const chartExpanded = ref(false)
const customIndicatorDialog = ref(false)
const patternDialog = ref(false)
const patternLibraryDialog = ref(false)
const patternLibraryPage = ref(1)
const editingPatternTemplateId = ref(null)
const patternRecording = ref(false)
const patternCanvas = ref(null)
const reversePatternCanvas = ref(null)
const patternBars = ref([])
const patternSaving = ref(false)
const patternStroke = ref(null)
const patternDragBounds = ref(null)
const patternTemplates = ref([])
const patternMatchResults = ref([])
const patternScanResults = ref([])
const patternScanning = ref(false)
const patternScanStatus = ref('')
const patternMatchCount = computed(() => patternMatchResults.value.length)
const patternTolerance = ref(0.18)
const patternScanBarCount = ref(200)
const aiPresets = ref([])
const aiPreset = ref(null)
const aiPresetsLoading = ref(false)
const aiConfigVisible = ref(false)
const aiConfigDraftPreset = ref('')
const aiConfigDraft = ref({ name: '', apiBase: '', apiMethod: 'responses', apiKey: '', model: '' })
const aiModels = ref([])
const aiModelsLoading = ref(false)
const aiAnalyzing = ref(false)
const aiResult = ref(null)
const aiError = ref('')
const aiReady = computed(() => Boolean(aiPreset.value?.apiBase && aiPreset.value?.apiKey && aiPreset.value?.model))
const aiBiasLabel = computed(() => ({ bullish: '偏多', bearish: '偏空', neutral: '震荡', unknown: '未知' }[aiResult.value?.marketBias] || '未知'))
const aiConfidenceLabel = computed(() => ({ high: '高', medium: '中', low: '低' }[aiResult.value?.confidence] || '未知'))
const resetPatternDragBounds = () => { patternDragBounds.value = null }
const pagedPatternTemplates = computed(() => patternTemplates.value.slice((patternLibraryPage.value - 1) * 6, patternLibraryPage.value * 6))
watch(patternTemplates, templates => {
  patternLibraryPage.value = Math.min(patternLibraryPage.value, Math.max(1, Math.ceil(templates.length / 6)))
}, { deep: true })
const boardConfigLoaded = ref(false)
let boardConfigSaveTimer
const patternDraft = ref({ name: '', inverseName: '', beforeTrend: 'any', afterTrend: 'any', trendBars: 8 })
const customIndicatorName = ref('Divergence for Many Indicators v4')
const customIndicatorCode = ref('')
const customIndicators = ref([])
const editingIndicatorId = ref(null)
const customIndicatorSettings = ref({
  pivotPeriod: 5,
  minDivergences: 1,
  maxPivots: 10,
  maxBars: 100,
  divergenceType: 'regular',
  indicatorNames: 'full',
  showDivergenceNumber: true,
  showOnlyLast: false,
  dontWaitConfirmation: false,
  showDivergenceLines: true,
  showPivotPoints: false,
  showMacd: false,
  showMacdHistogram: true,
  showRsi: false,
  showStochastic: false,
  showCci: false,
  showMomentum: false,
  showObv: false,
  bullColor: '#00c853',
  bearColor: '#f23645'
})
const customIndicatorSaved = computed(() => customIndicators.value.filter(item => item.visible))
const customIndicatorNames = computed(() => customIndicatorSaved.value.some(item => item.settings?.indicatorNames !== 'none'))
const barCountLabelSizes = ['Auto', 'Huge', 'Large', 'Normal', 'Small', 'Tiny']
const customIndicatorIsBarCount = computed(() => /(?:study|indicator)\s*\(\s*["']bar\s*count["']/i.test(customIndicatorCode.value) || /display\s+at\s+every\s+x\s+bars/i.test(customIndicatorCode.value))
const bars = ref([])
const tick = ref({ bid: 0, ask: 0 })
const account = ref(null)
const connected = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const updatedAt = ref('')
const mt5ClockOffsetSeconds = ref(0)
const chartEl = ref(null)
const macdEl = ref(null)
const priceOverlayStyle = ref({ display: 'none' })
let chart
let candleSeries
let priceLine
let macdChart
let macdLine
let macdSignalLine
let macdHistogram
let emaSeriesMap = new Map()
let bollingerSeries = []
let customDivergenceSeries = []
let customMarkers
let refreshTimer
let countdownTimer
let resizeObserver
let loadingOlder
let priceUpdateTimer = false
let hasMoreHistory = true
let syncingTimeScale = false
let skipHistoryLoadOnce = false

const timeframeLabel = computed(() => timeframes.find(item => item.value === timeframe.value)?.label || timeframe.value)
const chartTimeOffsetSeconds = ref(5 * 3600)
const getChartTimeParts = time => {
  if (time && typeof time === 'object') return { year: Number(time.year), month: Number(time.month), day: Number(time.day), hour: 0, minute: 0 }
  const timestamp = Number(time)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date((timestamp + chartTimeOffsetSeconds.value) * 1000)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() }
}
const formatBeijingChartTime = time => {
  const parts = getChartTimeParts(time)
  if (!parts) return ''
  if (['D1', 'W1', 'MN1'].includes(timeframe.value) || (time && typeof time === 'object')) return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}
const formatBeijingTooltipTime = time => {
  const parts = getChartTimeParts(time)
  if (!parts) return ''
  return `${String(parts.day).padStart(2, '0')} ${String(parts.month).padStart(2, '0')}月 ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}
const accountText = computed(() => account.value ? `${account.value.server || 'MT5'} · 模拟账户` : '账户未连接')
const isFavoriteSymbol = name => favoriteSymbols.value.includes(name)
const selectSymbol = name => { symbol.value = name; loadBars() }
const toggleFavoriteSymbol = name => {
  favoriteSymbols.value = favoriteSymbols.value.includes(name) ? favoriteSymbols.value.filter(item => item !== name) : [...favoriteSymbols.value, name]
  scheduleBoardConfigSave()
}
const normalizeRefreshInterval = value => {
  refreshIntervalSeconds.value = Math.max(1, Math.min(5, Number(Number(value || 5).toFixed(1))))
  scheduleBoardConfigSave()
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = window.setInterval(refreshMarket, refreshIntervalSeconds.value * 1000) }
}
const spread = computed(() => tick.value.bid && tick.value.ask ? (tick.value.ask - tick.value.bid).toFixed(5) : '--')
const timeframeSeconds = computed(() => ({ M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN1: 2592000 }[timeframe.value] || 0))
const countdownSeconds = ref(0)
const emaColors = ['#f59e0b', '#38bdf8', '#f472b6', '#a3e635', '#fb7185', '#c084fc']
let nextEmaId = 3
const emaConfigs = ref([{ id: 1, period: 20, color: emaColors[0], visible: true }, { id: 2, period: 60, color: emaColors[1], visible: false }])
const bollingerVisible = ref(false)
const macdVisible = ref(false)
const ictVisible = ref(true)
const activeEmaConfigs = computed(() => emaConfigs.value.filter(item => item.visible).map(item => ({ ...item, value: bars.value.length ? calculateEma(bars.value, Number(item.period)).at(-1)?.value : null })))
const sessionCountdownSeconds = ref(0)
const sessionMode = ref('closed')
const sessionName = ref('休市')
const sessionTargetName = ref('亚盘')
const marketSessions = [
  { name: '亚盘', open: 8 * 60, close: 16 * 60, label: '08:00-16:00' },
  { name: '欧盘', open: 15 * 60, close: 23 * 60, label: '15:00-23:00' },
  { name: '美盘', open: 20 * 60, close: 4 * 60, label: '20:00-04:00' }
]
const sessionStatusText = computed(() => sessionMode.value === 'open' ? `${sessionName.value}进行中 · 距闭市 ${sessionCountdownText.value}` : `距${sessionTargetName.value}开市 ${sessionCountdownText.value}`)
const sessionScheduleText = computed(() => `亚盘 08:00-16:00 · 欧盘 15:00-23:00 · 美盘 20:00-次日04:00（北京时间）`)
const countdownText = computed(() => {
  const total = Math.max(0, countdownSeconds.value)
  const seconds = total % 60
  const minutes = Math.floor((total % 3600) / 60)
  const hours = Math.floor((total % 86400) / 3600)
  const days = Math.floor(total / 86400)
  const tf = timeframe.value
  if (tf === 'M1') return `00:${String(seconds).padStart(2, '0')}`
  if (['M5', 'M15', 'M30'].includes(tf)) return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  if (['H1', 'H4'].includes(tf)) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  if (days) return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const sessionCountdownText = computed(() => {
  const total = Math.max(0, sessionCountdownSeconds.value)
  const seconds = total % 60
  const minutes = Math.floor((total % 3600) / 60)
  const hours = Math.floor((total % 86400) / 3600)
  const days = Math.floor(total / 86400)
  if (days) return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const tradingCountdownText = computed(() => sessionMode.value === 'open' ? sessionCountdownText.value : '--')
const openingCountdownText = computed(() => sessionMode.value === 'open' ? '--' : sessionCountdownText.value)

const formatPrice = value => value ? Number(value).toFixed(5).replace(/0+$/, '').replace(/\.$/, '') : '--'
const showError = error => { errorMessage.value = error?.response?.data?.message || error?.message || '请求行情失败' }

const createChartInstance = async () => {
  await nextTick()
  if (!chartEl.value) return
  chart?.remove()
  macdChart?.remove()
  macdChart = null
  macdLine = null
  macdSignalLine = null
  macdHistogram = null
  chart = createChart(chartEl.value, { layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#aab4c3' }, grid: { vertLines: { color: '#202938' }, horzLines: { color: '#202938' } }, timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#334155', tickMarkFormatter: formatBeijingChartTime }, localization: { timeFormatter: formatBeijingTooltipTime }, rightPriceScale: { borderColor: '#334155' }, crosshair: { mode: 0 } })
  candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350', lastValueVisible: false })
  customMarkers = createSeriesMarkers(candleSeries, [])
  priceLine = candleSeries.createPriceLine({ price: 0, color: '#26a69a', lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: 'Bid' })
  emaSeriesMap = new Map()
  bollingerSeries = []
  emaConfigs.value.forEach(item => { emaSeriesMap.set(item.id, chart.addSeries(LineSeries, { color: item.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, visible: item.visible })) })
  const middle = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: bollingerVisible.value })
  const upper = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, visible: bollingerVisible.value })
  const lower = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, visible: bollingerVisible.value })
  bollingerSeries = [middle, upper, lower]
  customDivergenceSeries = []
  await createMacdChart()
  resizeObserver = new ResizeObserver(() => { chart?.resize(chartEl.value.clientWidth, chartEl.value.clientHeight); if (macdChart && macdEl.value) macdChart.resize(macdEl.value.clientWidth, macdEl.value.clientHeight); updatePriceOverlay(); redrawPatternCanvases() })
  resizeObserver.observe(chartEl.value)
  if (macdEl.value) resizeObserver.observe(macdEl.value)
  chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (skipHistoryLoadOnce) { skipHistoryLoadOnce = false } else if (range && range.from < 20) loadOlderBars()
    if (range && macdChart && !syncingTimeScale) {
      syncingTimeScale = true
      macdChart.timeScale().setVisibleLogicalRange(range)
      syncingTimeScale = false
    }
  })
}

const calculateEma = (items, period = 20) => {
  const multiplier = 2 / (period + 1)
  let ema
  return items.map(item => {
    ema = ema == null ? item.close : (item.close - ema) * multiplier + ema
    return { time: item.time, value: ema }
  })
}
const calculateBollinger = (items, period = 20, deviations = 2) => items.map((item, index) => {
  const window = items.slice(Math.max(0, index - period + 1), index + 1).map(value => value.close)
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length
  const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length
  const deviation = Math.sqrt(variance) * deviations
  return { time: item.time, middle: mean, upper: mean + deviation, lower: mean - deviation }
})
const calculateSma = (items, period) => items.map((item, index) => ({ time: item.time, value: items.slice(Math.max(0, index - period + 1), index + 1).reduce((sum, value) => sum + value.close, 0) / Math.min(period, index + 1) }))
const calculateMacdHistogram = (items, fast = 12, slow = 26, signal = 9) => {
  const fastValues = calculateEma(items, fast)
  const slowValues = calculateEma(items, slow)
  const macd = items.map((item, index) => ({ time: item.time, value: fastValues[index].value - slowValues[index].value }))
  const signalValues = calculateEma(macd.map(item => ({ ...item, close: item.value })), signal)
  return macd.map((item, index) => ({ time: item.time, value: item.value - signalValues[index].value }))
}
const defaultCustomSettings = () => ({
  pivotPeriod: 5, minDivergences: 1, maxPivots: 10, maxBars: 10000, divergenceType: 'regular', indicatorNames: 'full',
  showDivergenceNumber: true, showOnlyLast: false, dontWaitConfirmation: false, showDivergenceLines: true, showPivotPoints: false,
  showMacd: false, showMacdHistogram: true, showRsi: false, showStochastic: false, showCci: false, showMomentum: false, showObv: false,
  bullColor: '#00c853', bearColor: '#f23645', labelSize: 'Normal', labelColor: '#f59e0b', barInterval: 2
})
const defaultBarCountIndicator = () => ({
  id: 'builtin-bar-count',
  name: 'Bar Count',
  code: `//@version=4\nstudy("Bar Count", overlay=true)\n// Display at every X bars`,
  settings: { ...defaultCustomSettings() },
  visible: true,
  builtin: true,
  savedAt: Date.now()
})
const parsePineDefaults = code => {
  const settings = defaultCustomSettings()
  const source = String(code || '')
  const number = (patterns, fallback) => {
    for (const pattern of patterns) {
      const match = source.match(pattern)
      if (match) return Number(match[1])
    }
    return fallback
  }
  const inputLine = name => new RegExp(`(?:^|\\n)\\s*(?:var\\s+)?(?:bool|int|float|string|color)\\s+${name}\\s*=.*(?:input|input\\.)`, 'im').test(source)
  const aliases = {
    pivotPeriod: [/pivotlen/i, /pivot.?period/i], minDivergences: [/mindivergences?/i, /mindiv/i], maxPivots: [/maxpp/i, /max.?pivots?/i], maxBars: [/maxbars/i, /max.?bars/i],
    divergenceType: [/divergence.?type/i, /dtype/i], indicatorNames: [/indicator.?names?/i], showDivergenceNumber: [/shownumber/i, /showdivergencenumber/i], showOnlyLast: [/showonlylast/i],
    dontWaitConfirmation: [/dontwaitconfirmation/i, /dont.?wait/i], showDivergenceLines: [/showlines/i, /showdivergencelines/i], showPivotPoints: [/showpivot/i],
    showMacd: [/showmacd(?!hist)/i], showMacdHistogram: [/showmacd.?histogram/i, /showhistogram/i], showRsi: [/showrsi/i], showStochastic: [/showstochastic/i, /showstoch/i], showCci: [/showcci/i], showMomentum: [/showmomentum/i], showObv: [/showobv/i]
  }
  settings.pivotPeriod = number([/pivotlen\s*=\s*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i, /pivot\s*period[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i], settings.pivotPeriod)
  settings.minDivergences = number([/mindivergences?[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i, /mindiv[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i], settings.minDivergences)
  settings.maxPivots = number([/maxpp[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i, /max(?:imum)?\s*pivot[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i], settings.maxPivots)
  settings.maxBars = number([/maxbars[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i, /max(?:imum)?\s*bars[^\n]*input\s*\(\s*(?:defval\s*=\s*)?(\d+)/i], settings.maxBars)
  Object.entries(aliases).forEach(([key, patterns]) => { settings[`supports_${key}`] = patterns.some(pattern => pattern.test(source)) || inputLine(key) })
  if (settings.supports_showDivergenceLines) settings.showDivergenceLines = !/showlines\s*=\s*input\s*\(\s*false/i.test(source)
  if (settings.supports_showPivotPoints) settings.showPivotPoints = !/showpivot[^\n]*input\s*\(\s*false/i.test(source)
  if (/label\s*size/i.test(source)) settings.labelSize = source.match(/defval\s*=\s*["']([^"']+)["']/i)?.[1] || settings.labelSize
  if (/text\s*color/i.test(source)) {
    const colorName = source.match(/input\s*\(\s*color\.(\w+)\s*,\s*["']text\s*color["']/i)?.[1]?.toLowerCase()
    settings.labelColor = { orange: '#f59e0b', yellow: '#facc15', red: '#ef4444', green: '#22c55e', blue: '#3b82f6', white: '#ffffff', black: '#000000' }[colorName] || settings.labelColor
  }
  if (/display\s+at\s+every\s+x\s+bars/i.test(source)) settings.barInterval = number([/c_contador\s*=\s*input\s*\([^\n]*defval\s*=\s*(\d+)/i, /display\s+at\s+every\s+x\s+bars[\s\S]*?defval\s*=\s*(\d+)/i], settings.barInterval)
  return settings
}
const pineSupports = key => parsePineDefaults(customIndicatorCode.value)[`supports_${key}`] === true
const openCustomIndicatorEditor = item => {
  editingIndicatorId.value = item?.id || null
  const source = item || { name: 'Divergence for Many Indicators v4', code: '', settings: defaultCustomSettings() }
  customIndicatorName.value = source.name
  customIndicatorCode.value = source.code
  customIndicatorSettings.value = { ...defaultCustomSettings(), ...parsePineDefaults(source.code), ...(source.settings || {}) }
  customIndicatorDialog.value = true
}
const saveCustomIndicator = () => {
  if (!customIndicatorName.value.trim() || !customIndicatorCode.value.trim()) return
  const existing = editingIndicatorId.value ? customIndicators.value.find(item => item.id === editingIndicatorId.value) : null
  const payload = { name: customIndicatorName.value.trim(), code: customIndicatorCode.value, settings: { ...customIndicatorSettings.value }, savedAt: Date.now(), visible: existing ? existing.visible : true }
  if (editingIndicatorId.value) {
    const index = customIndicators.value.findIndex(item => item.id === editingIndicatorId.value)
    if (index >= 0) customIndicators.value[index] = { ...customIndicators.value[index], ...payload }
  } else {
    customIndicators.value.push({ id: `custom-${Date.now()}`, ...payload })
  }
  scheduleBoardConfigSave()
  customIndicatorDialog.value = false
  editingIndicatorId.value = null
  updateCustomIndicator()
}
const setCustomIndicatorVisible = (item, visible) => {
  item.visible = visible
  scheduleBoardConfigSave()
  updateCustomIndicator()
}
const removeCustomIndicator = id => {
  if (customIndicators.value.find(item => item.id === id)?.builtin) return
  customIndicators.value = customIndicators.value.filter(item => item.id !== id)
  if (!customIndicators.value.some(item => item.visible)) customIndicators.value.forEach(item => { item.visible = false })
  scheduleBoardConfigSave()
  updateCustomIndicator()
}
const calculateBarCountMarkers = (items, settings) => {
  const markers = []
  const interval = Math.max(1, Number(settings.barInterval) || 2)
  let count = 0
  let sessionDay
  items.forEach(item => {
    const sessionKey = Math.floor((Number(item.time) - 12 * 3600) / 86400)
    if (sessionKey !== sessionDay) { count = 1; sessionDay = sessionKey } else count += 1
    if (count >= interval && count % interval === 0) markers.push({ time: item.time, position: 'belowBar', color: settings.labelColor || '#f59e0b', shape: 'circle', text: String(count) })
  })
  return markers
}
const calculateCustomDivergence = (items, settings = defaultCustomSettings()) => {
  const markers = []
  const lines = { bull: [], bear: [] }
  const pivots = []
  const oscillator = calculateMacdHistogram(items)
  const pivotPeriod = Number(settings.pivotPeriod) || 5
  const maxBars = Math.max(Number(settings.maxBars) || 10000, pivotPeriod * 2 + 1)
  const start = Math.max(pivotPeriod, items.length - maxBars)
  const lastClosedIndex = Math.max(-1, items.length - 2)
  const lows = []
  const highs = []
  for (let index = start; index <= lastClosedIndex - pivotPeriod; index += 1) {
    const pivot = items[index]
    const left = items.slice(index - pivotPeriod, index)
    const right = items.slice(index + 1, index + pivotPeriod + 1)
    if (left.every(item => pivot.low <= item.low) && right.every(item => pivot.low <= item.low)) { lows.push({ index, price: pivot.low, oscillator: oscillator[index].value }); pivots.push({ time: pivot.time, position: 'belowBar', color: '#64748b', shape: 'circle', text: settings.showPivotPoints ? 'P' : '' }) }
    if (left.every(item => pivot.high >= item.high) && right.every(item => pivot.high >= item.high)) { highs.push({ index, price: pivot.high, oscillator: oscillator[index].value }); pivots.push({ time: pivot.time, position: 'aboveBar', color: '#64748b', shape: 'circle', text: settings.showPivotPoints ? 'P' : '' }) }
  }
  const occupiedUntil = { value: -1 }
  const maxPivots = Math.max(1, Number(settings.maxPivots) || 10)
  const minDivergences = Math.max(1, Number(settings.minDivergences) || 1)
  const candidates = []
  const collectCandidates = (points, bullish) => {
    for (let currentIndex = 1; currentIndex < points.length; currentIndex += 1) {
      const current = points[currentIndex]
      const currentBar = items[current.index]
      const confirmationIndex = current.index + pivotPeriod
      const confirmationBar = items[confirmationIndex]
      const confirmed = confirmationIndex <= lastClosedIndex && (bullish ? confirmationBar.close > currentBar.high : confirmationBar.close < currentBar.low)
      if (!settings.dontWaitConfirmation && !confirmed) continue
      for (let previousIndex = currentIndex - 1; previousIndex >= 0 && currentIndex - previousIndex <= maxPivots; previousIndex -= 1) {
        const previous = points[previousIndex]
        const previousBar = items[previous.index]
        const regular = bullish ? current.price < previous.price && current.oscillator > previous.oscillator : current.price > previous.price && current.oscillator < previous.oscillator
        const hidden = bullish ? current.price > previous.price && current.oscillator < previous.oscillator : current.price < previous.price && current.oscillator > previous.oscillator
        const matches = settings.divergenceType === 'both' ? regular || hidden : settings.divergenceType === 'hidden' ? hidden : regular
        if (matches) candidates.push({ previous, current, previousBar, currentBar, confirmationBar: confirmed ? confirmationBar : currentBar, bullish })
      }
    }
  }
  collectCandidates(lows, true)
  collectCandidates(highs, false)
  const grouped = new Map()
  candidates.forEach(candidate => {
    const key = candidate.previous.index
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(candidate)
  })
  const acceptedByType = { bull: [], bear: [] }
  Array.from(grouped.entries()).sort(([left], [right]) => left - right).forEach(([, group]) => {
    if (group[0].previous.index <= occupiedUntil.value) return
    const selected = group.sort((left, right) => left.current.index - right.current.index).slice(0, 2)
    selected.forEach(candidate => acceptedByType[candidate.bullish ? 'bull' : 'bear'].push(candidate))
    if (selected.length) occupiedUntil.value = Math.max(occupiedUntil.value, ...selected.map(item => item.current.index))
  })
  Object.entries(acceptedByType).forEach(([type, accepted]) => {
    const bullish = type === 'bull'
    accepted.forEach((candidate, index) => {
      if (index + 1 < minDivergences) return
      const color = bullish ? settings.bullColor : settings.bearColor
      markers.push({ time: candidate.currentBar.time, position: bullish ? 'belowBar' : 'aboveBar', color, shape: bullish ? 'arrowUp' : 'arrowDown', text: settings.showDivergenceNumber ? `${bullish ? '底' : '顶'}${index + 1}` : '' })
      if (settings.showDivergenceLines) {
        const previousPrice = bullish ? candidate.previousBar.low : candidate.previousBar.high
        const currentPrice = bullish ? candidate.currentBar.low : candidate.currentBar.high
        lines[type].push([{ time: candidate.previousBar.time, value: previousPrice }, { time: candidate.currentBar.time, value: currentPrice }])
      }
    })
  })
  return { markers: [...(settings.showPivotPoints ? pivots : []), ...(settings.showOnlyLast ? markers.slice(-1) : markers)], lines }
}
const normalizePatternBar = bar => {
  const range = Math.max(0.00000001, Number(bar.high) - Number(bar.low))
  const body = Math.abs(Number(bar.close) - Number(bar.open))
  return {
    direction: Number(bar.close) >= Number(bar.open) ? 'bullish' : 'bearish',
    bodyRatio: body / range,
    upperWickRatio: (Number(bar.high) - Math.max(Number(bar.open), Number(bar.close))) / range,
    lowerWickRatio: (Math.min(Number(bar.open), Number(bar.close)) - Number(bar.low)) / range,
    closePosition: (Number(bar.close) - Number(bar.low)) / range
  }
}
const patternBarSummary = bar => ({ bodyRatio: (normalizePatternBar(bar).bodyRatio * 100).toFixed(0) })
const getPatternBody = bar => Math.abs(Number(bar.close) - Number(bar.open))
const buildPatternRelationships = editorBars => {
  const barsWithRange = editorBars.map(bar => ({ ...bar, body: getPatternBody(bar), range: Math.max(0.00000001, Number(bar.high) - Number(bar.low)) }))
  const patternLow = Math.min(...barsWithRange.map(bar => Number(bar.low)))
  const patternHigh = Math.max(...barsWithRange.map(bar => Number(bar.high)))
  const patternRange = Math.max(0.00000001, patternHigh - patternLow)
  const bodyComparisons = []
  const bodyContainments = []
  const lowOrders = []
  for (let left = 0; left < barsWithRange.length; left += 1) {
    for (let right = left + 1; right < barsWithRange.length; right += 1) {
      const leftBar = barsWithRange[left]
      const rightBar = barsWithRange[right]
      const bodyRatio = rightBar.body / Math.max(0.00000001, leftBar.body)
      if (bodyRatio <= 0.5) bodyComparisons.push({ smaller: right, larger: left, maxRatio: Math.min(0.5, bodyRatio * 1.15) })
      else if (bodyRatio >= 2) bodyComparisons.push({ smaller: left, larger: right, maxRatio: Math.min(0.5, (1 / bodyRatio) * 1.15) })
      if (right === left + 1) {
        const leftBullish = Number(leftBar.close) >= Number(leftBar.open)
        const rightBullish = Number(rightBar.close) >= Number(rightBar.open)
        const bullishEngulfing = !leftBullish && rightBullish && Number(rightBar.open) <= Number(leftBar.close) && Number(rightBar.close) >= Number(leftBar.open)
        const bearishEngulfing = leftBullish && !rightBullish && Number(rightBar.open) >= Number(leftBar.close) && Number(rightBar.close) <= Number(leftBar.open)
        if (bullishEngulfing || bearishEngulfing) bodyContainments.push({ inner: left, outer: right, direction: bullishEngulfing ? 'bullish' : 'bearish' })
      }
      if (Number(leftBar.low) !== Number(rightBar.low)) {
        lowOrders.push({ higher: Number(leftBar.low) > Number(rightBar.low) ? left : right, lower: Number(leftBar.low) > Number(rightBar.low) ? right : left })
      }
    }
  }
  return { bodyComparisons, bodyContainments, lowOrders }
}
const patternRelationshipsMatch = (items, template) => {
  const generatedRelationships = buildPatternRelationships(template.editorBars || [])
  const relationships = {
    ...generatedRelationships,
    ...(template.relationships || {}),
    bodyContainments: template.relationships?.bodyContainments || generatedRelationships.bodyContainments
  }
  const patternLow = Math.min(...items.map(item => Number(item.low)))
  const patternHigh = Math.max(...items.map(item => Number(item.high)))
  const patternRange = Math.max(0.00000001, patternHigh - patternLow)
  for (const relation of relationships.bodyComparisons || []) {
    const smallerBody = getPatternBody(items[relation.smaller])
    const largerBody = getPatternBody(items[relation.larger])
    if (smallerBody > largerBody * Number(relation.maxRatio || 0.5)) return false
  }
  for (const relation of relationships.bodyContainments || []) {
    const inner = items[relation.inner]
    const outer = items[relation.outer]
    const innerBullish = Number(inner.close) >= Number(inner.open)
    const outerBullish = Number(outer.close) >= Number(outer.open)
    const directionMatches = relation.direction === 'bullish' ? !innerBullish && outerBullish : innerBullish && !outerBullish
    const bodyContains = relation.direction === 'bullish'
      ? Number(outer.open) <= Number(inner.close) && Number(outer.close) >= Number(inner.open)
      : Number(outer.open) >= Number(inner.close) && Number(outer.close) <= Number(inner.open)
    if (!directionMatches || !bodyContains) return false
  }
  for (const relation of relationships.lowOrders || []) {
    if (Number(items[relation.higher].low) - Number(items[relation.lower].low) <= patternRange * 0.01) return false
  }
  return true
}
const invertPatternTrend = trend => trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'any'
const createInversePatternTemplate = template => {
  const editorBars = getReversePatternBars(template.editorBars?.length ? template.editorBars : patternPreviewBars(template))
  return {
    ...template,
    name: template.inverseName || `${template.name}-逆`,
    beforeTrend: invertPatternTrend(template.afterTrend),
    afterTrend: invertPatternTrend(template.beforeTrend),
    bars: editorBars.map(normalizePatternBar),
    editorBars,
    relationships: buildPatternRelationships(editorBars)
  }
}
const detectPatternTrend = (items, direction, trendBars) => {
  const requiredBars = Math.max(0, Number(trendBars) || 0)
  if (direction === 'any' || requiredBars === 0) return true
  if (items.length < requiredBars) return false
  const first = Number(items[0].close)
  const last = Number(items.at(-1).close)
  const slope = last - first
  return direction === 'up' ? slope > 0 : slope < 0
}
const patternMatches = (items, template, sourceBars = bars.value) => {
  if (items.length !== template.bars.length) return false
  const tolerance = Math.max(0, Math.min(1, Number(patternTolerance.value) || 0))
  const matches = items.every((bar, index) => {
    const actual = normalizePatternBar(bar)
    const expected = template.bars[index]
    return actual.direction === expected.direction && ['bodyRatio', 'upperWickRatio', 'lowerWickRatio', 'closePosition'].every(key => Math.abs(actual[key] - expected[key]) <= tolerance)
  })
  if (!matches || !patternRelationshipsMatch(items, template)) return false
  const before = sourceBars.slice(Math.max(0, items[0].index - template.trendBars), items[0].index)
  const after = sourceBars.slice(items.at(-1).index + 1, items.at(-1).index + 1 + template.trendBars)
  return detectPatternTrend(before, template.beforeTrend, template.trendBars) && detectPatternTrend(after, template.afterTrend, template.trendBars)
}
const calculatePatternMatchResults = () => {
  const results = []
  const occupied = new Map()
  patternTemplates.value.filter(template => template.enabled !== false).forEach(template => {
    const candidates = [
      { template, suffix: '', key: String(template.id) },
      { template: createInversePatternTemplate(template), suffix: '-逆', key: `${template.id}:inverse` }
    ]
    candidates.forEach(candidate => {
      const currentTemplate = candidate.template
      for (let index = 0; index <= bars.value.length - currentTemplate.bars.length; index += 1) {
        const sample = bars.value.slice(index, index + currentTemplate.bars.length).map((bar, offset) => ({ ...bar, index: index + offset }))
        if (!patternMatches(sample, currentTemplate)) continue
        const time = sample.at(-1).time
        const key = `${time}:${candidate.key}`
        if (occupied.has(key)) continue
        occupied.set(key, true)
        results.push({ time, index, text: currentTemplate.name, inverse: Boolean(candidate.suffix) })
      }
    })
  })
  return results.sort((left, right) => Number(left.time) - Number(right.time))
}
const calculatePatternMarkers = () => {
  const results = calculatePatternMatchResults()
  patternMatchResults.value = results
  return results.map(result => ({ time: result.time, position: 'aboveBar', color: result.inverse ? '#c084fc' : '#fbbf24', shape: 'arrowDown', text: result.text }))
}
const refreshPatternMatches = () => { patternMatchResults.value = calculatePatternMatchResults() }
const normalizePatternTolerance = () => {
  patternTolerance.value = Math.max(0, Math.min(1, Number(Number(patternTolerance.value || 0.18).toFixed(2))))
  scheduleBoardConfigSave()
  refreshPatternMatches()
  updateCustomIndicator()
}
const normalizePatternScanBarCount = () => {
  patternScanBarCount.value = Math.max(120, Math.round(Number(patternScanBarCount.value) || 200))
  scheduleBoardConfigSave()
}
const locateLatestPatternMatch = () => {
  const latest = patternMatchResults.value.at(-1)
  if (!latest || !chart) return
  const targetIndex = bars.value.findIndex(bar => Number(bar.time) === Number(latest.time))
  if (targetIndex < 0) return
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, targetIndex - 20), to: Math.min(bars.value.length - 1, targetIndex + 20) })
}
const timeframeLabelFor = value => timeframes.find(item => item.value === value)?.label || value
const scanSymbols = async (scanList, label, excludeCurrent = true) => {
  patternScanning.value = true
  patternScanStatus.value = `正在扫描${label}和周期…`
  patternScanResults.value = []
  try {
    const { data } = await axios.post(`${API}/scan-patterns`, { currentSymbol: symbol.value, symbols: scanList, timeframes: ['M1', 'M5', 'M15', 'H1'], scanCount: patternScanBarCount.value, excludeCurrent })
    const results = []
    ;(data.datasets || []).forEach(dataset => {
      const matches = []
      const sourceBars = dataset.bars || []
      patternTemplates.value.filter(template => template.enabled !== false).forEach(template => {
        const candidates = [template, createInversePatternTemplate(template)]
        candidates.forEach(candidate => {
          for (let index = 0; index <= sourceBars.length - candidate.bars.length; index += 1) {
            const sample = sourceBars.slice(index, index + candidate.bars.length).map((bar, offset) => ({ ...bar, index: index + offset }))
            if (patternMatches(sample, candidate, sourceBars)) matches.push({ time: sample.at(-1).time, name: candidate.name })
          }
        })
      })
      if (matches.length) results.push({ symbol: dataset.symbol, timeframe: dataset.timeframe, count: matches.length, latestTime: matches.at(-1).time })
    })
    patternScanResults.value = results
    patternScanStatus.value = results.length ? `扫描完成，发现 ${results.length} 个品种周期` : '扫描完成，未发现符合结构'
  } catch (error) { patternScanStatus.value = error?.response?.data?.message || error.message || '扫描失败' }
  finally { patternScanning.value = false }
}
const scanFavoriteSymbols = () => scanSymbols(favoriteSymbols.value, '自选品种', false)
const scanOtherSymbols = () => scanSymbols(symbols.value.map(item => item.name).filter(name => !favoriteSymbols.value.includes(name)), '其他品种')
const openScannedPattern = async item => {
  symbol.value = item.symbol
  timeframe.value = item.timeframe
  await loadBars()
  await nextTick()
  const targetIndex = bars.value.findIndex(bar => Number(bar.time) === Number(item.latestTime))
  if (targetIndex >= 0 && chart) chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, targetIndex - 20), to: Math.min(bars.value.length - 1, targetIndex + 20) })
}
const patternTrendLabel = value => value === 'up' ? '上涨' : value === 'down' ? '下跌' : '不限制'
const hasRawPatternBars = template => Array.isArray(template.editorBars) && template.editorBars.length > 0 && template.editorBars.every(item => ['open', 'high', 'low', 'close'].every(key => Number.isFinite(Number(item[key]))))
const patternPreviewBars = template => {
  if (hasRawPatternBars(template)) {
    return template.editorBars.map((bar, index) => ({ time: bar.time || `preview-${index}`, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close) }))
  }
  return (Array.isArray(template.bars) ? template.bars : []).map((bar, index) => normalizedPatternToEditorBar(bar, index))
}
const normalizedPatternToEditorBar = (bar, index = 0) => {
  const low = 100 + index * 0.01
  const bodyRatio = Math.max(0, Number(bar.bodyRatio) || 0)
  const upperWickRatio = Math.max(0, Number(bar.upperWickRatio) || 0)
  const lowerWickRatio = Math.max(0, Number(bar.lowerWickRatio) || 0)
  const closePosition = Math.min(1, Math.max(0, Number(bar.closePosition) || 0.5))
  const range = 10
  const close = low + closePosition * range
  const open = bar.direction === 'bullish' ? close - bodyRatio * range : close + bodyRatio * range
  const high = Math.max(open, close) + upperWickRatio * range
  const actualLow = Math.min(open, close) - lowerWickRatio * range
  return { time: `preview-${index}`, open, high, low: actualLow, close }
}
const patternPreviewX = (index, count) => {
  if (count <= 1) return 150
  const gap = Math.min(34, 140 / (count - 1))
  return 150 - gap * (count - 1) / 2 + index * gap
}
const getPatternPriceBounds = items => {
  const prices = items.flatMap(item => [Number(item.high), Number(item.low)]).filter(Number.isFinite)
  if (!prices.length) return { max: 1, min: 0 }
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  const padding = Math.max((max - min) * 0.08, Math.abs(max || min) * 0.001, 0.00000001)
  return { max: max + padding, min: min - padding }
}
const patternPreviewY = (value, template) => {
  const { max, min } = getPatternPriceBounds(patternPreviewBars(template))
  return 12 + (max - Number(value)) / Math.max(0.00000001, max - min) * 112
}
const patternBarCount = template => hasRawPatternBars(template) ? template.editorBars.length : (Array.isArray(template.bars) ? template.bars.length : 0)
const openPatternLibrary = () => {
  patternLibraryPage.value = 1
  patternLibraryDialog.value = true
}
const openPatternTemplateEditor = async template => {
  editingPatternTemplateId.value = template.id
  patternRecording.value = true
  patternDraft.value = { name: template.name || '', inverseName: template.inverseName || '', beforeTrend: template.beforeTrend || 'any', afterTrend: template.afterTrend || 'any', trendBars: Number.isFinite(Number(template.trendBars)) ? Math.max(0, Number(template.trendBars)) : 8 }
  patternBars.value = patternPreviewBars(template).map((item, index) => ({ ...item, time: item.time || `stored-${template.id}-${index}` }))
  resetPatternDragBounds()
  patternDialog.value = true
  await nextTick()
  redrawPatternCanvases()
}
const togglePatternTemplate = async template => {
  try {
    const { data } = await axios.put(`${BOARD_PATTERNS_API}/${encodeURIComponent(template.id)}`, template)
    const index = patternTemplates.value.findIndex(item => item.id === template.id)
    if (index >= 0) patternTemplates.value[index] = data.data
    scheduleBoardConfigSave()
    updateCustomIndicator()
  } catch (error) { template.enabled = !template.enabled; showError(error) }
}
const deletePatternTemplate = async template => {
  if (!window.confirm(`确定删除结构“${template.name}”吗？`)) return
  try {
    await axios.delete(`${BOARD_PATTERNS_API}/${encodeURIComponent(template.id)}`)
    patternTemplates.value = patternTemplates.value.filter(item => item.id !== template.id)
    const maxPage = Math.max(1, Math.ceil(patternTemplates.value.length / 6))
    patternLibraryPage.value = Math.min(patternLibraryPage.value, maxPage)
    scheduleBoardConfigSave()
    updateCustomIndicator()
  } catch (error) { showError(error) }
}
const getPatternBarLayout = (width, count) => {
  if (count <= 1) return { start: width / 2, gap: 0 }
  const gap = Math.min(36, Math.max(24, (width - 160) / (count - 1)))
  return { start: (width - gap * (count - 1)) / 2, gap }
}
const getReversePatternBars = items => {
  if (!items.length) return []
  const patternHigh = Math.max(...items.map(bar => Number(bar.high)))
  const patternLow = Math.min(...items.map(bar => Number(bar.low)))
  const mirrorAxis = patternHigh + patternLow
  return items.map(bar => ({
    time: `${bar.time}-reverse`,
    open: mirrorAxis - Number(bar.open),
    close: mirrorAxis - Number(bar.close),
    high: mirrorAxis - Number(bar.low),
    low: mirrorAxis - Number(bar.high)
  }))
}
const redrawPatternCanvas = (target = patternCanvas.value, sourceBars = patternBars.value, boundsOverride = null) => {
  const canvas = target
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const pixelWidth = Math.max(1, Math.round(rect.width * ratio))
  const pixelHeight = Math.max(1, Math.round(rect.height * ratio))
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const width = rect.width
  const height = rect.height
  const isEditableCanvas = target === patternCanvas.value
  const displayBars = sourceBars
  const baseBounds = getPatternPriceBounds(displayBars)
  const bounds = boundsOverride || (isEditableCanvas && patternDragBounds.value
    ? patternDragBounds.value
    : (() => {
        const baseSpan = baseBounds.max - baseBounds.min
        const referenceHeight = 360
        const scale = Math.max(1, height / referenceHeight)
        const extra = (baseSpan * (scale - 1)) / 2
        return { max: baseBounds.max + extra, min: baseBounds.min - extra }
      })())
  const { max, min } = bounds
  const span = Math.max(0.00000001, max - min)
  const priceToY = price => 18 + (max - price) / span * (height - 36)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#0f172a'; context.fillRect(0, 0, width, height)
  context.strokeStyle = '#263246'; context.lineWidth = 1
  for (let row = 1; row < 5; row += 1) { const y = row * height / 5; context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke() }
  const layout = getPatternBarLayout(width, displayBars.length)
  displayBars.forEach((item, index) => {
    const x = layout.start + index * layout.gap
    const openY = priceToY(item.open); const closeY = priceToY(item.close); const highY = priceToY(item.high); const lowY = priceToY(item.low)
    const color = item.close >= item.open ? '#26a69a' : '#ef5350'
    context.strokeStyle = color; context.lineWidth = 2; context.beginPath(); context.moveTo(x, highY); context.lineTo(x, lowY); context.stroke()
    context.fillStyle = color; context.fillRect(x - 9, Math.min(openY, closeY), 18, Math.max(4, Math.abs(closeY - openY)))
    context.fillStyle = '#94a3b8'; context.font = '11px sans-serif'; context.textAlign = 'center'; context.fillText(String(index + 1), x, height - 8)
  })
}
let patternRedrawFrame = 0
let patternDragRedrawFrame = 0
const redrawPatternCanvases = () => {
  if (patternRedrawFrame) return
  patternRedrawFrame = requestAnimationFrame(() => {
    patternRedrawFrame = 0
    const sourceBars = patternBars.value
    const reverseBars = getReversePatternBars(sourceBars)
    const editorHeight = patternCanvas.value?.getBoundingClientRect().height || 460
    const sourceBounds = getPatternCanvasBounds(sourceBars, editorHeight, patternDragBounds.value)
    const rotationAxis = sourceBars.length
      ? Math.max(...sourceBars.map(bar => Number(bar.high))) + Math.min(...sourceBars.map(bar => Number(bar.low)))
      : 0
    const reverseBounds = {
      max: rotationAxis - sourceBounds.min,
      min: rotationAxis - sourceBounds.max
    }
    redrawPatternCanvas(patternCanvas.value, sourceBars, sourceBounds)
    redrawPatternCanvas(reversePatternCanvas.value, reverseBars, reverseBounds)
  })
}
const redrawPatternDragCanvas = () => {
  if (patternDragRedrawFrame) return
  patternDragRedrawFrame = requestAnimationFrame(() => {
    patternDragRedrawFrame = 0
    redrawPatternCanvas(patternCanvas.value, patternBars.value)
  })
}
const patternEditorPoint = event => { const rect = patternCanvas.value?.getBoundingClientRect(); return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null }
const getPatternCanvasBounds = (items, height, dragBounds = null) => {
  if (dragBounds) return dragBounds
  const baseBounds = getPatternPriceBounds(items)
  const baseSpan = baseBounds.max - baseBounds.min
  const scale = Math.max(1, height / 360)
  const extra = (baseSpan * (scale - 1)) / 2
  return { max: baseBounds.max + extra, min: baseBounds.min - extra }
}
const patternEditorMetrics = () => {
  const rect = patternCanvas.value.getBoundingClientRect()
  const bounds = getPatternCanvasBounds(patternBars.value, rect.height, patternDragBounds.value)
  const { max, min } = bounds
  return { rect, max, min, span: Math.max(0.00000001, max - min) }
}
const beginPatternCandleDrag = event => {
  const point = patternEditorPoint(event)
  if (!point || !patternBars.value.length) return
  const { rect, max, min, span } = patternEditorMetrics()
  const layout = getPatternBarLayout(rect.width, patternBars.value.length)
  const distancesToBars = patternBars.value.map((item, index) => ({ index, distance: Math.abs(point.x - (layout.start + index * layout.gap)) }))
  const nearest = distancesToBars.reduce((best, current) => current.distance < best.distance ? current : best)
  if (nearest.distance > Math.max(14, layout.gap * 0.45)) return
  const index = nearest.index
  const item = patternBars.value[index]
  const toY = value => 18 + (max - value) / span * (rect.height - 36)
  const distances = [['open', Math.abs(point.y - toY(item.open))], ['close', Math.abs(point.y - toY(item.close))], ['high', Math.abs(point.y - toY(item.high))], ['low', Math.abs(point.y - toY(item.low))]]
  const nearestHandle = distances.sort((a, b) => a[1] - b[1])[0]
  if (nearestHandle[1] > 18) return
  const handle = nearestHandle[0]
  patternDragBounds.value = { max, min }
  patternStroke.value = { index, handle, pointerId: event.pointerId }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}
const continuePatternCandleDrag = event => {
  if (!patternStroke.value) return
  const point = patternEditorPoint(event)
  const { rect, max, min, span } = patternEditorMetrics()
  const rawValue = max - ((point.y - 18) / Math.max(1, rect.height - 36)) * span
  const item = patternBars.value[patternStroke.value.index]
  item[patternStroke.value.handle] = Number(rawValue.toFixed(5))
  normalizePatternEditorBar(item, false)
  redrawPatternDragCanvas()
}
const finishPatternCandleDrag = event => {
  if (!patternStroke.value) return
  const { max, min } = patternDragBounds.value || getPatternPriceBounds(patternBars.value)
  const values = patternBars.value.flatMap(item => [item.high, item.low]).map(Number).filter(Number.isFinite)
  const valueMax = Math.max(...values)
  const valueMin = Math.min(...values)
  const span = Math.max(0.00000001, max - min)
  patternDragBounds.value = {
    max: Math.max(max, valueMax + span * 0.08),
    min: Math.min(min, valueMin - span * 0.08)
  }
  const pointerId = patternStroke.value.pointerId
  patternStroke.value = null
  event?.currentTarget?.releasePointerCapture?.(pointerId)
  redrawPatternCanvases()
}
const normalizePatternEditorBar = (item, redraw = true) => {
  item.open = Number.isFinite(Number(item.open)) ? Number(item.open) : 0
  item.close = Number.isFinite(Number(item.close)) ? Number(item.close) : 0
  item.high = Math.max(Number.isFinite(Number(item.high)) ? Number(item.high) : 0, item.open, item.close)
  item.low = Math.min(Number.isFinite(Number(item.low)) ? Number(item.low) : 0, item.open, item.close)
  if (redraw) {
    resetPatternDragBounds()
    redrawPatternCanvases()
  }
}
const createPatternBar = (index, center = 100) => {
  const base = Number.isFinite(Number(center)) ? Number(center) : 100
  return { time: `draft-${Date.now()}-${index}`, open: base - 0.08, high: base + 0.2, low: base - 0.2, close: base + 0.08 }
}
const addPatternBar = () => {
  const canvasHeight = patternCanvas.value?.getBoundingClientRect().height || 460
  const currentBounds = patternBars.value.length
    ? getPatternCanvasBounds(patternBars.value, canvasHeight, patternDragBounds.value)
    : null
  const center = patternBars.value.length ? Number(patternBars.value.at(-1).close) : 100
  patternBars.value.push(createPatternBar(patternBars.value.length, center))
  if (currentBounds) patternDragBounds.value = currentBounds
  redrawPatternCanvases()
}
const removePatternBar = () => { if (patternBars.value.length > 1) patternBars.value.pop(); resetPatternDragBounds(); redrawPatternCanvases() }
const resetPatternBars = () => { patternBars.value = [createPatternBar(0), createPatternBar(1)]; resetPatternDragBounds(); redrawPatternCanvases() }
const startPatternRecording = async () => { editingPatternTemplateId.value = null; patternDraft.value = { name: '', inverseName: '', beforeTrend: 'any', afterTrend: 'any', trendBars: 8 }; patternRecording.value = true; patternDialog.value = true; resetPatternBars(); await nextTick(); redrawPatternCanvases() }
const savePatternTemplate = async () => {
  const name = String(patternDraft.value.name || '').trim()
  if (!name) return ElMessage.warning('请填写结构名称')
  if (!patternBars.value.length) return ElMessage.warning('请至少保留一根 K 线')
  const editorBars = patternBars.value.map(item => ({ time: item.time, open: Number(item.open), high: Number(item.high), low: Number(item.low), close: Number(item.close) }))
  const invalidBar = editorBars.find(item => ![item.open, item.high, item.low, item.close].every(Number.isFinite) || item.high < Math.max(item.open, item.close) || item.low > Math.min(item.open, item.close) || item.high <= item.low)
  if (invalidBar) return ElMessage.warning('K 线价格数据无效，请检查开盘、最高、最低和收盘价')
  const existingTemplate = patternTemplates.value.find(item => item.id === editingPatternTemplateId.value)
  const payload = { name, inverseName: String(patternDraft.value.inverseName || '').trim(), beforeTrend: patternDraft.value.beforeTrend, afterTrend: patternDraft.value.afterTrend, trendBars: Number.isFinite(Number(patternDraft.value.trendBars)) ? Math.max(0, Number(patternDraft.value.trendBars)) : 8, bars: editorBars.map(normalizePatternBar), editorBars, relationships: buildPatternRelationships(editorBars), enabled: existingTemplate ? existingTemplate.enabled !== false : true }
  patternSaving.value = true
  try {
    const request = editingPatternTemplateId.value ? axios.put(`${BOARD_PATTERNS_API}/${encodeURIComponent(editingPatternTemplateId.value)}`, payload) : axios.post(BOARD_PATTERNS_API, payload)
    const { data } = await request
    if (!data?.data?.id) throw new Error('服务端未返回已保存的结构')
    const index = patternTemplates.value.findIndex(item => item.id === data.data.id)
    if (index >= 0) patternTemplates.value[index] = data.data
    else patternTemplates.value.push(data.data)
    editingPatternTemplateId.value = null
    patternDialog.value = false
    patternRecording.value = false
    patternLibraryPage.value = Math.max(1, Math.ceil(patternTemplates.value.length / 6))
    scheduleBoardConfigSave()
    updateCustomIndicator()
    ElMessage.success('K 线结构已保存')
  } catch (error) {
    showError(error)
    ElMessage.error(error?.response?.data?.message || error?.message || 'K 线结构保存失败')
  } finally {
    patternSaving.value = false
  }
}
const ICT_ANALYSIS_BAR_LIMIT = 240
const ICT_STRUCTURE_RESULT_LIMIT = 24
const ICT_LIQUIDITY_RESULT_LIMIT = 24
const updateCustomIndicator = () => {
  if (!chart || !bars.value.length) return
  const activeIndicators = customIndicatorSaved.value
  const markers = calculatePatternMarkers()
  if (ictVisible.value) {
    const ict = detectIctAnalysis(bars.value.slice(-ICT_ANALYSIS_BAR_LIMIT))
    ict.structure.slice(-ICT_STRUCTURE_RESULT_LIMIT).forEach(item => markers.push({ time: item.time, position: item.direction === 'bullish' ? 'belowBar' : 'aboveBar', color: item.type === 'CHOCH' ? '#c084fc' : '#38bdf8', shape: item.direction === 'bullish' ? 'arrowUp' : 'arrowDown', text: item.type }))
    ict.liquidity.filter(item => item.swept).slice(-ICT_LIQUIDITY_RESULT_LIMIT).forEach(item => markers.push({ time: item.time, position: 'aboveBar', color: '#fbbf24', shape: 'circle', text: `${item.type}扫损` }))
  }
  customDivergenceSeries.forEach(series => chart?.removeSeries(series))
  customDivergenceSeries = []
  activeIndicators.forEach(active => {
    const isBarCount = /(?:study|indicator)\s*\(\s*["']bar\s*count["']/i.test(active.code)
    const result = isBarCount ? { markers: calculateBarCountMarkers(bars.value, active.settings), lines: { bull: [], bear: [] } } : calculateCustomDivergence(bars.value, active.settings)
    markers.push(...result.markers)
    if (isBarCount || !active.settings?.showDivergenceLines) return
    const createDivergenceLine = (data, color) => {
      if (data.length < 2) return
      const series = chart?.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
      series?.setData(data)
      if (series) customDivergenceSeries.push(series)
    }
    result.lines.bull.forEach(line => createDivergenceLine(line, active.settings.bullColor || '#00c853'))
    result.lines.bear.forEach(line => createDivergenceLine(line, active.settings.bearColor || '#f23645'))
  })
  customMarkers?.setMarkers(markers.sort((left, right) => Number(left.time) - Number(right.time)))
}
const calculateAverageRange = items => items.length ? items.reduce((sum, item) => sum + Math.max(0, Number(item.high) - Number(item.low)), 0) / items.length : 0
const detectIctSwings = (items, length = 3) => {
  const span = Math.max(1, Number(length) || 3)
  const highs = []
  const lows = []
  for (let index = span; index < items.length - span; index += 1) {
    const current = items[index]
    const left = items.slice(index - span, index)
    const right = items.slice(index + 1, index + span + 1)
    if (left.every(item => Number(current.high) > Number(item.high)) && right.every(item => Number(current.high) >= Number(item.high))) highs.push({ index, time: current.time, price: Number(current.high), type: 'high' })
    if (left.every(item => Number(current.low) < Number(item.low)) && right.every(item => Number(current.low) <= Number(item.low))) lows.push({ index, time: current.time, price: Number(current.low), type: 'low' })
  }
  return { highs, lows, all: [...highs, ...lows].sort((left, right) => left.index - right.index) }
}
const detectIctAnalysis = (items, swingLength = 3) => {
  if (items.length < swingLength * 2 + 5) return { swings: { highs: [], lows: [], all: [] }, structure: [], liquidity: [], zones: [], premiumDiscount: null, summary: ['K线数量不足，暂不能确认 ICT/SMC 结构'] }
  const swings = detectIctSwings(items, swingLength)
  const averageRange = calculateAverageRange(items.slice(-50))
  const tolerance = Math.max(averageRange * 0.12, 0.00001)
  const structure = []
  let trend = 'neutral'
  const broken = new Set()
  items.forEach((bar, index) => {
    const priorHigh = [...swings.highs].reverse().find(item => item.index < index && !broken.has(`high:${item.index}`))
    const priorLow = [...swings.lows].reverse().find(item => item.index < index && !broken.has(`low:${item.index}`))
    if (priorHigh && Number(bar.close) > priorHigh.price) {
      const type = trend === 'bearish' ? 'CHOCH' : 'BOS'
      structure.push({ time: bar.time, index, type, direction: 'bullish', price: priorHigh.price, note: `${type} 向上突破 ${priorHigh.price}` })
      trend = 'bullish'; broken.add(`high:${priorHigh.index}`)
    } else if (priorLow && Number(bar.close) < priorLow.price) {
      const type = trend === 'bullish' ? 'CHOCH' : 'BOS'
      structure.push({ time: bar.time, index, type, direction: 'bearish', price: priorLow.price, note: `${type} 向下突破 ${priorLow.price}` })
      trend = 'bearish'; broken.add(`low:${priorLow.index}`)
    }
  })
  const liquidity = []
  const addLiquidity = (source, label) => source.forEach((item, index) => source.slice(index + 1).forEach(other => {
    if (Math.abs(item.price - other.price) <= tolerance) liquidity.push({ type: label, price: Number(((item.price + other.price) / 2).toFixed(5)), time: other.time, swept: items.some((bar, barIndex) => barIndex > other.index && (label === '等高' ? Number(bar.high) > other.price && Number(bar.close) < other.price : Number(bar.low) < other.price && Number(bar.close) > other.price)) })
  }))
  addLiquidity(swings.highs.slice(-16), '等高'); addLiquidity(swings.lows.slice(-16), '等低')
  const recentHigh = swings.highs.at(-1)?.price
  const recentLow = swings.lows.at(-1)?.price
  const midpoint = recentHigh != null && recentLow != null ? (recentHigh + recentLow) / 2 : null
  const currentPrice = Number(items.at(-1).close)
  const zones = []
  for (let index = 2; index < items.length; index += 1) {
    const first = items[index - 2]; const third = items[index]
    if (Number(third.low) > Number(first.high)) zones.push({ type: '多头FVG', upper: Number(third.low), lower: Number(first.high), time: third.time, filled: items.slice(index + 1).some(item => Number(item.low) <= Number(first.high)) })
    if (Number(third.high) < Number(first.low)) zones.push({ type: '空头FVG', upper: Number(first.low), lower: Number(third.high), time: third.time, filled: items.slice(index + 1).some(item => Number(item.high) >= Number(first.low)) })
  }
  structure.slice(-24).forEach(event => {
    const source = items.slice(Math.max(0, event.index - 5), event.index).reverse().find(item => event.direction === 'bullish' ? Number(item.close) < Number(item.open) : Number(item.close) > Number(item.open))
    if (source) zones.push({ type: event.direction === 'bullish' ? '多头OB' : '空头OB', upper: Number(source.high), lower: Number(source.low), time: source.time, filled: items.slice(event.index + 1).some(item => Number(item.close) < Number(source.low) || Number(item.close) > Number(source.high)) })
  })
  const latestStructure = structure.at(-1)
  return {
    swings,
    structure: structure.slice(-24),
    liquidity: liquidity.slice(-24),
    zones: zones.filter(item => !item.filled).slice(-24),
    premiumDiscount: midpoint == null ? null : { high: recentHigh, low: recentLow, midpoint, currentPrice, zone: currentPrice >= midpoint ? 'premium' : 'discount' },
    summary: [latestStructure ? `最近结构：${latestStructure.type} ${latestStructure.direction === 'bullish' ? '向上' : '向下'}` : '暂未确认新的 BOS/CHOCH', midpoint == null ? '关键摆动区间不足' : `当前处于${currentPrice >= midpoint ? '溢价区' : '折价区'}`, zones.filter(item => !item.filled).length ? `存在 ${zones.filter(item => !item.filled).length} 个未失效 FVG/OB 区域` : '暂未发现未失效 FVG/OB 区域']
  }
}
const calculateMacd = (items, fast = 12, slow = 26, signal = 9) => {
  const fastValues = calculateEma(items, fast)
  const slowValues = calculateEma(items, slow)
  const macd = items.map((item, index) => ({ time: item.time, value: fastValues[index].value - slowValues[index].value }))
  const signalValues = calculateEma(macd.map(item => ({ ...item, close: item.value })), signal)
  return { macd, signal: signalValues, histogram: macd.map((item, index) => ({ time: item.time, value: item.value - signalValues[index].value })) }
}
const updateIndicators = () => {
  emaConfigs.value.forEach(item => {
    const series = emaSeriesMap.get(item.id)
    series?.setData(calculateEma(bars.value, Number(item.period)))
    series?.applyOptions({ visible: item.visible, color: item.color })
  })
  const bands = calculateBollinger(bars.value)
  bollingerSeries[0]?.setData(bands.map(item => ({ time: item.time, value: item.middle })))
  bollingerSeries[1]?.setData(bands.map(item => ({ time: item.time, value: item.upper })))
  bollingerSeries[2]?.setData(bands.map(item => ({ time: item.time, value: item.lower })))
  const macd = calculateMacd(bars.value)
  macdLine?.setData(macd.macd)
  macdSignalLine?.setData(macd.signal)
  macdHistogram?.setData(macd.histogram.map(item => ({ ...item, color: item.value >= 0 ? '#26a69a' : '#ef5350' })))
  updateCustomIndicator()
}
const normalizeEmaPeriod = id => {
  const item = emaConfigs.value.find(value => value.id === id)
  if (!item) return
  const usedPeriods = new Set(emaConfigs.value.filter(value => value.id !== id).map(value => Number(value.period)))
  let period = Math.max(1, Math.min(500, Number(item.period) || 1))
  while (usedPeriods.has(period) && period < 500) period += 1
  item.period = period
}
const addEma = () => {
  const usedPeriods = new Set(emaConfigs.value.map(item => Number(item.period)))
  let nextPeriod = 5
  while (usedPeriods.has(nextPeriod) && nextPeriod < 500) nextPeriod += 5
  if (usedPeriods.has(nextPeriod)) return
  emaConfigs.value.push({ id: nextEmaId++, period: nextPeriod, color: emaColors[emaConfigs.value.length % emaColors.length], visible: true })
  createChartInstance().then(() => { candleSeries?.setData(bars.value.map(item => ({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close }))); updateIndicators() })
}
const removeEma = id => { emaConfigs.value = emaConfigs.value.filter(item => item.id !== id); createChartInstance().then(() => { candleSeries?.setData(bars.value.map(item => ({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close }))); updateIndicators() }) }
const createMacdChart = async () => {
  await nextTick()
  if (!macdEl.value) return
  macdChart?.remove()
  macdChart = createChart(macdEl.value, { layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#94a3b8' }, grid: { vertLines: { color: '#202938' }, horzLines: { color: '#202938' } }, rightPriceScale: { borderColor: '#334155' }, timeScale: { visible: false } })
  macdLine = macdChart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
  macdSignalLine = macdChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
  macdHistogram = macdChart.addSeries(HistogramSeries, { priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }, lastValueVisible: false, priceLineVisible: false })
  requestAnimationFrame(() => {
    if (!macdChart || !macdEl.value) return
    macdChart.resize(Math.max(1, macdEl.value.clientWidth), Math.max(1, macdEl.value.clientHeight))
  })
  updateIndicators()
  if (chart) {
    const range = chart.timeScale().getVisibleLogicalRange()
    if (range) macdChart.timeScale().setVisibleLogicalRange(range)
    macdChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range && chart && !syncingTimeScale) {
        syncingTimeScale = true
        chart.timeScale().setVisibleLogicalRange(range)
        syncingTimeScale = false
      }
    })
  }
}
const saveIndicatorPreferences = () => { scheduleBoardConfigSave() }
watch(emaConfigs, () => { saveIndicatorPreferences(); updateIndicators() }, { deep: true })
watch(customIndicators, () => { scheduleBoardConfigSave(); updateCustomIndicator() }, { deep: true })
watch(bollingerVisible, visible => { saveIndicatorPreferences(); bollingerSeries.forEach(series => series.applyOptions({ visible })) })
watch(ictVisible, () => { saveIndicatorPreferences(); updateCustomIndicator() })
watch(macdVisible, async visible => { saveIndicatorPreferences(); if (visible) await createMacdChart(); else { macdChart?.remove(); macdChart = null; macdLine = null; macdSignalLine = null; macdHistogram = null } })
const getBoardConfig = () => ({
  preferences: { emaConfigs: emaConfigs.value, bollingerVisible: bollingerVisible.value, macdVisible: macdVisible.value, ictVisible: ictVisible.value, favoriteSymbols: favoriteSymbols.value, refreshIntervalSeconds: refreshIntervalSeconds.value, patternTolerance: patternTolerance.value, patternScanBarCount: patternScanBarCount.value },
  customIndicators: customIndicators.value,
  patternTemplates: patternTemplates.value
})
const saveBoardConfig = async configOverride => {
  if (!boardConfigLoaded.value) return false
  try {
    await axios.put(BOARD_CONFIG_API, configOverride || getBoardConfig())
    return true
  } catch (error) { showError(error); return false }
}
const scheduleBoardConfigSave = () => {
  if (!boardConfigLoaded.value) return
  clearTimeout(boardConfigSaveTimer)
  boardConfigSaveTimer = window.setTimeout(saveBoardConfig, 350)
}
const readLegacyBoardConfig = () => {
  const parse = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
  }
  const preferences = parse('forge-indicator-preferences')
  const customIndicators = parse('forge-custom-indicators') || parse('forge-custom-indicator')
  const patternTemplates = parse('forge-pattern-templates')
  return { preferences, customIndicators: Array.isArray(customIndicators) ? customIndicators : customIndicators ? [customIndicators] : null, patternTemplates }
}
const loadBoardConfig = async () => {
  try {
    const { data } = await axios.get(BOARD_CONFIG_API)
    const config = data.data || {}
    const legacy = readLegacyBoardConfig()
    let needsMigration = (!Array.isArray(config.customIndicators) || config.customIndicators.length === 0) && Boolean(legacy.customIndicators?.length)
    if (config.preferences) {
      if (Array.isArray(config.preferences.emaConfigs)) { emaConfigs.value = config.preferences.emaConfigs; nextEmaId = Math.max(0, ...emaConfigs.value.map(item => Number(item.id) || 0)) + 1 }
      if (typeof config.preferences.bollingerVisible === 'boolean') bollingerVisible.value = config.preferences.bollingerVisible
      if (typeof config.preferences.macdVisible === 'boolean') macdVisible.value = config.preferences.macdVisible
      if (typeof config.preferences.ictVisible === 'boolean') ictVisible.value = config.preferences.ictVisible
      if (Array.isArray(config.preferences.favoriteSymbols)) favoriteSymbols.value = config.preferences.favoriteSymbols
      if (Number.isFinite(Number(config.preferences.refreshIntervalSeconds))) refreshIntervalSeconds.value = Math.max(1, Math.min(5, Number(Number(config.preferences.refreshIntervalSeconds).toFixed(1))))
      if (Number.isFinite(Number(config.preferences.patternTolerance))) patternTolerance.value = Math.max(0, Math.min(1, Number(Number(config.preferences.patternTolerance).toFixed(2))))
      if (Number.isFinite(Number(config.preferences.patternScanBarCount))) patternScanBarCount.value = Math.max(120, Math.round(Number(config.preferences.patternScanBarCount)))
    }
    if (Array.isArray(config.customIndicators) && config.customIndicators.length) customIndicators.value = config.customIndicators
    else if (legacy.customIndicators?.length) customIndicators.value = legacy.customIndicators
    else if (Array.isArray(config.customIndicators)) customIndicators.value = config.customIndicators
    const hasBarCount = customIndicators.value.some(item => item.builtin || String(item.name || '').trim().toLowerCase() === 'bar count' || /(?:study|indicator)\s*\(\s*["']bar\s*count["']/i.test(item.code || ''))
    if (!hasBarCount) {
      customIndicators.value.unshift(defaultBarCountIndicator())
      needsMigration = true
    }
    try {
      const { data: patternData } = await axios.get(BOARD_PATTERNS_API)
      if (Array.isArray(patternData.data)) patternTemplates.value = patternData.data
    } catch {
      if (Array.isArray(config.patternTemplates) && config.patternTemplates.length) patternTemplates.value = config.patternTemplates
      else if (legacy.patternTemplates?.length) patternTemplates.value = legacy.patternTemplates
      else if (Array.isArray(config.patternTemplates)) patternTemplates.value = config.patternTemplates
    }
    if (!config.preferences && legacy.preferences) {
      const preferences = legacy.preferences
      if (Array.isArray(preferences.emaConfigs)) { emaConfigs.value = preferences.emaConfigs; nextEmaId = Math.max(0, ...emaConfigs.value.map(item => Number(item.id) || 0)) + 1 }
      if (typeof preferences.bollingerVisible === 'boolean') bollingerVisible.value = preferences.bollingerVisible
      if (typeof preferences.macdVisible === 'boolean') macdVisible.value = preferences.macdVisible
    }
    boardConfigLoaded.value = true
    if (needsMigration || (!config.preferences && legacy.preferences) || (config.patternTemplates == null && legacy.patternTemplates?.length)) await saveBoardConfig()
  } catch (error) { boardConfigLoaded.value = true; showError(error) }
}
const loadAiPresets = async () => {
  aiPresetsLoading.value = true
  try {
    const { data } = await axios.get(AI_PRESETS_API)
    aiPresets.value = data.data || []
    let savedId = ''
    try { savedId = localStorage.getItem(AI_SELECTED_PRESET_KEY) || '' } catch {}
    const selected = aiPresets.value.find(item => item.id === savedId) || aiPresets.value.find(item => item.id === aiConfigDraftPreset.value) || aiPresets.value.find(item => item.apiBase && item.apiKey && item.model) || aiPresets.value[0]
    if (selected) { aiPreset.value = selected; aiConfigDraftPreset.value = selected.id }
  } catch (error) { aiError.value = error?.response?.data?.message || 'AI API 预设读取失败' } finally { aiPresetsLoading.value = false }
}
const applyAiPreset = id => {
  const preset = aiPresets.value.find(item => item.id === id)
  if (!preset) return
  aiPreset.value = preset
  aiConfigDraft.value = { name: preset.name || '', apiBase: preset.apiBase || '', apiMethod: preset.apiMethod || 'responses', apiKey: preset.apiKey || '', model: preset.model || '' }
}
const selectAiPreset = preset => { if (preset) { aiPreset.value = preset; aiConfigDraftPreset.value = preset.id; try { localStorage.setItem(AI_SELECTED_PRESET_KEY, preset.id) } catch {} } }
const createAiPreset = () => {
  aiConfigDraftPreset.value = ''
  aiConfigDraft.value = { name: '', apiBase: '', apiMethod: 'responses', apiKey: '', model: '' }
}
const deleteAiPreset = async () => {
  const preset = aiPresets.value.find(item => item.id === aiConfigDraftPreset.value)
  if (!preset) return
  try {
    if (!window.confirm(`确定删除预设“${preset.name}”吗？`)) return
    await axios.delete(`${AI_PRESETS_API}/${encodeURIComponent(preset.id)}`)
    try { localStorage.removeItem(AI_SELECTED_PRESET_KEY) } catch {}
    await loadAiPresets()
  } catch (error) { aiError.value = error?.response?.data?.message || 'AI API 预设删除失败' }
}
const openAiConfig = async () => {
  await loadAiPresets()
  const preset = aiPreset.value || aiPresets.value[0]
  if (preset) { aiConfigDraftPreset.value = preset.id; applyAiPreset(preset.id) } else createAiPreset()
  aiConfigVisible.value = true
}
const saveAiConfig = async () => {
  if (!aiConfigDraft.value.name.trim() || !aiConfigDraft.value.apiBase.trim() || !aiConfigDraft.value.apiKey.trim() || !aiConfigDraft.value.model.trim()) {
    aiError.value = '请完整填写预设名称、Base URL、API Key 和模型'
    return
  }
  try {
    const current = aiPresets.value.find(item => item.id === aiConfigDraftPreset.value)
    const payload = { ...aiConfigDraft.value, apiMethod: aiConfigDraft.value.apiMethod || 'responses', prompt: current?.prompt || '' }
    const { data } = current ? await axios.put(`${AI_PRESETS_API}/${encodeURIComponent(current.id)}`, payload) : await axios.post(AI_PRESETS_API, payload)
    await loadAiPresets()
    aiConfigDraftPreset.value = data.data.id
    applyAiPreset(data.data.id)
    try { localStorage.setItem(AI_SELECTED_PRESET_KEY, data.data.id) } catch {}
    aiConfigVisible.value = false
    aiError.value = ''
  } catch (error) { aiError.value = error?.response?.data?.message || 'AI API 预设保存失败' }
}
const loadAiModels = async () => {
  const draft = aiConfigDraft.value
  if (!draft.apiBase || !draft.apiKey) { aiError.value = '请先填写 Base URL 和 API Key'; return }
  aiModelsLoading.value = true
  try {
    const { data } = await axios.get('http://127.0.0.1:5888/api/video-notes/models', { params: { apiBase: draft.apiBase, apiMethod: draft.apiMethod || 'responses', apiKey: draft.apiKey } })
    aiModels.value = (data.data?.data || []).map(item => item.id).filter(Boolean)
  } catch (error) { aiError.value = error?.response?.data?.message || '模型列表获取失败' } finally { aiModelsLoading.value = false }
}
const summarizeAiTimeframe = (items, value) => {
  const latest = items.at(-1)
  if (!latest) return { timeframe: value, bars: 0 }
  const ema = emaConfigs.value.filter(item => item.visible).map(item => ({ period: Number(item.period), value: calculateEma(items, Number(item.period)).at(-1)?.value }))
  const macdSeries = calculateMacd(items)
  const ict = detectIctAnalysis(items)
  return { timeframe: value, bars: items.length, latestBar: latest, trend: latest.close > items[0].close ? 'up' : latest.close < items[0].close ? 'down' : 'flat', indicators: { ema, bollinger: calculateBollinger(items).at(-1), macd: { macd: macdSeries.macd.at(-1), signal: macdSeries.signal.at(-1), histogram: macdSeries.histogram.at(-1) }, ict: { structure: ict.structure, liquidity: ict.liquidity, zones: ict.zones, premiumDiscount: ict.premiumDiscount, summary: ict.summary } } }
}
const buildAiContext = async () => {
  const requestedTimeframes = [...new Set([timeframe.value, 'M15', 'H1', 'H4', 'D1'])]
  const timeframeData = await Promise.all(requestedTimeframes.map(async value => {
    if (value === timeframe.value) return summarizeAiTimeframe(bars.value.slice(-ICT_ANALYSIS_BAR_LIMIT), value)
    try {
      const { data } = await axios.get(`${API}/bars`, { params: { symbol: symbol.value, timeframe: value, count: ICT_ANALYSIS_BAR_LIMIT } })
      return summarizeAiTimeframe((data.bars || []).slice(-ICT_ANALYSIS_BAR_LIMIT), value)
    } catch { return { timeframe: value, bars: 0, error: '周期数据读取失败' } }
  }))
  const recentBars = bars.value.slice(-80)
  const latest = recentBars.at(-1)
  return {
    symbol: symbol.value,
    timeframe: timeframe.value,
    currentPrice: tick.value.bid || latest?.close,
    quote: { bid: tick.value.bid, ask: tick.value.ask, spread: spread.value },
    multiTimeframe: timeframeData,
    matchedPatterns: patternMatchResults.value.slice(-12).map(item => ({ name: item.text, time: item.time, inverse: item.inverse })),
    scanResults: patternScanResults.value,
    recentBars: recentBars.map(item => ({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume })),
    session: sessionStatusText.value
  }
}
const analyzeAiMarket = async () => {
  if (!aiReady.value || aiAnalyzing.value) return
  aiAnalyzing.value = true
  aiError.value = ''
  try {
    const { data } = await axios.post(AI_ANALYZE_API, { apiBase: aiPreset.value.apiBase, apiMethod: aiPreset.value.apiMethod || 'responses', apiKey: aiPreset.value.apiKey, model: aiPreset.value.model, context: await buildAiContext() })
    aiResult.value = data.data || null
  } catch (error) {
    aiError.value = error?.response?.data?.message || error.message || 'AI 分析失败'
  } finally { aiAnalyzing.value = false }
}
const loadSymbols = async () => {
  try { const { data } = await axios.get(`${API}/symbols`); if (data.symbols?.length) symbols.value = data.symbols; account.value = data.account || account.value } catch (error) { showError(error) }
}
const loadBars = async () => {
  loading.value = true
  try {
    const { data } = await axios.get(`${API}/bars`, { params: { symbol: symbol.value, timeframe: timeframe.value, count: 1500 } })
    bars.value = data.bars || []; account.value = data.account || account.value; connected.value = true
    hasMoreHistory = bars.value.length >= 1500
    await createChartInstance()
    candleSeries.setData(bars.value.map(item => ({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close })))
    updateIndicators()
    refreshPatternMatches()
    chart.timeScale().fitContent(); await refreshMarket()
  } catch (error) { connected.value = false; showError(error) } finally { loading.value = false }
}
const refreshMarket = async () => {
  try {
    const [{ data: tickData }, { data: barsData }] = await Promise.all([
      axios.get(`${API}/tick`, { params: { symbol: symbol.value } }),
      axios.get(`${API}/bars`, { params: { symbol: symbol.value, timeframe: timeframe.value, count: 2 } })
    ])
    tick.value = tickData.tick
    if (tickData.tick?.time) mt5ClockOffsetSeconds.value = Number(tickData.tick.time) - Math.floor(Date.now() / 1000)
    const latest = barsData.bars?.at(-1)
    if (latest && candleSeries) {
      candleSeries.update({ time: latest.time, open: latest.open, high: latest.high, low: latest.low, close: latest.close })
      if (bars.value.length && bars.value.at(-1).time === latest.time) bars.value[bars.value.length - 1] = latest
      updateIndicators()
      refreshPatternMatches()
      updateCountdown(latest.time)
    }
    if (priceLine && tick.value.bid) priceLine.applyOptions({ price: tick.value.bid })
    updatePriceOverlay()
    account.value = barsData.account || account.value
    connected.value = true
    updatedAt.value = new Date().toLocaleTimeString()
  } catch (error) { connected.value = false; showError(error) }
}

const updatePriceOverlay = () => {
  if (!chart || !candleSeries || !chartEl.value || !tick.value.bid) return
  const y = candleSeries.priceToCoordinate(tick.value.bid)
  if (y == null) { priceOverlayStyle.value = { display: 'none' }; return }
  priceOverlayStyle.value = { display: 'flex', top: `${Math.max(4, y - 14)}px` }
}
const getNextMonthClose = barTime => {
  const d = new Date(Math.floor(barTime) * 1000)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000
}
const updateCountdown = barTime => {
  if (['W1', 'MN1'].includes(timeframe.value)) return
  const nowSec = Math.floor(Date.now() / 1000) + mt5ClockOffsetSeconds.value
  const tf = timeframe.value
  const openTime = Math.floor(Number(barTime))
  let remaining
  if (tf === 'MN1') {
    remaining = getNextMonthClose(openTime) - nowSec
  } else {
    const period = timeframeSeconds.value
    const elapsed = nowSec - openTime
    const remainder = ((elapsed % period) + period) % period
    remaining = remainder === 0 ? period : period - remainder
  }
  countdownSeconds.value = Math.max(0, Math.min(remaining, tf === 'MN1' ? remaining : timeframeSeconds.value))
  updateSessionCountdown()
}
const getBeijingParts = date => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date)
  return Object.fromEntries(parts.filter(item => item.type !== 'literal').map(item => [item.type, Number.isNaN(Number(item.value)) ? item.value : Number(item.value)]))
}
const beijingDateAt = (parts, hour) => {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 8, 0, 0))
  return value
}
const getSessionWindow = now => {
  const parts = getBeijingParts(now)
  const currentMinutes = parts.hour * 60 + parts.minute + parts.second / 60
  const weekday = parts.weekday
  const base = beijingDateAt(parts, 0)
  if (weekday === 'Sat' || weekday === 'Sun') {
    const days = weekday === 'Sat' ? 2 : 1
    return { mode: 'closed', name: '休市', targetName: '亚盘', target: new Date(base.getTime() + days * 86400000) }
  }
  const intervals = marketSessions.flatMap(session => {
    const start = new Date(base.getTime() + session.open * 60000)
    const end = new Date(base.getTime() + (session.close <= session.open ? session.close + 1440 : session.close) * 60000)
    return [{ session, start, end }, ...(session.close <= session.open ? [{ session, start: new Date(start.getTime() - 86400000), end: new Date(end.getTime() - 86400000) }] : [])]
  })
  const current = intervals.find(interval => now >= interval.start && now < interval.end)
  if (current) return { mode: 'open', name: current.session.name, targetName: current.session.name, target: current.end }
  const next = intervals.filter(interval => interval.start > now).sort((left, right) => left.start - right.start)[0]
  if (next) return { mode: 'closed', name: '休市', targetName: next.session.name, target: next.start }
  return { mode: 'closed', name: '休市', targetName: '亚盘', target: new Date(base.getTime() + 86400000 + marketSessions[0].open * 60000) }
}
const updateSessionCountdown = () => {
  const window = getSessionWindow(new Date())
  sessionMode.value = window.mode
  sessionName.value = window.name
  sessionTargetName.value = window.targetName
  sessionCountdownSeconds.value = Math.max(0, Math.floor((window.target.getTime() - Date.now()) / 1000))
}
const loadOlderBars = async () => {
  if (loadingOlder || !hasMoreHistory || !bars.value.length) return
  loadingOlder = true
  try {
    const previousRange = chart?.timeScale().getVisibleLogicalRange()
    const { data } = await axios.get(`${API}/bars`, { params: { symbol: symbol.value, timeframe: timeframe.value, count: 500, start: bars.value.length } })
    const older = (data.bars || []).filter(item => item.time < bars.value[0].time)
    if (!older.length) { hasMoreHistory = false; return }
    bars.value = [...older, ...bars.value]
    candleSeries.setData(bars.value.map(item => ({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close })))
    updateIndicators()
    await nextTick()
    updateCustomIndicator()
    if (previousRange) { skipHistoryLoadOnce = true; chart.timeScale().setVisibleLogicalRange({ from: previousRange.from + older.length, to: previousRange.to + older.length }) }
    hasMoreHistory = older.length >= 500
    refreshPatternMatches()
  } catch (error) { showError(error) } finally { loadingOlder = false }
}

onMounted(async () => { await loadAiPresets(); await loadBoardConfig(); const active = customIndicators.value.find(item => item.visible); if (active) { const migratedSettings = { ...defaultCustomSettings(), ...(active.settings || {}) }; if (migratedSettings.maxBars < 10000) migratedSettings.maxBars = 10000; if (migratedSettings.maxPivots > 10) migratedSettings.maxPivots = 10; active.settings = migratedSettings; customIndicatorName.value = active.name; customIndicatorCode.value = active.code; customIndicatorSettings.value = migratedSettings } await loadSymbols(); await loadBars(); updateSessionCountdown(); countdownTimer = window.setInterval(() => { if (bars.value.length) updateCountdown(bars.value.at(-1).time); else updateSessionCountdown() }, 1000); refreshTimer = window.setInterval(refreshMarket, refreshIntervalSeconds.value * 1000); priceUpdateTimer = window.setInterval(updatePriceOverlay, 1000) })
onBeforeUnmount(() => { clearTimeout(boardConfigSaveTimer); if (refreshTimer) clearInterval(refreshTimer); if (countdownTimer) clearInterval(countdownTimer); if (priceUpdateTimer) clearInterval(priceUpdateTimer); resizeObserver?.disconnect(); chart?.remove(); macdChart?.remove(); saveBoardConfig() })
</script>

<style scoped>
.board-page { color: #e5e7eb; padding: 18px 22px; height: 100%; box-sizing: border-box; overflow: auto; scrollbar-width: none; -ms-overflow-style: none; background: #0b1220; }
.board-page::-webkit-scrollbar { width: 0; height: 0; display: none; }
.page-header, .toolbar, .quote-bar { display: flex; align-items: center; gap: 14px; }
.page-header { justify-content: space-between; margin-bottom: 14px; } h2 { margin: 0 0 4px; } .muted, .chart-note, p { color: #94a3b8; font-size: 13px; }.header-actions { justify-content:space-between; padding:0 12px; flex:1; display: flex; gap: 10px; align-items: center; }.market-countdowns { display: flex; gap: 12px; font-size: 12px; color: #94a3b8; }.market-countdowns span { white-space: nowrap; }.header-account { color: #94a3b8; font-size: 12px; white-space: nowrap; }.market-countdowns b { color: #fbbf24; margin-left: 4px; }.toolbar { flex-wrap: wrap; background: #111827; padding: 12px; border-radius: 8px; }.symbol-select { width: 180px; flex: 0 0 180px; }.symbol-option { display: flex; align-items: center; justify-content: space-between; width: 100%; }.favorite-symbols { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }.favorite-symbols .el-button { margin: 0; }.account { margin-left: auto; color: #94a3b8; font-size: 13px; }.candle-countdown { color: #fbbf24; font-size: 13px; }.quote-bar { display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin: 0 0 16px; padding: 12px 14px; background: #172033; border-radius: 8px; font-size: 13px; }.quote-bar span { display: flex; justify-content: space-between; gap: 12px; }.quote-bar b { color: #f8fafc; margin-left: 5px; }.quote-bar b { color: #f8fafc; margin-left: 5px; }.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 14px; height: calc(100vh - 180px); max-height: calc(100vh - 180px); min-height: 420px; overflow: hidden; align-items: stretch; }.content-grid.is-expanded { grid-template-columns: 1fr; }.chart-card, .info-card { background: #111827; border: 1px solid #263246; border-radius: 8px; min-height: 0; }.chart-card { display: flex; flex-direction: column; overflow: hidden; }.info-card { display: flex; flex-direction: column; box-sizing: border-box; height: 100%; min-height: 0; overflow: hidden; }.chart-toolbar { display: flex; align-items: center; gap: 14px; padding: 9px 12px; border-bottom: 1px solid #263246; }.chart-title { flex: 0 0 auto; }.chart-timeframe { flex: 1; overflow-x: auto; }.chart-timeframe .el-radio-button__inner { padding: 6px 10px; }.chart-title { color: rgb(103, 232, 249); font-size: 16px;font-weight: bolder; margin-right:30px;}.chart-actions { display: flex; gap: 8px; }.chart { flex: 1 1 auto; height: auto; min-height: 0; position: relative; }:deep(.pattern-dialog .el-dialog) { max-height: 90vh; margin-top: 5vh !important; margin-bottom: 5vh; display: flex; flex-direction: column; }.pattern-dialog :deep(.el-dialog__body) { min-height: 0; overflow: hidden; }.pattern-dialog :deep(.el-dialog__footer) { flex: 0 0 auto; }.pattern-dialog-content { max-height: calc(90vh - 130px); overflow-y: auto; padding-right: 6px; scrollbar-width: thin; scrollbar-color: #475569 #111827; }.pattern-dialog-content::-webkit-scrollbar { width: 7px; }.pattern-dialog-content::-webkit-scrollbar-track { background: #111827; border-radius: 7px; }.pattern-dialog-content::-webkit-scrollbar-thumb { background: #475569; border-radius: 7px; }.pattern-editor { position: relative; height: 460px; margin: 14px 0 18px; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }.pattern-canvas-viewport { width: 100%; height: 100%; overflow: hidden; }.pattern-canvas-viewport .pattern-editor-canvas { display: block; width: 100%; height: 100%; }.pattern-canvas-zoom-label { margin-left: auto; color: #94a3b8; font-size: 12px; white-space: nowrap; }.pattern-editor.is-fullscreen { height: min(62vh, 680px); }.reverse-pattern-section { margin-top: 18px; }.reverse-pattern-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; color: #cbd5e1; }.reverse-pattern-title span { color: #94a3b8; font-size: 12px; }.reverse-pattern-editor { height: 460px; margin: 0; }.pattern-editor-canvas { display: block; width: 100%; height: 100%; cursor: ns-resize; touch-action: none; }.pattern-editor-help { position: absolute; left: 12px; bottom: 10px; color: #94a3b8; font-size: 12px; pointer-events: none; }.pattern-form { margin-top: 8px; }.pattern-trend-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }.pattern-trend-fields .el-select, .pattern-trend-fields .el-input-number { width: 100%; }.content-grid.is-expanded .chart { height: auto; }.macd-chart { flex: 0 0 150px; height: 150px; min-height: 150px; border-top: 1px solid #263246; }.ai-analysis-card { margin-top: 14px; padding: 16px 18px; background: #111827; border: 1px solid #263246; border-radius: 8px; }.ai-analysis-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.ai-analysis-header > div:first-child { display: flex; align-items: baseline; gap: 10px; }.ai-analysis-header strong { color: #e2e8f0; font-size: 15px; }.ai-analysis-header span { color: #64748b; font-size: 12px; }.ai-analysis-actions { display: flex; align-items: center; gap: 8px; }.ai-preset-select { width: 190px; }.ai-preset-form-row, .ai-model-form-row { display: flex; align-items: center; gap: 8px; width: 100%; }.ai-preset-form-row .el-select, .ai-model-form-row .el-select { flex: 1; min-width: 0; }.ai-analysis-empty, .ai-analysis-error { margin-top: 12px; padding: 12px; color: #94a3b8; background: #0f172a; border-radius: 6px; font-size: 13px; }.ai-analysis-error { color: #fca5a5; border: 1px solid #7f1d1d; }.ai-analysis-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }.ai-result-section { min-width: 0; padding: 14px; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; }.ai-result-conclusion { grid-column: 1 / -1; }.ai-result-risk { border-color: #713f12; }.ai-section-title { display: flex; align-items: center; gap: 9px; color: #e2e8f0; }.ai-section-title b { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; color: #0f172a; background: #67e8f9; font-size: 13px; }.ai-result-risk .ai-section-title b { background: #fbbf24; }.ai-section-title strong { font-size: 14px; }.ai-section-title span { margin-left: auto; color: #94a3b8; font-size: 12px; }.ai-result-section p, .ai-result-section li { color: #cbd5e1; font-size: 13px; line-height: 1.6; }.ai-result-section > p { margin: 10px 0 0; }.ai-result-section ul { margin: 10px 0 0; padding-left: 20px; }.ai-result-section li + li { margin-top: 6px; }.ai-no-data { color: #64748b !important; }.ai-plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }.ai-plan-grid p { margin: 0; padding: 10px; background: #111827; border-radius: 6px; }.ai-plan-grid label { display: block; margin-bottom: 5px; color: #67e8f9; font-size: 12px; }.ai-levels { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }.ai-levels span { padding: 6px 9px; color: #fbbf24; background: #1c1917; border-radius: 5px; font-size: 12px; }.ai-levels small { margin-left: 5px; color: #94a3b8; }.indicator-panel { display: flex; flex-direction: column; gap: 8px; }.indicator-section { display: flex; align-items: center; justify-content: space-between; color: #cbd5e1; }.indicator-row { display: flex; align-items: center; gap: 6px; min-height: 30px; color: #cbd5e1; }.indicator-row .el-input-number { width: 94px; }.indicator-row .el-color-picker { flex: 0 0 auto; }.custom-indicator-row { min-width: 0; }.custom-indicator-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.custom-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }.custom-settings-grid .el-input-number, .custom-settings-grid .el-select { width: 100%; }.custom-settings-checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin-bottom: 16px; }.custom-color-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }.color-dot { width: 10px; height: 10px; border-radius: 50%; }.legend-item { margin-right: 16px; white-space: nowrap; }.indicator-legend { position: absolute; top: 8px; left: 10px; z-index: 3; color: #cbd5e1; font-size: 12px; pointer-events: none; }.ema-dot { display: inline-block; width: 18px; border-top: 2px solid #f59e0b; margin: 0 6px 3px 0; }.indicator-legend b { margin-left: 8px; color: #cbd5e1; font-weight: 400; }.price-overlay { position: absolute; right: 0; z-index: 3; min-width: 68px; padding: 2px 7px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; background: #0f9f87; color: #fff; font-size: 12px; line-height: 16px; pointer-events: none; }.price-overlay small { font-size: 11px; opacity: .95; }.chart-note { padding: 8px 14px 12px; }.info-card { padding: 14px; }.info-card > .el-divider { margin: 10px 0 12px; }.pattern-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; min-height: 0; overflow: hidden; }.pattern-entry-button, .pattern-library-button { flex: 1 1 calc(50% - 4px); width: calc(50% - 4px); min-width: 0; margin: 0; }.pattern-entry-button { --el-button-bg-color: #102a43; --el-button-border-color: #2563eb; --el-button-text-color: #60a5fa; }.pattern-library-button { --el-button-bg-color: #241b0f; --el-button-border-color: #a16207; --el-button-text-color: #fbbf24; }.locate-pattern-button { --el-button-bg-color: #102a43; --el-button-border-color: #0891b2; --el-button-text-color: #67e8f9; }.scan-favorite-button { --el-button-bg-color: #102a22; --el-button-border-color: #059669; --el-button-text-color: #6ee7b7; }.scan-other-button { --el-button-bg-color: #211735; --el-button-border-color: #7c3aed; --el-button-text-color: #c4b5fd; }.pattern-hint { flex: 0 0 100%; display: block; margin-top: 8px; color: #fbbf24; font-size: 12px; line-height: 1.5; }.pattern-tolerance-row { flex: 0 0 100%; display: flex; align-items: center; gap: 8px; margin-top: 8px; color: #cbd5e1; font-size: 13px; }.pattern-tolerance-row small { color: #64748b; }.pattern-tolerance-row .el-input-number { width: 86px; }.pattern-match-status { flex: 0 0 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; color: #94a3b8; font-size: 12px; }.pattern-match-status .el-button { flex: 0 0 auto; }.pattern-scan-area { flex: 0 0 100%; width: 100%; align-self: stretch; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; margin-top: 6px; min-height: 0; }.pattern-scan-area.has-results { flex: 1 1 auto; min-height: 0; }.pattern-scan-area > .el-button { flex: 0 0 auto; width: 100%; margin: 0; font-size: 13px; }.pattern-scan-status { flex: 0 0 auto; color: #aab8cc; font-size: 13px; line-height: 1.5; }.pattern-scan-results { flex: 1 1 auto; max-height: 425px; min-height: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; flex-wrap: nowrap; gap: 6px; overflow-y: auto; overflow-x: hidden; padding: 2px 5px 2px 0; scrollbar-width: thin; scrollbar-color: #64748b #111827; }.pattern-scan-results::-webkit-scrollbar { width: 6px; }.pattern-scan-results::-webkit-scrollbar-track { background: #111827; border-radius: 6px; }.pattern-scan-results::-webkit-scrollbar-thumb { background: #475569; border-radius: 6px; }.pattern-scan-results::-webkit-scrollbar-thumb:hover { background: #64748b; }.pattern-scan-results .el-button { width: 100%; min-height: 28px; margin: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.info-instructions { display: none; }.info-instructions p { margin: 0 0 10px; line-height: 1.55; }.refresh-interval-input { width: 82px; vertical-align: middle; margin: 0 3px; }.pattern-library-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }.pattern-library-card { min-width: 0; padding: 8px; border: 1px solid #334155; border-radius: 10px; background: #0f172a; }.pattern-card-header, .pattern-card-meta, .pattern-card-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.pattern-card-header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.pattern-preview { display: block; width: 100%; height: 92px; margin: 6px 0; background: #111827; border-radius: 6px; }.pattern-grid-line { stroke: #263246; stroke-width: 1; }.pattern-bull { stroke: #26a69a; stroke-width: 2; }.pattern-bear { stroke: #ef5350; stroke-width: 2; }.pattern-bull-fill { fill: #26a69a; }.pattern-bear-fill { fill: #ef5350; }.pattern-card-meta { color: #94a3b8; font-size: 12px; }.pattern-card-actions { justify-content: flex-end; margin-top: 6px; }.pattern-pagination { display: flex; justify-content: center; margin-top: 16px; }.pattern-recording-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }.pattern-recording-toolbar span { margin-right: auto; color: #94a3b8; }.instrument { font-size: 28px; font-weight: 700; color: #67e8f9; margin-bottom: 22px; }.info-row { display: flex; justify-content: space-between; margin: 13px 0; color: #94a3b8; }.info-row b { color: #e5e7eb; }@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; }.info-card { display: none; } }
.market-connect { display: flex; align-items: center; justify-content: flex-end; gap: 14px; }.market-connect-main { display: flex; align-items: center; gap: 12px; }.header-instructions {  color: #64748b; font-size: 11px; line-height: 1.45; text-align: right; }.header-instructions .refresh-interval-input { width: 68px; }.toolbar-instructions { display: none; }
</style>
