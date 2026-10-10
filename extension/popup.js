// Side panel: sign in, or save the job on the current tab by hand (for "Apply on company
// site" jobs the extension can't detect). It stays open while you browse and refills itself
// on the job sites; on other sites, click the toolbar icon to read the page.

const signIn = document.getElementById('sign-in')
const capture = document.getElementById('capture')
const status = document.querySelector('.status')

const send = (message) => chrome.runtime.sendMessage(message)

function show(text, isError = false) {
  status.textContent = text
  status.className = isError ? 'status error' : 'status'
}

async function render() {
  const { signedIn } = await send({ type: 'status' })
  signIn.hidden = signedIn
  capture.hidden = !signedIn
  if (signedIn) {
    await fillFromTab()
  } else {
    const { apiUrl } = await chrome.storage.local.get('apiUrl')
    signIn.elements.apiUrl.value = apiUrl ?? 'https://careerpipeline-api.onrender.com'
  }
}

async function fillFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let job = null
  try {
    const target = { tabId: tab.id }
    await chrome.scripting.executeScript({ target, files: ['sites.js'] })
    const [{ result }] = await chrome.scripting.executeScript({
      target,
      func: () => extractJob(location.href, document),
    })
    job = result
  } catch {
    // Pages the browser doesn't let extensions read (e.g. chrome://): use the tab itself.
  }
  job ??= { listing_url: tab.url ?? '', job_title: tab.title ?? '', company_name: '' }
  if (job.listing_url !== capture.elements.listing_url.value) show('') // a new job
  for (const name of ['job_title', 'company_name', 'listing_url']) {
    capture.elements[name].value = job[name] ?? ''
  }
}

signIn.addEventListener('submit', async (event) => {
  event.preventDefault()
  const data = Object.fromEntries(new FormData(signIn))
  // An API on a custom https domain needs permission first; this must run before any await.
  const allowed = chrome.permissions.request({ origins: [`${new URL(data.apiUrl).origin}/*`] })
  if (!(await allowed.catch(() => false))) {
    return show('The extension needs permission to reach that API URL.', true)
  }
  show('Signing in…')
  const result = await send({ type: 'signIn', ...data })
  if (result.error) return show(result.error, true)
  show('')
  await render()
})

capture.addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = capture.querySelector('button[type=submit]')
  button.disabled = true
  show('Saving…')
  const result = await send({ type: 'capture', job: Object.fromEntries(new FormData(capture)) })
  button.disabled = false
  if (result.error) {
    show(result.error, true)
    if (/sign in/i.test(result.error)) await render()
    return
  }
  show(result.created ? 'Added to your board.' : 'Already on your board.')
})

document.getElementById('sign-out').addEventListener('click', async () => {
  await send({ type: 'signOut' })
  show('Signed out.')
  await render()
})

document.getElementById('close').addEventListener('click', () => window.close())

// Refill when you switch tabs, a page finishes loading, a job site shows another job
// (content.js stores it as lastJob:<site>), or the toolbar icon is clicked.
function refill() {
  if (!capture.hidden) fillFromTab()
}
chrome.tabs.onActivated.addListener(refill)
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if (tab.active && change.status === 'complete') refill()
})
chrome.storage.onChanged.addListener((changes) => {
  if (Object.keys(changes).some((key) => key.startsWith('lastJob:'))) refill()
})
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'refill') refill()
})

render()
