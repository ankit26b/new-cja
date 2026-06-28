const pool = require('./config/db');

const SITE_CONFIGS = [
  {
    siteId: 'ecommerce_001',
    name: 'E-Commerce Demo',
    funnel: ['/products', '/cart', '/checkout', '/order-complete'],
    landingPages: ['/products'],
    pageHotspots: {
      '/products': [
        { x: 980, y: 430, weight: 0.45 },
        { x: 420, y: 320, weight: 0.2 },
        { x: 780, y: 85, weight: 0.2 },
        { x: 230, y: 300, weight: 0.15 },
      ],
      '/cart': [
        { x: 990, y: 690, weight: 0.5 },
        { x: 880, y: 330, weight: 0.2 },
        { x: 315, y: 350, weight: 0.2 },
        { x: 760, y: 90, weight: 0.1 },
      ],
      '/checkout': [
        { x: 870, y: 515, weight: 0.35 },
        { x: 1040, y: 720, weight: 0.35 },
        { x: 450, y: 410, weight: 0.2 },
        { x: 760, y: 90, weight: 0.1 },
      ],
      '/order-complete': [
        { x: 890, y: 620, weight: 0.5 },
        { x: 760, y: 90, weight: 0.2 },
        { x: 600, y: 420, weight: 0.3 },
      ],
    },
  },
  {
    siteId: 'demo_bookstore_002',
    name: 'Demo Bookstore',
    funnel: ['/book/:id', '/cart', '/checkout', '/order-confirmed'],
    landingPages: ['/book/101', '/book/102', '/book/203', '/book/309'],
    pageHotspots: {
      '/book/:id': [
        { x: 955, y: 455, weight: 0.5 },
        { x: 510, y: 390, weight: 0.2 },
        { x: 790, y: 90, weight: 0.2 },
        { x: 290, y: 350, weight: 0.1 },
      ],
      '/cart': [
        { x: 980, y: 700, weight: 0.5 },
        { x: 845, y: 310, weight: 0.2 },
        { x: 330, y: 350, weight: 0.2 },
        { x: 760, y: 90, weight: 0.1 },
      ],
      '/checkout': [
        { x: 860, y: 505, weight: 0.35 },
        { x: 1030, y: 725, weight: 0.35 },
        { x: 460, y: 440, weight: 0.2 },
        { x: 760, y: 90, weight: 0.1 },
      ],
      '/order-confirmed': [
        { x: 870, y: 610, weight: 0.45 },
        { x: 760, y: 90, weight: 0.2 },
        { x: 590, y: 420, weight: 0.35 },
      ],
    },
  },
];

const TOTAL_SESSIONS_PER_SITE = 500;
const STAGE_RATIOS = { stage1: 0.55, stage2: 0.65, stage3: 0.7 };
const DEFAULT_SEED = 'cja_demo_seed_v1';

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const seedArg = argv.slice(2).find((item) => item.startsWith('--seed='));
  return {
    reset: args.has('--reset'),
    seed: seedArg ? seedArg.split('=')[1] : DEFAULT_SEED,
  };
}

