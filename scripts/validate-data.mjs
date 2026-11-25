import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const str = (v) => typeof v === 'string' && v.length > 0
const arr = Array.isArray
const VOCAB_CHUNK_KEYS = ['hsk-1', 'hsk-2', 'hsk-3', 'hsk-4', 'hsk-5', 'hsk-6', 'hsk-7-9', 'extra']
const CORE_KEYS = ['hsk-1', 'hsk-2', 'hsk-3', 'hsk-4', 'hsk-5', 'hsk-6', 'hsk-7-9']

export function validateVocabBank(dataDir) {
  const results = []
  const metaPath = join(dataDir, 'vocab', 'vocab-meta.json')
  if (!existsSync(metaPath)) return [{ name: 'vocab/vocab-meta.json', errors: ['Missing vocab-meta.json'] }]
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  const metaErrs = []
  if (typeof meta.total !== 'number' || meta.total < 10000) metaErrs.push('meta.total < 10000')
  results.push({ name: 'vocab/vocab-meta.json', errors: metaErrs })

  const idxPath = join(dataDir, 'vocab', 'search-index.json')
  if (!existsSync(idxPath)) results.push({ name: 'vocab/search-index.json', errors: ['Missing search-index.json'] })
  else {
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'))
    const idxErrs = []
    if (!arr(idx) || idx.length !== meta.total) idxErrs.push(`search-index length (${idx?.length}) != meta.total (${meta.total})`)
    else {
      for (let i = 0; i < idx.length; i++) {
        const r = idx[i]
        if (!arr(r) || r.length < 9 || !str(r[0]) || !str(r[1]) || !str(r[4]) || !str(r[5])) {
          idxErrs.push(`search-index[${i}] invalid row`)
          break
        }
      }
    }
    results.push({ name: 'vocab/search-index.json', errors: idxErrs })
  }

  let chunkSum = 0
  const seenIds = new Set()
  for (const key of VOCAB_CHUNK_KEYS) {
    const cp = join(dataDir, 'vocab', `${key}.json`)
    if (!existsSync(cp)) {
      results.push({ name: `vocab/${key}.json`, errors: [`Missing chunk ${key}.json`] })
      continue
    }
    const items = JSON.parse(readFileSync(cp, 'utf8'))
    const cErrs = []
    if (!arr(items) || items.length === 0) cErrs.push('chunk empty')
    else {
      chunkSum += items.length
      if (meta.chunks?.[key] !== items.length) cErrs.push(`meta.chunks[${key}] != ${items.length}`)
      items.forEach((v, i) => {
        if (seenIds.has(v?.id)) {
          if (cErrs.length < 5) cErrs.push(`${key}[${i}] duplicate id ${v.id}`)
        }
        seenIds.add(v?.id)
        if (!str(v?.id) || !str(v?.hanzi) || !str(v?.pinyin) || !str(v?.hanViet) || !str(v?.meaningVi) || !str(v?.pos) || !str(v?.meaningEn)) {
          if (cErrs.length < 5) cErrs.push(`${key}[${i}] missing required field (${v?.hanzi})`)
        }
      })
    }
    results.push({ name: `vocab/${key}.json`, errors: cErrs })
  }
  if (chunkSum !== meta.total) metaErrs.push(`Chunk sum (${chunkSum}) != meta.total (${meta.total})`)

  const cumTargets = [
    ['hsk-1', 290, 310],
    ['hsk-2', 485, 515],
    ['hsk-3', 960, 1030],
    ['hsk-4', 1940, 2060],
    ['hsk-5', 3480, 3700],
    ['hsk-6', 5200, 5550],
  ]
  for (const [key, min, max] of cumTargets) {
    const val = meta.hsk3CoreCumulative?.[key] ?? 0
    if (val < min || val > max) metaErrs.push(`hsk3CoreCumulative[${key}]=${val} outside ${min}..${max}`)
  }

  return results
}

export function validateExamplesBank(dataDir) {
  const results = []
  const metaPath = join(dataDir, 'examples', 'examples-meta.json')
  if (!existsSync(metaPath)) return [{ name: 'examples/examples-meta.json', errors: ['Missing examples-meta.json'] }]
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  const metaErrs = []
  for (const key of CORE_KEYS) {
    const ep = join(dataDir, 'examples', `${key}.json`)
    if (!existsSync(ep)) {
      results.push({ name: `examples/${key}.json`, errors: [`Missing ${key}.json`] })
      continue
    }
    const rows = JSON.parse(readFileSync(ep, 'utf8'))
    const errs = []
    if (!arr(rows) || rows.length === 0) errs.push('examples chunk empty')
    else {
      rows.slice(0, 50).forEach((ex, i) => {
        if (!str(ex?.id) || !str(ex?.wordId) || !str(ex?.zh) || !str(ex?.vi)) {
          errs.push(`${key}[${i}] invalid example`)
        }
      })
    }
    results.push({ name: `examples/${key}.json`, errors: errs })
  }
  if ((meta.totalExamples ?? 0) < 3000) metaErrs.push('totalExamples < 3000')
  results.push({ name: 'examples/examples-meta.json', errors: metaErrs })
  return results
}

