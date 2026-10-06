// Runs on LinkedIn, Indeed and JobStreet. It remembers the last job you looked at (the
// "application sent" screen often no longer shows it), and when that screen appears it
// asks whether to save the job to CareerPipeline. Uses sites.js (loaded first).

const prompted = new Set() // listing URLs already asked about on this tab
let scheduled = false
let lastSaved = ''

new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
})
schedule()

// These sites are single-page apps, so watch DOM changes, at most once a second.
function schedule() {
  if (scheduled) return
  scheduled = true
  setTimeout(() => {
    scheduled = false
    check().catch(() => {}) // the extension was reloaded: this old script can't reach it
  }, 1000)
}

async function check() {
  const site = siteFor(location.hostname)
  const key = `lastJob:${site.id}`
  const job = extractJob(location.href, document)
  if (job && JSON.stringify(job) !== lastSaved) {
    lastSaved = JSON.stringify(job)
    await chrome.storage.local.set({ [key]: job })
  }
  if (!isSuccessPage(location.hostname, document)) return

  const remembered = job ?? (await chrome.storage.local.get(key))[key]
  const candidate = remembered ?? { listing_url: '', job_title: '', company_name: '' }
  if (prompted.has(candidate.listing_url)) return
  prompted.add(candidate.listing_url)
  showCard(candidate)
}

function showCard(job) {
  document.getElementById('careerpipeline-card')?.remove()
  const host = document.createElement('div')
  host.id = 'careerpipeline-card'
  // Shadow DOM: the job site's CSS can't restyle the card, and ours can't leak out.
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `
    <style>
      :host { all: initial; }
      form { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px;
        box-sizing: border-box; padding: 14px; border-radius: 10px; background: #fff;
        color: #0f172a; font: 13px/1.4 system-ui, sans-serif; border: 1px solid #cbd5e1;
        box-shadow: 0 10px 30px rgba(15, 23, 42, .2); }
      h2 { margin: 0 0 8px; font-size: 14px; }
      label { display: block; margin-top: 6px; color: #475569; }
      input { display: block; width: 100%; box-sizing: border-box; margin-top: 2px;
        padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
      .row { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
      button { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1;
        background: #fff; font: inherit; cursor: pointer; }
      button[type=submit] { background: #2563eb; border-color: #2563eb; color: #fff; }
      button:disabled { opacity: .6; cursor: default; }
      .status { margin: 8px 0 0; }
      .error { color: #b91c1c; }
    </style>
    <form>
      <h2>Save to CareerPipeline?</h2>
      <label>Job title <input name="job_title" required></label>
      <label>Company <input name="company_name" placeholder="Optional"></label>
      <label>Listing URL <input name="listing_url" type="url" required></label>
      <p class="status" role="status"></p>
      <div class="row">
        <button type="button" data-close>Dismiss</button>
        <button type="submit">Save</button>
      </div>
    </form>`

  const form = root.querySelector('form')
  const status = root.querySelector('.status')
  for (const name of ['job_title', 'company_name', 'listing_url']) {
    form.elements[name].value = job[name] ?? ''
  }
  root.querySelector('[data-close]').addEventListener('click', () => host.remove())
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const save = form.querySelector('button[type=submit]')
    save.disabled = true
    status.className = 'status'
    status.textContent = 'Saving…'
    const data = Object.fromEntries(new FormData(form))
    const result = await chrome.runtime
      .sendMessage({ type: 'capture', job: data })
      .catch(() => ({ error: 'The extension was updated. Reload this page and try again.' }))
    if (result.error) {
      status.className = 'status error'
      status.textContent = result.error
      save.disabled = false
      return
    }
    status.textContent = result.created ? 'Added to your board.' : 'Already on your board.'
    setTimeout(() => host.remove(), 2500)
  })
  document.documentElement.append(host)
}
