import type { Expansion } from '../../types/lesson'

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-3">
    <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-jade">{title}</h4>
    {children}
  </section>
)

export const hasExpansion = (e: Expansion) =>
  e.synonyms.length + e.antonyms.length + e.collocations.length + e.relatedWords.length + e.examples.length > 0

export default function ExpansionView({ e }: { e: Expansion }) {
  if (!hasExpansion(e)) return <p className="text-xs text-muted">Chưa có ghi chú mở rộng cho mục từ này.</p>
  return (
    <div className="text-sm space-y-2">
      {e.synonyms.length > 0 && (
        <Sec title="Từ đồng nghĩa (近义词)">
          <ul className="space-y-1.5">
            {e.synonyms.map((s) => (
              <li key={s.hanzi} className="glass-subtle p-2.5">
                <span className="hanzi font-bold">{s.hanzi}</span> <span className="text-muted text-xs">{s.pinyin}</span> — {s.meaningVi}
                {s.nuanceVi && <div className="text-xs text-muted mt-0.5">↳ {s.nuanceVi}</div>}
              </li>
            ))}
          </ul>
        </Sec>
      )}
      {e.antonyms.length > 0 && (
        <Sec title="Từ trái nghĩa (反义词)">
          <div className="flex flex-wrap gap-1.5">
            {e.antonyms.map((a) => (
              <span key={a.hanzi} className="soft-chip !bg-terracotta-soft !text-terracotta">
                <span className="hanzi font-bold">{a.hanzi}</span> · {a.meaningVi}
              </span>
            ))}
          </div>
        </Sec>
      )}
      {e.collocations.length > 0 && (
        <Sec title="Cụm từ kết hợp (搭配)">
          <ul className="space-y-1">
            {e.collocations.map((c) => (
              <li key={c.zh}>
                <span className="hanzi font-semibold">{c.zh}</span> <span className="text-xs text-muted">{c.pinyin}</span> — {c.vi}
              </li>
            ))}
          </ul>
        </Sec>
      )}
      {e.examples.length > 0 && (
        <Sec title="Câu ví dụ song ngữ">
          <ul className="space-y-2">
            {e.examples.map((x) => (
              <li key={x.zh} className="glass-subtle p-2.5">
                <div className="hanzi font-medium">{x.zh}</div>
                <div className="text-xs text-muted">{x.pinyin}</div>
                <div className="text-xs mt-0.5">{x.vi}</div>
              </li>
            ))}
          </ul>
        </Sec>
      )}
    </div>
  )
}
