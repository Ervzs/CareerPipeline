function linkedinId(url) {
  return url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ?? url.searchParams.get("currentJobId")
}

const SITES = [
  {
    hosts: /(^|\.)jobstreet\.com$/,
    jobUrl(url) {
      const id = url.pathname.match(/\/job\/(\d+)/)?.[1] ?? url.searchParams.get("jobId")
      return id ? `${url.origin}/job/${id}` : null
    },
    title: ['[data-automation="job-detail-title"]'],
    company: ['[data-automation="advertiser-name"]'],
  },
  {
    hosts: /(^|\.)indeed\.com$/,
    jobUrl(url) {
      const id = url.searchParams.get("jk") ?? url.searchParams.get("vjk")
      return id ? `${url.origin}/viewjob?jk=${id}` : null
    },
    title: ['[data-testid="vj-job-title"]', '[data-testid="vj-job-title-compact"]'],
    company: [
      '[data-testid="desktop-job-header"] a[href*="/cmp/"]',
      '[data-testid="desktop-embedded-compact-header"] a[href*="/cmp/"]',
    ],
  },
  {
    hosts: /(^|\.)linkedin\.com$/,
    jsonLd: true,
    jobUrl(url) {
      const id = linkedinId(url)
      return id ? `https://www.linkedin.com/jobs/view/${id}/` : null
    },
    find(url, doc) {
      const leaf = (selector) =>
        [...doc.querySelectorAll(selector)].find((e) => e.children.length === 0 && e.textContent.trim())
      return {
        job_title: leaf(`a[href*="/jobs/view/${linkedinId(url)}"]`)?.textContent.trim() ?? "",
        company: leaf('a[href*="/company/"]')?.textContent.trim() ?? "",
      }
    },
  },
]

function siteFor(hostname) {
  return SITES.find((site) => site.hosts.test(hostname)) ?? null
}

function textOf(doc, selectors) {
  for (const selector of selectors) {
    const text = doc.querySelector(selector)?.textContent?.trim().replace(/\s+/g, " ")
    if (text) return text
  }
  return ""
}

function findJobPosting(node) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== "object") return null
  if ([].concat(node["@type"] ?? []).includes("JobPosting")) return node
  return findJobPosting(node["@graph"])
}

function readJsonLd(doc) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = findJobPosting(JSON.parse(script.textContent))
      if (data) return { title: data.title ?? "", company: data.hiringOrganization?.name ?? "" }
    } catch {}
  }
  return null
}

function extractJob(href, doc) {
  const url = new URL(href)
  const site = siteFor(url.hostname)
  if (!site) return null
  const ld = site.jsonLd ? readJsonLd(doc) : null
  const job_url = site.jobUrl(url) ?? (site.jsonLd ? href : null)
  if (!job_url) return null
  const found = site.find?.(url, doc) ?? {}
  return {
    company: found.company || textOf(doc, site.company ?? []) || ld?.company || "",
    job_title: found.job_title || textOf(doc, site.title ?? []) || ld?.title || "",
    job_url,
  }
}