// Keeps the project cards current: pulls each linked repository's metadata (last push,
// stars, language, homepage) from the GitHub API into src/content/github.generated.json,
// which the cards read for their "Updated <month>" line.
//
// Runs before every build (npm "prebuild"), so each deploy refreshes the dates. With
// --soft, any network or rate-limit failure keeps the committed file and exits cleanly:
// a GitHub hiccup must never break a deploy. Set GITHUB_TOKEN for a higher rate limit.
//
// Curated copy (descriptions, facts) is NOT pulled from GitHub on purpose: repo
// descriptions are short and unreviewed, while the cards' wording follows each repo's
// own claims rules (see docs/CONTENT_SOURCES.md).

import { readFile, writeFile } from 'node:fs/promises'
import { projects } from '../src/content/projects.js'

const OUT = new URL('../src/content/github.generated.json', import.meta.url)
const soft = process.argv.includes('--soft')

const toSlug = (url) => url.replace('https://github.com/', '').split('/tree/')[0]
const slugs = [...new Set(projects.map((p) => p.repo).filter(Boolean).map(toSlug))]

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'karthik-sengupta-portfolio-sync' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function fetchRepo(slug) {
  const res = await fetch(`https://api.github.com/repos/${slug}`, { headers, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`)
  const j = await res.json()
  return {
    pushedAt: j.pushed_at,
    stars: j.stargazers_count,
    language: j.language,
    homepage: j.homepage || null,
    archived: j.archived,
  }
}

try {
  const repos = {}
  for (const slug of slugs) repos[slug] = await fetchRepo(slug)
  const next = { syncedAt: new Date().toISOString(), repos }
  // Only rewrite when something other than the timestamp changed, so builds don't churn git.
  let previous = null
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'))
  } catch {
    // first run
  }
  if (previous && JSON.stringify(previous.repos) === JSON.stringify(repos)) {
    console.log(`sync-github: ${slugs.length} repos, no changes`)
  } else {
    await writeFile(OUT, JSON.stringify(next, null, 2) + '\n')
    console.log(`sync-github: updated ${slugs.length} repos`)
  }
} catch (err) {
  if (!soft) throw err
  console.warn(`sync-github: skipped (${err.message}); keeping the committed metadata`)
}
