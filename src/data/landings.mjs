// Sursa unica de adevar pentru landing pages (Faza 1).
// SINGULAR (2026-07-14): lumea cauta "televizor 43 inch" (sing), NU plural (raport 59:1 in GSC).
// Slug + H1 + kw = singular. Exceptie: "cele mai bune televizoare 2026" (se cauta chiar plural).
// Folosit de: gen-emag.mjs, [landing].astro, Nav, Footer, homepage, breadcrumbs.
// URL: /<slug>/  (keyword in URL). Design: autoritate topicala + util + intentie clara pe UN query.

export const LANDINGS = [
  // ---------- DUPA MARIME (inch SI cm — autosuggest: "televizor 108 cm" etc.) ----------
  { slug: 'televizor-32-inch', group: 'Dupa marime', label: '32 inch (80 cm)', navLabel: '32 inch',
    h1: 'Televizor 32 inch (80 cm): cele mai bune modele ieftine', kw: 'televizor 32 inch',
    intent: 'televizor 32 inch / 80 cm ieftin, pentru dormitor sau bucatarie',
    match: (p) => p.inch === 32 },
  { slug: 'televizor-40-inch', group: 'Dupa marime', label: '40 inch (100 cm)', navLabel: '40 inch',
    h1: 'Televizor 40 inch (100 cm): cele mai bune modele ieftine', kw: 'televizor 40 inch',
    intent: 'televizor 40 inch / 100 cm ieftin',
    match: (p) => p.inch === 40 },
  { slug: 'televizor-43-inch', group: 'Dupa marime', label: '43 inch (108 cm)', navLabel: '43 inch',
    h1: 'Televizor 43 inch (108 cm): cele mai bune modele ieftine', kw: 'televizor 43 inch',
    intent: 'televizor 43 inch / 108 cm ieftin, cea mai cautata diagonala',
    match: (p) => p.inch === 43 },
  { slug: 'televizor-50-inch', group: 'Dupa marime', label: '50 inch (127 cm)', navLabel: '50 inch',
    h1: 'Televizor 50 inch (127 cm): cele mai bune modele ieftine', kw: 'televizor 50 inch',
    intent: 'televizor 50 inch / 127 cm ieftin, pentru living',
    match: (p) => p.inch === 50 },

  // ---------- DUPA BUGET ----------
  { slug: 'televizor-sub-1000-lei', group: 'Dupa buget', label: 'sub 1000 lei', navLabel: 'sub 1000 lei',
    h1: 'Televizor bun si ieftin sub 1000 de lei', kw: 'televizor sub 1000 lei',
    intent: 'televizor bun sub 1000 lei',
    match: (p) => p.price < 1000 },
  { slug: 'televizor-raport-calitate-pret', group: 'Dupa buget', label: 'Raport calitate-pret', navLabel: 'Raport calitate-pret',
    h1: 'Cel mai bun televizor ca raport calitate-pret', kw: 'cel mai bun televizor raport calitate pret',
    intent: 'cel mai bun televizor raport calitate-pret',
    match: (p) => (p.rating || 0) >= 4.4 && (p.reviews || 0) >= 30, sort: 'value' },

  // ---------- DUPA TIP / TEHNOLOGIE ----------
  { slug: 'televizor-4k-ieftin', group: 'Dupa tip', label: '4K Ultra HD', navLabel: '4K ieftin',
    h1: 'Televizor 4K ieftin: cele mai bune modele in 2026', kw: 'televizor 4k ieftin',
    intent: 'televizor 4K Ultra HD ieftin',
    match: (p) => p.resolution === '4K' },
  { slug: 'smart-tv-ieftin', group: 'Dupa tip', label: 'Smart TV', navLabel: 'Smart TV',
    h1: 'Smart TV ieftin si bun: cele mai bune modele', kw: 'smart tv ieftin si bun',
    intent: 'smart tv ieftin si bun, cu Netflix si YouTube',
    match: (p) => p.smart === true },

  // ---------- USE-CASE (autosuggest: gaming/dormitor/bucatarie/living) ----------
  { slug: 'televizor-pentru-dormitor', group: 'Pentru camera ta', label: 'Pentru dormitor', navLabel: 'Pentru dormitor',
    h1: 'Cel mai bun televizor pentru dormitor', kw: 'televizor pentru dormitor',
    intent: 'televizor pentru dormitor (compact, 32-40 inch)',
    match: (p) => p.inch <= 40, sort: 'sizeAsc' },
  { slug: 'televizor-pentru-bucatarie', group: 'Pentru camera ta', label: 'Pentru bucatarie', navLabel: 'Pentru bucatarie',
    h1: 'Televizor mic pentru bucatarie: modele ieftine', kw: 'televizor bucatarie',
    intent: 'televizor mic pentru bucatarie (24-32 inch)',
    match: (p) => p.inch <= 32, sort: 'sizeAsc' },
  { slug: 'televizor-pentru-living', group: 'Pentru camera ta', label: 'Pentru living', navLabel: 'Pentru living',
    h1: 'Cel mai bun televizor pentru living', kw: 'televizor living',
    intent: 'televizor mare pentru living (43-50 inch)',
    match: (p) => p.inch >= 43, sort: 'sizeDesc' },
  { slug: 'televizor-gaming-ieftin', group: 'Pentru camera ta', label: 'Pentru gaming', navLabel: 'Pentru gaming',
    h1: 'Televizor ieftin bun pentru gaming si consola', kw: 'televizor gaming ieftin',
    intent: 'televizor ieftin pentru gaming / consola (4K, HDMI)',
    match: (p) => p.resolution === '4K' && p.inch >= 43, sort: 'value' },

  // ---------- RECOMANDARI / AN (plural — se cauta chiar plural) ----------
  { slug: 'cele-mai-bune-televizoare-2026', group: 'Recomandari', label: 'Cele mai bune 2026', navLabel: 'Cele mai bune 2026',
    h1: 'Cele mai bune televizoare ieftine in 2026', kw: 'cele mai bune televizoare 2026',
    intent: 'cele mai bune televizoare ieftine 2026',
    match: (p) => (p.rating || 0) >= 4.3 && (p.reviews || 0) >= 20, sort: 'value' },
];

// Sufix gramatical pt heading-uri ("Cele mai bune televizoare {hSuffix}", "Toate modelele {hSuffix}",
// "Intrebari despre televizoarele {hSuffix}"). NU "de {label}" — se strica la "de Pentru living".
export const H_SUFFIX = {
  'televizor-32-inch': 'de 32 inch',
  'televizor-40-inch': 'de 40 inch',
  'televizor-43-inch': 'de 43 inch',
  'televizor-50-inch': 'de 50 inch',
  'televizor-sub-1000-lei': 'sub 1000 de lei',
  'televizor-raport-calitate-pret': 'cu raport calitate-pret bun',
  'televizor-4k-ieftin': '4K ieftine',
  'smart-tv-ieftin': 'cu Smart TV',
  'televizor-pentru-dormitor': 'pentru dormitor',
  'televizor-pentru-bucatarie': 'pentru bucatarie',
  'televizor-pentru-living': 'pentru living',
  'televizor-gaming-ieftin': 'pentru gaming',
  'cele-mai-bune-televizoare-2026': 'in 2026',
};

// grupuri pt nav/footer (ordinea conteaza)
export const LANDING_GROUPS = ['Dupa marime', 'Dupa buget', 'Dupa tip', 'Pentru camera ta', 'Recomandari'];
export const byGroup = () => LANDING_GROUPS.map((g) => ({ group: g, items: LANDINGS.filter((l) => l.group === g) }));