function xmur3(str) {
  let hash = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seedInt) {
  return function rng() {
    let t = (seedInt += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seedText) {
  const seedFn = xmur3(seedText);
  const seedInt = seedFn();
  return mulberry32(seedInt);
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function weightedPick(rng, weightedItems) {
  const total = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng() * total;
  for (const item of weightedItems) {
    if (cursor <= item.weight) return item.value;
    cursor -= item.weight;
  }
  return weightedItems[weightedItems.length - 1].value;
}

function shuffleInPlace(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function getStageCounts() {
  const stage0 = TOTAL_SESSIONS_PER_SITE;
  const stage1 = Math.round(stage0 * STAGE_RATIOS.stage1);
  const stage2 = Math.round(stage1 * STAGE_RATIOS.stage2);
  const stage3 = Math.round(stage2 * STAGE_RATIOS.stage3);
  return { stage0, stage1, stage2, stage3 };
}

function buildStageAssignment(rng) {
  const counts = getStageCounts();
  const maxStages = [];

  const onlyStage0 = counts.stage0 - counts.stage1;
  const onlyStage1 = counts.stage1 - counts.stage2;
  const onlyStage2 = counts.stage2 - counts.stage3;
  const fullStage3 = counts.stage3;

  for (let i = 0; i < onlyStage0; i++) maxStages.push(0);
  for (let i = 0; i < onlyStage1; i++) maxStages.push(1);
  for (let i = 0; i < onlyStage2; i++) maxStages.push(2);
  for (let i = 0; i < fullStage3; i++) maxStages.push(3);

  shuffleInPlace(rng, maxStages);
  return maxStages;
}

function chooseArchetype(rng, maxStage) {
  if (maxStage === 3) return 'smooth_converter';
  if (maxStage === 2 || maxStage === 1) return 'hesitant_browser';

  return weightedPick(rng, [
    { value: 'quick_bouncer', weight: 0.7 },
    { value: 'hesitant_browser', weight: 0.3 },
  ]);
}

function randomDateInLast14Days(rng) {
  const now = new Date();
  const dayOffset = randInt(rng, 0, 13);
  const base = new Date(now);
  base.setDate(now.getDate() - dayOffset);

  const timeBand = weightedPick(rng, [
    { value: 'lunch', weight: 0.42 },
    { value: 'evening', weight: 0.38 },
    { value: 'daytime', weight: 0.16 },
    { value: 'lateNight', weight: 0.04 },
  ]);

  let hour;
  if (timeBand === 'lunch') hour = randInt(rng, 11, 14);
  else if (timeBand === 'evening') hour = randInt(rng, 19, 22);
  else if (timeBand === 'daytime') hour = randInt(rng, 9, 18);
  else hour = randInt(rng, 3, 6);

  const minute = randInt(rng, 0, 59);
  const second = randInt(rng, 0, 59);

  base.setHours(hour, minute, second, randInt(rng, 0, 999));
  return base;
}

function pageKeyForConfig(siteConfig, page) {
  if (siteConfig.pageHotspots[page]) return page;
  if (page.startsWith('/book/')) return '/book/:id';
  return page;
}

function pickLandingPage(rng, siteConfig) {
  return siteConfig.landingPages[randInt(rng, 0, siteConfig.landingPages.length - 1)];
}

function buildPageSequence(rng, siteConfig, maxStage, archetype) {
  const pages = [];
  const stage0Page = pickLandingPage(rng, siteConfig);

  const funnelForSite = {
    stage0: stage0Page,
    stage1: '/cart',
    stage2: '/checkout',
    stage3: siteConfig.siteId === 'ecommerce_001' ? '/order-complete' : '/order-confirmed',
  };

  pages.push(funnelForSite.stage0);

  if (archetype === 'quick_bouncer') {
    return pages;
  }

  if (archetype === 'smooth_converter' && maxStage === 3) {
    pages.push(funnelForSite.stage1, funnelForSite.stage2, funnelForSite.stage3);
    return pages;
  }

  if (archetype === 'hesitant_browser') {
    if (maxStage >= 1) {
      const cartRevisits = randInt(rng, 2, 3);
      for (let i = 0; i < cartRevisits; i++) {
        pages.push(funnelForSite.stage1);
        if (rng() < 0.35) pages.push(funnelForSite.stage0);
      }
    }

    if (maxStage >= 2) {
      pages.push(funnelForSite.stage2);
      if (rng() < 0.35) pages.push(funnelForSite.stage1);
      if (rng() < 0.2) pages.push(funnelForSite.stage2);
    }

    return pages;
  }

  if (maxStage >= 1) pages.push(funnelForSite.stage1);
  if (maxStage >= 2) pages.push(funnelForSite.stage2);
  if (maxStage >= 3) pages.push(funnelForSite.stage3);
  return pages;
}

function buildFeatureProfile(rng, archetype, maxStage, pageSequence) {
  let duration;
  let clickCount;
  let avgScrollDepth;

  if (archetype === 'smooth_converter') {
    duration = randInt(rng, 60, 180);
    clickCount = randInt(rng, 6, 14);
    avgScrollDepth = randInt(rng, 72, 98);
  } else if (archetype === 'hesitant_browser') {
    duration = randInt(rng, 300, 600);
    clickCount = randInt(rng, 8, 20);
    avgScrollDepth = randInt(rng, 38, 82);
  } else {
    duration = randInt(rng, 8, 28);
    clickCount = randInt(rng, 1, 2);
    avgScrollDepth = randInt(rng, 4, 18);
  }

  const pagesVisited = new Set(pageSequence).size;
  const maxFunnelStage = maxStage;

  const normDuration = clamp(duration / 600, 0, 1);
  const normPages = clamp(pagesVisited / 4, 0, 1);
  const normStage = clamp(maxFunnelStage / 3, 0, 1);
  const normScroll = clamp(avgScrollDepth / 100, 0, 1);
  const normClicks = clamp(clickCount / 15, 0, 1);

  const engagement =
    normDuration * 0.28 +
    normPages * 0.2 +
    normStage * 0.24 +
    normScroll * 0.18 +
    normClicks * 0.1;

  const scoreNoise = (rng() - 0.5) * 0.08;
  const riskScore = clamp(1 - engagement + scoreNoise, 0.02, 0.98);

  let riskTier;
  if (riskScore >= 0.67) riskTier = 'high';
  else if (riskScore >= 0.4) riskTier = 'medium';
  else riskTier = 'low';

  return {
    duration,
    clickCount,
    avgScrollDepth,
    pagesVisited,
    maxFunnelStage,
    riskScore,
    riskTier,
  };
}

function buildScrollDepthSeries(rng, archetype, maxDepth) {
  if (archetype === 'quick_bouncer') {
    const points = [randInt(rng, 3, 12), randInt(rng, 8, 20)];
    return points.map((value) => clamp(value, 0, maxDepth));
  }

  if (archetype === 'hesitant_browser') {
    const base = clamp(maxDepth - randInt(rng, 10, 25), 20, 90);
    const series = [
      clamp(base - randInt(rng, 15, 25), 5, 95),
      clamp(base + randInt(rng, 0, 10), 10, 96),
      clamp(base - randInt(rng, 5, 18), 8, 94),
      clamp(base + randInt(rng, 6, 14), 12, 98),
      clamp(base - randInt(rng, 2, 12), 10, 95),
      clamp(base + randInt(rng, 8, 16), 12, 100),
    ];
    return series;
  }

  const series = [
    randInt(rng, 10, 25),
    randInt(rng, 30, 55),
    randInt(rng, 50, 75),
    randInt(rng, 65, 90),
    randInt(rng, 75, 100),
  ];
  return series.map((value) => clamp(value, 0, maxDepth));
}

function pickHotspot(rng, siteConfig, page) {
  const key = pageKeyForConfig(siteConfig, page);
  const hotspots = siteConfig.pageHotspots[key] || [{ x: 760, y: 420, weight: 1 }];
  return weightedPick(
    rng,
    hotspots.map((h) => ({ value: h, weight: h.weight }))
  );
}

function buildMouseTrail(rng, from, to, steps) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t * (2 - t);
    const x = Math.round(from.x + (to.x - from.x) * ease + randInt(rng, -12, 12));
    const y = Math.round(from.y + (to.y - from.y) * ease + randInt(rng, -10, 10));
    out.push({ x: clamp(x, 10, 1360), y: clamp(y, 10, 860) });
  }
  return out;
}

function buildEventsForSession(rng, siteConfig, sessionId, sessionStart, pageSequence, features) {
  const events = [];
  let cursor = new Date(sessionStart);

  const baseVisit = Math.max(Math.floor(features.duration / Math.max(pageSequence.length, 1)), 4);

  let virtualCursor = { x: randInt(rng, 90, 220), y: randInt(rng, 60, 110) };

  for (let pageIndex = 0; pageIndex < pageSequence.length; pageIndex++) {
    const page = pageSequence[pageIndex];

    events.push({
      session_id: sessionId,
      site_id: siteConfig.siteId,
      event_type: 'page_view',
      page_url: page,
      scroll_depth: pageIndex === 0 ? randInt(rng, 2, 12) : randInt(rng, 6, 22),
      x: null,
      y: null,
      timestamp: new Date(cursor),
    });

    const pageDuration =
      pageIndex === pageSequence.length - 1
        ? Math.max(features.duration - baseVisit * pageIndex, 5)
        : Math.max(baseVisit + randInt(rng, -12, 18), 4);

    const maxDepthForPage = clamp(
      features.avgScrollDepth + randInt(rng, -12, 10) - pageIndex * randInt(rng, 0, 5),
      8,
      100
    );

    const scrollSeries = buildScrollDepthSeries(rng, inferArchetypeFromFeatures(features), maxDepthForPage);

    const hotspotsToVisit =
      inferArchetypeFromFeatures(features) === 'quick_bouncer'
        ? randInt(rng, 1, 2)
        : inferArchetypeFromFeatures(features) === 'hesitant_browser'
          ? randInt(rng, 2, 4)
          : randInt(rng, 2, 3);

    for (let h = 0; h < hotspotsToVisit; h++) {
      const hotspot = pickHotspot(rng, siteConfig, page);
      const target = {
        x: hotspot.x + randInt(rng, -18, 18),
        y: hotspot.y + randInt(rng, -14, 14),
      };

      const trailSteps = inferArchetypeFromFeatures(features) === 'quick_bouncer' ? randInt(rng, 3, 5) : randInt(rng, 5, 9);
      const trail = buildMouseTrail(rng, virtualCursor, target, trailSteps);

      for (const point of trail) {
        cursor = new Date(cursor.getTime() + randInt(rng, 120, 520));
        events.push({
          session_id: sessionId,
          site_id: siteConfig.siteId,
          event_type: 'mouse_move',
          page_url: page,
          x: point.x,
          y: point.y,
          scroll_depth: null,
          timestamp: new Date(cursor),
        });
      }

      virtualCursor = target;

      const clickChance = inferArchetypeFromFeatures(features) === 'quick_bouncer' ? 0.55 : 0.85;
      if (rng() < clickChance) {
        cursor = new Date(cursor.getTime() + randInt(rng, 180, 850));
        events.push({
          session_id: sessionId,
          site_id: siteConfig.siteId,
          event_type: 'click',
          page_url: page,
          x: clamp(target.x + randInt(rng, -10, 10), 10, 1360),
          y: clamp(target.y + randInt(rng, -8, 8), 10, 860),
          scroll_depth: null,
          timestamp: new Date(cursor),
        });
      }
    }

    // ── Rage-click bursts ───────────────────────────────────────────────
    // Frustrated users (hesitant browsers / higher-risk sessions) sometimes
    // click the same element 3-5 times rapidly when it feels unresponsive.
    // We emit a tight cluster (same page, <600ms span, <30px spread) so the
    // rage-click detector in analytics.js picks it up as a genuine signal.
    const archetypeForRage = inferArchetypeFromFeatures(features);
    const isFrustrationPage = /\/(cart|checkout|payment)/.test(page);
    const proneToRage = archetypeForRage === 'hesitant_browser' || features.riskTier === 'high' || features.riskTier === 'medium';
    const rageChance = isFrustrationPage && proneToRage ? 0.35 : (isFrustrationPage ? 0.06 : 0.02);

    if (rng() < rageChance) {
      const rageHotspot = pickHotspot(rng, siteConfig, page);
      const anchorX = clamp(rageHotspot.x + randInt(rng, -8, 8), 12, 1360);
      const anchorY = clamp(rageHotspot.y + randInt(rng, -8, 8), 12, 860);
      const rageCount = randInt(rng, 3, 5);

      // Small lead-in delay before the frustration burst begins
      cursor = new Date(cursor.getTime() + randInt(rng, 200, 700));

      for (let r = 0; r < rageCount; r++) {
        // 50-110ms between clicks keeps the whole burst comfortably under 600ms
        cursor = new Date(cursor.getTime() + randInt(rng, 50, 110));
        events.push({
          session_id: sessionId,
          site_id: siteConfig.siteId,
          event_type: 'click',
          page_url: page,
          // ±9px jitter stays within the 30px clustering radius
          x: clamp(anchorX + randInt(rng, -9, 9), 10, 1360),
          y: clamp(anchorY + randInt(rng, -9, 9), 10, 860),
          scroll_depth: null,
          timestamp: new Date(cursor),
        });
      }
    }

    for (const depth of scrollSeries) {
      cursor = new Date(cursor.getTime() + randInt(rng, 250, 1250));
      events.push({
        session_id: sessionId,
        site_id: siteConfig.siteId,
        event_type: 'scroll',
        page_url: page,
        x: null,
        y: null,
        scroll_depth: depth,
        timestamp: new Date(cursor),
      });
    }

    const targetPageEnd = new Date(sessionStart.getTime() + pageDuration * 1000 * (pageIndex + 1));
    if (cursor < targetPageEnd) {
      cursor = targetPageEnd;
    }
  }

  const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
  return sorted;
}

function inferArchetypeFromFeatures(features) {
  if (features.duration <= 30 && features.avgScrollDepth < 20 && features.clickCount <= 2) return 'quick_bouncer';
  if (features.maxFunnelStage === 3 && features.avgScrollDepth >= 70) return 'smooth_converter';
  return 'hesitant_browser';
}

function buildFeedbackTexts() {
  return {
    positive: [
      'Great prices and super smooth checkout. I was done in minutes.',
      'Loved the product quality and the checkout flow felt effortless.',
      'Fast site, clear product pages, and no hiccups while paying.',
      'Everything worked perfectly and the order confirmation was instant.',
      'Found exactly what I needed and checkout was genuinely easy.',
      'Good deals, clean UI, and quick payment process.',
      'The recommendations were useful and I completed my order quickly.',
      'Really happy with the purchase experience from start to finish.',
    ],
    neutral: [
      'It was okay overall. I found what I needed after a bit of browsing.',
      'The site worked fine, though I had to double-check a few details.',
      'Checkout was acceptable but could be a little clearer.',
      'Average experience. Nothing bad, nothing amazing.',
      'I eventually completed what I came for. The flow was decent.',
      'Product info was sufficient, but navigation felt a bit busy.',
      'The process was manageable, though a couple screens felt repetitive.',
      'It did the job. I would use it again if needed.',
    ],
    negative: [
      'Checkout felt confusing and I nearly gave up halfway.',
      'I kept going back and forth because the cart flow was unclear.',
      'Too many steps for a simple purchase, not a great experience.',
      'The page flow was frustrating and I left before finishing.',
      'I had trouble understanding what to click next during checkout.',
      'Navigation felt clunky and I could not complete quickly.',
      'The experience was slow for me and I abandoned my cart.',
      'I expected a smoother checkout; this was harder than it should be.',
    ],
  };
}

function chooseFeedbackSentiment(rng, archetype) {
  const byArchetype = {
    smooth_converter: [
      { value: 'positive', weight: 0.72 },
      { value: 'neutral', weight: 0.22 },
      { value: 'negative', weight: 0.06 },
    ],
    hesitant_browser: [
      { value: 'positive', weight: 0.2 },
      { value: 'neutral', weight: 0.5 },
      { value: 'negative', weight: 0.3 },
    ],
    quick_bouncer: [
      { value: 'positive', weight: 0.08 },
      { value: 'neutral', weight: 0.42 },
      { value: 'negative', weight: 0.5 },
    ],
  };

  return weightedPick(rng, byArchetype[archetype] || byArchetype.hesitant_browser);
}

function sentimentScoreForLabel(rng, label) {
  if (label === 'positive') return Number((0.72 + rng() * 0.27).toFixed(3));
  if (label === 'neutral') return Number((0.43 + rng() * 0.2).toFixed(3));
  return Number((0.05 + rng() * 0.34).toFixed(3));
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
  return Boolean(rows[0]?.regclass);
}

async function getTableColumns(client, tableName) {
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return rows.map((r) => r.column_name);
}

async function ensureFeedbackTable(client) {
  const exists = await tableExists(client, 'feedback');
  if (exists) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      site_id VARCHAR(64) NOT NULL,
      message TEXT NOT NULL,
      sentiment_score NUMERIC(6,3),
      sentiment_label VARCHAR(16),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

function buildInsertStatement(tableName, columns, rows, startParam = 1) {
  const values = [];
  const valueClauses = [];
  let paramIndex = startParam;

  for (const row of rows) {
    const placeholders = [];
    for (const col of columns) {
      placeholders.push(`$${paramIndex++}`);
      values.push(row[col] ?? null);
    }
    valueClauses.push(`(${placeholders.join(', ')})`);
  }

  return {
    sql: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valueClauses.join(', ')}`,
    values,
    nextParam: paramIndex,
  };
}

function filterColumns(columns, candidates) {
  return candidates.filter((c) => columns.includes(c));
}

async function insertRowsInChunks(client, tableName, columns, rows, chunkSize = 500) {
  if (!rows.length || !columns.length) return;

  const parts = chunk(rows, chunkSize);
  for (const part of parts) {
    const { sql, values } = buildInsertStatement(tableName, columns, part);
    await client.query(sql, values);
  }
}

function mapEventRowsForColumns(eventRows, eventColumns) {
  const timestampCol = eventColumns.includes('timestamp')
    ? 'timestamp'
    : eventColumns.includes('created_at')
      ? 'created_at'
      : null;

  return eventRows.map((row) => {
    const mapped = {
      session_id: row.session_id,
      site_id: row.site_id,
      event_type: row.event_type,
      page_url: row.page_url,
      x: row.x,
      y: row.y,
      scroll_depth: row.scroll_depth,
    };

    if (timestampCol) mapped[timestampCol] = row.timestamp;

    return mapped;
  });
}

function mapFeedbackRowsForColumns(feedbackRows, feedbackColumns) {
  const textColumn =
    ['message', 'feedback_text', 'text', 'content', 'comment'].find((c) => feedbackColumns.includes(c)) || null;

  const tsColumn =
    ['created_at', 'timestamp', 'submitted_at', 'createdon'].find((c) => feedbackColumns.includes(c)) || null;

  return feedbackRows
    .map((row) => {
      const mapped = {
        site_id: row.site_id,
        session_id: row.session_id,
      };

      if (textColumn) mapped[textColumn] = row.message;
      if (feedbackColumns.includes('sentiment_score')) mapped.sentiment_score = row.sentiment_score;
      if (feedbackColumns.includes('sentiment_label')) mapped.sentiment_label = row.sentiment_label;
      if (tsColumn) mapped[tsColumn] = row.created_at;

      return mapped;
    })
    .filter((row) => Object.keys(row).length >= 3);
}

async function seedSite(rng, siteConfig, eventTable, eventColumns, sessionColumns, featureColumns, feedbackColumns) {
  const stageAssignment = buildStageAssignment(rng);

  const sessions = [];
  const sessionFeatures = [];
  const events = [];
  const sessionMeta = [];

  const summary = {
    site_id: siteConfig.siteId,
    totalSessions: 0,
    archetypes: {
      smooth_converter: 0,
      hesitant_browser: 0,
      quick_bouncer: 0,
    },
    risk: { low: 0, medium: 0, high: 0 },
    stageReached: { stage0: 0, stage1: 0, stage2: 0, stage3: 0 },
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  };

  for (let i = 0; i < TOTAL_SESSIONS_PER_SITE; i++) {
    const sessionId = `seed_${siteConfig.siteId}_${String(i + 1).padStart(4, '0')}`;
    const maxStage = stageAssignment[i];
    const archetype = chooseArchetype(rng, maxStage);

    const startTime = randomDateInLast14Days(rng);
    const pageSequence = buildPageSequence(rng, siteConfig, maxStage, archetype);
    const features = buildFeatureProfile(rng, archetype, maxStage, pageSequence);

    const endTime = new Date(startTime.getTime() + features.duration * 1000);

    const sessionEvents = buildEventsForSession(rng, siteConfig, sessionId, startTime, pageSequence, features);
    events.push(...sessionEvents);

    const sessionRow = {
      session_id: sessionId,
      site_id: siteConfig.siteId,
      start_time: startTime,
      end_time: endTime,
      duration: features.duration,
      total_clicks: features.clickCount,
      max_scroll_depth: Math.round(features.avgScrollDepth),
      total_pages: pageSequence.length,
      device_id: `device_${randInt(rng, 1000, 9999)}`,
    };

    const sfRow = {
      session_id: sessionId,
      site_id: siteConfig.siteId,
      total_clicks: features.clickCount,
      click_count: features.clickCount,
      avg_scroll_depth: Number(features.avgScrollDepth.toFixed(2)),
      scroll_depth: Number(features.avgScrollDepth.toFixed(2)),
      session_duration: Number(features.duration.toFixed(2)),
      duration: Number(features.duration.toFixed(2)),
      pages_visited: features.pagesVisited,
      max_funnel_stage: features.maxFunnelStage,
    };

    sessions.push(sessionRow);
    sessionFeatures.push(sfRow);
    sessionMeta.push({
      session_id: sessionId,
      site_id: siteConfig.siteId,
      archetype,
      riskTier: features.riskTier,
      startedAt: startTime,
      maxStage,
    });

    summary.totalSessions += 1;
    summary.archetypes[archetype] += 1;
    summary.risk[features.riskTier] += 1;
    summary.stageReached.stage0 += 1;
    if (maxStage >= 1) summary.stageReached.stage1 += 1;
    if (maxStage >= 2) summary.stageReached.stage2 += 1;
    if (maxStage >= 3) summary.stageReached.stage3 += 1;
  }

  const feedbackCount = randInt(rng, 50, 80);
  const feedbackTexts = buildFeedbackTexts();
  const feedbackRows = [];

  for (let i = 0; i < feedbackCount; i++) {
    const anchorSession = sessionMeta[randInt(rng, 0, sessionMeta.length - 1)];
    const sentimentLabel = chooseFeedbackSentiment(rng, anchorSession.archetype);

    const textCandidates = feedbackTexts[sentimentLabel];
    const text = textCandidates[randInt(rng, 0, textCandidates.length - 1)];

    const createdAt = new Date(anchorSession.startedAt.getTime() + randInt(rng, 30, 1500) * 1000);

    feedbackRows.push({
      session_id: anchorSession.session_id,
      site_id: anchorSession.site_id,
      message: text,
      sentiment_score: sentimentScoreForLabel(rng, sentimentLabel),
      sentiment_label: sentimentLabel,
      created_at: createdAt,
    });

    summary.sentiment[sentimentLabel] += 1;
  }

  const mappedEvents = mapEventRowsForColumns(events, eventColumns);

  const sessionInsertColumns = filterColumns(sessionColumns, [
    'session_id',
    'site_id',
    'start_time',
    'end_time',
    'duration',
    'total_clicks',
    'max_scroll_depth',
    'total_pages',
    'device_id',
  ]);

  const sfInsertColumns = filterColumns(featureColumns, [
    'session_id',
    'site_id',
    'total_clicks',
    'click_count',
    'avg_scroll_depth',
    'scroll_depth',
    'session_duration',
    'duration',
    'pages_visited',
    'max_funnel_stage',
  ]);

  const eventInsertColumns = filterColumns(eventColumns, [
    'session_id',
    'site_id',
    'event_type',
    'x',
    'y',
    'page_url',
    'scroll_depth',
    'timestamp',
    'created_at',
  ]);

  const mappedFeedback = mapFeedbackRowsForColumns(feedbackRows, feedbackColumns);
  const feedbackInsertColumns = mappedFeedback.length
    ? Object.keys(mappedFeedback[0]).filter((col) => feedbackColumns.includes(col))
    : [];

  return {
    summary,
    sessionIds: sessions.map((s) => s.session_id),
    sessions,
    sessionFeatures,
    events: mappedEvents,
    feedbackRows: mappedFeedback,
    insertColumns: {
      sessions: sessionInsertColumns,
      sessionFeatures: sfInsertColumns,
      events: eventInsertColumns,
      feedback: feedbackInsertColumns,
    },
  };
}

function printSummary(seed, results) {
  const grand = {
    totalSessions: 0,
    archetypes: { smooth_converter: 0, hesitant_browser: 0, quick_bouncer: 0 },
    risk: { low: 0, medium: 0, high: 0 },
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  };

  console.log('\n=== Seed Summary ===');
  console.log(`Seed: ${seed}`);

  for (const { summary } of results) {
    grand.totalSessions += summary.totalSessions;
    grand.archetypes.smooth_converter += summary.archetypes.smooth_converter;
    grand.archetypes.hesitant_browser += summary.archetypes.hesitant_browser;
    grand.archetypes.quick_bouncer += summary.archetypes.quick_bouncer;

    grand.risk.low += summary.risk.low;
    grand.risk.medium += summary.risk.medium;
    grand.risk.high += summary.risk.high;

    grand.sentiment.positive += summary.sentiment.positive;
    grand.sentiment.neutral += summary.sentiment.neutral;
    grand.sentiment.negative += summary.sentiment.negative;

    console.log(`\nSite: ${summary.site_id}`);
    console.log(`  Sessions: ${summary.totalSessions}`);
    console.log(
      `  Funnel reached: stage0=${summary.stageReached.stage0}, stage1=${summary.stageReached.stage1}, stage2=${summary.stageReached.stage2}, stage3=${summary.stageReached.stage3}`
    );
    console.log(
      `  Archetypes: smooth=${summary.archetypes.smooth_converter}, hesitant=${summary.archetypes.hesitant_browser}, quick=${summary.archetypes.quick_bouncer}`
    );
    console.log(`  Risk tiers: low=${summary.risk.low}, medium=${summary.risk.medium}, high=${summary.risk.high}`);
    console.log(
      `  Sentiment: positive=${summary.sentiment.positive}, neutral=${summary.sentiment.neutral}, negative=${summary.sentiment.negative}`
    );
  }

  console.log('\nOverall:');
  console.log(`  Total sessions created: ${grand.totalSessions}`);
  console.log(
    `  Archetypes: smooth=${grand.archetypes.smooth_converter}, hesitant=${grand.archetypes.hesitant_browser}, quick=${grand.archetypes.quick_bouncer}`
  );
  console.log(`  Risk tiers: low=${grand.risk.low}, medium=${grand.risk.medium}, high=${grand.risk.high}`);
  console.log(
    `  Sentiment: positive=${grand.sentiment.positive}, neutral=${grand.sentiment.neutral}, negative=${grand.sentiment.negative}`
  );
}

async function main() {
  const { reset, seed } = parseArgs(process.argv);
  const rng = createRng(seed);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hasRawEvents = await tableExists(client, 'raw_events');
    const eventTable = hasRawEvents ? 'raw_events' : 'events';

    await ensureFeedbackTable(client);

    const eventColumns = await getTableColumns(client, eventTable);
    const sessionColumns = await getTableColumns(client, 'sessions');
    const featureColumns = await getTableColumns(client, 'session_features');
    const feedbackColumns = await getTableColumns(client, 'feedback');

    if (reset) {
      const siteIds = SITE_CONFIGS.map((s) => s.siteId);
      await client.query(`DELETE FROM feedback WHERE site_id = ANY($1)`, [siteIds]);
      await client.query(`DELETE FROM ${eventTable} WHERE site_id = ANY($1)`, [siteIds]);
      await client.query(`DELETE FROM session_features WHERE site_id = ANY($1)`, [siteIds]);
      await client.query(`DELETE FROM sessions WHERE site_id = ANY($1)`, [siteIds]);
    }

    const allResults = [];

    for (const site of SITE_CONFIGS) {
      const seeded = await seedSite(rng, site, eventTable, eventColumns, sessionColumns, featureColumns, feedbackColumns);

      await client.query(
        `INSERT INTO sites (site_id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (site_id) DO NOTHING`,
        [site.siteId, site.name]
      );

      await client.query(`DELETE FROM feedback WHERE site_id = $1 AND session_id = ANY($2)`, [
        site.siteId,
        seeded.sessionIds,
      ]);
      await client.query(`DELETE FROM ${eventTable} WHERE site_id = $1 AND session_id = ANY($2)`, [
        site.siteId,
        seeded.sessionIds,
      ]);
      await client.query(`DELETE FROM session_features WHERE site_id = $1 AND session_id = ANY($2)`, [
        site.siteId,
        seeded.sessionIds,
      ]);
      await client.query(`DELETE FROM sessions WHERE site_id = $1 AND session_id = ANY($2)`, [
        site.siteId,
        seeded.sessionIds,
      ]);

      await insertRowsInChunks(client, 'sessions', seeded.insertColumns.sessions, seeded.sessions, 250);
      await insertRowsInChunks(client, 'session_features', seeded.insertColumns.sessionFeatures, seeded.sessionFeatures, 250);
      await insertRowsInChunks(client, eventTable, seeded.insertColumns.events, seeded.events, 1200);
      await insertRowsInChunks(client, 'feedback', seeded.insertColumns.feedback, seeded.feedbackRows, 250);

      allResults.push({ summary: seeded.summary });
    }

    await client.query('COMMIT');
    printSummary(seed, allResults);

    console.log(`\nInserted using event table: ${hasRawEvents ? 'raw_events' : 'events'}`);
    console.log('Done.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
