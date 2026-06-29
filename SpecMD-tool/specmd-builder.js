// specmd-builder.js  —  React + JSX (transpiled by Babel standalone)
// WebStorm may show JSX parse errors here: these are expected false-positives.
// The code runs correctly in browsers via Babel.

/* global React, ReactDOM, JSZip */
const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 1. HARDCODED CONFIG GENERATORS
//    Built programmatically — no string embedding, no escaping issues.
// ─────────────────────────────────────────────────────────────────────────────

// ─── PACKAGE COMPATIBILITY TABLE ────────────────────────────────────────────
// Strategy:
//   KNOWN packages → precise version, peer-dep verified against React 18.
//   UNKNOWN packages → excluded from package.json, listed in README for manual install.
//   Rationale: peer dependency resolution requires knowing the full graph.
//   Guessing a version for unknown packages creates ERESOLVE errors worse than no version.
//   The user must verify unknown packages against their React version (18.x here).
//
// React compatibility note for this stack: React 18.3.x
//   Some libraries release major versions that bump the React peer dep.
//   Always check: https://www.npmjs.com/package/<pkg> before adding to this table.
// ─────────────────────────────────────────────────────────────────────────────
const PINNED_VERSIONS = {
  // 3D — react-three-fiber v8 is the last version supporting React 18.
  //       v9 requires React >=19. Pin strictly to avoid ERESOLVE.
  'three':                    '^0.169.0',
  '@react-three/fiber':       '^8.17.10',   // React 18 compat; v9 requires React 19
  '@react-three/drei':        '^9.122.0',   // peer: @react-three/fiber ^8
  '@types/three':             '^0.169.0',

  // Maps
  'leaflet':                  '^1.9.4',
  'react-leaflet':            '^4.2.1',     // v5 requires React 19
  '@types/leaflet':           '^1.9.14',

  // Data visualization
  'd3':                       '^7.9.0',
  '@types/d3':                '^7.4.3',

  // Animation — framer-motion v11 supports React 18
  'framer-motion':            '^11.11.0',

  // Forms
  'react-hook-form':          '^7.53.2',
  '@hookform/resolvers':      '^3.9.1',

  // Dates
  'date-fns':                 '^4.1.0',
  'dayjs':                    '^1.11.13',

  // HTTP
  'axios':                    '^1.7.9',

  // Real-time
  'socket.io-client':         '^4.8.1',

  // Rich text / markdown
  'react-markdown':           '^9.0.1',
  'remark-gfm':               '^4.0.0',
  'rehype-highlight':         '^7.0.1',

  // Spreadsheet / PDF export
  'xlsx':                     '^0.18.5',
  'jspdf':                    '^2.5.2',
  'jspdf-autotable':          '^3.8.4',

  // UI utilities
  'react-hot-toast':          '^2.4.1',
  'clsx':                     '^2.1.1',
  'tailwind-merge':           '^2.5.4',
  'class-variance-authority': '^0.7.1',

  // Icon libraries
  'react-icons':              '^5.4.0',

  // Date pickers
  'react-datepicker':         '^7.5.0',
  '@types/react-datepicker':  '^7.0.0',

  // Drag and drop
  '@dnd-kit/core':            '^6.3.1',
  '@dnd-kit/sortable':        '^8.0.0',

  // Virtual lists (large datasets)
  'react-virtual':            '^2.10.4',
  '@tanstack/react-virtual':  '^3.13.0',

  // QR code
  'qrcode.react':             '^4.2.0',

  // Charts (additional to recharts)
  'chart.js':                 '^4.4.6',
  'react-chartjs-2':          '^5.3.0',
  'victory':                  '^37.3.6',

  // State URL sync
  'nuqs':                     '^2.2.3',

  // Effects / celebrations / UX sugar that LLMs commonly reach for.
  // All React-18-safe (zero or compatible peer deps).
  'canvas-confetti':          '^1.9.3',
  '@types/canvas-confetti':   '^1.9.0',
  'react-confetti':           '^6.1.0',
  'sonner':                   '^1.7.1',
  'cmdk':                     '^1.0.4',
  'vaul':                     '^1.1.2',
  'embla-carousel-react':     '^8.5.1',
  'react-countup':            '^6.5.3',
  'usehooks-ts':              '^3.1.0',
  'nanoid':                   '^5.0.9',
  'uuid':                     '^11.0.3',
  '@types/uuid':              '^10.0.0',
};

// Core packages that are always present — never need detection or installation.
const CORE_PACKAGES = new Set([
  'react', 'react-dom', 'react/jsx-runtime',
  'react-router-dom', '@tanstack/react-query', 'zustand', 'zod',
  'lucide-react', 'recharts',
]);

// Deterministically scan generated source files for bare npm imports.
// Returns the set of external package names actually imported (excluding core,
// internal @/ aliases, and relative paths). This lets package.json be DERIVED
// from the real generated code instead of guessed up-front — so anything the
// model imports is guaranteed to be installed.
function detectImportedPackages(genFiles) {
  // Node built-in modules — never npm packages, must never land in package.json.
  const NODE_BUILTINS = new Set([
    'assert', 'buffer', 'child_process', 'cluster', 'console', 'crypto',
    'dgram', 'dns', 'events', 'fs', 'http', 'http2', 'https', 'net', 'os',
    'path', 'perf_hooks', 'process', 'querystring', 'readline', 'stream',
    'string_decoder', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'zlib',
  ]);
  const found = new Set();
  // Matches: import X from "pkg"  |  import {..} from "pkg"  |  import "pkg"  |  export ... from "pkg"
  const importRe = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  Object.entries(genFiles).forEach(([p, c]) => {
    if (!/\.(tsx?|jsx?)$/.test(p) || !c) return;
    let m;
    while ((m = importRe.exec(c)) !== null) {
      const spec = m[1];
      // Skip internal alias, relative, and absolute paths
      if (spec.startsWith('@/') || spec.startsWith('.') || spec.startsWith('/')) continue;
      // Skip Node built-ins, with or without the node: prefix (node:url, url, node:path, ...)
      if (spec.startsWith('node:')) continue;
      const bare = spec.split('/')[0];
      if (NODE_BUILTINS.has(bare)) continue;
      // Extract bare package name: scoped (@org/pkg) keeps two segments, else first segment
      const pkg = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
      if (!pkg || CORE_PACKAGES.has(pkg)) continue;
      found.add(pkg);
    }
  });
  return [...found];
}

// Packages NOT in PINNED_VERSIONS are unknown — we cannot guarantee their peer
// compatibility with React 18. They are listed in README for manual install.
function parseAdditionalPackages(additionalPackages) {
  const known = {};
  const unknown = [];
  (additionalPackages || []).forEach(entry => {
    entry.split('+').map(p => p.trim()).filter(Boolean).forEach(pkg => {
      const name = pkg.split(' ')[0].trim();
      if (!name) return;
      if (PINNED_VERSIONS[name]) {
        known[name] = PINNED_VERSIONS[name];
      } else {
        unknown.push(name);
      }
    });
  });
  return { known, unknown };
}

// detectedPackages (optional): bare package names found in the generated code.
// Known ones get their pinned version; unknown real ones get "latest" so the
// app still installs and runs (README notes they should be version-verified).
function makePackageJson(projectName, additionalPackages, detectedPackages) {
  const name = (projectName || 'app').toLowerCase().replace(/\s+/g, '-');
  const { known: extraDeps } = parseAdditionalPackages(additionalPackages);

  // Merge in packages actually imported by the generated code.
  const detectedDeps = {};
  (detectedPackages || []).forEach(pkg => {
    if (CORE_PACKAGES.has(pkg)) return;
    if (PINNED_VERSIONS[pkg]) {
      detectedDeps[pkg] = PINNED_VERSIONS[pkg];
      // Pull in matching @types/* for known packages when available.
      const typesPkg = '@types/' + pkg.replace(/^@/, '').replace(/\//g, '__');
      if (PINNED_VERSIONS[typesPkg]) detectedDeps[typesPkg] = PINNED_VERSIONS[typesPkg];
    } else {
      // Unknown but actually imported → install latest so the build resolves.
      detectedDeps[pkg] = 'latest';
    }
  });

  return JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      test: 'vitest run',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      'react-router-dom': '^6.26.2',
      '@tanstack/react-query': '^5.56.0',
      zustand: '^4.5.5',
      zod: '^3.23.8',
      'lucide-react': '^0.439.0',
      recharts: '^2.12.7',
      ...extraDeps,
      ...detectedDeps,
    },
    devDependencies: {
      '@types/react': '^18.3.5',
      '@types/react-dom': '^18.3.0',
      '@vitejs/plugin-react': '^4.3.1',
      autoprefixer: '^10.4.20',
      postcss: '^8.4.45',
      tailwindcss: '^3.4.10',
      typescript: '^5.5.4',
      vite: '^5.4.3',
      vitest: '^2.0.5',
      '@testing-library/react': '^16.0.1',
      '@testing-library/jest-dom': '^6.5.0',
      jsdom: '^25.0.0',
    },
  }, null, 2);
}

function makeTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      useDefineForClassFields: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      allowJs: true,
      baseUrl: '.',
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src'],
    references: [{ path: './tsconfig.node.json' }],
  }, null, 2);
}

function makeTsConfigNode() {
  return JSON.stringify({
    compilerOptions: {
      composite: true,
      skipLibCheck: true,
      module: 'ESNext',
      moduleResolution: 'bundler',
      allowSyntheticDefaultImports: true,
    },
    include: ['vite.config.ts'],
  }, null, 2);
}

function makeViteConfig() {
  return [
    "import { defineConfig } from 'vite'",
    "import react from '@vitejs/plugin-react'",
    "import { fileURLToPath, URL } from 'node:url'",
    '',
    'export default defineConfig({',
    '  plugins: [react()],',
    '  resolve: {',
    '    alias: {',
    "      '@': fileURLToPath(new URL('./src', import.meta.url)),",
    '    },',
    '  },',
    '  test: {',
    '    globals: true,',
    "    environment: 'jsdom',",
    "    setupFiles: './src/test-setup.ts',",
    '  },',
    '})',
  ].join('\n');
}

function makeTailwindConfig() {
  return [
    "/** @type {import('tailwindcss').Config} */",
    'export default {',
    "  content: ['./index.html', './src/**/*.{ts,tsx}'],",
    '  theme: { extend: {} },',
    '  plugins: [],',
    '}',
  ].join('\n');
}

function makePostcssConfig() {
  return [
    'export default {',
    '  plugins: {',
    '    tailwindcss: {},',
    '    autoprefixer: {},',
    '  },',
    '}',
  ].join('\n');
}

function makeIndexHtml(projectName) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '    <title>' + (projectName || 'App') + '</title>',
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    '    <script type="module" src="/src/main.tsx"><' + '/script>',
    '  </body>',
    '</html>',
  ].join('\n');
}

function makeIndexCss() {
  return [
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
  ].join('\n');
}

function makeTestSetup() {
  return "import '@testing-library/jest-dom'";
}

