const API_URL = "http://localhost:8000"

const jobForm = document.getElementById("job")
const message = document.getElementById("message")

async function getAccessToken() {
  const response = await fetch(`${API_URL}/api/auth/refresh/`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) throw new Error("Log in on the CareerPipeline website first.")
  const { access } = await response.json()
  return access
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAccessToken()}`,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(Object.values(data).flat()[0] ?? `Request failed (${response.status})`)
  }
  return data
}

async function render() {
  message.textContent = ""
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const job = await chrome.tabs.sendMessage(tab.id, "readJob").catch(() => null)
  jobForm.elements.company.value = job?.company ?? ""
  jobForm.elements.job_title.value = job?.job_title ?? ""
  jobForm.elements.job_url.value = job?.job_url ?? ""
  if (!job) message.textContent = "Open a job posting on JobStreet, LinkedIn or Indeed."
}

jobForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  try {
    await api("/api/applications/", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(jobForm))),
    })
    message.textContent = "Saved to CareerPipeline."
  } catch (error) {
    message.textContent = error.message
  }
})

chrome.tabs.onActivated.addListener(render)
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if (tab.active && change.status === "complete") render()
})

render()
