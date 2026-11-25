import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const str = (v) => typeof v === 'string' && v.length > 0
const arr = Array.isArray
const CHUNK_KEYS = ['hsk-1', 'hsk-2', 'hsk-3', 'hsk-4', 'hsk-5', 'hsk-6', 'hsk-7-9']

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
  for (const key of CHUNK_KEYS) {
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
        if (!str(v?.id) || !str(v?.hanzi) || !str(v?.pinyin) || !str(v?.hanViet) || !str(v?.meaningVi)) {
          if (cErrs.length < 5) cErrs.push(`${key}[${i}] missing required field (${v?.hanzi})`)
        }
      })
    }
    results.push({ name: `vocab/${key}.json`, errors: cErrs })
  }
  if (chunkSum !== meta.total) metaErrs.push(`Chunk sum (${chunkSum}) != meta.total (${meta.total})`)
  return results
}

export function validateAll(dataDir) {
  return validateVocabBank(dataDir)
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
  const res = validateAll(dir)
  let bad = 0
  for (const r of res) {
    console.log(`${r.errors.length ? 'FAIL' : 'PASS'}  ${r.name}`)
    r.errors.forEach((e) => console.log('   -', e))
    bad += r.errors.length
  }
  console.log(bad ? `\nFAILED: ${bad} errors` : `\nPASS: ${res.length} HSK 1-9 data files valid`)
  process.exit(bad ? 1 : 0)
}
