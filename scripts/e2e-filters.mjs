import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const outDir = join(process.cwd(), 'scripts', 'e2e-out')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const log = []
function note(msg) {
  log.push(msg)
  console.log(msg)
}

try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 30000 })
  await page.screenshot({ path: join(outDir, '01-home.png'), fullPage: true })
  note('opened home')

  // 侧栏：绩效分析
  const analysisNav = page.getByText('绩效分析', { exact: true }).first()
  await analysisNav.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(outDir, '02-analysis.png'), fullPage: true })
  note('navigated analysis')

  // 读 KPI 总交易数
  const kpiBefore = await page.locator('.kpi strong').first().textContent()
  note(`kpi trades before filter: ${kpiBefore}`)

  // 打开交易品种多选
  const symbolSelect = page.locator('.filters .app-select').filter({ hasText: '交易品种' })
  await symbolSelect.locator('.app-select-trigger').click()
  await page.waitForTimeout(300)
  const symbolOptions = await page.locator('.app-select-panel.open .app-select-option').allTextContents()
  note(`symbol options: ${JSON.stringify(symbolOptions.slice(0, 12))}`)
  // 勾选第一个非空选项
  const firstSymbol = page.locator('.app-select-panel.open .app-select-option').first()
  const firstSymbolText = (await firstSymbol.textContent())?.trim()
  await firstSymbol.click()
  await page.locator('.app-select-panel.open .app-select-done').click()
  await page.waitForTimeout(600)
  note(`selected symbol: ${firstSymbolText}`)

  const kpiAfterSymbol = await page.locator('.kpi strong').first().textContent()
  note(`kpi trades after symbol: ${kpiAfterSymbol}`)

  // 打开策略，看联动后选项
  const strategySelect = page.locator('.filters .app-select').filter({ hasText: '策略' })
  await strategySelect.locator('.app-select-trigger').click()
  await page.waitForTimeout(300)
  const strategyOptions = await page
    .locator('.app-select-panel.open .app-select-option')
    .allTextContents()
  note(`strategy options after symbol filter: ${JSON.stringify(strategyOptions)}`)
  await page.screenshot({ path: join(outDir, '03-after-symbol.png'), fullPage: true })
  // 关闭策略面板
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // 再选一个策略，看品种是否收窄
  await strategySelect.locator('.app-select-trigger').click()
  await page.waitForTimeout(200)
  const firstStrategy = page.locator('.app-select-panel.open .app-select-option').first()
  const firstStrategyText = (await firstStrategy.textContent())?.trim()
  await firstStrategy.click()
  await page.locator('.app-select-panel.open .app-select-done').click()
  await page.waitForTimeout(600)
  note(`selected strategy: ${firstStrategyText}`)

  await symbolSelect.locator('.app-select-trigger').click()
  await page.waitForTimeout(300)
  const symbolsAfterStrategy = await page
    .locator('.app-select-panel.open .app-select-option')
    .allTextContents()
  note(`symbol options after strategy: ${JSON.stringify(symbolsAfterStrategy)}`)
  await page.screenshot({ path: join(outDir, '04-after-strategy.png'), fullPage: true })

  const kpiFinal = await page.locator('.kpi strong').first().textContent()
  note(`kpi trades final: ${kpiFinal}`)

  // 日期条是否仍显示全量（AccountStrip bug）
  const strip = await page.locator('.account-strip').textContent()
  note(`account strip: ${strip?.replace(/\s+/g, ' ').trim()}`)
} catch (err) {
  note(`ERROR: ${err?.message || err}`)
  await page.screenshot({ path: join(outDir, 'error.png'), fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
  console.log('---LOG---')
  console.log(log.join('\n'))
}
