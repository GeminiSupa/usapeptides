import { Bullets, Prose } from '@/components/Longform';
import type { Block } from '@/content/knowledgeCenter';

export default function KnowledgeBlocks({ body }: { body: Block[] }) {
  return (
    <>
      {body.map((block, i) => {
        if (block.type === 'p') return <Prose key={i} body={[block.text]} muted />;
        if (block.type === 'ul') return <Bullets key={i} items={block.items} />;
        return (
          <ol key={i} className="max-w-[68ch] space-y-4">
            {block.items.map((item, n) => (
              <li key={item.title} className="flex gap-4">
                <span className="font-display text-sm font-extrabold text-brand-accentGlow">
                  {String(n + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xs font-extrabold uppercase tracking-wide text-brand-heading">
                    {item.title}
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-brand-textMuted">
                    {item.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        );
      })}
    </>
  );
}
