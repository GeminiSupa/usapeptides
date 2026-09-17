-- USA Peptide Depot - editable product categories
-- Run after 0010_order_operations.sql. Safe to re-run.
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_categories_slug_idx on public.product_categories (slug);
create unique index if not exists product_categories_name_idx on public.product_categories (lower(name));
alter table public.product_categories enable row level security;
drop policy if exists "active categories are publicly readable" on public.product_categories;
create policy "active categories are publicly readable" on public.product_categories for select using (is_active = true);

insert into public.product_categories (name, slug, description, sort_order) values
('Incretin and Metabolic Receptor Compounds','incretin-metabolic-receptor-compounds','Targeted incretin mimetics, GLP-1, GIP, and glucagon multi-receptor agonist research compounds.',10),
('GHRH and Ghrelin Receptor Peptides','ghrh-ghrelin-receptor-peptides','Growth hormone releasing factor analogs, secretagogues, and somatotropic axis study peptides.',20),
('Extracellular Matrix and Cell-Migration Peptides','extracellular-matrix-cell-migration-peptides','Cytoprotective, tissue remodeling, collagen synthesis, and angiogenic pathway peptides.',30),
('Melanocortin Receptor Peptides','melanocortin-receptor-peptides','Selective melanocortin receptor research compounds.',40),
('Mitochondrial and Senescence Peptides','mitochondrial-senescence-peptides','Cellular longevity, cardiolipin-targeting peptides, and senescence research compounds.',50),
('Neuropeptide and CNS Signaling Compounds','neuropeptide-cns-signaling-compounds','Neurotrophic signaling and central nervous system receptor research ligands.',60),
('Antimicrobial and Cytokine-Pathway Peptides','antimicrobial-cytokine-pathway-peptides','Immune signaling, antimicrobial, and cytokine-pathway research peptides.',70),
('GnRH and Kisspeptin Signaling Peptides','gnrh-kisspeptin-signaling-peptides','HPG-axis and GPR54 receptor research peptides.',80),
('Chromatin and Gene-Expression Peptides','chromatin-gene-expression-peptides','Epigenetic, telomerase, and peptide bioregulator research compounds.',90),
('Laboratory Solvents and Supplies','laboratory-solvents-supplies','Reconstitution solutions, sterile vials, and laboratory preparation supplies.',100)
on conflict (slug) do nothing;
