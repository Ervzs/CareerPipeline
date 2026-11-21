chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === "readJob") reply(extractJob(location.href, document))
})

let timer
new MutationObserver(() => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      chrome.runtime.sendMessage("jobChanged").catch(() => {})
    } catch {}
  }, 500)
}).observe(document.documentElement, { childList: true, subtree: true })