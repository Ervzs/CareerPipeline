function readJob() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(script.textContent)
    if (data["@type"] === "JobPosting") {
      return {
        company: data.hiringOrganization?.name ?? "",
        job_title: data.title,
        job_url: location.href,
      }
    }
  }
  return { company: "", job_title: document.title, job_url: location.href }
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === "readJob") reply(readJob())
})
