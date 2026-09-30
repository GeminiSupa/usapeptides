import type { Metadata } from 'next';
import { BUSINESS } from '@/lib/env';
import { Disclosure, PageHeader, Prose, Related, ResearchUseNote } from '@/components/Longform';
import { KNOWLEDGE_FAQS } from '@/content/knowledgeCenter';

const NAME = BUSINESS.name;

export const metadata: Metadata = {
  title: 'Research peptides and laboratory handling',
  description:
    'Answers about research-use classification, independent testing, lot matching, storage, and laboratory handling.',
  alternates: { canonical: '/research/laboratory-handling' },
};

export default function LaboratoryHandlingPage() {
  return (
    <div className="shell space-y-10 py-12">
      <PageHeader
        eyebrow="Research"
        title="Research peptides and laboratory handling"
        intro={[
          'These answers cover research-use classification, independent testing, lot matching, storage, and what to do if a shipment is compromised.',
        ]}
      />
      <div className="max-w-4xl space-y-3">
        {KNOWLEDGE_FAQS.map((faq) => (
          <Disclosure key={faq.question} summary={faq.question} openLabel="Answer">
            <Prose body={[faq.answer]} muted />
          </Disclosure>
        ))}
      </div>
      <Related
        links={[
          { href: '/research', label: 'All research topics' },
          { href: '/research/glossary', label: 'Glossary' },
          { href: '/faq', label: 'General FAQ' },
          { href: '/contact-us', label: 'Contact support' },
        ]}
      />
      <ResearchUseNote>
        {`Educational content is for informational purposes and does not replace laboratory protocols, institutional requirements, manufacturer instructions, or professional scientific judgment. Products sold by ${NAME} are intended for laboratory and research use only and are not intended for human or veterinary use.`}
      </ResearchUseNote>
    </div>
  );
}
