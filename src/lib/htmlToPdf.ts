import Chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

// Pin Chromium version so serverless downloads stay reproducible.
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar'

export async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath =
    // 1. Explicit override (e.g. CHROME_EXECUTABLE_PATH=/Applications/Google Chrome.app/... in .env.local)
    process.env.CHROME_EXECUTABLE_PATH ||
    // 2. Common local Chrome paths for development
    (process.env.NODE_ENV === 'development'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await Chromium.executablePath(CHROMIUM_PACK_URL))

  const browser = await puppeteer.launch({
    args: Chromium.args,
    executablePath,
    headless: true,
    defaultViewport: { width: 1280, height: 1024 },
  })

  try {
    const page = await browser.newPage()
    // page.pdf() automatically switches to @media print — CSS print rules apply
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,  // honours @page { size: A4 portrait; margin: ... } in HTML
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