export function validateGrammarBank(dataDir) {
  const results = []
  for (const lvl of [1, 2, 3]) {
    const gp = join(dataDir, 'grammar', `hsk-${lvl}.json`)
    if (!existsSync(gp)) {
      results.push({ name: `grammar/hsk-${lvl}.json`, errors: [`Missing grammar/hsk-${lvl}.json`] })
      continue
    }
    const items = JSON.parse(readFileSync(gp, 'utf8'))
    const errs = []
    if (!arr(items) || items.length < 24) errs.push(`expected >=24 lessons, got ${items?.length}`)
    else {
      const ids = new Set()
      items.forEach((g, i) => {
        if (ids.has(g.id)) errs.push(`duplicate grammar id ${g.id}`)
        ids.add(g.id)
        if (!str(g.title) || !str(g.formula) || !str(g.explanationVi) || !arr(g.examples) || g.examples.length < 2 || !arr(g.exercises) || g.exercises.length < 4) {
          if (errs.length < 5) errs.push(`lesson[${i}] (${g?.id}) incomplete schema`)
        }
      })
    }
    results.push({ name: `grammar/hsk-${lvl}.json`, errors: errs })
  }
  return results
}

export function validateExamsBank(dataDir) {
  const results = []
  const trendsPath = join(dataDir, 'exams', 'trends.json')
  if (!existsSync(trendsPath)) results.push({ name: 'exams/trends.json', errors: ['Missing trends.json'] })
  else {
    const tr = JSON.parse(readFileSync(trendsPath, 'utf8'))
    results.push({ name: 'exams/trends.json', errors: arr(tr) && tr.length === 6 ? [] : ['Expected 6 trend items'] })
  }

  for (const lvl of [3, 4, 5, 6]) {
    const ep = join(dataDir, 'exams', `hsk-${lvl}.json`)
    if (!existsSync(ep)) {
      results.push({ name: `exams/hsk-${lvl}.json`, errors: [`Missing exams/hsk-${lvl}.json`] })
      continue
    }
    const papers = JSON.parse(readFileSync(ep, 'utf8'))
    const errs = []
    if (!arr(papers) || papers.length < 3) errs.push(`expected >=3 papers for HSK ${lvl}`)
    else {
      papers.forEach((p, pi) => {
        if (!arr(p.questions) || p.questions.length < 15) errs.push(`paper[${pi}] has <15 questions`)
        p.questions?.forEach((q, qi) => {
          if (q.kind !== 'writing_prompt' && q.kind !== 'translation_prompt') {
            if (!arr(q.options) || q.options.length !== 4 || typeof q.correctIndex !== 'number') {
              if (errs.length < 5) errs.push(`paper[${pi}].q[${qi}] invalid MCQ`)
            }
            if (!q.coaching || !str(q.coaching.trap) || !str(q.coaching.tip) || !q.coaching.miniExample) {
              if (errs.length < 5) errs.push(`paper[${pi}].q[${qi}] missing 3-layer coaching`)
            }
          }
        })
      })
    }
    results.push({ name: `exams/hsk-${lvl}.json`, errors: errs })
  }
  return results
}

export function validateAll(dataDir) {
  return [
    ...validateVocabBank(dataDir),
    ...validateExamplesBank(dataDir),
    ...validateGrammarBank(dataDir),
    ...validateExamsBank(dataDir),
  ]
}

function walkFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walkFiles(p))
    else out.push(p)
  }
  return out
}

export function scanDistForLeaks(distDir) {
  const files = walkFiles(distDir)
  const bundleLeaks = []
  const dataLeaks = []
  let maiBundleCount = 0

  for (const fp of files) {
    const rel = fp.slice(distDir.length + 1).replace(/\\/g, '/')
    if (!/\.(html|js|css|json|webmanifest|txt)$/i.test(rel)) continue
    const txt = readFileSync(fp, 'utf8')
    const isData = rel.startsWith('data/')
    const patterns = isData
      ? [
          ['admin@', /admin@/gi],
          ['zhweb', /zhweb/gi],
          ['Khánh Mai', /Khánh Mai|Cô Khánh/gi],
        ]
      : [
          ['admin@', /admin@/gi],
          ['zhweb', /zhweb/gi],
          ['Khánh', /Khánh/gi],
        ]

    for (const [label, rx] of patterns) {
      const m = txt.match(rx)
      if (m && m.length > 0) {
        ;(isData ? dataLeaks : bundleLeaks).push(`${rel}: ${label} x${m.length}`)
      }
    }
    if (!isData) {
      const maiM = txt.match(/Mai/g)
      if (maiM) maiBundleCount += maiM.length
    }
  }
  return { bundleLeaks, dataLeaks, maiBundleCount }
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const dir = join(root, 'public', 'data')
  const res = validateAll(dir)
  let bad = 0
  for (const r of res) {
    console.log(`${r.errors.length ? 'FAIL' : 'PASS'}  ${r.name}`)
    r.errors.forEach((e) => console.log('   -', e))
    bad += r.errors.length
  }

  if (process.argv.includes('--check-dist')) {
    const distDir = join(root, 'dist')
    if (!existsSync(distDir)) {
      console.error('FAIL  dist/ directory not found (run npm run build first)')
      process.exit(1)
    }
    const scan = scanDistForLeaks(distDir)
    console.log(`\nDIST_SCAN: bundleLeaks=${scan.bundleLeaks.length}, dataLeaks=${scan.dataLeaks.length}, Mai_in_bundle=${scan.maiBundleCount}`)
    scan.bundleLeaks.forEach((l) => console.error('   LEAK(bundle):', l))
    scan.dataLeaks.forEach((l) => console.error('   LEAK(data):', l))
    if (scan.bundleLeaks.length || scan.dataLeaks.length) bad += scan.bundleLeaks.length + scan.dataLeaks.length
  }

  console.log(bad ? `\nFAILED: ${bad} errors` : `\nPASS: ${res.length} HSK v1.2 datasets valid`)
  process.exit(bad ? 1 : 0)
}
