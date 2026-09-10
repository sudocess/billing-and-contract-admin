import Chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

// Pin Chromium version so serverless downloads stay reproducible.
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar'

export async function htmlToPdf(html: string): Promise<Buffer> {
  const override = process.env.CHROME_EXECUTABLE_PATH
  const useLocalChrome = !!override || process.env.NODE_ENV === 'development'

  const executablePath =
    override ||
    (useLocalChrome
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await Chromium.executablePath(CHROMIUM_PACK_URL))

  /* Chromium.args is tuned for Lambda and carries --single-process and --no-zygote.
     Handing those to a desktop Chrome hangs the launch until puppeteer's own 30 second
     timeout, which is why generating a signed PDF never worked locally. They are right
     for the bundled Chromium and wrong for anything else, so they are applied only
     where they belong. */
  const args = useLocalChrome
    ? ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
    : Chromium.args

  const browser = await puppeteer.launch({
    args,
    executablePath,
    headless: true,
    defaultViewport: { width: 1280, height: 1024 },
    timeout: 20_000,
  })

  try {
    const page = await browser.newPage()

    /* 'load', not 'networkidle0'.
       networkidle0 waits for 500ms with zero open connections, and on this document it
       never arrives: it timed out at the full 30 seconds on every launch configuration
       tried, with Lambda args and with plain ones. Since this runs on the signing
       request, and the PDF is generated before the signature is recorded, that made
       every attempt to sign a contract fail after a 30 second wait. Measured on the
       same document: 'load' renders it in about 1.7 seconds. */
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 })

    /* The document pulls Gabarito from Google Fonts, and 'load' can fire before the
       face is applied, which would print the contract in a fallback typeface. Waiting
       on document.fonts is the specific guarantee that was wanted; networkidle0 was
       only ever an approximation of it. Capped, because a slow font must delay the
       PDF, not prevent it. */
    await Promise.race([
      page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready),
      new Promise(resolve => setTimeout(resolve, 3_000)),
    ])

    // page.pdf() automatically switches to @media print, so CSS print rules apply.
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
