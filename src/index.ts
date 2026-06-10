interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * FBI Wanted MCP.
 *
 * Official FBI Wanted persons data — Most Wanted, Ten Most Wanted Fugitives,
 * cyber, terrorism, white-collar, kidnappings/missing, ECAP, and law-enforcement
 * assistance cases. Sourced live from api.fbi.gov. Keyless, no auth required.
 */


const BASE = 'https://api.fbi.gov';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

interface FbiImage {
  caption?: string | null;
  thumb?: string | null;
  large?: string | null;
  original?: string | null;
}

interface FbiItem {
  uid?: string;
  title?: string | null;
  description?: string | null;
  subjects?: string[] | null;
  field_offices?: string[] | null;
  person_classification?: string | null;
  poster_classification?: string | null;
  status?: string | null;
  warning_message?: string | null;
  reward_text?: string | null;
  reward_min?: number | null;
  reward_max?: number | null;
  dates_of_birth_used?: string[] | null;
  place_of_birth?: string | null;
  hair?: string | null;
  hair_raw?: string | null;
  eyes?: string | null;
  height_min?: number | null;
  height_max?: number | null;
  weight?: string | null;
  weight_max?: number | null;
  race?: string | null;
  sex?: string | null;
  nationality?: string | null;
  aliases?: string[] | null;
  scars_and_marks?: string | null;
  occupations?: string[] | null;
  remarks?: string | null;
  caution?: string | null;
  details?: string | null;
  images?: FbiImage[] | null;
  url?: string | null;
  modified?: string | null;
  publication?: string | null;
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_wanted',
    description:
      "Search the FBI's Wanted persons database — fugitives, Most Wanted, cyber's-most-wanted, terrorists, white-collar suspects, kidnappings/missing persons, and law-enforcement-assistance cases. Returns compact records with reward, warning, and image. Keyless, official FBI data.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text title search (matches the subject name/case title).' },
        person_classification: {
          type: 'string',
          description: 'Filter by person classification, e.g. "Main", "Victim", "Ten Most Wanted".',
        },
        poster_classification: {
          type: 'string',
          description:
            'Filter by poster/program category. Common values: "ten" (Ten Most Wanted Fugitives), "cyber", "wcc" (white-collar crime), "terrorist", "kidnap" (kidnappings/missing persons), "ecap" (Endangered Child Alert Program), "seeking-info", "law-enforcement-assistance".',
        },
        field_office: {
          type: 'string',
          description: 'Filter by FBI field office, e.g. "miami", "newyork", "losangeles".',
        },
        page: { type: 'number', description: 'Page number (default 1).' },
        page_size: { type: 'number', description: 'Results per page (default 20, max 50).' },
        sort_on: {
          type: 'string',
          description: 'Field to sort on, e.g. "modified" (default) or "publication".',
        },
      },
    },
  },
  {
    name: 'get_wanted',
    description:
      'Get the full FBI Wanted profile for one person by uid — physical description, aliases, occupations, caution/remarks/details (plain text), reward, field offices, and images. Keyless, official FBI data.',
    inputSchema: {
      type: 'object',
      properties: {
        uid: { type: 'string', description: 'The wanted-person uid (from search_wanted / most_wanted results).' },
      },
      required: ['uid'],
    },
  },
  {
    name: 'most_wanted',
    description:
      "The FBI's Ten Most Wanted Fugitives. Returns the current top-ten list with reward, warning, and image for each. Keyless, official FBI data.",
    inputSchema: {
      type: 'object',
      properties: {
        page_size: { type: 'number', description: 'How many to return (default 10, max 20).' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_wanted':
        return searchWanted(args);
      case 'get_wanted':
        return getWanted(args);
      case 'most_wanted':
        return mostWanted(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const text = s
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

function ageRange(dates?: string[] | null): string | null {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const now = new Date();
  const ages: number[] = [];
  for (const d of dates) {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) continue;
    let age = now.getFullYear() - parsed.getFullYear();
    const m = now.getMonth() - parsed.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) age--;
    if (age >= 0 && age < 130) ages.push(age);
  }
  if (ages.length === 0) return null;
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  return min === max ? `${min}` : `${min}-${max}`;
}

function compactPerson(item: FbiItem): Record<string, unknown> {
  const img = item.images?.[0];
  return {
    uid: item.uid,
    title: item.title,
    subjects: item.subjects ?? null,
    person_classification: item.person_classification ?? null,
    poster_classification: item.poster_classification ?? null,
    reward_text: item.reward_text ?? null,
    warning_message: item.warning_message ?? null,
    field_offices: item.field_offices ?? null,
    sex: item.sex ?? null,
    race: item.race ?? null,
    nationality: item.nationality ?? null,
    age_range: ageRange(item.dates_of_birth_used),
    image: img?.large ?? img?.thumb ?? null,
    url: item.url ?? null,
  };
}

interface FbiListResponse {
  total?: number;
  items?: FbiItem[];
  page?: number;
}

async function fetchList(qs: string): Promise<FbiListResponse> {
  const res = await fetch(`${BASE}/wanted/v1/list?${qs}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    throw new Error(`FBI: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as FbiListResponse;
}

async function searchWanted(args: Record<string, unknown>): Promise<unknown> {
  const params = new URLSearchParams();

  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (query) params.set('title', query);

  if (typeof args.person_classification === 'string' && args.person_classification.trim())
    params.set('person_classification', args.person_classification.trim());

  if (typeof args.poster_classification === 'string' && args.poster_classification.trim())
    params.set('poster_classification', args.poster_classification.trim());

  if (typeof args.field_office === 'string' && args.field_office.trim())
    params.set('field_offices', args.field_office.trim());

  const page = typeof args.page === 'number' && args.page >= 1 ? Math.floor(args.page) : 1;
  params.set('page', String(page));

  const rawSize = typeof args.page_size === 'number' ? Math.floor(args.page_size) : 20;
  const pageSize = Math.max(1, Math.min(50, rawSize));
  params.set('pageSize', String(pageSize));

  const sortOn = (typeof args.sort_on === 'string' && args.sort_on.trim()) || 'modified';
  params.set('sort_on', sortOn);

  const data = await fetchList(params.toString());
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    return { total: data.total ?? 0, page, count: 0, wanted: [] };
  }
  return {
    total: data.total ?? items.length,
    page: data.page ?? page,
    count: items.length,
    wanted: items.map(compactPerson),
  };
}

async function getWanted(args: Record<string, unknown>): Promise<unknown> {
  const uid = typeof args.uid === 'string' ? args.uid.trim() : '';
  if (!uid) return { error: 'provide a uid', uid: args.uid ?? null };

  let item: FbiItem | null = null;

  // Primary: dedicated detail endpoint (verified live: 200 OK).
  const res = await fetch(`${BASE}/@wanted-person/${encodeURIComponent(uid)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.ok) {
    item = (await res.json()) as FbiItem;
  } else if (res.status !== 404) {
    return { error: `FBI: ${res.status} ${(await res.text()).slice(0, 200)}`, uid };
  }

  // Fallback: filter the list for the uid.
  if (!item) {
    const data = await fetchList(`pageSize=50&title=${encodeURIComponent(uid)}`);
    item = (data.items ?? []).find((i) => i.uid === uid) ?? null;
  }

  if (!item || !item.uid) return { error: 'wanted person not found', uid };

  return {
    uid: item.uid,
    title: item.title ?? null,
    description: stripHtml(item.description),
    subjects: item.subjects ?? null,
    person_classification: item.person_classification ?? null,
    poster_classification: item.poster_classification ?? null,
    status: item.status ?? null,
    warning_message: item.warning_message ?? null,
    reward_text: item.reward_text ?? null,
    caution: stripHtml(item.caution),
    remarks: stripHtml(item.remarks),
    details: stripHtml(item.details),
    physical: {
      sex: item.sex ?? null,
      race: item.race ?? null,
      height_min: item.height_min ?? null,
      height_max: item.height_max ?? null,
      weight: item.weight ?? null,
      hair: item.hair ?? null,
      eyes: item.eyes ?? null,
      scars_and_marks: stripHtml(item.scars_and_marks),
      nationality: item.nationality ?? null,
      place_of_birth: item.place_of_birth ?? null,
      dates_of_birth_used: item.dates_of_birth_used ?? null,
    },
    aliases: item.aliases ?? null,
    occupations: item.occupations ?? null,
    field_offices: item.field_offices ?? null,
    images: (item.images ?? []).slice(0, 4).map((img) => ({
      caption: img.caption ?? null,
      large: img.large ?? img.original ?? null,
    })),
    url: item.url ?? null,
    modified: item.modified ?? null,
  };
}

async function mostWanted(args: Record<string, unknown>): Promise<unknown> {
  const rawSize = typeof args.page_size === 'number' ? Math.floor(args.page_size) : 10;
  const pageSize = Math.max(1, Math.min(20, rawSize));

  const data = await fetchList(`poster_classification=ten&pageSize=${pageSize}`);
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    return { count: 0, fugitives: [] };
  }
  return {
    count: items.length,
    fugitives: items.map(compactPerson),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
