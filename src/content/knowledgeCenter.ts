/**
 * Knowledge Center copy, written for the business by its content lawyer.
 *
 * Kept as data, not markup, so the page stays one layout and the writer can
 * hand over new articles without touching a component. The business name is
 * interpolated rather than typed in, so another store reusing this template
 * does not inherit ours.
 */

import { BUSINESS } from '@/lib/env';

const NAME = BUSINESS.name;

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'steps'; items: { title: string; text: string }[] };

export interface KnowledgeArticle {
  id: string;
  title: string;
  /** Shown while the article is closed; the rest is behind "read more". */
  summary: string;
  body: Block[];
  related?: { href: string; label: string }[];
}

export const KNOWLEDGE_INTRO = [
  `${NAME}'s Research section is designed to inform researchers on topics such as product identity and purity, storage, handling, and research-material terminology.`,
  'These articles explain what a term means, what a test can and cannot establish, how to read supporting documentation, and where uncertainty remains.',
];

export const researchHref = (slug: string) => `/research/${slug}`;

const COA_LINK = { href: '/coa-database', label: 'COA database' };
const STANDARDS_LINK = { href: '/quality-standards', label: 'Quality standards' };
const HPLC_LINK = { href: researchHref('what-hplc-can-tell-you'), label: 'What HPLC can and cannot tell you' };
const COA_ARTICLE_LINK = { href: researchHref('how-to-read-a-coa'), label: 'How to read a Certificate of Analysis' };
const PURITY_LINK = { href: researchHref('purity-identity-concentration-mass'), label: 'Understanding purity, identity, concentration, and mass' };
const VERIFY_LINK = { href: researchHref('verify-documentation'), label: 'How to verify documentation before beginning research' };
const INDEPENDENT_LINK = { href: researchHref('independent-testing'), label: 'How independent laboratory testing works' };

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'how-to-read-a-coa',
    title: 'How to read a Certificate of Analysis',
    summary:
      'A Certificate of Analysis should be treated as analytical documentation, not a marketing claim. The first question is not “what is the purity percentage?” It is “what was tested, and can this report be connected to the material in front of me?”',
    body: [
      {
        type: 'p',
        text: 'Start with product identity. Confirm that the compound or research material named on the COA matches the product being evaluated. Next, check the lot number or sample identifier. A report tied to a different lot may not describe the specific material you received.',
      },
      {
        type: 'p',
        text: 'Then review the testing laboratory, test date, and analytical method. These details provide context for the reported results. If the report includes HPLC data, look beyond the headline percentage and review the chromatogram and method information where available. If identity testing such as mass spectrometry is included, confirm what the test was designed to establish.',
      },
      { type: 'p', text: 'The most useful COAs should make it possible to answer several basic questions:' },
      {
        type: 'ul',
        items: [
          'What material was tested?',
          'Which lot or sample was tested?',
          'Who performed the analysis?',
          'When was it tested?',
          'Which analytical method was used?',
          'What did that method actually measure?',
          'Do the reported results match the claims being made about the material?',
        ],
      },
      {
        type: 'p',
        text: 'A COA should also be read for its limits. One test does not automatically establish every characteristic of a research material. For example, a chromatographic purity result does not by itself prove identity, concentration, sterility, or suitability for a particular experiment unless those characteristics were separately evaluated.',
      },
      {
        type: 'p',
        text: 'Before beginning research, compare the lot information on the product with the report available in the COA database. If the product, lot, or analytical documentation does not match, contact support before relying on the report.',
      },
    ],
    related: [STANDARDS_LINK, COA_LINK, INDEPENDENT_LINK],
  },
  {
    id: 'what-hplc-can-tell-you',
    title: 'What HPLC can — and cannot — tell you',
    summary:
      'High-performance liquid chromatography is one of the most widely used techniques for separating and measuring components in a sample. That makes it valuable, but it matters what the result actually means.',
    body: [
      {
        type: 'p',
        text: 'In peptide research, HPLC is commonly used to evaluate chromatographic purity by showing how much of the detected signal is associated with the primary peak compared with other detectable components under the test conditions.',
      },
      {
        type: 'p',
        text: 'HPLC can help show whether a sample contains one dominant chromatographic component and whether additional detectable peaks are present. It can also provide a reported purity percentage based on the method used by the laboratory.',
      },
      {
        type: 'p',
        text: 'What HPLC cannot do by itself is establish every property of the material. A high HPLC purity percentage does not automatically prove:',
      },
      {
        type: 'ul',
        items: [
          'Molecular identity',
          'Exact mass or quantity',
          'Concentration after preparation',
          'Sterility',
          'Absence of every possible contaminant',
          'Stability over time',
          'Suitability for a particular research protocol',
        ],
      },
      { type: 'p', text: 'These are different analytical questions and may require different methods.' },
      {
        type: 'p',
        text: `This is why ${NAME} treats HPLC as part of a broader documentation system rather than a stand-alone marketing number. A meaningful HPLC result should be reviewed with the sample identification, lot information, laboratory, test date, analytical method, chromatogram, and any complementary testing that may be available.`,
      },
      {
        type: 'p',
        text: 'When comparing reports, researchers should also avoid assuming that two percentages generated by different methods, instruments, laboratories, or sample conditions are directly interchangeable.',
      },
      {
        type: 'p',
        text: 'The practical rule is simple: read the full report, understand what the method measured, and avoid treating one number as proof of characteristics the test was never designed to establish.',
      },
    ],
    related: [COA_LINK, STANDARDS_LINK, PURITY_LINK],
  },
  {
    id: 'purity-identity-concentration-mass',
    title: 'Understanding purity, identity, concentration, and mass',
    summary:
      'These are related analytical concepts, but they are not interchangeable. One measurement does not automatically establish another.',
    body: [
      {
        type: 'p',
        text: 'Purity generally describes how much of the detected material corresponds to the primary component under a particular analytical method. An HPLC purity result, for example, may describe the relative area of the primary chromatographic peak compared with other detectable peaks.',
      },
      {
        type: 'p',
        text: 'Identity asks a different question: is the material actually the compound it is represented to be? Identity may be evaluated using techniques designed to characterize molecular properties, such as mass spectrometry or other analytical methods.',
      },
      {
        type: 'p',
        text: 'Mass refers to the amount of material present, commonly expressed in units such as milligrams. A vial labeled with a nominal amount describes the stated quantity, but analytical confirmation of quantity requires an appropriate quantitative method.',
      },
      {
        type: 'p',
        text: 'Concentration describes how much material is present within a defined volume or mixture. Concentration is therefore different from both purity and total mass.',
      },
      {
        type: 'p',
        text: 'These distinctions matter because one measurement does not automatically establish another. A sample can show high chromatographic purity while still requiring separate analytical work to establish identity or quantity. Likewise, confirming molecular identity does not automatically establish how much material is present.',
      },
      { type: 'p', text: 'When reviewing documentation, ask which question each analytical result actually answers:' },
      {
        type: 'ul',
        items: [
          'Purity: how dominant is the primary detected component?',
          'Identity: is the detected material consistent with the expected compound?',
          'Mass: how much material is present?',
          'Concentration: how much material exists per unit of volume?',
        ],
      },
      {
        type: 'p',
        text: 'Keeping those concepts separate makes analytical documentation easier to interpret and reduces the risk of drawing conclusions that the underlying test does not support.',
      },
    ],
    related: [HPLC_LINK, COA_ARTICLE_LINK, STANDARDS_LINK],
  },
  {
    id: 'why-lot-numbers-matter',
    title: 'Why lot numbers matter',
    summary:
      'A lot number is more than an inventory code. It is the link between a physical research material and the records associated with a particular production or packaging batch.',
    body: [
      {
        type: 'p',
        text: 'When a supplier receives or prepares material in separate lots, each lot may have its own sourcing history, handling records, labeling information, and analytical documentation. That means a test performed on one lot should not automatically be assumed to describe every later lot of the same product.',
      },
      { type: 'p', text: 'Lot-specific documentation improves traceability by allowing researchers to connect:' },
      {
        type: 'ul',
        items: [
          'The product received',
          'The lot or batch identifier',
          'The applicable analytical report',
          'The test date',
          'The testing laboratory',
          'Any quality or fulfillment records associated with that batch',
        ],
      },
      {
        type: 'p',
        text: `This is why ${NAME} emphasizes lot matching. When an order arrives, the lot information on the product should be compared with the documentation available in the COA database. If the lot number on the product and the lot number on the analytical report do not match, the report should not automatically be treated as evidence for that material.`,
      },
      {
        type: 'p',
        text: 'Lot numbers also matter when a quality issue is identified. Clear lot identification makes it easier to investigate whether a concern affects one item, one shipment, one batch, or a broader set of materials.',
      },
      {
        type: 'p',
        text: 'Traceability reduces ambiguity. Instead of asking whether a product name was ever tested, researchers can ask the more useful question: was this specific lot tested, and can I review the applicable documentation?',
      },
    ],
    related: [COA_LINK, STANDARDS_LINK, VERIFY_LINK],
  },
  {
    id: 'independent-testing',
    title: 'How independent laboratory testing works',
    summary:
      'Independent laboratory testing means analytical work is performed by a laboratory that is separate from the company selling the research material.',
    body: [
      {
        type: 'p',
        text: 'The basic process begins with a sample submitted for analysis. The laboratory identifies the sample using the information provided with it, performs the requested analytical method or methods, and reports the findings associated with that tested sample.',
      },
      {
        type: 'p',
        text: 'Depending on the material and the purpose of the analysis, testing may include chromatographic methods such as HPLC, identity-focused methods such as mass spectrometry, or other analytical techniques.',
      },
      {
        type: 'p',
        text: 'The important point is that a laboratory report describes the sample that was actually tested. It should not automatically be extended to different lots, different products, or characteristics that were not evaluated.',
      },
      { type: 'p', text: 'When reviewing independent laboratory documentation, researchers should look for:' },
      {
        type: 'ul',
        items: [
          'Clear sample or product identification',
          'Lot or batch reference where applicable',
          'Laboratory identity',
          'Date of analysis',
          'Test method',
          'Reported findings',
          'Supporting chromatograms, spectra, or other analytical data where provided',
        ],
      },
      {
        type: 'p',
        text: 'Independent testing is valuable because it creates separation between the seller’s marketing claims and the analytical measurement. But “third-party tested” should still not be treated as a substitute for reading the report itself.',
      },
      {
        type: 'p',
        text: `${NAME}'s approach is to make applicable analytical documentation accessible so researchers can evaluate the evidence directly.`,
      },
    ],
    related: [COA_LINK, COA_ARTICLE_LINK, STANDARDS_LINK],
  },
  {
    id: 'storage-and-handling',
    title: 'Research-material storage and handling basics',
    summary:
      'Temperature, moisture, light exposure, contamination, repeated handling, and other conditions may influence sample integrity.',
    body: [
      {
        type: 'p',
        text: 'Research materials can be affected by their environment. Temperature, moisture, light exposure, contamination, repeated handling, and other conditions may influence sample integrity.',
      },
      {
        type: 'p',
        text: 'Because storage requirements vary by compound and product format, the first source of guidance should always be the specifications shown on the product label, product page, or applicable technical documentation.',
      },
      { type: 'p', text: 'General laboratory handling principles include:' },
      {
        type: 'ul',
        items: [
          'Keep materials in appropriate containers.',
          'Follow the stated storage-temperature requirements.',
          'Protect materials from unnecessary moisture or light when specified.',
          'Minimize contamination by using clean laboratory practices.',
          'Clearly identify containers and preserve lot information.',
          'Avoid unnecessary repeated exposure to changing environmental conditions.',
          'Maintain records when chain of custody or sample history is important to the research.',
        ],
      },
      {
        type: 'p',
        text: 'Lyophilized materials are produced through a freeze-drying process that removes water under controlled conditions. This format can support storage and transportation, but lyophilization does not eliminate the need for appropriate handling.',
      },
      {
        type: 'p',
        text: `Researchers should also distinguish between supplier storage information and experimental preparation procedures. ${NAME} provides research-material information and documentation but does not provide instructions for human or veterinary administration.`,
      },
      {
        type: 'p',
        text: 'If a material arrives damaged, improperly labeled, or visibly compromised, do not rely on it for research until the issue has been reviewed. Contact support and retain the packaging and identifying information.',
      },
    ],
    related: [
      { href: '/shipping-policy', label: 'Shipping policy' },
      { href: '/return-refund-policy', label: 'Return policy' },
      STANDARDS_LINK,
    ],
  },
  {
    id: 'verify-documentation',
    title: 'How to verify documentation before beginning research',
    summary:
      'Documentation should be verified before it is relied upon. Start with the product itself, then find the report that matches its lot.',
    body: [
      {
        type: 'p',
        text: 'Record the product name, lot number, and any other identifying information on the label. Then locate the corresponding analytical documentation in the COA database or on the applicable product page, and work through the verification process below.',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Match the product name',
            text: 'The material identified on the report should correspond to the product being evaluated.',
          },
          {
            title: 'Match the lot number',
            text: 'Confirm that the lot or sample reference on the documentation matches the lot on the physical product.',
          },
          {
            title: 'Check the laboratory',
            text: 'Identify who performed the analysis and whether the report clearly identifies the issuing laboratory.',
          },
          { title: 'Check the test date', text: 'The report should show when the sample was analyzed.' },
          {
            title: 'Identify the analytical method',
            text: 'Determine whether the report uses HPLC, mass spectrometry, or another method, and understand what that method is designed to measure.',
          },
          {
            title: 'Read the full result',
            text: 'Do not rely only on a headline purity percentage. Review the chromatogram, reported findings, sample identification, and supporting information where available.',
          },
          {
            title: 'Separate what was tested from what was not',
            text: 'Do not assume that a purity result proves identity, quantity, sterility, stability, or another characteristic unless the documentation specifically supports that conclusion.',
          },
          {
            title: 'Resolve mismatches before proceeding',
            text: 'If the product, lot number, report, or other documentation appears inconsistent, contact support before relying on the material for research.',
          },
        ],
      },
      {
        type: 'p',
        text: 'Verification is not complicated, but it requires discipline. The goal is to create a clear chain between the research material, its identifying information, and the evidence associated with that specific lot.',
      },
      {
        type: 'p',
        text: `That process is central to ${NAME}'s operating principle: Trust. Verified.`,
      },
    ],
    related: [COA_LINK, STANDARDS_LINK, { href: '/faq', label: 'FAQ' }, { href: '/contact-us', label: 'Support' }],
  },
];

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Amino acid', definition: 'An organic compound that serves as a building block of peptides and proteins.' },
  { term: 'Analytical data', definition: 'Measurements or outputs produced by a laboratory method, such as chromatograms, spectra, peak data, or reported numerical results.' },
  { term: 'Analytical method', definition: 'A defined laboratory technique or procedure used to measure, separate, identify, or characterize a sample.' },
  { term: 'Analytical report', definition: 'A laboratory document presenting the sample identification, method, date, results, and other information associated with an analysis.' },
  { term: 'Assay', definition: 'A laboratory test or analytical procedure used to measure or evaluate a specified property of a sample. The meaning depends on the particular method used.' },
  { term: 'Batch', definition: 'A defined quantity of material produced, received, packaged, or processed under related conditions.' },
  { term: 'Calibration', definition: 'The process of comparing an instrument or measurement system with a known reference so its response can be evaluated or adjusted.' },
  { term: 'Certificate of Analysis (COA)', definition: 'A document reporting analytical information associated with a tested sample or lot. A COA should be interpreted within the limits of the methods actually performed.' },
  { term: 'Chain of custody', definition: 'A documented history showing how a sample or material was received, handled, transferred, stored, or tested.' },
  { term: 'Chromatogram', definition: 'The visual output of a chromatographic analysis, usually displaying detected signal as peaks over time or another separation dimension.' },
  { term: 'Chromatography', definition: 'A family of analytical techniques used to separate components of a mixture so they can be detected, compared, or measured.' },
  { term: 'Compound', definition: 'A substance with a defined chemical composition or structure.' },
  { term: 'Concentration', definition: 'The amount of a substance present within a defined volume or mixture.' },
  { term: 'Contaminant', definition: 'An unintended substance or material present in a sample. Whether a method can detect a particular contaminant depends on the method and test design.' },
  { term: 'Documentation', definition: 'Records associated with a research material, such as labels, lot identifiers, analytical reports, specifications, and handling information.' },
  { term: 'HPLC', definition: 'High-performance liquid chromatography, a chromatographic technique used to separate and measure components in a sample. In peptide analysis, it is commonly used to report chromatographic purity under defined test conditions.' },
  { term: 'Identity', definition: 'Analytical evidence addressing whether a material is consistent with the compound it is represented to be.' },
  { term: 'Independent testing', definition: 'Analysis performed by a laboratory separate from the seller of the material.' },
  { term: 'Laboratory reference material', definition: 'Material used for analytical, comparison, calibration, method-development, or research purposes.' },
  { term: 'Lot', definition: 'A defined production, packaging, receiving, or inventory grouping associated with a particular set of records.' },
  { term: 'Lot number', definition: 'An identifier used to connect a product with a specific lot or batch and its associated records.' },
  { term: 'Lot-specific documentation', definition: 'Documentation tied to an identifiable lot rather than to a product name in general.' },
  { term: 'Lyophilization', definition: 'A freeze-drying process that removes water under controlled low-temperature and reduced-pressure conditions.' },
  { term: 'Lyophilized', definition: 'Freeze-dried; a material format produced through lyophilization.' },
  { term: 'Mass', definition: 'The amount of material present, commonly expressed in units such as milligrams. Confirming quantity requires an appropriate quantitative method.' },
  { term: 'Mass spectrometry (MS)', definition: 'An analytical technique that measures mass-to-charge characteristics and can help support molecular identification or characterization.' },
  { term: 'Method', definition: 'The defined analytical procedure used by a laboratory, including relevant instrument conditions, preparation steps, and measurement approach.' },
  { term: 'Method validation', definition: 'A documented evaluation of whether an analytical method is suitable for its intended measurement purpose. The scope of validation varies by method and laboratory context.' },
  { term: 'Molecular weight', definition: 'The calculated or measured mass associated with a molecule, commonly expressed in daltons or related units.' },
  { term: 'Peak', definition: 'A signal feature on a chromatogram or spectrum associated with detected material under the conditions of the method.' },
  { term: 'Peptide', definition: 'A chain of amino acids linked by peptide bonds. Peptides can vary in sequence, length, structure, and analytical characteristics.' },
  { term: 'Peptide sequence', definition: 'The ordered arrangement of amino acids in a peptide.' },
  { term: 'Product identifier', definition: 'Information used to distinguish a specific research material, such as product name, catalog number, lot number, sample identifier, or other assigned code.' },
  { term: 'Purity', definition: 'A measurement describing the relative proportion of the primary detected component under the analytical method used. Purity does not automatically establish identity, quantity, sterility, or suitability for a particular experiment.' },
  { term: 'Qualitative analysis', definition: 'Analysis intended primarily to determine what is present or whether a characteristic is detected, rather than how much is present.' },
  { term: 'Quantitative analysis', definition: 'Analysis intended to determine the amount or concentration of a substance using an appropriate measurement method.' },
  { term: 'Reference standard', definition: 'A material with defined characteristics used as a comparison or calibration reference in an analytical procedure.' },
  { term: 'Research peptide', definition: 'Peptide material supplied for laboratory, analytical, educational, or research investigation rather than for therapeutic or consumer use.' },
  { term: 'Research use only (RUO)', definition: 'A designation indicating that a material is supplied for legitimate laboratory, analytical, educational, or research applications and is not intended for human or veterinary administration.' },
  { term: 'Retention time', definition: 'The time a component takes to pass through a chromatographic system and produce a detected signal under specified method conditions.' },
  { term: 'Sample', definition: 'The specific portion of material submitted for testing or used in an analysis.' },
  { term: 'Sample identifier', definition: 'A code or description used to identify the particular sample submitted to a laboratory.' },
  { term: 'Specification', definition: 'A documented characteristic, requirement, range, or criterion associated with a material or test. A specification should not be treated as a measured result unless supported by actual testing.' },
  { term: 'Stability', definition: 'The extent to which a material retains defined characteristics over time under specified conditions. Stability is separate from a single purity result.' },
  { term: 'Sterility', definition: 'The absence of viable microorganisms as established by an appropriate sterility test. HPLC purity alone does not establish sterility.' },
  { term: 'Third-party laboratory', definition: 'A laboratory organizationally separate from the seller that performs analytical testing.' },
  { term: 'Traceability', definition: 'The ability to connect a research material to relevant identifiers, records, analytical documentation, and handling history.' },
];

