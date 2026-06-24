import { chromium } from 'playwright-chromium'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] || 'https://req-2-ui.vercel.app'
const only = process.argv[3] // optional single route name
const out = './public/screens'
mkdirSync(out, { recursive: true })

let routes = [['landing', '/'], ['login', '/login'], ['register', '/register']]
if (only) routes = routes.filter(([n]) => n === only)

const browser = await chromium.launch({
  args: [
    '--enable-webgl', '--ignore-gpu-blocklist',
    '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

for (const [name, route] of routes) {
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 35000 })
    await page.waitForTimeout(3500) // let the Aurora canvas paint a frame
    await page.screenshot({ path: `${out}/${name}.png` })
    console.log('OK   ', name)
  } catch (e) {
    console.log('FAIL ', name, '-', e.message.split('\n')[0])
  }
}
await browser.close()
