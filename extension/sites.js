// How to read a job (title, company, link) and spot the "application sent" screen on each
// job site. Job sites change their HTML often: when detection stops working, update the
// selectors and phrases here. `var` (not const) so the popup can inject this file into a tab
// that already has it without a "redeclared" error.

var SITES = [
  {
    id: 'linkedin',
    hosts: /(^|\.)linkedin\.com$/,
    // /jobs/view/123/ or a search page with ?currentJobId=123
    jobUrl(url) {
      const id =
        url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ?? url.searchParams.get('currentJobId')
      return id ? `https://www.linkedin.com/jobs/view/${id}/` : null
    },
    title: [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
    ],
    success: [/your application was sent/i],
  },
  {
    id: 'indeed',
    hosts: /(^|\.)indeed\.com$/,
    // /viewjob?jk=abc or a search page with ?vjk=abc. The apply flow runs on
    // smartapply.indeed.com, which has no job id, so the last job seen is used there.
    jobUrl(url) {
      const id = url.searchParams.get('jk') ?? url.searchParams.get('vjk')
      return id && url.hostname !== 'smartapply.indeed.com'
        ? `${url.origin}/viewjob?jk=${id}`
        : null
    },
    title: [
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobsearch-JobInfoHeader-title',
      'h1',
    ],
    company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]'],
    success: [/your application has been submitted/i, /application submitted/i],
  },
  {
    id: 'jobstreet',
    hosts: /(^|\.)jobstreet\.com$/,
    // /job/123, /job/123/apply... or a search page with ?jobId=123
    jobUrl(url) {
      const id = url.pathname.match(/\/job\/(\d+)/)?.[1] ?? url.searchParams.get('jobId')
      return id ? `${url.origin}/job/${id}` : null
    },
    title: ['[data-automation="job-detail-title"]', 'h1'],
    company: ['[data-automation="advertiser-name"]'],
    success: [/your application (has been|was) sent/i, /application (sent|submitted)/i],
  },
]

function siteFor(hostname) {
  return SITES.find((site) => site.hosts.test(hostname)) ?? null
}

function textOf(doc, selectors) {
  for (const selector of selectors) {
    const text = doc.querySelector(selector)?.textContent?.trim().replace(/\s+/g, ' ')
    if (text) return text
  }
  return ''
}

function meta(doc, property) {
  return doc.querySelector(`meta[property="${property}"]`)?.content?.trim() ?? ''
}

/** The job on this page, or null when the page shows no job (e.g. a plain search list). */
function extractJob(href, doc) {
  const url = new URL(href)
  const site = siteFor(url.hostname)
  if (site) {
    const listingUrl = site.jobUrl(url)
    const title = textOf(doc, site.title)
    if (!listingUrl || !title) return null
    return { listing_url: listingUrl, job_title: title, company_name: textOf(doc, site.company) }
  }
  // Any other site (e.g. a company careers page): best guess from the page metadata.
  return {
    listing_url: href.split('#')[0],
    job_title: meta(doc, 'og:title') || textOf(doc, ['h1']) || doc.title.trim(),
    company_name: meta(doc, 'og:site_name'),
  }
}

function isSuccessPage(hostname, doc) {
  const site = siteFor(hostname)
  const text = doc.body?.innerText ?? ''
  return Boolean(site && site.success.some((phrase) => phrase.test(text)))
}
