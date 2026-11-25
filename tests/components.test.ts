import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import type { PageId } from '../src/types/trading.ts'
import { renderToString } from 'vue/server-renderer'

// Render the real Vue components without a browser, network listener or database.
test('所有功能页面、共享布局和导入弹窗可渲染且没有缺失组件或状态警告', async () => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    appType: 'custom',
    logLevel: 'error',
  })
  try {
    const { createTradeWorkspace, provideTradeWorkspace } =
      (await server.ssrLoadModule(
        '/src/composables/useTradeWorkspace.ts',
      )) as typeof import('../src/composables/useTradeWorkspace.ts')
    const ids = {
      DashboardPage: 'dashboard',
      AnalysisPage: 'analysis',
      TradesPage: 'trades',
      FundsPage: 'funds',
      StrategiesPage: 'strategies',
      CorrelationPage: 'correlation',
      SettingsPage: 'settings',
    }
    for (const [name, id] of Object.entries(ids)) {
      const { default: Page } = await server.ssrLoadModule(
        `/src/pages/${name}.vue`,
      )
      const warnings: string[] = []
      const app = createSSRApp({
        setup() {
          const w = provideTradeWorkspace(
            createTradeWorkspace({ storage: null, confirm: () => true }),
          )
          w.page.value = id as PageId
          if (id === 'dashboard')
            w.report.value = {
              closedProfit: 50,
              closedCommission: 0,
              closedSwap: 0,
              initial: 50000,
              balance: 50050,
              equity: 50060,
              floating: 10,
              net: 50,
              closedNet: 50,
              openingCosts: 0,
              cashflowNet: 0,
              hasMagic: false,
              strategyMatched: 1,
              reconciliationDifference: 0,
              balanceCurve: [
                { time: '2026-10-01T00:00:00', balance: 50050, drawdown: 0 },
              ],
              openPositions: [
                {
                  ...w.trades.value[0],
                  openTime: w.trades.value[0].time,
                  openingCost: 0,
                  openPrice: 100,
                  marketPrice: 101,
                },
              ],
              cashflows: [
                {
                  ...w.trades.value[0],
                  net: 1,
                  direction: 'balance',
                  orderId: '',
                  entry: '',
                  balance: 50050,
                  openTime: w.trades.value[0].time,
                  comment: '调整',
                },
              ],
            }
          return () => h(Page)
        },
      })
      app.config.warnHandler = (m) => warnings.push(m)
      const html = await renderToString(app)
      assert.ok(html.length > 100, `${name} rendered content`)
      assert.deepEqual(warnings, [], `${name} rendered without warnings`)
    }
    for (const name of [
      'AppSidebar',
      'AppTopbar',
      'PageHeading',
      'DataNotice',
      'AppFooter',
      'StatusToast',
      '../ImportDialog',
    ]) {
      const path = name.startsWith('../')
        ? '/src/components/ImportDialog.vue'
        : `/src/components/layout/${name}.vue`
      const { default: Component } = await server.ssrLoadModule(path)
      const warnings: string[] = []
      const app = createSSRApp({
        setup() {
          const w = provideTradeWorkspace(
            createTradeWorkspace({ storage: null, confirm: () => true }),
          )
          w.uploadOpen.value = true
          w.notice.value = '验证'
          return () => h(Component)
        },
      })
      app.config.warnHandler = (m) => warnings.push(m)
      assert.ok((await renderToString(app)).length > 20)
      assert.deepEqual(warnings, [], name)
    }
  } finally {
    await server.close()
  }
})
