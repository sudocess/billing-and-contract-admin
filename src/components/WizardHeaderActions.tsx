'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The generate step's actions, rendered into the page header rather than under the
 * preview.
 *
 * The preview is the real contract, which is five A4 pages tall. Putting Save and
 * Generate below it meant the only way to reach them was to scroll past the entire
 * document, and on a wizard whose last step exists to produce a file, the button that
 * produces the file was the one thing you could not see.
 *
 * Portalled into the header rather than made sticky inside the form, because each page
 * header is a different height and a sticky offset guessed here would either overlap the
 * title or float below it.
 */
export const WIZARD_ACTIONS_SLOT = 'wizard-header-actions'

export default function WizardHeaderActions({
  lang,
  onLang,
  onSave,
  onGenerate,
  saving,
  saveLabel,
  disabled,
}: {
  lang: 'en' | 'nl'
  onLang: (l: 'en' | 'nl') => void
  onSave: () => void
  onGenerate: () => void
  saving: boolean
  saveLabel: string
  disabled?: boolean
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  // After mount, because the header is server-rendered and is not in the DOM during
  // the first client render.
  useEffect(() => setSlot(document.getElementById(WIZARD_ACTIONS_SLOT)), [])
  if (!slot) return null

  return createPortal(
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex gap-1" role="group" aria-label="Contract language">
        <button
          type="button"
          className={`lang-tab !px-3 !py-[6px] !text-[0.8rem] ${lang === 'en' ? 'lang-tab-active' : ''}`}
          onClick={() => onLang('en')}
        >EN</button>
        <button
          type="button"
          className={`lang-tab !px-3 !py-[6px] !text-[0.8rem] ${lang === 'nl' ? 'lang-tab-active' : ''}`}
          onClick={() => onLang('nl')}
        >NL</button>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onSave}
        disabled={saving || disabled}
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onGenerate}
        disabled={disabled}
      >
        Generate contract
      </button>
    </div>,
    slot,
  )
}
