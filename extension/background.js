// The only part of the extension that talks to the CareerPipeline API. The side panel and the
// on-page card send it messages; it keeps { apiUrl, token } in chrome.storage.local.

// The toolbar icon opens the side panel and tells it to read the current tab. The click is
// what lets the extension read pages outside the job sites (activeTab).
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
  // Not open yet: the panel reads the tab itself when it loads.
  chrome.runtime.sendMessage({ type: 'refill' }).catch(() => {})
})

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  handle(message).then(reply, (error) => reply({ error: error.message }))
  return true // reply asynchronously
})

async function handle(message) {
  switch (message.type) {
    case 'status': {
      const { token } = await chrome.storage.local.get('token')
      return { signedIn: Boolean(token) }
    }
    case 'signIn': {
      const apiUrl = message.apiUrl.replace(/\/+$/, '')
      const body = await request(apiUrl, '/api/auth/extension-token/', {
        method: 'POST',
        body: { email: message.email, password: message.password },
      })
      await chrome.storage.local.set({ apiUrl, token: body.token })
      return { signedIn: true }
    }
    case 'signOut': {
      const { apiUrl, token } = await chrome.storage.local.get(['apiUrl', 'token'])
      await chrome.storage.local.remove('token')
      // Revoke the key too; if the API is unreachable the local sign-out still counts.
      await request(apiUrl, '/api/auth/extension-token/', { method: 'DELETE', token }).catch(
        () => {},
      )
      return { signedIn: false }
    }
    case 'capture': {
      const { apiUrl, token } = await chrome.storage.local.get(['apiUrl', 'token'])
      if (!token) throw new Error('Sign in from the CareerPipeline toolbar icon first.')
      const { status } = await request(apiUrl, '/api/applications/capture/', {
        method: 'POST',
        token,
        body: { ...message.job, date_applied: localToday() },
      })
      return { created: status === 201 }
    }
    default:
      throw new Error(`Unknown message: ${message.type}`)
  }
}

async function request(apiUrl, path, { method, token, body }) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Token ${token}`
  let response
  try {
    response = await fetch(apiUrl + path, {
      method,
      headers,
      body: body && JSON.stringify(body),
    })
  } catch {
    throw new Error(`Can't reach ${apiUrl}. Is the server running?`)
  }
  if (response.status === 204) return { status: 204 }
  const data = await response.json().catch(() => ({}))
  if (response.status === 401 && token) {
    await chrome.storage.local.remove('token')
    throw new Error('Your sign-in expired. Sign in again from the toolbar icon.')
  }
  if (!response.ok) throw new Error(errorMessage(data))
  return { ...data, status: response.status }
}

/** Turn the API's { error: { message, details } } envelope into one readable line. */
function errorMessage(data) {
  const details = Object.entries(data.error?.details ?? {})
    .map(([field, messages]) => `${field}: ${[].concat(messages).join(' ')}`)
    .join(' · ')
  return details || data.error?.message || 'Something went wrong.'
}

function localToday() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