export const GLOSSARY_NOTE =
  'These definitions are intended to help researchers read product and analytical documentation more accurately. The exact meaning of a reported result still depends on the method, laboratory, and context in which the measurement was produced.';

export interface KnowledgeFaq {
  question: string;
  answer: string;
}

/** The writer's research-and-handling FAQs, kept on the page they belong to. */
export const KNOWLEDGE_FAQS: KnowledgeFaq[] = [
  {
    question: 'What are research peptides?',
    answer:
      'Peptides are chains of amino acids that can be studied in laboratory settings for a wide range of biochemical and analytical research applications. The term research peptide generally refers to peptide material supplied for laboratory investigation rather than for therapeutic or consumer use.',
  },
  {
    question: 'What does “research use only” mean?',
    answer: `Research use only means the material is supplied exclusively for laboratory, analytical, or other legitimate research applications. Research-use products sold by ${NAME} are not supplied for human or veterinary consumption or administration.`,
  },
  {
    question: 'Are all peptides the same?',
    answer:
      'No. Peptides can differ in amino-acid sequence, molecular structure, purity, concentration, molecular weight, analytical characteristics, and intended research application. Researchers should review the specifications and available documentation for the individual product and lot being evaluated.',
  },
  {
    question: 'What information should researchers review before purchasing a peptide?',
    answer:
      'Depending on the research application, useful information may include product name, peptide sequence or chemical identification, molecular weight, lot or batch number, analytical testing information, HPLC results, mass spectrometry or identity information where available, Certificate of Analysis, product format, and storage and handling specifications. Review the applicable product page and COA database before ordering when documentation is important to a project.',
  },
  {
    question: 'What does lyophilized mean?',
    answer:
      'Lyophilization, commonly called freeze-drying, is a process used to remove water from a material under controlled conditions. Some research materials are supplied in lyophilized form because that format can be useful for laboratory storage, transportation, and subsequent experimental preparation.',
  },
  {
    question: 'How should research peptides be stored?',
    answer:
      'Storage requirements can vary by compound and product format. Researchers should follow the storage specifications shown on the applicable product label, product page, or technical documentation. Research materials should be protected from inappropriate heat, moisture, contamination, and other environmental conditions that could compromise the sample.',
  },
  {
    question: 'Why is proper laboratory storage important?',
    answer:
      'Temperature, moisture, light, contamination, repeated handling, and other variables may influence sample integrity. Following documented storage requirements helps preserve the material in the condition intended for laboratory research.',
  },
  {
    question: `Does ${NAME} provide peptide dosing instructions?`,
    answer: `No. ${NAME} products are not intended for human or veterinary use, and we do not provide human dosing, administration, injection, or treatment instructions for research products.`,
  },
  {
    question: `Does ${NAME} provide medical reconstitution instructions?`,
    answer: `No. Our products are sold for laboratory research only. Information supplied by ${NAME} is limited to legitimate product, analytical, laboratory, and research documentation and should not be interpreted as instructions for human administration.`,
  },
  {
    question: `Are ${NAME} products intended for human or veterinary use?`,
    answer: `No. Products sold by ${NAME} are intended for research use only and are not supplied for human or veterinary consumption or administration.`,
  },
  {
    question: 'Are your products medicines, prescription drugs, or compounded medications?',
    answer: `No. ${NAME} does not operate as a pharmacy and does not sell its research materials as prescription drugs, compounded medications, or products intended to diagnose, treat, cure, mitigate, or prevent disease.`,
  },
  {
    question: 'Are research peptides the same as pharmaceutical products?',
    answer:
      'No. Research materials and pharmaceutical products are different categories with different intended uses, manufacturing frameworks, labeling, regulatory pathways, and distribution requirements.',
  },
  {
    question: `Does ${NAME} test its research materials?`,
    answer: `${NAME} relies on independent third-party laboratories for analytical testing where testing is performed. The resulting documentation should be reviewed in the context of the specific sample, lot, method, laboratory, and test date.`,
  },
  {
    question: 'What is third-party peptide testing?',
    answer:
      'Third-party testing means analytical work performed by a laboratory separate from the seller of the material. Independent testing creates separation between the seller’s marketing claims and the laboratory’s reported measurements.',
  },
  {
    question: 'Does a high HPLC purity percentage prove identity, quantity, sterility, or suitability for a particular experiment?',
    answer:
      'No. HPLC purity is one analytical measurement. It does not automatically establish molecular identity, exact quantity, sterility, stability, absence of every possible contaminant, or suitability for a particular research protocol.',
  },
  {
    question: 'Can a COA from one lot be applied to another lot?',
    answer:
      'No. Analytical results describe the sample that was actually tested. A report from one lot should not automatically be treated as evidence for a different lot.',
  },
  {
    question: 'What should I do if a product arrives damaged, mislabeled, or visibly compromised?',
    answer:
      'Do not rely on compromised research material for an experiment. Retain the packaging and identifying information, photograph the issue, and contact support promptly so the order can be reviewed.',
  },
];

export function getKnowledgeArticle(slug: string) {
  return KNOWLEDGE_ARTICLES.find((article) => article.id === slug);
}
