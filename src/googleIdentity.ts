const GOOGLE_IDENTITY_SCRIPT_ID = 'wms-google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export type GoogleCredentialResponse = {
  credential: string
  select_by?: string
}

type GoogleButtonConfiguration = {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

type GoogleIdentityConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
}

export type GoogleIdentityApi = {
  initialize(configuration: GoogleIdentityConfiguration): void
  renderButton(parent: HTMLElement, configuration: GoogleButtonConfiguration): void
  prompt(): void
  disableAutoSelect(): void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi
      }
    }
  }
}

let scriptPromise: Promise<GoogleIdentityApi> | null = null

export async function loadGoogleIdentityServices(): Promise<GoogleIdentityApi> {
  const existing = window.google?.accounts?.id
  if (existing) return existing
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const finish = () => {
      const api = window.google?.accounts?.id
      if (api) resolve(api)
      else reject(new Error('Googleログインを初期化できませんでした。'))
    }

    const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', finish, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Googleログイン用スクリプトを読み込めませんでした。')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = finish
    script.onerror = () => reject(new Error('Googleログイン用スクリプトを読み込めませんでした。'))
    document.head.appendChild(script)
  }).catch((error) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}