function getHardcodedFiles(projectName, additionalPackages) {
  return {
    'package.json':       makePackageJson(projectName, additionalPackages),
    'tsconfig.json':      makeTsConfig(),
    'tsconfig.node.json': makeTsConfigNode(),
    'vite.config.ts':     makeViteConfig(),
    'tailwind.config.js': makeTailwindConfig(),
    'postcss.config.js':  makePostcssConfig(),
    'index.html':         makeIndexHtml(projectName),
    'src/index.css':      makeIndexCss(),
    'src/test-setup.ts':  makeTestSetup(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROMPTS  (array-join, no template literals with embedded content)
// ─────────────────────────────────────────────────────────────────────────────

function buildStackLines(additionalPackages) {
  const lines = [
    'TECH STACK:',
    'CORE (always available):',
    '- React 18 functional components + TypeScript 5 (moduleResolution: bundler; type-checking is relaxed, build never blocks on type errors)',
    '- Tailwind CSS v3: inline classes only, zero separate CSS files',
    '- TanStack Query v5: useQuery/useMutation for all server state',
    '- React Router v6: Routes, Route, Link, useNavigate, useParams',
    '- Zustand v4: global UI state that spans pages',
    '- Zod: form validation and API response parsing',
    '- Lucide React: icons',
    '- Recharts: bar, line, area, pie charts',
  ];
  if (additionalPackages && additionalPackages.length > 0) {
    lines.push('', 'ADDITIONAL PACKAGES FOR THIS APP (in package.json — safe to import):');
    additionalPackages.forEach(pkg => lines.push('- ' + pkg));
    lines.push('', 'Prefer the packages listed above. If you import another real npm package (e.g. canvas-confetti for effects), it will be auto-detected and installed — but keep dependencies minimal and prefer CSS/inline effects when reasonable. Never import a package you are not sure exists on npm.');
  }
  return lines;
}

function buildSysPrompt(antiRequirements, additionalPackages) {
  return [
    'You are generating a single production-ready file for a React + Vite + TypeScript web application.',
    'This is not a prototype. Every feature must be fully implemented and working.',
    '',
    'THE THREE RULES THAT MATTER MOST (if you do nothing else, do these):',
    '1. IMPORTS: import every internal file with the "@/" alias — "@/types", "@/store/authStore", "@/pages/HomePage". Never "./" or "../". Copy the exact import lines from the EXACT IMPORTS AVAILABLE list in the context.',
    '2. NAMES: only call functions, hooks, and store methods that appear in the EXACT IMPORTS list or the Blueprint. Never invent a method name. If you need something that does not exist, build it inline with useState.',
    '3. COMPLETE: write the FULL file — all imports, the full component, real data arrays (15+ rows), the complete JSX. Never stop early, never leave a section as a comment. A real page is 200-600 lines.',
    '',
    'OUTPUT FORMAT:',
    '- RAW FILE CONTENTS ONLY. DO NOT wrap the code in ```typescript, ```tsx, or ``` markdown blocks.',
    '- The very first characters of your response MUST be the `import` statements.',
    '- No markdown fences, no explanations, no preamble.',
    '- If output is cut off, end with exactly: <<<CONTINUE>>>',
    '- No artificial line limit — implement COMPLETELY. A page with 5 features should be 400-800 lines.',
    '',
    ...buildStackLines(additionalPackages),
    '',
    'IMPLEMENTATION RULES:',
    '- INLINE UI ONLY (CRITICAL): There is no "components" folder. Do NOT import { StatCard }, { Button }, or { DataTable } from external files. You must build all UI elements inline directly inside the file you are generating.',
    '- If you need a helper component (like a StatCard), define it as a standard function `function StatCard({ ... }) { ... }` in the same file, above the main default export.',
    '- Write ALL import statements first, before any other code.',
    '- DUPLICATE PREVENTION: Every name appears EXACTLY ONCE. No private helper + public export with same name.',
    '- Implement EVERY function/class/component mentioned in ROLE.',
    '- Never use the any type. No console.log in production.',
    '- Named imports only. No default/namespace imports.',
    '- NEVER use "import type" — always use a regular "import { X }" for both types and values. With this build (isolatedModules + esbuild), "import type" is stripped at bundle time, so if you import a symbol with "import type" and then use it as a value (e.g. in an array, a comparison, or Object.values), it becomes undefined at runtime and crashes (TS1361). Regular "import { X }" works for everything; esbuild elides unused type imports automatically.',
    '- TYPE vs VALUE: a union type like `type RiskLevel = "low" | "medium" | "high"` has NO runtime value — you cannot iterate it or use RiskLevel as a value. If you need the runtime list, define `const RISK_LEVELS = ["low","medium","high"] as const` and derive the type with `type RiskLevel = typeof RISK_LEVELS[number]`. Use RISK_LEVELS for values (mapping, dropdowns), RiskLevel only for type annotations.',
    '- src/types/index.ts contains ONLY TypeScript types. NEVER import functions, ROUTES, or runtime values from types/index.ts.',
    '- ROUTES and app constants come from src/constants.ts.',
    '- Service functions come from src/services/api.ts or src/services/mock.ts.',
    '- Nothing useful is exported from src/App.tsx — never import from it.',
    '- LINE DISCIPLINE: Stop when logically complete. Do not pad.',
    '- STATE / FILTERS OPTIONAL TYPING (CRITICAL): Types used for filter states or form states that receive partial updates (e.g., setState(prev => ({...prev, status: "paid"}))) MUST have all properties marked as optional (e.g., `search?: string`). Failure to do this causes TS2345 errors.',
    '- LUCIDE ICONS: Use base names like `BarChart`, `PieChart`, `LineChart`. Do NOT use numbered variants like `BarChart3` or `PieChart2` as they may be deprecated in the current lucide-react version.',
    '- LUCIDE ICON EXISTENCE: only import icons you are CERTAIN exist in lucide-react. Common safe ones: Home, User, Users, Settings, Search, Menu, X, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Plus, Minus, Trash2, Edit, Eye, Calendar, Clock, MapPin, Building2 (for a city/building — there is NO "City" icon), Bell, Mail, Heart, Star, Filter, Download, Upload, LogOut, AlertCircle, CheckCircle2, Loader2, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Activity, BarChart, PieChart, LineChart. If you want an icon and are unsure of its exact name, use a generic one from this list instead of guessing — a wrong name (e.g. "City", "Poker", "Casino") breaks the build with TS2305.',
    '- LOCAL CONSTANTS: If a component needs a configuration object (like `APP_THEME`) or a list of options (like `REPORT_FORMATS`), define them as local `const` variables inside the file, outside the component. Do not attempt to import them from `src/constants.ts`.',
    '- EXPLICIT IMPORTS (CRITICAL): React has no global variables. Never use variables like `APP_CONFIG`, `ROUTES`, or Recharts components without explicitly writing the import statement at the top of the file. Missing imports cause ReferenceError crashes.',
    '- STRING SYNTAX (FATAL ERROR PREVENTION): When writing object properties with text values (especially long descriptions, interpretations, or mock data), YOU MUST WRAP THE TEXT IN QUOTES. `description: gross margin improved` is invalid JavaScript and breaks the build. Correct: `description: "gross margin improved"`.',
    '- ARRAY VS OBJECT ASSIGNMENT: If a type definition returns an object containing an array (e.g., `interface Response { items: Data[] }`), do NOT treat the response itself as an array. You cannot call `.length` or `.map()` on the response object. Extract the array first (`response.items.map()`).',
    '',
    'QUALITY — THIS IS A PRODUCTION-GRADE APP, NOT A PROTOTYPE:',
    '',
    'ASCII IDENTIFIERS (critical): Use exclusively standard ASCII (A-Z a-z 0-9 _ $) in ALL variable names, function names, type names, interface names. NEVER use Unicode lookalikes, Malayalam, Arabic, Greek, or any non-Latin characters even if they visually resemble ASCII. Wrong: SummaryറെRequest. Correct: SummaryRequest. Before outputting each identifier, verify it contains only ASCII.',
    '',
    'ZERO PLACEHOLDERS: Words "TODO", "coming soon", "lorem ipsum", "sample data", "placeholder" must never appear. Every UI element is functional.',
    '',
    'CHARTS (recharts required): Every chart needs: typed data array (15+ entries with realistic domain values), XAxis dataKey, YAxis with unit label, Tooltip with formatter, Legend, ResponsiveContainer width="100%" height={320}. Use real values — for a park: revenue in millions, visitor counts in thousands. Not [1,2,3].',
    '',
    'TABLES: Typed data array (15-20 rows), all specified columns rendered, alternating row classes, hover highlight, at least one working filter (useState + .filter()). Use semantic <table><thead><tbody>.',
    '',
    'FORMS: Controlled inputs with useState, Zod schema with .parse() or .safeParse(), onSubmit that updates local state or calls mutation, success banner (green), per-field error messages (red). Non-functional submit buttons are forbidden.',
    '',
    'MOCK DATA: 15-20 records with domain-specific realistic values. For parks: real park names, actual revenue figures (¥2.3M etc), real dates. For e-commerce: real product names, real prices, real categories. Never generic: {id:"1", name:"Item 1", value:100}.',
    '',
    'INTERACTIVITY: Every dropdown/filter changes displayed rows. Every sort button reorders. Every toggle shows/hides content. Every tab switch renders different content. No decorative controls.',
    '',
    'COLORS AND LAYOUT: If role specifies colors, apply to: page background, section headers, primary buttons, stat card accents, nav active state. If role specifies layout type — dashboard: CSS grid of stat cards then charts; sidebar: fixed 240px left nav + flex-1 main with overflow-y-auto; table-heavy: full-width table with sticky <thead>.',
    '',
    'LOADING/ERROR/EMPTY: Every useQuery must handle isLoading (skeleton divs with animate-pulse), isError (red banner with error.message), empty array (centered message with Lucide icon).',
    '',
    'BLUEPRINT CONTRACT: If an App Blueprint appears in context, implement EXACT function names, parameter names, and return types declared there. Same name, same signature — no variants, no aliases.',
    '',
    'CORRECT PATTERNS TO FOLLOW:',
    'Zustand: export const useMyStore = create<MyStore>((set) => ({ field: init, setField: (v) => set({ field: v }) })) — use in components: const x = useMyStore(s => s.field)',
    'STORE METHOD ADHERENCE (prevents runtime crashes): Before calling any store method, verify it EXISTS in the store file shown in ALREADY-GENERATED FILES. The auth store typically has ONLY: user, isAuthenticated, login(email,password), logout(). It does NOT have setUser, setUserData, demoUsers, or register unless you see them defined. Calling a non-existent store method crashes the app at runtime (undefined is not a function).',
    'ZUSTAND STORE WHITELIST (critical): The ONLY Zustand stores that exist are the ones listed in FILES THAT EXIST (typically authStore and/or cartStore). NEVER import from @/store/orderStore, @/store/productStore, @/store/userStore, or ANY store not in that list — those files do not exist and will fail with TS2307 / module not found.',
    'For server data (orders, products, records, categories, profile), use TanStack Query hooks from @/hooks/useApi — NOT a Zustand store. Orders are server state: const { data: orders = [] } = useOrders(). Products are server state: const { data: products = [] } = useProducts(). Never create or import an orderStore/productStore.',
    'For component-local state (selected tab, form values, modal open), use useState — not a store.',
    'Zustand is reserved EXCLUSIVELY for auth and cart. Everything else is TanStack Query (server data) or useState (local UI).',
    'If you need a store capability that does not exist, derive it from what IS exported. Need the current user? Use useAuthStore(s => s.user). Need to log in? Use useAuthStore(s => s.login)(email, password).',
    'TanStack Query: const { data = [], isLoading, isError, error } = useQuery({ queryKey: ["key", dep], queryFn: () => fetchFn(dep) }) — always default data with = []',
    'Query error access: use error?.message (the error value can be null). Never assume error is non-null.',
    'Type all callback parameters explicitly: items.map((item: ItemType) => ...) not items.map((item) => ...). Same for event handlers: (e: React.ChangeEvent<HTMLInputElement>) => ...',
    'Each form has its OWN value type. A checkout form and an account form are different types — never pass one where the other is expected. Define separate interfaces (CheckoutFormValues, AccountFormValues) and separate handlers.',
    'Auth guard: const isAuth = useAuthStore(s => s.isAuthenticated); useEffect(() => { if (!isAuth) navigate("/login") }, [isAuth, navigate])',
    'Navigation: always use useNavigate() + navigate("/path") or <Link to="/path"> — NEVER window.location',
    'Form: useState for values + z.object schema + e.preventDefault() + schema.safeParse() + setErrors on fail + action on success',
    'Recharts: always wrap in <ResponsiveContainer width="100%" height={320}> with CartesianGrid, XAxis, YAxis, Tooltip, Legend',
    'SAFE ARRAY ACCESS (CRITICAL PREVENTS CRASHES): In JavaScript, `obj?.items.length` crashes if `items` is undefined. Never write `obj?.array.map()`. ALWAYS write `(obj?.array || []).map(...)` and `obj?.array?.length`. Provide safe fallbacks for all arrays and nested objects.',
    '',
    'ANTI-REQUIREMENTS (from spec — never violate):',
    ...(antiRequirements.length > 0
        ? antiRequirements.map(a => '- ' + a)
        : ['(none specified)']),
  ].join('\n');
}

function buildUserPrompt(filePath, fileRole, specMarkdown, extraContext) {
  const lines = [];

  // Already-generated files come FIRST — they are the ground truth for all names.
  // The LLM must import functions, types, and components using the exact names it sees here.
  if (extraContext) {
    lines.push(
        '╔══════════════════════════════════════════════════════════╗',
        '║  ALREADY-GENERATED FILES + APP BLUEPRINT (ground truth) ║',
        '╚══════════════════════════════════════════════════════════╝',
        'These files exist on disk. When you import from them, use EXACTLY the',
        'function names, type names, and component names you see below.',
        'If a function is named getOrders (plural), import getOrders — not getOrder.',
        'If a type is named CartItem, use CartItem — not CartItemType or ICartItem.',
        '',
        extraContext,
        '',
        '╔══════════════════════════════════════════════════════════╗',
        '║  END OF ALREADY-GENERATED FILES                         ║',
        '╚══════════════════════════════════════════════════════════╝',
        '',
    );
  }

  lines.push(
      'APP SPEC:',
      specMarkdown,
      '',
      'NOW GENERATE: ' + filePath,
      'ROLE: ' + fileRole,
      '',
      'Output the complete file. No explanation, no fences.',
      '',
      'FINAL CHECK before outputting:',
      '- PATH ALIAS RULE (CRITICAL — applies to EVERY import from src): ALWAYS import internal files using the "@/" alias, which points to the src/ folder. This is absolute — it works identically in EVERY file regardless of folder depth. NEVER use "./" or "../" for internal src imports.',
      '  • Correct: import { User } from "@/types"',
      '  • Correct: import { ROUTES } from "@/constants"',
      '  • Correct: import { useAuthStore } from "@/store/authStore"',
      '  • Correct: import HomePage from "@/pages/HomePage"',
      '  • WRONG: import { User } from "./types" or "../types" — use "@/types" instead',
      '- HALLUCINATION CHECK: Did you write `import ... from "@/components/..."`? If yes, DELETE THAT IMPORT immediately and write the component inline instead. The components folder does not exist.',
      '- INTERNAL VARIABLE CHECK (TS2552): Scan every variable you use inside your functions. Did you spell it EXACTLY as it was declared? If you declared `mockData`, do not try to use `data` or `_data`.',
      '- Every import statement uses a name that exists in the ALREADY-GENERATED FILES above',
      '- No invented function names, no singular/plural guessing',
      '- No default imports (import X from ...) from service files — named imports only',
      '- No namespace imports (import * as X) — named imports only',
      '- Every import PATH must point to a file in the FILES THAT EXIST list. No exceptions.',
      '- Scan every identifier you wrote: contains only A-Z a-z 0-9 _ $? If any character looks unusual (Malayalam, Arabic, Greek), replace it with ASCII immediately.',
      '- IMPORT SOURCES CHECK — verify every import path:',
      '  • Types (interface/type/enum) → from "@/types" ✓',
      '  • Route constants, app config → from "@/constants" ✓',
      '  • Service functions (fetch/mock data) → from "@/services/api" or "@/services/mock" ✓',
      '  • TanStack Query hooks → from "@/hooks/useApi" ✓',
      '  • Zustand stores → from "@/store/authStore" or "@/store/cartStore" etc. ✓',
      '  • Functions from "@/types" → WRONG, fix immediately ✗',
      '  • Anything from "@/App" → WRONG, App.tsx exports nothing ✗',
      '- MISSING TYPE IMPORTS (TS2304): Ensure EVERY type (e.g., CartItem, Product, User) you use is explicitly imported from "@/types".',
      '- TYPE EXPORT COMPLETENESS (TS2305): If THIS file is src/types/index.ts, verify it EXPORTS every type that other files import — especially User (if auth exists), Product and CartItem (if cart exists). A type imported elsewhere but not exported here breaks the build. When in doubt, export it.',
      '- RECHARTS IMPORTS (TS2304): If rendering charts, you MUST explicitly import EVERY component you use: `import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"`. Do not use them without importing them.',
      '- IMPORT TYPE CHECK (TS1361): scan your imports — did you write "import type"? Replace it with a regular "import". Never use "import type" in this project; it breaks at runtime when the symbol is used as a value.',
      '- TYPE-AS-VALUE CHECK: are you using a union type (like RiskLevel) as a runtime value — iterating it, putting it in an array, or calling Object.values on it? A type union has no runtime value. Use a "const X = [...] as const" array for the values instead.',
      '- LUCIDE EXISTENCE CHECK (TS2305): every icon you import from lucide-react must be a real export. If you guessed a name (City, Poker, Casino, etc.), replace it with a verified one (Building2, MapPin, etc.).',
      '- STORE EXISTENCE: every import from "@/store/" must point to a store in FILES THAT EXIST. If you import useOrderStore but orderStore.ts is not listed, REMOVE it and use the useOrders() TanStack Query hook from "@/hooks/useApi" instead. Only authStore and cartStore exist.',
      '- STORE METHODS: every store method you call (login, logout, addItem, etc.) must be defined in the store file shown above. If you call a method that is not there, the app crashes. Verify each one.',
      '- TYPE COMPATIBILITY: if you have two different form types (e.g. CheckoutFormValues vs AccountFormValues), never pass one to a function expecting the other. Each form gets its own handler.',
      '- CALLBACK TYPES: prefer typing parameters explicitly — (item: Product) => not (item) =>. Helps even if not strictly required.',
      '- MISSING IMPORTS CHECK (ReferenceError): Scan your code for `APP_CONFIG`, `ROUTES`, `DEMO_CREDENTIALS`, and all Recharts components. Did you write the `import` statement for them at the top of the file? IF NOT, ADD IT NOW.',
      '- CONSTANTS IMPORT CHECK: "src/constants.ts" ONLY exports `ROUTES`, `APP_CONFIG`, and `DEMO_CREDENTIALS`. NEVER import anything else (like `APP_THEME`, `REPORT_FORMATS`, `STATUSES`) from it. If you need a constant array or theme object, DEFINE IT LOCALLY inside your component file.',
      '- SYNTAX ERROR CHECK (CRITICAL): Scan every object literal. Did you leave any string values unquoted? (e.g., `text: value goes here` instead of `text: "value goes here"`). Fix it immediately. Unquoted strings break the parser.',
      '- ARRAY EXTRACTION CHECK: Are you passing an object to a table or list that expects an array? Are you calling `.length` on an interface that isn\'t an array? Check your Types and extract the array if needed.',
      '- NULL/UNDEFINED CRASH CHECK: Did you write `?.something.map` or `?.something.length`? It WILL crash your app if something is undefined. Change it to `(?.something || []).map` and `?.something?.length` immediately.',
      '- Every Tailwind class is a complete string (no string concatenation for class names)',
      '- useQuery({ queryKey: [...], queryFn: async () => ... }) — both fields required',
      '- NEVER put BrowserRouter (or any Router) inside App.tsx — it belongs only in main.tsx. Two Routers = crash.',
  );
  return lines.join('\n');
}

function buildAutoModePrompt() {
  return [
    'You are a web app specification expert. Given a brief description, produce a JSON spec for a React + Vite + TypeScript web app.',
    'Return ONLY valid JSON — no markdown fences, no preamble, no explanation.',
    '',
    'Fixed stack (do not change): React 18, Vite 5, TypeScript 5, Tailwind CSS v3, TanStack Query v5, React Router v6, Zustand v4, Zod, Lucide React, Recharts.',
    'Use Recharts when the app needs charts, graphs, or data visualization (bar, line, pie, area, radar charts).',
    'If the app needs 3D (Three.js), maps (Leaflet), animations (Framer Motion), etc., add those packages to additionalPackages. The generator will install them.',
    '',
    'JSON schema to return:',
    '{',
    '  "projectName": "string",',
    '  "description": "2-3 sentences what it does — subject verb object",',
    '  "primaryUser": "one sentence — who uses it for what task",',
    '  "successMetric": "one observable measurement",',
    '  "outOfScope": ["string"],',
    '  "pages": [{"route": "/", "component": "HomePage", "description": "what this page shows", "authRequired": false}],',
    '  "features": [{"name": "", "page": "PageComponent", "userStory": "Given/When/Then", "dataReads": "what data from which endpoint/store", "dataWrites": "what mutations this feature triggers", "edgeCases": "loading state / empty state / error state", "uiComponents": "PRESCRIPTIVE: e.g. BarChart(X=month Y=revenue) | DataTable(cols: date amount status) | Form(fields: name email, POST /submit) | StatCard(label value icon)"}],',
    '"layoutType": "dashboard or sidebar or cards or table or landing or form",',
    '"colorScheme": "exact colors from prompt with hex codes, e.g. background: pale goldenrod #EEE8AA, primary: dark olive green #556B2F",',
    '  "dataTypes": "export interface User { id: string; email: string }\\nexport interface ApiError { code: string; message: string }\\n// ALL entities used anywhere",',
    '  "apiStyle": "ALMOST ALWAYS mock. Use rest ONLY if the prompt explicitly provides a real backend URL or existing API. For self-contained apps (the default), use mock so the app works without a server.",',
    '  "apiEndpoints": [{"method": "GET", "path": "/api/resource", "request": "", "response": "Type[]", "usedBy": "PageName"}],',
    '  "mockDescription": "description if apiStyle is mock or local",',
    '  "colorPrimary": "tailwind class or hex",',
    '  "colorSecondary": "",',
    '  "fontFamily": "",',
    '  "layoutNotes": "",',
    '  "a11yNotes": "",',
    '  "additionalPackages": ["npm packages beyond core stack for this app type: e.g. three + @react-three/fiber + @react-three/drei for 3D, leaflet + react-leaflet for maps, d3 for complex charts, framer-motion for animations, socket.io-client for realtime. Use [] for standard CRUD/dashboard apps."],',
    '  "antiRequirements": ["MUST NOT ..."]',
    '}',
    '',
    'CRITICAL RULES:',
    '- dataTypes must be EXHAUSTIVE: include every TypeScript interface used by any page, feature, or API. Always include ApiError.',
    '- pages: all routes start with /. Component names are PascalCase ending in Page.',
    '- features.page must exactly match a component name listed in pages.',
    '- apiEndpoints only needed when apiStyle is "rest".',
    '- AUTH + MOCK: If any page has authRequired:true AND apiStyle is "mock" or "local", you MUST include a LoginPage at route /login in the pages array. The auth is handled entirely client-side with demo credentials.',
    '- Never set ALL pages as authRequired:true — the login page itself must be authRequired:false, otherwise the app is inaccessible.',
    '- uiComponents: be MAXIMALLY PRESCRIPTIVE. Specify chart type + axes + data source + entry count. Specify table columns by name. Specify form fields with types. Example: "BarChart(X=month labels Jan-Dec, Y=revenue in millions, 12 data points from getMonthlySales) | DataTable(20 rows, cols: parkName string, revenue number, visitors number, growthRate percent, status active/inactive, actions Edit/View) | StatCard×4 (totalRevenue, totalVisitors, activeParks, alertCount)".',
    '- mockDescription: when apiStyle is mock, describe 15-20 realistic records with specific domain values (real names, realistic numbers, meaningful dates). The generator will use this to create actual mock data arrays.',
    '- colorScheme: always fill this if the prompt mentions any color, material, or visual style. Include hex codes.',
    '- layoutType: always set this — it determines the page structure. Dashboard apps use "dashboard", management tools use "sidebar", content sites use "cards".',
    '- uiComponents: for EVERY feature, specify EXACT recharts component (BarChart/LineChart/PieChart/AreaChart/RadarChart), table columns with types, or form fields with validation rules. This is the most important field — it drives actual implementation.',
    '- dataTypes: include EVERY interface. For each interface, list all fields with their TypeScript types. The generator uses this verbatim — incomplete types cause runtime errors.',
    '- If the app involves any data over time: include a LineChart or AreaChart feature.',
    '- If the app involves categories/distribution: include a PieChart or BarChart feature.',
    '- If the app involves comparison: include a grouped BarChart or RadarChart feature.',
    '- DEFAULT TO MOCK: unless the prompt explicitly mentions an existing backend/REST API/server URL, set apiStyle to "mock". WebGen-style prompts almost never provide a backend. A mock app runs immediately; a REST app fails because fetch hits a non-existent server and returns HTML instead of JSON.',
    '- With mock: apiEndpoints can be empty []. The mock service derives all functions from dataTypes. Do NOT list cart endpoints (cart is Zustand-only) and do NOT list a login endpoint (login is client-side via DEMO_CREDENTIALS).',
    '- Cart is ALWAYS Zustand + localStorage, never an API. Order/product/record data is server state handled by the mock service, never a Zustand store.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATE
// ─────────────────────────────────────────────────────────────────────────────

const blankPage    = () => ({ route: '', component: '', description: '', authRequired: false });
const blankFeature = () => ({
  name: '', page: '', userStory: '', dataReads: '', dataWrites: '', edgeCases: '',
  uiComponents: '',  // specific UI to render: chart type, table columns, form fields
});
const blankEndpoint = () => ({ method: 'GET', path: '', request: '', response: '', usedBy: '' });

const COMMON_EXTRA_PACKAGES = [
  { name: 'three + @react-three/fiber + @react-three/drei + @types/three', label: '3D (Three.js + R3F v8 → React 18)' },
  { name: 'leaflet + react-leaflet + @types/leaflet', label: 'Maps (Leaflet)' },
  { name: 'd3 + @types/d3', label: 'Data viz (D3.js)' },
  { name: 'framer-motion', label: 'Animations (Framer Motion)' },
  { name: 'react-hook-form + @hookform/resolvers', label: 'Forms (React Hook Form)' },
  { name: 'date-fns', label: 'Date utilities (date-fns)' },
  { name: 'axios', label: 'HTTP client (Axios)' },
  { name: 'socket.io-client', label: 'WebSockets (Socket.io)' },
  { name: 'react-markdown + remark-gfm', label: 'Markdown rendering' },
  { name: 'xlsx', label: 'Excel export (SheetJS)' },
  { name: 'react-hot-toast', label: 'Toast notifications' },
  { name: 'react-icons', label: 'Icon library (react-icons)' },
  { name: 'jspdf', label: 'PDF export (jsPDF)' },
];

const DEFAULT_ANTI = [
  'MUST NOT add pages or routes not listed in the spec',

  'MUST NOT write CSS files — Tailwind classes only',
  'MUST NOT use class components',
  'MUST NOT add Redux or MobX',
  'MUST NOT use Axios — native fetch inside queryFn only',
  'MUST NOT use the any type',
  'MUST NOT add console.log in production paths',
];

const initialState = {
  projectName: '', description: '', primaryUser: '', successMetric: '', outOfScope: [],
  pages: [blankPage()],
  features: [blankFeature()],
  dataTypes: '',
  apiStyle: 'mock',
  apiEndpoints: [blankEndpoint()],
  mockDescription: '',
  colorPrimary: '', colorSecondary: '', fontFamily: '', layoutNotes: '', a11yNotes: '',
  antiRequirements: [...DEFAULT_ANTI],
  additionalPackages: [],
  layoutType: 'dashboard',
  colorScheme: '',
  model: 'openai/gpt-5.4-mini',
};

const SECTIONS = [
  { id: 1, label: 'App Overview' },
  { id: 2, label: 'Pages & Routes' },
  { id: 3, label: 'Features' },
  { id: 4, label: 'Data Types' },
  { id: 5, label: 'API / Data Layer' },
  { id: 6, label: 'UI Constraints' },
  { id: 7, label: 'Anti-Requirements' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. MARKDOWN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function generateMarkdown(s) {
  const L = [];
  const push = (...x) => L.push(...x);
  const ok = v => v && String(v).trim().length > 0;

  push('# ' + (s.projectName || '[App Name]'), '');
  push('> **SpecMD v4 — React Web App**', '> React 18 · Vite 5 · TypeScript 5 · Tailwind CSS · TanStack Query v5 · React Router v6 · Zustand', '');

  push('---', '', '## 1. App Overview', '');
  if (ok(s.description))    push('### 1.1 What it does', s.description.trim(), '');
  if (ok(s.primaryUser))    push('### 1.2 Primary user', s.primaryUser.trim(), '');
  if (ok(s.successMetric))  push('### 1.3 Success metric', s.successMetric.trim(), '');
  if (s.outOfScope.length)  { push('### 1.4 Out of scope'); s.outOfScope.forEach(x => push('- ' + x)); push(''); }
  if (s.additionalPackages && s.additionalPackages.length) {
    push('### 1.5 Additional packages');
    s.additionalPackages.forEach(p => push('- `' + p + '`'));
    push('');
  }

  const pages = s.pages.filter(p => ok(p.route) || ok(p.component));
  if (pages.length) {
    push('---', '', '## 2. Pages & Routes', '');
    push('| Route | Page component | Description | Auth |');
    push('|-------|---------------|-------------|------|');
    pages.forEach(p => push('| `' + (p.route || '/') + '` | `' + (p.component || 'Page') + '` | ' + (p.description || '—') + ' | ' + (p.authRequired ? 'yes' : 'no') + ' |'));
    push('');
  }

  const feats = s.features.filter(f => ok(f.name));
  if (feats.length) {
    push('---', '', '## 3. Features', '');
    feats.forEach(f => {
      push('### Feature: `' + f.name + '`', '');
      if (ok(f.page))       push('- **Page**: `' + f.page + '`');
      if (ok(f.userStory))  { push('- **User story**:', '', '  ```'); f.userStory.split('\n').forEach(l => push('  ' + l)); push('  ```'); }
      if (ok(f.dataReads))    push('- **Data reads**: ' + f.dataReads);
      if (ok(f.dataWrites))   push('- **Data writes**: ' + f.dataWrites);
      if (ok(f.edgeCases))    push('- **Edge cases**: ' + f.edgeCases);
      if (ok(f.uiComponents)) push('- **UI to render**: ' + f.uiComponents);
      push('');
    });
  }

  if (ok(s.dataTypes)) {
    push('---', '', '## 4. Data Types', '', '```typescript', s.dataTypes.trim(), '```', '');
  }

  const hasApi = s.apiStyle === 'rest'
      ? s.apiEndpoints.some(e => ok(e.path))
      : ok(s.mockDescription);

  if (hasApi) {
    push('---', '', '## 5. API / Data Layer', '');
    if (s.apiStyle === 'rest') {
      push('**REST API** — functions in `src/services/api.ts`', '');
      push('| Method | Path | Request | Response | Used by |');
      push('|--------|------|---------|----------|---------|');
      s.apiEndpoints.filter(e => ok(e.path)).forEach(e =>
          push('| ' + e.method + ' | `' + e.path + '` | ' + (e.request || '—') + ' | `' + (e.response || 'unknown') + '` | ' + (e.usedBy || '—') + ' |')
      );
      push('');
    } else {
      push('**' + (s.apiStyle === 'mock' ? 'Mock data' : 'Local state') + '**', '', s.mockDescription.trim(), '');
    }
  }

  const hasUI = [s.layoutType, s.colorScheme, s.colorPrimary, s.colorSecondary, s.fontFamily, s.layoutNotes, s.a11yNotes].some(ok);
  if (hasUI) {
    push('---', '', '## 6. UI Constraints', '');
    if (ok(s.layoutType))     push('- **Layout pattern**: ' + s.layoutType);
    if (ok(s.colorScheme))    push('- **Color scheme**: ' + s.colorScheme);
    if (ok(s.colorPrimary))   push('- **Primary colour**: ' + s.colorPrimary);
    if (ok(s.colorSecondary)) push('- **Secondary**: ' + s.colorSecondary);
    if (ok(s.fontFamily))     push('- **Typography**: ' + s.fontFamily);
    if (ok(s.layoutNotes))    push('- **Layout notes**: ' + s.layoutNotes);
    if (ok(s.a11yNotes))      push('- **Accessibility**: ' + s.a11yNotes);
    push('');
  }

  if (s.antiRequirements.length) {
    push('---', '', '## 7. Anti-Requirements', '');
    s.antiRequirements.forEach(a => push('- ' + a));
    push('');
  }

  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SECTION STATUS
// ─────────────────────────────────────────────────────────────────────────────

function secStatus(s, id) {
  const ok = v => v && String(v).trim().length > 0;
  switch (id) {
    case 1: { const f = [s.projectName, s.description, s.primaryUser, s.successMetric].filter(ok).length; return f === 0 ? 'empty' : f >= 3 ? 'filled' : 'partial'; }
    case 2: { const p = s.pages.filter(p => ok(p.route) && ok(p.component)); return p.length === 0 ? 'empty' : p.length >= 2 ? 'filled' : 'partial'; }
    case 3: { const f = s.features.filter(f => ok(f.name)); return f.length === 0 ? 'empty' : f.every(f => ok(f.userStory)) ? 'filled' : 'partial'; }
    case 4: return ok(s.dataTypes) ? 'filled' : 'empty';
    case 5: return s.apiStyle === 'rest' ? s.apiEndpoints.some(e => ok(e.path)) ? 'filled' : 'empty' : ok(s.mockDescription) ? 'filled' : 'empty';
    case 6: return [s.layoutType, s.colorScheme, s.colorPrimary, s.layoutNotes].some(ok) ? 'filled' : 'empty';
    case 7: return s.antiRequirements.length > 0 ? 'filled' : 'empty';
    default: return 'empty';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, help, children }) {
  return (
      <div className="field">
        <label className="field-label">{label}</label>
        {help && <div className="field-help">{help}</div>}
        {children}
      </div>
  );
}

function Tags({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const submit = () => { const t = draft.trim(); if (t) { onChange([...value, t]); setDraft(''); } };
  return (
      <div className="tag-wrap">
        {value.map((v, i) => (
            <span key={i} className="tag">
          {v}
              <button className="tag-rm" onClick={() => onChange(value.filter((_, j) => j !== i))} type="button">×</button>
        </span>
        ))}
        <input
            className="tag-input" type="text" value={draft} placeholder={placeholder}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); submit(); }
              else if (e.key === 'Backspace' && !draft && value.length > 0) { onChange(value.slice(0, -1)); }
            }}
            onBlur={submit}
        />
      </div>
  );
}

function Cards({ items, onChange, onAdd, addLabel, title, renderItem }) {
  return (
      <div>
        <div className="card-stack">
          {items.length === 0 && <div className="empty-hint">No items yet.</div>}
          {items.map((item, idx) => (
              <div key={idx} className="item-card">
                <div className="item-card-header">
                  <span className="item-card-title"><span className="idx">#{idx + 1}</span>{title}</span>
                  <button className="btn-danger-ghost" onClick={() => onChange(items.filter((_, j) => j !== idx))} type="button">Remove</button>
                </div>
                {renderItem(item, idx)}
              </div>
          ))}
        </div>
        <button className="add-btn" onClick={onAdd} type="button">+ {addLabel}</button>
      </div>
  );
}

function hlMd(md) {
  return md.split('\n').map((line, i) => {
    let cls = '';
    if (line.startsWith('# '))          cls = 'md-h1';
    else if (line.startsWith('## '))    cls = 'md-h2';
    else if (line.startsWith('### '))   cls = 'md-h3';
    else if (line.startsWith('- '))     cls = 'md-list';
    else if (line.startsWith('```') || line.startsWith('    ')) cls = 'md-code';
    else if (line.startsWith('_'))      cls = 'md-meta';
    return <div key={i} className={cls}>{line || '\u00A0'}</div>;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Sec1({ s, set }) {
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 01</span>
          <h2 className="section-title">App <em>Overview</em></h2>
          <p className="section-desc">What the app does, who it serves, how we know it succeeded.</p>
        </div>
        <Field label="Project name">
          <input type="text" value={s.projectName} onChange={e => set({ projectName: e.target.value })} placeholder="BisqueSalmon Storefront"/>
        </Field>
        <Field label="What it does" help="2-3 sentences. Subject, verb, object. No marketing.">
          <textarea value={s.description} onChange={e => set({ description: e.target.value })} placeholder="Lets customers browse a product catalogue, add items to a cart, and complete checkout. Admins manage inventory. Order history is available in the user profile."/>
        </Field>
        <div className="row-2">
          <Field label="Primary user & job">
            <textarea value={s.primaryUser} onChange={e => set({ primaryUser: e.target.value })} placeholder="A shopper who wants to browse and buy products without creating an account."/>
          </Field>
          <Field label="Success metric">
            <textarea value={s.successMetric} onChange={e => set({ successMetric: e.target.value })} placeholder="A user can add a product to cart and reach order confirmation in under 3 clicks."/>
          </Field>
        </div>
        <Field label="Out of scope" help="Press Enter after each item.">
          <Tags value={s.outOfScope} onChange={v => set({ outOfScope: v })} placeholder="e.g. Admin dashboard"/>
        </Field>
        <Field label="Additional npm packages" help="Libraries beyond the core stack (React, Tailwind, TanStack Query, Zustand, Recharts). The generator will add them to package.json. Press Enter after each.">
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>Common additions:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {COMMON_EXTRA_PACKAGES.map(pkg => {
                const on = s.additionalPackages.includes(pkg.name);
                return (
                    <button key={pkg.name} className="btn" style={{ fontSize: 11, padding: '3px 10px', background: on ? 'var(--gen-muted)' : '', borderColor: on ? 'var(--gen)' : '', color: on ? 'var(--gen)' : '' }}
                            onClick={() => set({ additionalPackages: on ? s.additionalPackages.filter(p => p !== pkg.name) : [...s.additionalPackages, pkg.name] })}>
                      {on ? '✓ ' : '+ '}{pkg.label}
                    </button>
                );
              })}
            </div>
          </div>
          <Tags value={s.additionalPackages} onChange={v => set({ additionalPackages: v })} placeholder="e.g. three, @react-three/fiber"/>
        </Field>
      </>
  );
}

function Sec2({ s, set }) {
  const upP = (i, patch) => { const n = [...s.pages]; n[i] = { ...n[i], ...patch }; set({ pages: n }); };
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 02</span>
          <h2 className="section-title">Pages & <em>Routes</em></h2>
          <p className="section-desc">Every screen in the app. Component names become file names: <code>HomePage → src/pages/HomePage.tsx</code>.</p>
        </div>
        <Cards
            items={s.pages} title="Page" addLabel="Add page"
            onChange={items => set({ pages: items })}
            onAdd={() => set({ pages: [...s.pages, blankPage()] })}
            renderItem={(p, i) => (
                <>
                  <div className="row-3">
                    <Field label="Route path">
                      <input type="text" className="code" value={p.route} onChange={e => upP(i, { route: e.target.value })} placeholder="/products"/>
                    </Field>
                    <Field label="Page component name">
                      <input type="text" className="code" value={p.component} onChange={e => upP(i, { component: e.target.value })} placeholder="ProductsPage"/>
                    </Field>
                    <Field label="Auth required">
                      <select value={p.authRequired ? 'yes' : 'no'} onChange={e => upP(i, { authRequired: e.target.value === 'yes' })}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea value={p.description} onChange={e => upP(i, { description: e.target.value })} placeholder="Grid of all products with category filters. Each card links to the product detail page." style={{ minHeight: 60 }}/>
                  </Field>
                </>
            )}
        />
      </>
  );
}

function Sec3({ s, set }) {
  const upF = (i, patch) => { const n = [...s.features]; n[i] = { ...n[i], ...patch }; set({ features: n }); };
  const pageOpts = s.pages.filter(p => p.component).map(p => p.component);
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 03</span>
          <h2 className="section-title">Features & <em>User Stories</em></h2>
          <p className="section-desc">What each meaningful section of the UI does. The generator uses these to know what each page must render and handle.</p>
        </div>
        <Cards
            items={s.features} title="Feature" addLabel="Add feature"
            onChange={items => set({ features: items })}
            onAdd={() => set({ features: [...s.features, blankFeature()] })}
            renderItem={(f, i) => (
                <>
                  <div className="row-2">
                    <Field label="Feature name">
                      <input type="text" value={f.name} onChange={e => upF(i, { name: e.target.value })} placeholder="Product catalogue"/>
                    </Field>
                    <Field label="Page component">
                      {pageOpts.length > 0
                          ? <select value={f.page} onChange={e => upF(i, { page: e.target.value })}>
                            <option value="">— select page —</option>
                            {pageOpts.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          : <input type="text" className="code" value={f.page} onChange={e => upF(i, { page: e.target.value })} placeholder="ProductsPage"/>
                      }
                    </Field>
                  </div>
                  <Field label="User story" help="Given / When / Then — one per line.">
                    <textarea className="code" value={f.userStory} onChange={e => upF(i, { userStory: e.target.value })} placeholder={'Given products are loaded\nWhen user clicks a category\nThen only that category shows\nAnd the URL updates'} style={{ minHeight: 100 }}/>
                  </Field>
                  <div className="row-2">
                    <Field label="Data reads">
                      <textarea value={f.dataReads} onChange={e => upF(i, { dataReads: e.target.value })} placeholder="Product list from GET /api/products. Categories from GET /api/categories." style={{ minHeight: 60 }}/>
                    </Field>
                    <Field label="Data writes">
                      <textarea value={f.dataWrites} onChange={e => upF(i, { dataWrites: e.target.value })} placeholder="POST /api/cart/add on 'Add to cart' click." style={{ minHeight: 60 }}/>
                    </Field>
                  </div>
                  <Field label="Edge cases">
                    <textarea value={f.edgeCases} onChange={e => upF(i, { edgeCases: e.target.value })} placeholder="Skeleton grid while loading. 'No products found' when empty. Error banner on failure." style={{ minHeight: 56 }}/>
                  </Field>
                  <Field label="UI components to render" help="Be specific: chart type, table columns, form fields, card layout. This drives the actual implementation.">
                    <textarea className="code" value={f.uiComponents || ''} onChange={e => upF(i, { uiComponents: e.target.value })} placeholder='e.g. BarChart(X=month Y=revenue) | DataTable(cols: date amount status) | Form(fields: name email) | StatCard(label value icon)' style={{ minHeight: 80 }}/>
                  </Field>
                </>
            )}
        />
      </>
  );
}

function Sec4({ s, set }) {
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 04</span>
          <h2 className="section-title">Data <em>Types</em></h2>
          <p className="section-desc">TypeScript interfaces for every entity. All go in <code>src/types/index.ts</code> — the first file generated, imported by everything else.</p>
        </div>
        <div className="section-info-note">
          ⚡ This is the most critical file. List EVERY type used anywhere. A missing type causes cascading errors across all files that import it.
        </div>
        <Field label="TypeScript interfaces" help="Use export interface / export type. Every entity and every API error shape goes here.">
        <textarea
            className="code" value={s.dataTypes} onChange={e => set({ dataTypes: e.target.value })}
            style={{ minHeight: 320 }}
            placeholder={'export interface User {\n  id: string\n  email: string\n  name: string\n}\n\nexport interface Product {\n  id: string\n  name: string\n  description: string\n  price: number\n  category: string\n  imageUrl: string\n  stock: number\n}\n\nexport interface CartItem {\n  product: Product\n  quantity: number\n}\n\nexport interface Cart {\n  items: CartItem[]\n  total: number\n}\n\nexport interface ApiError {\n  code: string\n  message: string\n}'}
        />
        </Field>
      </>
  );
}

function Sec5({ s, set }) {
  const upE = (i, patch) => { const n = [...s.apiEndpoints]; n[i] = { ...n[i], ...patch }; set({ apiEndpoints: n }); };
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 05</span>
          <h2 className="section-title">API / <em>Data Layer</em></h2>
          <p className="section-desc">Where data comes from. API calls go in <code>src/services/api.ts</code> and are wrapped by TanStack Query hooks.</p>
        </div>
        <Field label="Data source">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['rest', 'REST API'], ['mock', 'Mock data'], ['local', 'Local state']].map(([v, l]) => (
                <button key={v} className="btn" style={{ flex: 1, justifyContent: 'center', background: s.apiStyle === v ? 'var(--accent-muted)' : '', borderColor: s.apiStyle === v ? 'var(--accent)' : '', color: s.apiStyle === v ? 'var(--accent)' : '' }} onClick={() => set({ apiStyle: v })}>{l}</button>
            ))}
          </div>
        </Field>
        {s.apiStyle === 'rest' && (
            <Cards
                items={s.apiEndpoints} title="Endpoint" addLabel="Add endpoint"
                onChange={items => set({ apiEndpoints: items })}
                onAdd={() => set({ apiEndpoints: [...s.apiEndpoints, blankEndpoint()] })}
                renderItem={(e, i) => (
                    <>
                      <div className="row-2">
                        <Field label="Method & path">
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select value={e.method} onChange={ev => upE(i, { method: ev.target.value })} style={{ width: 90, flex: 'none' }}>
                              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                            </select>
                            <input type="text" className="code" value={e.path} onChange={ev => upE(i, { path: ev.target.value })} placeholder="/api/products" style={{ flex: 1 }}/>
                          </div>
                        </Field>
                        <Field label="Response type">
                          <input type="text" className="code" value={e.response} onChange={ev => upE(i, { response: ev.target.value })} placeholder="Product[]"/>
                        </Field>
                      </div>
                      <div className="row-2">
                        <Field label="Request body">
                          <input type="text" className="code" value={e.request} onChange={ev => upE(i, { request: ev.target.value })} placeholder="{ productId: string, qty: number }"/>
                        </Field>
                        <Field label="Used by">
                          <input type="text" value={e.usedBy} onChange={ev => upE(i, { usedBy: ev.target.value })} placeholder="ProductsPage"/>
                        </Field>
                      </div>
                    </>
                )}
            />
        )}
        {(s.apiStyle === 'mock' || s.apiStyle === 'local') && (
            <Field label={s.apiStyle === 'mock' ? 'Mock data description' : 'Local state description'}>
              <textarea value={s.mockDescription} onChange={e => set({ mockDescription: e.target.value })} style={{ minHeight: 120 }} placeholder={s.apiStyle === 'mock' ? '5 products across 3 categories. 2 users. 1 sample cart with 2 items.' : 'Auth state in localStorage. Cart persisted to localStorage.'}/>
            </Field>
        )}
      </>
  );
}

function Sec6({ s, set }) {
  const layouts = [
    ['dashboard','Dashboard','Stat cards + charts grid'],
    ['sidebar','Sidebar nav','Left nav + main content'],
    ['cards','Cards','Grid of content cards'],
    ['table','Table-heavy','Full-width data tables'],
    ['landing','Landing','Hero + sections'],
    ['form','Form-centric','Multi-step forms'],
  ];
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 06</span>
          <h2 className="section-title">UI <em>Constraints</em></h2>
          <p className="section-desc">Visual and layout requirements. These directly affect what gets generated — be specific.</p>
        </div>
        <Field label="Layout type" help="Choose the dominant layout pattern for this app.">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {layouts.map(([val, label, desc]) => (
                <button key={val} className="btn" onClick={() => set({ layoutType: val })}
                        style={{ flex: '1 1 120px', flexDirection: 'column', alignItems: 'flex-start', padding: '8px 12px',
                          background: s.layoutType === val ? 'var(--accent-muted)' : '',
                          borderColor: s.layoutType === val ? 'var(--accent)' : '',
                          color: s.layoutType === val ? 'var(--accent)' : '' }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                  <span style={{ fontSize: 11, color: s.layoutType === val ? 'var(--accent)' : 'var(--text-3)' }}>{desc}</span>
                </button>
            ))}
          </div>
        </Field>
        <Field label="Color scheme / theme" help="Describe the visual identity. Copy directly from the prompt if it specifies colors.">
          <textarea value={s.colorScheme || ''} onChange={e => set({ colorScheme: e.target.value })} placeholder='e.g. background: pale goldenrod (#EEE8AA), primary: dark olive green (#556B2F), accent: crimson #DC143C' style={{ minHeight: 80 }}/>
        </Field>
        <div className="row-2">
          <Field label="Primary colour"><input type="text" value={s.colorPrimary} onChange={e => set({ colorPrimary: e.target.value })} placeholder="blue-600 or #3B82F6"/></Field>
          <Field label="Secondary / neutral"><input type="text" value={s.colorSecondary} onChange={e => set({ colorSecondary: e.target.value })} placeholder="slate-600"/></Field>
        </div>
        <Field label="Typography"><input type="text" value={s.fontFamily} onChange={e => set({ fontFamily: e.target.value })} placeholder="System font or Google Fonts: Geist"/></Field>
        <Field label="Layout notes">
          <textarea value={s.layoutNotes} onChange={e => set({ layoutNotes: e.target.value })} placeholder="Top navigation bar. Content max-width 1280px centered. Mobile-first." style={{ minHeight: 70 }}/>
        </Field>
        <Field label="Accessibility">
          <textarea value={s.a11yNotes} onChange={e => set({ a11yNotes: e.target.value })} placeholder="Keyboard navigation for all interactive elements. ARIA labels on icon-only buttons." style={{ minHeight: 70 }}/>
        </Field>
      </>
  );
}

function Sec7({ s, set }) {
  const presets = [
    'MUST NOT add pages or routes not listed in the spec',

    'MUST NOT write CSS files — Tailwind classes only',
    'MUST NOT use class components',
    'MUST NOT add Redux or MobX',
    'MUST NOT use Axios — native fetch inside queryFn only',
    'MUST NOT use the any type',
    'MUST NOT add console.log in production paths',
    'MUST NOT implement authentication not described in the spec',
    'MUST NOT add a backend server',
  ];
  return (
      <>
        <div className="section-header">
          <span className="section-tag">SECTION 07</span>
          <h2 className="section-title">Anti-<em>Requirements</em></h2>
          <p className="section-desc">Every item is injected into every file generation prompt. The more specific, the better.</p>
        </div>
        <Field label="Presets">
          {presets.map(r => {
            const on = s.antiRequirements.includes(r);
            return (
                <label key={r} className={'check-row ' + (on ? 'on' : '')}>
                  <input type="checkbox" checked={on} onChange={e => {
                    if (e.target.checked) set({ antiRequirements: [...s.antiRequirements, r] });
                    else set({ antiRequirements: s.antiRequirements.filter(x => x !== r) });
                  }}/>
                  <span className="check-row-label">{r}</span>
                </label>
            );
          })}
        </Field>
        <Field label="Custom">
          <Tags
              value={s.antiRequirements.filter(r => !presets.includes(r))}
              onChange={custom => { const fp = s.antiRequirements.filter(r => presets.includes(r)); set({ antiRequirements: [...fp, ...custom] }); }}
              placeholder="MUST NOT ..."
          />
        </Field>
      </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. GENERATE APP LOGIC
// ─────────────────────────────────────────────────────────────────────────────

async function callGPT(apiKey, messages, model, temperature = 0.1, onUsage) {
  // Constructed as an array join to entirely bypass markdown link auto-formatting in chat UIs
  const API_URL = ['https:', '', 'openrouter.ai', 'api', 'v1', 'chat', 'completions'].join('/');

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://specmd-builder.local',
      'X-Title': 'SpecMD Builder',
    },
    body: JSON.stringify({ model: model || 'openai/gpt-5.4-mini', temperature, messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'API error ' + resp.status);
  }
  const data = await resp.json();
  // Report token usage (deterministic, straight from the API response) if a sink is provided.
  if (onUsage && data.usage) {
    onUsage({
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0,
      totalTokens: data.usage.total_tokens || 0,
    });
  }
  return data.choices?.[0]?.message?.content || '';
}

// Validate a generated .ts/.tsx file by actually parsing it with Babel (available
// in-browser via @babel/standalone). Returns { ok: true } or { ok: false, error }.
// This is the objective gate: the parser — not a heuristic — decides validity.
function validateSyntax(filePath, code) {
  if (!/\.(tsx?|jsx?)$/.test(filePath)) return { ok: true };
  const Babel = (typeof window !== 'undefined' && window.Babel) || (typeof globalThis !== 'undefined' && globalThis.Babel);
  if (!Babel || !Babel.transform) return { ok: true }; // can't validate → don't block
  try {
    Babel.transform(code, {
      presets: [
        ['react', { runtime: 'classic' }],
        ['typescript', { allExtensions: true, isTSX: true, onlyRemoveTypeImports: true }],
      ],
      filename: filePath,
    });
    return { ok: true };
  } catch (e) {
    // Babel error messages include the line/column and a code frame — exactly the
    // feedback the model needs to fix the specific syntax problem.
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

async function generateOneFile(filePath, fileRole, extraContext, state, apiKey, onCont, model, onUsage) {
  const sys  = buildSysPrompt(state.antiRequirements, state.additionalPackages);
  const user = buildUserPrompt(filePath, fileRole, generateMarkdown(state), extraContext);

  let content = '';
  let msgs = [{ role: 'system', content: sys }, { role: 'user', content: user }];

  for (let att = 0; att <= 3; att++) {
    if (att > 0 && onCont) onCont(att);
    const chunk = await callGPT(apiKey, msgs, model, 0.1, onUsage);
    const cleanChunk = chunk.replace(/<<<CONTINUE>>>\s*$/, '').trimEnd();

    // RESTART GUARD (small-model failure mode): instead of continuing, weaker
    // models often re-emit the file from the top. A continuation chunk that
    // begins with an import block or "export default" is a restart, not a
    // continuation. Detect it and stop — keep only the first, longer attempt.
    if (att > 0) {
      const head = cleanChunk.replace(/^```[a-z]*\s*\n/i, '').trimStart().slice(0, 400);
      const looksLikeRestart = /^\s*import\s/.test(head) || /export\s+default\s+function/.test(head);
      if (looksLikeRestart) {
        // Discard this restart entirely; the already-accumulated content is the file.
        break;
      }
    }

    const hasCont = chunk.trimEnd().endsWith('<<<CONTINUE>>>');
    content += (att > 0 ? '\n' : '') + cleanChunk;
    if (!hasCont) break;
    msgs = [...msgs,
      { role: 'assistant', content: chunk },
      { role: 'user', content: 'Continue exactly from where you stopped. Output ONLY the remaining lines. Do NOT restart the file, do NOT repeat the imports, do NOT repeat any line you already wrote.' },
    ];
  }
  content = sanitizeGenerated(content);

  // VALIDATION GATE: parse the file with Babel. If it has a syntax error (e.g. a
  // backslash in a JSX attribute, a malformed ternary, an unclosed string), do ONE
  // targeted regeneration. The retry sees the SAME full context (system prompt +
  // Blueprint + manifest + cheatsheet + all generated files, all inside `user`)
  // PLUS the broken code and the exact parser error. Deterministic in WHEN to retry
  // (the parser decides), model-driven in HOW to fix.
  const check = validateSyntax(filePath, content);
  if (!check.ok) {
    if (onCont) onCont('fixing syntax');
    const fixUser = [
      user,
      '',
      '════════ SYNTAX ERROR — THE FILE YOU PRODUCED DOES NOT PARSE ════════',
      'You generated the file below for ' + filePath + ', but it has a SYNTAX error and must be rewritten.',
      '',
      'The exact parser error was:',
      check.error,
      '',
      'Common causes and their fixes:',
      '- Backslash in a JSX attribute (value="...\\"...\\"..."): JSX attributes do NOT use JS-style \\" escapes. Use a JS expression instead: value={"Noun Genders: \\"en\\" vs \\"et\\""}, or rewrite with single quotes inside, e.g. value={\'Noun Genders: "en" vs "et"\'}.',
      '- Malformed JSX ternary ({cond ? (...)} with no ": else" branch): every {cond ? (<A/>) : (<B/>)} needs the colon branch; if there is no else, use {cond && (<A/>)}.',
      '- Unterminated string or template literal, or a missing closing tag/brace/paren.',
      '',
      'Output the COMPLETE corrected file for ' + filePath + ' again, from the first import to the last line. Fix ONLY what is needed to make it parse; keep all the working logic, imports, and JSX. Do not add explanations, do not wrap in markdown fences.',
    ].join('\n');

    const fixMsgs = [
      { role: 'system', content: sys },
      { role: 'user', content: fixUser },
      { role: 'assistant', content: content },
      { role: 'user', content: 'The above does not parse. Error: ' + check.error + '\nRewrite the entire corrected file now. Output only the code.' },
    ];
    try {
      const fixed = sanitizeGenerated(await callGPT(apiKey, fixMsgs, model, 0.1, onUsage));
      const recheck = validateSyntax(filePath, fixed);
      // Keep the fixed version if it now parses, OR if it parses no worse and is
      // substantial (avoid replacing with a truncated stub).
      if (recheck.ok && fixed.trim().length > 0) {
        content = fixed;
      }
    } catch (e) {
      // Retry call failed (network etc.) — keep the original best-effort content.
    }
  }

  return content.trim();
}

// Shared post-processing applied to every generated file (first pass AND any
// validation-gate retry) so cleanup is identical on both paths.
function sanitizeGenerated(raw) {
  let content = (raw || '')
      .replace(/<\/<\//g, '</')      // </</aside> → </aside>
      .replace(/<<\//g, '</')        // <</div> → </div>
      // Strip leading markdown fences (e.g., ```typescript)
      .replace(/^```[a-z]*\s*\n/i, '')
      // Strip trailing markdown fences
      .replace(/\n```\s*$/, '');

  // TS1361 PREVENTION (line-scoped so object literals like { type: "x" } are untouched):
  // convert "import type { X }" → "import { X }" and strip inline "type" modifiers.
  content = content.split('\n').map(line => {
    if (/^\s*import\b/.test(line) && /\bfrom\b/.test(line)) {
      return line
          .replace(/\bimport\s+type\s+/, 'import ')
          .replace(/\{\s*type\s+/g, '{ ')
          .replace(/,\s*type\s+/g, ', ');
    }
    return line;
  }).join('\n');

  // DUPLICATE-FILE GUARD: if a small model concatenated two full copies of the
  // file, keep only the first complete copy.
  const exportDefaultMatches = [...content.matchAll(/^export\s+default\s+function\b/gm)];
  if (exportDefaultMatches.length > 1) {
    const cutIdx = exportDefaultMatches[1].index;
    const firstCopy = content.slice(0, cutIdx).trimEnd();
    const balanced = (s) => {
      const o = (s.match(/[{(]/g) || []).length;
      const c2 = (s.match(/[})]/g) || []).length;
      return Math.abs(o - c2) <= 2;
    };
    if (balanced(firstCopy)) {
      content = firstCopy;
    } else {
      const secondStart = content.lastIndexOf('\nimport ', cutIdx);
      content = secondStart > 0 ? content.slice(secondStart).trimStart() : content;
    }
  }

  return content.trim();
}

function planFiles(s) {
  const ok = v => v && String(v).trim().length > 0;
  const plan = [];

  // Detect auth need from multiple signals — not just authRequired flag.
  // The LLM will import useAuthStore if auth is mentioned anywhere in the spec,
  // so we must generate authStore proactively when auth is relevant.
  const AUTH_KEYWORDS = ['login', 'log in', 'log-in', 'auth', 'sign in', 'sign-in',
    'account', 'user management', 'credential', 'password', 'session', 'token'];
  const specText = [
    s.description, s.primaryUser,
    ...s.features.map(f => f.name + ' ' + f.userStory + ' ' + f.dataReads),
    ...s.pages.map(p => p.description),
  ].join(' ').toLowerCase();
  const needsAuth = s.pages.some(p => p.authRequired)
      || AUTH_KEYWORDS.some(kw => specText.includes(kw));
  const hasCart = s.features.some(f => f.name.toLowerCase().includes('cart'));

  if (ok(s.dataTypes)) {
    // Build the list of MANDATORY exports. These are types that hardcoded
    // downstream files (authStore, cartStore) import by exact name. If the LLM
    // omits or renames them, those files fail with TS2305. Forcing them here
    // closes the contract — the types file MUST export these exact names.
    const mandatoryTypes = [];
    if (needsAuth) {
      mandatoryTypes.push(
          'User — MUST be exported with this EXACT name (authStore imports { User } from "@/types"). Minimum shape: { id: string; email: string; name: string }. Add more fields if the spec describes them, but these three are required and the interface MUST be named exactly "User".'
      );
    }
    if (hasCart) {
      mandatoryTypes.push(
          'Product — MUST be exported with this EXACT name (cartStore imports it). Minimum shape: { id: string; name: string; price: number }.',
          'CartItem — MUST be exported with this EXACT name (cartStore imports it). Shape: { product: Product; quantity: number }.'
      );
    }
    const mandatorySection = mandatoryTypes.length > 0
        ? ['', 'MANDATORY EXPORTS (downstream files import these by exact name — omitting or renaming them breaks the build with TS2305):', ...mandatoryTypes.map(t => '- ' + t)]
        : [];

    plan.push({ path: 'src/types/index.ts',
      role: [
        'Export ONLY TypeScript type declarations: interface, type, enum.',
        'ZERO runtime code — no functions, no const values, no arrays, no objects, no ROUTES.',
        'ZERO service logic — no fetch calls, no data generation.',
        'Every page will import TYPES from this file and FUNCTIONS from src/services/ or src/hooks/.',
        'If a page imports a function from types/index.ts, that is a build error.',
        'Include ALL interfaces from the spec Data Types section. Be exhaustive.',
        ...mandatorySection,
        'No hard line limit — define every type the app needs.',
      ].join('\n'),
      phase: 1 });
  }

  // Guard against the most common LLM error: putting functions in types
  plan.forEach(f => {
    if (f.path === 'src/types/index.ts') {
      f.role = 'TYPES ONLY FILE — ' + f.role;
    }
  });

  // Constants file: ROUTES + theme constants — always generated so pages have a single source of truth.
  // Derive the EXACT ROUTES object from the spec pages so ROUTES.login === "/login"
  // matches the <Route path="/login"> registered in App.tsx (prevents nav mismatches).
  const routeKey = (route) => {
    if (route === '/') return 'home';
    const segs = route.split('/').filter(Boolean);
    const hasParam = segs.some(x => x.startsWith(':'));
    const staticSegs = segs.filter(x => !x.startsWith(':'));
    const camel = staticSegs.map((seg, i) => {
      const parts = seg.split(/[-_]/).filter(Boolean);
      return parts.map((p, j) => (i === 0 && j === 0) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('');
    }).join('');
    return hasParam ? (camel || 'detail') + 'Detail' : (camel || 'route');
  };
  const routeEntries = [];
  const usedKeys = new Set();
  s.pages.filter(p => ok(p.route)).forEach(p => {
    let key = routeKey(p.route);
    while (usedKeys.has(key)) key = key + '2';
    usedKeys.add(key);
    if (p.route.includes('/:')) {
      // Dynamic route → builder function. e.g. orderDetail: (id) => `/orders/${id}`
      const fnBody = '`' + p.route.replace(/:([A-Za-z0-9_]+)/g, '${$1}') + '`';
      const params = (p.route.match(/:([A-Za-z0-9_]+)/g) || []).map(s2 => s2.slice(1)).join(', ');
      routeEntries.push('    ' + key + ': (' + params + ': string) => ' + fnBody + ',');
    } else {
      routeEntries.push('    ' + key + ': "' + p.route + '",');
    }
  });
  const routesObjectText = routeEntries.length > 0
      ? routeEntries.join('\n')
      : '    home: "/",';

  const constantsRoleBlocks = [
    'Export ROUTES + app-wide config. SINGLE SOURCE OF TRUTH for routes.',
    '',
    'REQUIRED EXPORTS — use EXACTLY this ROUTES object (derived from the app pages; paths must match App.tsx route table):',
    '  export const ROUTES = {',
    routesObjectText,
    '  } as const',
    '',
    '  export const APP_CONFIG = {',
    '    title: "' + (s.projectName || 'App') + '",',
    '  } as const',
    '',
    'Static routes are string literals (navigate(ROUTES.login)). Dynamic routes are builder functions (navigate(ROUTES.ordersDetail(id))). Do not change the keys or paths above.',
  ];
  if (needsAuth) {
    constantsRoleBlocks.push(
        '',
        'CRITICAL — DEMO_CREDENTIALS export (used by BOTH authStore AND LoginPage):',
        '  export interface DemoCredential { email: string; password: string; name: string; role: string }',
        '  export const DEMO_CREDENTIALS: DemoCredential[] = [',
        '    { email: "demo@example.com",  password: "demo123",  name: "Demo User",  role: "user" },',
        '    { email: "admin@example.com", password: "admin123", name: "Admin User", role: "admin" },',
        '  ]',
        '',
        'These exact values must appear in this file VERBATIM. authStore.ts will import and validate against these. LoginPage.tsx will import and display these. Mismatch = broken login.',
    );
  }
  constantsRoleBlocks.push(
      '',
      'CRITICAL RESTRICTION: DO NOT export any other constants. Do not export APP_THEME, FORMATS, STATUSES, or any domain-specific arrays. Keep this file strictly limited to ROUTES and APP_CONFIG (and DEMO_CREDENTIALS if auth is used).',
      'No functions. No imports from other src/ files. No hard line limit.'
  );
  plan.push({
    path: 'src/constants.ts',
    role: constantsRoleBlocks.join('\n'),
    phase: 1,
  });

  if (s.apiStyle === 'rest' && s.apiEndpoints.some(e => ok(e.path)))
    plan.push({
      path: 'src/services/api.ts',
      role: [
        'Async API service functions. THESE are the functions pages import — NOT src/types.',
        'Pattern for each endpoint:',
        '  export async function getProducts(): Promise<Product[]> {',
        '    const r = await fetch("/api/products")',
        '    if (!r.ok) throw { code: "API_ERROR", message: r.statusText } satisfies ApiError',
        '    return r.json()',
        '  }',
        'Rules:',
        '- One exported function per API endpoint — no private helpers with duplicate names.',
        '- Every function name is unique in this file.',
        '- Import all types from "@/types".',
        '- No React, no hooks, no state.',
        'Endpoints to implement: ' + s.apiEndpoints.filter(e => e.path).map(e => e.method + ' ' + e.path + ' → ' + e.response).join(', '),
      ].join('\n'),
      phase: 2,
    });
  else if (s.apiStyle === 'mock')
    plan.push({
      path: 'src/services/mock.ts',
      role: [
        'COMPLETE MOCK SERVICE LAYER — implements every service function using local data.',
        'Private data arrays + exported async functions. NO bare exported const arrays.',
        '',
        'EXACT PATTERN TO USE:',
        '  import type { Character } from "@/types"',
        '  const mockCharacters: Character[] = [',
        '    { id:"c1", name:"Sam Porter Bridges", faction:"Bridges", role:"Porter", status:"active" },',
        '    // 15-20 records with realistic domain values',
        '  ]',
        '  export async function getCharacters(): Promise<Character[]> { return [...mockCharacters] }',
        '  export async function getCharacterById(id:string): Promise<Character|null> {',
        '    return mockCharacters.find(c => c.id === id) ?? null',
        '  }',
        '  export async function createCharacter(data: Omit<Character,"id">): Promise<Character> {',
        '    const c = { ...data, id: crypto.randomUUID() }',
        '    mockCharacters.push(c)',
        '    return c',
        '  }',
        '',
        'IMPLEMENT EVERY function the App Blueprint declares (see top of context).',
        'Names MUST be identical to Blueprint — pages will import them by exact name.',
        'Each function is async and returns Promise<T>.',
        'CRITICAL NAMING RULE: Prefix your private data arrays with "mock" (e.g., mockCharacters, mockProducts). DO NOT use underscores. Using the "mock" prefix prevents naming collisions with the exported functions (getCharacters, getProducts).',
        '15-20 realistic records per entity with domain-specific values (not Item 1, Item 2).',
        'POPULATE ALL FIELDS: Initialize EVERY field defined in the TypeScript types. If a type has an array field (e.g., reports: Report[]), set it to [] rather than omitting it. Omitted arrays cause runtime crashes.',
        'Import only from "@/types". No React, no hooks.',
        'App mock context: ' + s.mockDescription,
      ].join('\n'),
      phase: 2,
    });

  if (needsAuth) {
    const authRole = [
      'Zustand store for authentication. EXACT implementation below — follow it precisely.',
      '',
      'REQUIRED CODE STRUCTURE:',
      '  import { create } from "zustand"',
      '  import type { User } from "@/types"',
      '  import { DEMO_CREDENTIALS } from "@/constants"',
      '',
      '  interface AuthStore {',
      '    user: User | null',
      '    isAuthenticated: boolean',
      '    login: (email: string, password: string) => boolean',
      '    logout: () => void',
      '  }',
      '',
      '  export const useAuthStore = create<AuthStore>((set) => ({',
      '    user: null,',
      '    isAuthenticated: false,',
      '    login: (email, password) => {',
      '      const match = DEMO_CREDENTIALS.find(c => c.email === email && c.password === password)',
      '      if (match) {',
      '        set({ user: { id: match.email, email: match.email, name: match.name }, isAuthenticated: true })',
      '        return true',
      '      }',
      '      return false',
      '    },',
      '    logout: () => set({ user: null, isAuthenticated: false }),',
      '  }))',
      '',
      'CRITICAL RULES:',
      '- login() takes TWO string args (email, password) in that order — NOT an object.',
      '- login() returns boolean: true on success, false on failure.',
      '- Validate against DEMO_CREDENTIALS imported from "@/constants" — never hardcode credentials here.',
      '- The User object fields must match the User interface in src/types.',
      '- Do NOT auto-login on store creation.',
      s.apiStyle === 'rest'
          ? 'NOTE: This is a REST app, but for login use the DEMO_CREDENTIALS client-side validation above (real auth backends are out of scope).'
          : '',
      'No hard line limit.',
    ].filter(Boolean).join('\n');
    plan.push({ path: 'src/store/authStore.ts', role: authRole, phase: 3 });
  }

  if (hasCart) {
    const cartRole = [
      'Zustand store for the shopping cart. EXACT implementation below — follow it precisely.',
      '',
      'REQUIRED CODE STRUCTURE:',
      '  import { create } from "zustand"',
      '  import type { Product, CartItem } from "@/types"',
      '',
      '  interface CartStore {',
      '    items: CartItem[]',
      '    addItem: (product: Product, quantity?: number) => void',
      '    removeItem: (productId: string) => void',
      '    updateQuantity: (productId: string, quantity: number) => void',
      '    clearCart: () => void',
      '    getTotal: () => number',
      '    getSubtotal: () => number',
      '    getItemQuantity: (productId: string) => number',
      '    setItems: (items: CartItem[]) => void',
      '  }',
      '',
      '  export const useCartStore = create<CartStore>((set, get) => ({',
      '    items: [],',
      '    addItem: (product, quantity = 1) => set((state) => {',
      '      const existing = state.items.find(i => i.product.id === product.id)',
      '      if (existing) return { items: state.items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i) }',
      '      return { items: [...state.items, { product, quantity }] }',
      '    }),',
      '    removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.product.id !== id) })),',
      '    updateQuantity: (id, quantity) => set((state) => ({ items: state.items.map(i => i.product.id === id ? { ...i, quantity } : i) })),',
      '    clearCart: () => set({ items: [] }),',
      '    getTotal: () => get().items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0),',
      '    getSubtotal: () => get().getTotal(),',
      '    getItemQuantity: (id) => get().items.find(i => i.product.id === id)?.quantity || 0,',
      '    setItems: (items) => set({ items }),',
      '  }))',
      '',
      'CRITICAL RULES:',
      '- Implement this exact interface. Do not invent other method names.',
      '- Make sure CartItem is defined in src/types/index.ts (if not, define a safe fallback, but typically it has { product, quantity }).'
    ].join('\n');
    plan.push({ path: 'src/store/cartStore.ts', role: cartRole, phase: 3 });
  }

  plan.push({
    path: 'src/hooks/useApi.ts',
    role: [
      'TanStack Query hooks for every service function.',
      'CHECK ALREADY-GENERATED FILES above to find the service file and import from it:',
      '  mock app (src/services/mock.ts exists) → import from "@/services/mock"',
      '  REST app (src/services/api.ts exists)  → import from "@/services/api"',
      '',
      'One hook per service function. Examples:',
      '  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"',
      '  import { getCharacters, createCharacter } from "@/services/mock"',
      '  export const useCharacters = (filter?: CharacterFilter) =>',
      '    useQuery({ queryKey: ["characters", filter], queryFn: () => getCharacters(filter) })',
      '  export const useCreateCharacter = () => {',
      '    const qc = useQueryClient()',
      '    return useMutation({ mutationFn: createCharacter,',
      '      onSuccess: () => qc.invalidateQueries({ queryKey: ["characters"] }) })',
      '  }',
      'Implement a hook for EVERY function in the service file. No hard line limit.',
    ].join('\n'),
    phase: 4,
  });

  s.pages.filter(p => ok(p.component)).forEach(p => {
    const feats = s.features.filter(f => f.page === p.component);
    const featDesc = feats.length > 0
        ? 'Features on this page:\n' + feats.map(f => '- ' + f.name + ': ' + f.userStory.split('\n')[0]).join('\n')
        : '';
    const pageBudget = feats.length > 2 ? 1600 : 1200;
    const isLoginPage = (p.route === '/login' || p.component.toLowerCase().includes('login'));
    const mockLoginHint = isLoginPage
        ? [
          '═══ THIS IS THE LOGIN PAGE — implement EXACTLY this working pattern ═══',
          '',
          'import { useState } from "react"',
          'import { useNavigate } from "react-router-dom"',
          'import { useAuthStore } from "@/store/authStore"',
          'import { DEMO_CREDENTIALS, ROUTES } from "@/constants"',
          '',
          'export default function ' + p.component + '() {',
          '  const [email, setEmail] = useState("")',
          '  const [password, setPassword] = useState("")',
          '  const [error, setError] = useState("")',
          '  const login = useAuthStore(s => s.login)',
          '  const navigate = useNavigate()',
          '',
          '  const handleSubmit = (e: React.FormEvent) => {',
          '    e.preventDefault()',
          '    setError("")',
          '    const success = login(email, password)',
          '    if (success) { navigate(ROUTES.home) }',
          '    else { setError("Invalid email or password") }',
          '  }',
          '',
          '  return (',
          '    <div className="min-h-screen flex items-center justify-center ...">',
          '      <div className="...card...">',
          '        {/* Demo credentials box — clickable to autofill */}',
          '        <div className="...info box...">',
          '          <p>Demo accounts (click to use):</p>',
          '          {DEMO_CREDENTIALS.map(c => (',
          '            <button key={c.email} type="button"',
          '              onClick={() => { setEmail(c.email); setPassword(c.password) }}>',
          '              {c.email} / {c.password}',
          '            </button>',
          '          ))}',
          '        </div>',
          '        <form onSubmit={handleSubmit}>',
          '          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />',
          '          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />',
          '          {error && <p className="text-red-500">{error}</p>}',
          '          <button type="submit">Sign In</button>',
          '        </form>',
          '      </div>',
          '    </div>',
          '  )',
          '}',
          '',
          'RULES: login(email, password) takes two string args. Check the boolean return. Navigate to ROUTES.home on success. The demo credentials MUST come from DEMO_CREDENTIALS (imported) so they always match the auth store. Style it well with the app color scheme.',
        ].join('\n')
        : '';
    // Build feature detail: include uiComponents for each feature on this page
    const featureDetails = feats.map(f => {
      const lines = ['Feature: ' + f.name];
      if (f.userStory) lines.push('Story: ' + f.userStory.split('\n')[0]);
      if (f.uiComponents) lines.push('Render: ' + f.uiComponents);
      if (f.dataReads) lines.push('Data: ' + f.dataReads);
      if (f.edgeCases) lines.push('States: ' + f.edgeCases);
      return lines.join(' | ');
    }).join('\n');

    const layoutHint = s.layoutType ? 'Layout pattern: ' + s.layoutType + '. ' : '';
    const colorHint = s.colorScheme
        ? 'Apply this color scheme: ' + s.colorScheme
        : (s.colorPrimary ? 'Primary color: ' + s.colorPrimary + (s.colorSecondary ? ', secondary: ' + s.colorSecondary : '') : '');

    plan.push({
      path: 'src/pages/' + p.component + '.tsx',
      role: [
        'Page component for route "' + p.route + '".',
        p.description,
        featureDetails ? 'FEATURES TO IMPLEMENT ON THIS PAGE:\n' + featureDetails : '',
        layoutHint + colorHint,
        mockLoginHint,
        'IMPLEMENTATION REQUIREMENTS:',
        '- Implement every feature listed above with real functionality, not placeholders.',
        '- Every chart must use recharts with real data arrays (use mock data if no API).',
        '- Every table must render actual rows with all columns specified.',
        '- Every form must have state (useState), validation (Zod), and submit handler.',
        '- Apply the color scheme consistently to backgrounds, buttons, headers.',
        '- Use the layout pattern specified (e.g. dashboard = stat cards grid, sidebar = fixed left nav).',
        'Implement FULLY — no placeholder content, no TODO comments. Line budget: ' + pageBudget + ' lines (use all of it if needed).',
        'If auth is required (not the login page itself), check isAuthenticated and redirect to /login.',
      ].filter(Boolean).join('\n'),
      phase: 5,
    });
  });

  // Build the EXACT, COMPLETE route list deterministically from the spec pages.
  // This guarantees every page (especially /login) gets a registered <Route>,
  // eliminating "No routes matched" errors from the LLM omitting or renaming routes.
  const routablePages = s.pages.filter(p => ok(p.component) && ok(p.route));
  const pageImports = routablePages
      .map(p => 'import ' + p.component + ' from "@/pages/' + p.component + '"')
      .join('\n  ');
  const routeElements = routablePages
      .map(p => '<Route path="' + p.route + '" element={<' + p.component + ' />} />')
      .join('\n        ');

  plan.push({
    path: 'src/App.tsx',
    role: [
      'Renders <Routes> with one <Route> per page component. Nothing else.',
      'CRITICAL: Do NOT import or use BrowserRouter, HashRouter, MemoryRouter, or any Router component.',
      'BrowserRouter is already provided by main.tsx. Adding a second Router causes a crash.',
      '',
      'USE EXACTLY THESE IMPORTS AND ROUTES (copy verbatim — this is the complete, correct route table; do not add, remove, or rename any route):',
      '',
      '  import { Routes, Route } from "react-router-dom"',
      '  ' + pageImports,
      '',
      '  export default function App() {',
      '    return (',
      '      <Routes>',
      '        ' + routeElements,
      '      </Routes>',
      '    )',
      '  }',
      '',
      'Every route above MUST be present. The paths must match exactly (e.g. "/login" must be registered or login navigation fails with "No routes matched").',
      'You may add a catch-all <Route path="*" ...> redirecting to "/" if you wish, but never omit any route listed above.',
      'Line budget: 300 lines.',
    ].join('\n'),
    phase: 6,
  });
  plan.push({ path: 'src/main.tsx',
    role: [
      'Application entry point. Provides ALL providers — the ONE BrowserRouter for the whole app.',
      'CRITICAL: This is the only file that imports BrowserRouter. App.tsx has no Router.',
      'Exact structure to follow:',
      '  import { StrictMode } from "react"',
      '  import { createRoot } from "react-dom/client"',
      '  import { BrowserRouter } from "react-router-dom"',
      '  import { QueryClient, QueryClientProvider } from "@tanstack/react-query"',
      '  import App from "./App"',
      '  import "./index.css"',
      '  const queryClient = new QueryClient()',
      '  createRoot(document.getElementById("root")!).render(',
      '    <StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></StrictMode>',
      '  )',
      'Line budget: 80 lines.',
    ].join('\n'),
    phase: 6 });

  return plan;
}

function genReadme(s, detectedPackages) {
  const { known, unknown } = parseAdditionalPackages(s.additionalPackages || []);

  // Packages detected in the generated code and auto-added to package.json.
  const detected = (detectedPackages || []).filter(p => !CORE_PACKAGES.has(p));
  const detectedKnown = detected.filter(p => PINNED_VERSIONS[p]);
  const detectedUnverified = detected.filter(p => !PINNED_VERSIONS[p]);

  const detectedSection = detected.length > 0 ? [
    '',
    '## Auto-detected dependencies',
    '',
    'These packages are imported by the generated code and have been added to `package.json` automatically — `npm install` pulls them in:',
    '',
    '```',
    ...detectedKnown.map(p => p + '  (version-pinned, React 18 verified)'),
    ...detectedUnverified.map(p => p + '  (installed as "latest" — pin a version if you need reproducibility)'),
    '```',
  ] : [];

  const unknownSection = unknown.length > 0 ? [
    '',
    '## Declared packages requiring version check',
    '',
    'These were requested in the spec but are not in the verified compatibility table.',
    'They are installed; verify the version suits React 18 if you hit peer warnings.',
    '',
    '```bash',
    ...unknown.map(p => 'npm install ' + p),
    '```',
  ] : [];

  return [
    '# ' + (s.projectName || 'App'),
    '',
    '> Generated by **SpecMD Builder v4** — React + Vite + TypeScript + Tailwind CSS',
    '',
    '## Stack',
    'React 18 · Vite 5 · TypeScript 5 · Tailwind CSS v3 · TanStack Query v5 · React Router v6 · Zustand',
    ...(Object.keys(known).length > 0 ? ['· ' + Object.keys(known).join(' · ')] : []),
    '',
    '## Quick Start',
    '',
    '```bash',
    'npm install',
    'npm run dev',
    '```',
    '',
    '> If `npm install` fails with an ERESOLVE peer dependency error, use:',
    '> ```bash',
    '> npm install --legacy-peer-deps',
    '> ```',
    '> This is safe for development. Peer dependency conflicts arise when',
    '> two libraries require different versions of a shared dependency.',
    ...detectedSection,
    ...unknownSection,
    '',
    'Open http://localhost:5173',
    '',
    '## Commands',
    '',
    '| Command | Action |',
    '|---------|--------|',
    '| `npm run dev` | Development server |',
    '| `npm run build` | Production build (Vite bundles, types are not strictly checked) |',
    '| `npm test` | Run tests with Vitest |',
    '| `npm run preview` | Preview production build |',
    '',
    '## Project Structure',
    '',
    '```',
    'src/',
    '  pages/       # One component per route',
    '  components/  # Shared UI',
    '  hooks/       # TanStack Query hooks',
    '  services/    # API calls / mock data',
    '  store/       # Zustand stores',
    '  types/       # All TypeScript interfaces',
    '  App.tsx      # Routes',
    '  main.tsx     # Providers + entry',
    '```',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// METRICS — all computed deterministically from generated artifacts + usage log.
// No LLM calls, no estimation heuristics that touch the generation engine.
// ─────────────────────────────────────────────────────────────────────────────

// Count non-empty lines of code in a source string.
function countLOC(text) {
  if (!text) return { total: 0, code: 0, blank: 0, comment: 0 };
  const lines = text.split('\n');
  let code = 0, blank = 0, comment = 0;
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (inBlock) {
      comment++;
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line === '') { blank++; continue; }
    if (line.startsWith('//')) { comment++; continue; }
    if (line.startsWith('/*')) { comment++; if (!line.includes('*/')) inBlock = true; continue; }
    code++;
  }
  return { total: lines.length, code, blank, comment };
}

// Compute the full metrics object from the generated files and the token/timing log.
// `files` is the genRef map (path -> content). `meta` carries usage + timing + plan info.
function computeMetrics(state, files, meta) {
  const entries = Object.entries(files);
  const srcEntries = entries.filter(([p]) => p.startsWith('src/'));
  const tsxEntries = entries.filter(([p]) => p.endsWith('.tsx'));
  const tsEntries  = entries.filter(([p]) => p.endsWith('.ts') && !p.endsWith('.d.ts'));

  const sumLOC = (list, key) => list.reduce((acc, [, c]) => acc + countLOC(c)[key], 0);

  const totalChars = entries.reduce((acc, [, c]) => acc + (c ? c.length : 0), 0);
  const srcChars   = srcEntries.reduce((acc, [, c]) => acc + (c ? c.length : 0), 0);

  const pages    = state.pages.filter(p => p.component && p.component.trim()).length;
  const features = state.features.filter(f => f.name && f.name.trim()).length;
  const types    = (state.dataTypes.match(/export\s+(interface|type|enum)\s+\w+/g) || []).length;

  return {
    projectName: state.projectName || 'app',
    model: state.model || '',
    apiStyle: state.apiStyle || '',
    // File counts
    totalFiles: entries.length,
    sourceFiles: srcEntries.length,
    tsxFiles: tsxEntries.length,
    tsFiles: tsEntries.length,
    // Lines of code
    totalLOC: entries.reduce((acc, [, c]) => acc + countLOC(c).total, 0),
    sourceLOC: sumLOC(srcEntries, 'total'),
    sourceCodeLOC: sumLOC(srcEntries, 'code'),
    sourceBlankLOC: sumLOC(srcEntries, 'blank'),
    sourceCommentLOC: sumLOC(srcEntries, 'comment'),
    // Characters
    totalChars,
    sourceChars: srcChars,
    // Spec complexity (deterministic from state)
    specPages: pages,
    specFeatures: features,
    specTypes: types,
    specLOC: generateMarkdown(state).split('\n').length,
    // LLM usage (real numbers from API responses)
    llmCalls: meta.llmCalls || 0,
    promptTokens: meta.promptTokens || 0,
    completionTokens: meta.completionTokens || 0,
    totalTokens: meta.totalTokens || 0,
    // Timing
    generationSeconds: meta.generationSeconds != null ? meta.generationSeconds : '',
    blueprintGenerated: meta.blueprintGenerated ? 'yes' : 'no',
    // Efficiency ratios (deterministic divisions)
    tokensPerSourceLOC: sumLOC(srcEntries, 'code') > 0 ? (meta.totalTokens / sumLOC(srcEntries, 'code')).toFixed(2) : '',
    locPerLLMCall: (meta.llmCalls || 0) > 0 ? (sumLOC(srcEntries, 'total') / meta.llmCalls).toFixed(1) : '',
  };
}

// Render the metrics object as a two-column CSV (metric,value) — easy to import anywhere.
function metricsToCSV(m) {
  const order = [
    ['project_name', m.projectName],
    ['model', m.model],
    ['api_style', m.apiStyle],
    ['generation_seconds', m.generationSeconds],
    ['blueprint_generated', m.blueprintGenerated],
    ['llm_calls', m.llmCalls],
    ['prompt_tokens', m.promptTokens],
    ['completion_tokens', m.completionTokens],
    ['total_tokens', m.totalTokens],
    ['total_files', m.totalFiles],
    ['source_files', m.sourceFiles],
    ['tsx_files', m.tsxFiles],
    ['ts_files', m.tsFiles],
    ['total_loc', m.totalLOC],
    ['source_loc', m.sourceLOC],
    ['source_code_loc', m.sourceCodeLOC],
    ['source_blank_loc', m.sourceBlankLOC],
    ['source_comment_loc', m.sourceCommentLOC],
    ['total_chars', m.totalChars],
    ['source_chars', m.sourceChars],
    ['spec_pages', m.specPages],
    ['spec_features', m.specFeatures],
    ['spec_types', m.specTypes],
    ['spec_loc', m.specLOC],
    ['tokens_per_source_loc', m.tokensPerSourceLOC],
    ['loc_per_llm_call', m.locPerLLMCall],
  ];
  const esc = v => {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return ['metric,value', ...order.map(([k, v]) => esc(k) + ',' + esc(v))].join('\n');
}

// Extract exported symbol names from a generated source file (deterministic regex).
// Used to build an exact import cheatsheet so small models never guess names.
function extractExports(content) {
  if (!content) return [];
  const names = new Set();
  // export function/const/class/interface/type/enum NAME
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(content)) !== null) names.add(m[1]);
  // export { A, B, C }
  const reBrace = /export\s*\{([^}]+)\}/g;
  while ((m = reBrace.exec(content)) !== null) {
    m[1].split(',').forEach(part => {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    });
  }
  return [...names];
}

// Convert a src path to its @/ alias import specifier (drops extension and /index).
function toAlias(path) {
  return path
      .replace(/^src\//, '@/')
      .replace(/\.tsx?$/, '')
      .replace(/\/index$/, '');
}

// Build an exact, copy-paste import cheatsheet from already-generated files.
// This is the single biggest aid for small models: they no longer infer names or paths.
function buildImportCheatsheet(genFiles) {
  const lines = ['EXACT IMPORTS AVAILABLE (copy these verbatim — names and paths are guaranteed correct):'];
  Object.entries(genFiles)
      .filter(([p]) => p.startsWith('src/') && /\.tsx?$/.test(p) && p !== 'src/index.css')
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([p, c]) => {
        const alias = toAlias(p);
        const exports = extractExports(c);
        const hasDefault = /export\s+default/.test(c);
        if (hasDefault) {
          const defName = p.split('/').pop().replace(/\.tsx?$/, '');
          lines.push('  import ' + defName + ' from "' + alias + '"');
        }
        if (exports.length > 0) {
          lines.push('  import { ' + exports.join(', ') + ' } from "' + alias + '"');
        }
        if (!hasDefault && exports.length === 0) {
          lines.push('  // ' + alias + ' (no named exports detected)');
        }
      });
  lines.push('');
  return lines.join('\n');
}

async function buildZip(files, name) {
  const zip = new JSZip();
  Object.entries(files).forEach(([p, c]) => zip.file(p, c));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (name || 'app').toLowerCase().replace(/\s+/g, '-') + '.zip';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. APP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'specmd-builder-v4';

function App() {
  const [state, setState]     = useState(() => { try { const s = localStorage.getItem(STORAGE_KEY); if (s) return { ...initialState, ...JSON.parse(s) }; } catch (e) {} return initialState; });
  const [active, setActive]   = useState(1);
  const [toast, setToast]     = useState(null);
  const [aiOpen, setAiOpen]   = useState(false);
  const [apiKey, setApiKey]   = useState('');
  const [showKey, setShowKey] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus]   = useState('');
  const [genOpen, setGenOpen]   = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genProgress, setGenProgress] = useState([]);
  const [genError, setGenError]     = useState('');
  const [genDone, setGenDone]       = useState(false);
  const genRef      = useRef({});
  const abortRef    = useRef(false);
  const blueprintRef = useRef('');
  const metricsRef   = useRef(null);

  const set = useCallback(patch => setState(prev => ({ ...prev, ...patch })), []);

  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }, 300);
    return () => clearTimeout(t);
  }, [state]);

  const md    = useMemo(() => generateMarkdown(state), [state]);
  const stats = useMemo(() => ({ lines: md.split('\n').length, words: md.split(/\s+/).filter(Boolean).length }), [md]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const copy  = async () => { try { await navigator.clipboard.writeText(md); showToast('Copied'); } catch (e) { showToast('Copy failed'); } };
  const dlMd  = () => { const b = new Blob([md], { type: 'text/markdown' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = (state.projectName || 'spec').toLowerCase().replace(/\s+/g, '-') + '.spec.md'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); };
  const reset = () => { if (confirm('Reset all fields?')) { setState(initialState); localStorage.removeItem(STORAGE_KEY); showToast('Reset'); } };

  // ── AUTO MODE ──
  const runAuto = async () => {
    if (!apiKey.trim() || !aiPrompt.trim()) return;
    setAiLoading(true); setAiStatus('Sending to OpenRouter…');
    try {
      const API_URL = ['https:', '', 'openrouter.ai', 'api', 'v1', 'chat', 'completions'].join('/');
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
          'HTTP-Referer': '[https://specmd-builder.local](https://specmd-builder.local)',
          'X-Title': 'SpecMD Builder',
        },
        body: JSON.stringify({ model: state.model || 'openai/gpt-5.4-mini', temperature: 0.3, messages: [{ role: 'system', content: buildAutoModePrompt() }, { role: 'user', content: 'App: ' + aiPrompt }] }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e?.error?.message || 'API error ' + resp.status); }
      setAiStatus('Parsing…');
      const data = await resp.json();
      const raw  = data.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(raw.replace(/^```json\n?|^```\n?|```$/gm, '').trim());
      setState(prev => ({ ...prev, ...parsed }));
      setAiOpen(false); setActive(1);
      showToast('✦ Spec filled! Review §4 Data Types carefully.');
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      setAiLoading(false); setAiStatus('');
    }
  };

  // ── GENERATE APP ──
  const openGen = () => {
    abortRef.current = false; setGenDone(false); setGenError(''); genRef.current = {};
    const configs = Object.keys(getHardcodedFiles(state.projectName, state.additionalPackages)).map(p => ({ path: p, status: 'hardcoded' }));
    const llm     = planFiles(state).map(f => ({ path: f.path, status: 'pending' }));
    setGenProgress([
      { path: '📋 App Blueprint', status: 'pending' },
      ...configs,
      ...llm,
    ]);
    setGenOpen(true);
  };

  // ── BLUEPRINT GENERATION ──────────────────────────────────────────────────
  // Generates a TypeScript contract document BEFORE any code.
  // All subsequent files see this blueprint and must implement it exactly.
  // This eliminates naming drift, signature mismatches, and type inconsistencies.
  const generateBlueprint = async (apiKey, onUsage) => {
    const sys = [
      'You are generating a TypeScript contract document for a React + Vite web app.',
      'Output ONLY valid TypeScript — interfaces, types, function signatures, const objects.',
      'No implementations, no JSX, no comments — pure TypeScript declarations.',
      'This document is the LAW: every generated file must implement exactly what you declare here.',
    ].join('\n');

    const user = [
      'APP SPEC:',
      generateMarkdown(state),
      '',
      '═══ FILE SEPARATION RULES (critical — causes build errors if violated) ═══',
      'src/types/index.ts   → ONLY interfaces, types, enums. ZERO functions. ZERO const values.',
      'src/constants.ts     → ROUTES object + app-wide config constants. ZERO types.',
      'src/services/api.ts  → async functions that call the API. ZERO types defined here.',
      'src/services/mock.ts → exported const arrays of typed data. ZERO functions that are also in types.',
      'src/store/*.ts       → Zustand stores only.',
      'src/App.tsx          → Routes only. ZERO store definitions. ZERO exports used by pages.',
      '',
      'Generate a complete TypeScript contract document with these SEPARATE sections:',
      '',
      '// ═══ SECTION 1: DOMAIN TYPES (goes in src/types/index.ts) ═══',
      '// ONLY interface, type, enum declarations',
      '// Example: export interface Character { id: string; name: string; faction: string }',
      '// CRITICAL: If a type is used for filters or partial form state, ensure its properties are optional (e.g., search?: string).',
      '// If the app has authentication, you MUST declare: export interface User { id: string; email: string; name: string } (exact name "User").',
      '// If the app has a cart, you MUST declare: export interface Product { id: string; name: string; price: number } and export interface CartItem { product: Product; quantity: number } (exact names).',
      '',
      '// ═══ SECTION 2: CONSTANTS (goes in src/constants.ts) ═══',
      '// export const ROUTES = { home: "/", login: "/login", ... } as const',
      '// export const APP_CONFIG = { title: "App" } as const',
      '// CRITICAL: Do NOT declare APP_THEME, FORMATS, STATUSES, or other domain constants here. Pages will define those locally.',
      '// If the app has auth: export const DEMO_CREDENTIALS = [{ email, password, name, role }] — used by BOTH authStore and LoginPage',
      '',
      '// ═══ SECTION 3: SERVICE FUNCTION SIGNATURES (goes in src/services/) ═══',
      '// EXACT function signatures. These are canonical — pages will import from services, not from types.',
      '// Example: export declare function getCharacters(): Promise<Character[]>',
      '// Example: export declare function getCharacterById(id: string): Promise<Character | null>',
      '// EVERY function a page might call must be here.',
      '',
      '// ═══ SECTION 4: STORE CONTRACTS (goes in src/store/) ═══',
      '// ONLY declare authStore and/or cartStore. These are the ONLY Zustand stores that exist.',
      '// interface AuthStore { user: User | null; isAuthenticated: boolean; login(email: string, password: string): boolean; logout(): void }',
      '// interface CartStore { items: CartItem[]; addItem(p: Product, qty?: number): void; removeItem(id: string): void; updateQuantity(id: string, qty: number): void; clearCart(): void; getTotal(): number; getSubtotal(): number; getItemQuantity(id: string): number; setItems(items: CartItem[]): void }',
      '// Declare each fully — list EVERY field and method. Pages call only what is declared.',
      '// Do NOT declare orderStore, productStore, userStore or any other store. Orders/products/records are SERVER STATE handled by TanStack Query hooks, never by Zustand. If a page needs orders, it uses useOrders() from hooks, not a store.',
      '',
      '// ═══ SECTION 5: MOCK DATA SAMPLES ═══',
      '// 5 example records per entity with realistic domain values',
      '',
      'Be exhaustive. Every function name declared here is canonical for the whole app.',
      'Output TypeScript declarations only.',
    ].join('\n');

    const response = await callGPT(apiKey, [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], state.model, 0.2, onUsage);

    // Strip markdown from the blueprint before returning
    return response
        .replace(/^```[a-z]*\s*\n/i, '')
        .replace(/\n```\s*$/, '')
        .trim();
  };

  const runGen = async () => {
    if (!apiKey.trim()) { showToast('Enter API key in Auto Mode first'); return; }
    const plan = planFiles(state);
    if (plan.length === 0) { showToast('Fill in Pages (§2) and Data Types (§4) first'); return; }
    setGenLoading(true); setGenError(''); abortRef.current = false;
    blueprintRef.current = '';

    // Metrics accumulator — token usage and call counts come straight from the
    // API responses (deterministic). Timing is wall-clock around the run.
    const usage = { llmCalls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, blueprintGenerated: false };
    const onUsage = (u) => {
      usage.llmCalls += 1;
      usage.promptTokens += u.promptTokens;
      usage.completionTokens += u.completionTokens;
      usage.totalTokens += u.totalTokens;
    };
    const startTime = Date.now();
    metricsRef.current = null;

    // Define setFS early so it can be used in blueprint step and the main loop
    const setFS = (path, patch) => setGenProgress(prev => prev.map(p => p.path === path ? { ...p, ...patch } : p));

    // Step 0: Generate Blueprint (contract document)
    setFS('📋 App Blueprint', { status: 'generating' });
    try {
      const blueprint = await generateBlueprint(apiKey.trim(), onUsage);
      blueprintRef.current = blueprint;
      usage.blueprintGenerated = true;
      setFS('📋 App Blueprint', { status: 'done' });
    } catch (e) {
      setFS('📋 App Blueprint', { status: 'error' });
      // Non-fatal: continue without blueprint
      console.warn('Blueprint generation failed:', e.message);
    }

    Object.entries(getHardcodedFiles(state.projectName, state.additionalPackages)).forEach(([p, c]) => { genRef.current[p] = c; });

    for (const file of plan) {
      if (abortRef.current) break;
      setFS(file.path, { status: 'generating' });
      try {
        // Pass ALL previously generated source files in full.
        // This is the only way to guarantee that imports, function names,
        // type names, and prop signatures are consistent across every file.
        // Large context window — even 20 files at 300+ lines each
        // is only ~15k tokens, well within budget.
        const generatedSourceFiles = Object.entries(genRef.current)
            .filter(([p]) => p.startsWith('src/'))
            .sort(([a], [b]) => a.localeCompare(b));

        // Build explicit manifest of existing files.
        // This prevents the LLM from importing files that don't exist.
        const existingPaths = [
          ...Object.keys(genRef.current).filter(p => p.startsWith('src/')),
          // Also list files yet to be generated in this plan (they will exist)
          ...plan.map(f => f.path).filter(f => f.startsWith('src/')),
        ];
        const fileManifest = [
          'FILES THAT EXIST IN THIS PROJECT — import ONLY from these, use the @/ alias:',
          ...existingPaths.map(p => '  ' + toAlias(p) + '   (file: ' + p + ')'),
          '',
          'If a path is NOT listed above, the file does not exist. DO NOT import from it.',
          'Specifically: if @/store/authStore is not listed, do NOT use useAuthStore.',
          'If @/hooks/useApi is not listed, do NOT import from it.',
          '',
        ].join('\n');

        // Exact import cheatsheet from already-generated files — small models copy these verbatim.
        const cheatsheet = generatedSourceFiles.length > 0
            ? buildImportCheatsheet(genRef.current) + '\n'
            : '';

        // Blueprint (contract document) always comes first
        const blueprintSection = blueprintRef.current
            ? '╔═══════════════════════════════════════════════╗\n║  APP BLUEPRINT — implement these contracts EXACTLY  ║\n╚═══════════════════════════════════════════════╝\n' + blueprintRef.current + '\n\n'
            : '';

        let extra = blueprintSection + fileManifest + cheatsheet;
        if (generatedSourceFiles.length > 0) {
          extra += generatedSourceFiles
              .map(([p, c]) => '=== ' + p + ' ===\n' + c)
              .join('\n\n---\n\n');
        }

        const content = await generateOneFile(file.path, file.role, extra, state, apiKey.trim(), n => setFS(file.path, { status: 'cont ' + n }), state.model, onUsage);
        genRef.current[file.path] = content;
        setFS(file.path, { status: 'done' });
      } catch (e) {
        setFS(file.path, { status: 'error' });
        setGenError('Error on ' + file.path + ': ' + e.message);
        setGenLoading(false); return;
      }
    }

    if (!abortRef.current) {
      // Re-derive package.json from the code that was ACTUALLY generated, so any
      // package the model imported (e.g. canvas-confetti) is installed and the
      // app runs without manual steps. Deterministic — pure scan of imports.
      const detected = detectImportedPackages(genRef.current);
      genRef.current['package.json'] = makePackageJson(state.projectName, state.additionalPackages, detected);

      genRef.current['spec.md']   = generateMarkdown(state);
      genRef.current['README.md'] = genReadme(state, detected);

      // Surface any detected packages not in our verified table (installed as "latest").
      const unverified = detected.filter(p => !CORE_PACKAGES.has(p) && !PINNED_VERSIONS[p]);
      if (unverified.length > 0) {
        console.warn('Detected unverified packages (installed as latest):', unverified.join(', '));
      }

      // Compute deterministic metrics over the generated artifacts + usage log.
      const generationSeconds = Math.round((Date.now() - startTime) / 1000);
      const metrics = computeMetrics(state, genRef.current, {
        ...usage,
        generationSeconds,
      });
      metricsRef.current = metrics;
      genRef.current['metrics.csv'] = metricsToCSV(metrics);

      setGenDone(true);
    }
    setGenLoading(false);
  };

  const dlZip = async () => { try { await buildZip(genRef.current, state.projectName); showToast('✦ ZIP downloaded!'); } catch (e) { showToast('ZIP error: ' + e.message); } };

  const renderSection = () => {
    const p = { s: state, set };
    switch (active) {
      case 1: return <Sec1 {...p}/>;  case 2: return <Sec2 {...p}/>;
      case 3: return <Sec3 {...p}/>;  case 4: return <Sec4 {...p}/>;
      case 5: return <Sec5 {...p}/>;  case 6: return <Sec6 {...p}/>;
      case 7: return <Sec7 {...p}/>;
      default: return null;
    }
  };

  return (
      <>
        <header className="header">
          <div className="brand">
            <span className="brand-mark">Spec<span className="a">MD</span> Builder <span className="g">v4</span></span>
            <span className="brand-sub">Spec-Driven · Non-Agentic · Production-Grade</span>
          </div>
          <div className="header-right">
            <div className="stack-pills">
              {['React 18', 'Vite 5', 'TS 5', 'Tailwind', 'TanStack Query', 'RR6', 'Zustand', 'Zod', 'Recharts'].map(pill => (
                  <span key={pill} className="stack-pill">{pill}</span>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={reset}>Reset</button>
            <button className="btn btn-ai" onClick={() => setAiOpen(true)}>✦ Auto Mode</button>
            <button className="btn" onClick={copy}>Copy .md</button>
            <button className="btn btn-primary" onClick={dlMd}>Download .md</button>
            <button className="btn btn-gen" onClick={openGen}>⚡ Generate App</button>
          </div>
        </header>

        <div className="main">
          <aside className="sidebar">
            <div className="sidebar-label">Sections</div>
            {SECTIONS.map(sec => {
              const st = secStatus(state, sec.id);
              return (
                  <div key={sec.id} className={'nav-item ' + (active === sec.id ? 'active' : '')} onClick={() => setActive(sec.id)}>
                    <span className="nav-num">{String(sec.id).padStart(2, '0')}</span>
                    <span className="nav-label">{sec.label}</span>
                    <span className={'nav-dot ' + st}></span>
                  </div>
              );
            })}
            <div style={{ padding: '20px 16px 8px', borderTop: '1px solid var(--border)', marginTop: 16 }}>
              <div className="sidebar-label" style={{ padding: 0, marginBottom: 10 }}>Fixed stack</div>
              {['React 18 + Vite 5', 'TypeScript 5 (bundler)', 'Tailwind CSS v3', 'TanStack Query v5', 'React Router v6', 'Zustand v4', 'Zod', 'Recharts', state.model || 'openai/gpt-5.4-mini'].map(item => (
                  <div key={item} style={{ fontSize: 11, color: 'var(--text-3)', padding: '2px 0', fontFamily: "'JetBrains Mono',monospace" }}>✓ {item}</div>
              ))}
            </div>
          </aside>

          <main className="form-panel">{renderSection()}</main>

          <aside className="preview-panel">
            <div className="preview-header">
              <span className="preview-title">Live SpecMD preview</span>
              <span className="preview-stats">{stats.lines} lines · {stats.words} words</span>
            </div>
            <div className="preview-body">{hlMd(md)}</div>
          </aside>
        </div>

        {toast && <div className="toast">{toast}</div>}

        {/* AUTO MODE MODAL */}
        {aiOpen && (
            <div className="overlay" onClick={e => { if (e.target.classList.contains('overlay')) setAiOpen(false); }}>
              <div className="modal">
                <div className="modal-head">
                  <h2 className="modal-title">✦ Auto <em>Mode</em></h2>
                  <button className="modal-close" onClick={() => setAiOpen(false)}>✕</button>
                </div>
                <p className="modal-desc">Describe your app — the selected model fills the entire spec including data types, pages, and features. Review §4 Data Types before generating code.</p>
                <div className="ai-field">
                  <label>OpenRouter API Key (shared with Generate App)</label>
                  <div className="key-row">
                    <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-…"/>
                    <button className="key-toggle" onClick={() => setShowKey(v => !v)}>{showKey ? 'Hide' : 'Show'}</button>
                  </div>
                  <div className="ai-field-hint">Never stored server-side.</div>
                </div>
                <div className="ai-field">
                  <label>Model</label>
                  <input type="text" value={state.model} onChange={e => set({ model: e.target.value })} placeholder="openai/gpt-5.4-mini"/>
                  <div className="ai-field-hint">Any OpenRouter model you have API access to. Also used for Generate App and Blueprint.</div>
                </div>
                <div className="ai-field">
                  <label>App description</label>
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="An e-commerce storefront. Users browse products, add to cart, checkout. Products have categories, prices, stock. Auth via email/password. Mock data — no real backend."/>
                  <div className="ai-field-hint">Include: what it does, who uses it, key features, mock vs real API, tech constraints.</div>
                </div>
                {aiLoading && (
                    <div className="progress-row">
                      <div className="spinner"></div>
                      <span className="progress-text">{aiStatus || 'Working…'}</span>
                    </div>
                )}
                <div className="modal-foot">
                  <button className="btn btn-ghost" onClick={() => setAiOpen(false)} disabled={aiLoading}>Cancel</button>
                  <button className="btn btn-ai" onClick={runAuto} disabled={aiLoading || !apiKey.trim() || !aiPrompt.trim()}>{aiLoading ? 'Generating…' : '✦ Fill spec'}</button>
                </div>
              </div>
            </div>
        )}

        {/* GENERATE APP MODAL */}
        {genOpen && (
            <div className="overlay" onClick={e => { if (e.target.classList.contains('overlay') && !genLoading) setGenOpen(false); }}>
              <div className="modal modal-wide">
                <div className="modal-head">
                  <h2 className="modal-title">⚡ Generate <em className="g">App</em></h2>
                  <button className="modal-close" onClick={() => { if (genLoading) abortRef.current = true; setGenOpen(false); }}>✕</button>
                </div>
                <p className="modal-desc">Step 0: generates an <strong>App Blueprint</strong> (TypeScript contracts for all functions, stores, and components). Then generates files in order: types → services → store → hooks → pages → App. Every file sees the Blueprint and all previously generated files. ZIP includes all sources + spec.md + README.md.</p>
                {!apiKey.trim() && <div className="gen-error">⚠ No API key. Open Auto Mode to enter your OpenRouter key.</div>}
                {genError && <div className="gen-error">⚠ {genError}</div>}
                {genDone && (
                    <div className="gen-done">
                      <div className="gen-done-title">✓ Done — {Object.keys(genRef.current).length} files</div>
                      <div className="gen-done-sub">Run <code>npm install && npm run dev</code> after extracting the ZIP.</div>
                      {metricsRef.current && (
                          <div className="gen-done-sub" style={{ marginTop: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                            {metricsRef.current.totalTokens.toLocaleString()} tokens · {metricsRef.current.llmCalls} LLM calls · {metricsRef.current.sourceCodeLOC.toLocaleString()} LOC · {metricsRef.current.generationSeconds}s — full breakdown in <code>metrics.csv</code>
                          </div>
                      )}
                    </div>
                )}
                <div className="gen-file-list">
                  {genProgress.map((item, i) => (
                      <div key={i} className={'gen-file ' + item.status}>
                  <span className="gen-file-icon">
                    {item.status === 'hardcoded'   && '📄'}
                    {item.status === 'pending'      && '○'}
                    {item.status === 'done'         && '✓'}
                    {item.status === 'error'        && '✗'}
                    {(item.status === 'generating' || (item.status || '').startsWith('cont')) && '⟳'}
                  </span>
                        <span className="gen-file-path">{item.path}</span>
                        <span className="gen-file-stat">{item.status === 'hardcoded' ? 'pre-built' : item.status}</span>
                      </div>
                  ))}
                </div>
                {genLoading && (
                    <div className="progress-row">
                      <div className="spinner g"></div>
                      <span className="progress-text">Generating… do not close.</span>
                    </div>
                )}
                <div className="modal-foot">
                  {genLoading
                      ? <button className="btn btn-ghost" onClick={() => { abortRef.current = true; }}>Abort</button>
                      : <button className="btn btn-ghost" onClick={() => setGenOpen(false)}>Close</button>}
                  {genDone
                      ? <button className="btn btn-gen" onClick={dlZip}>⬇ Download ZIP</button>
                      : <button className="btn btn-gen" onClick={runGen} disabled={genLoading || !apiKey.trim()}>{genLoading ? '⚡ Start' : '⚡ Start'}</button>}
                </div>
              </div>
            </div>
        )}
      </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);