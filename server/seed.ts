import 'dotenv/config';
import bcrypt from 'bcrypt';
import { knex, initDb } from './db.js';
import { User, Product, Address } from './types/index.js';

// Ensure the app's minimal product seed is skipped when running this seeder
process.env.SKIP_INITIAL_PRODUCT_SEED = 'true';

// Type definitions for CLI arguments and options
interface SeedOptions {
  reset: boolean;
  users: number;
  products: number;
  orders: number;
  dry: boolean;
  verbose: boolean;
}

interface GeneratedUser {
  name: string;
  email: string;
  address: Address;
}

interface GeneratedProduct {
  slug: string;
  title: string;
  subtitle?: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  ratingCount?: number;
  tags?: string[];
  images?: string[];
  options?: any;
  description?: string;
  details?: any[];
  specs?: Record<string, string>;
  badges?: string[];
}

interface ProductFamily {
  family: string;
  adjectives: string[];
  nouns: string[];
  price: () => number;
  subtitle: string;
  badges?: string[];
  options?: any[];
}

// --- Simple CLI arg parsing
function parseArgs(argv: string[]): SeedOptions {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a && a.startsWith('--')) {
      const parts = a.split('=');
      const k = parts[0];
      const v = parts[1];
      if (k && v !== undefined) {
        args.set(k.slice(2), v);
      } else if (k && i + 1 < argv.length) {
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          args.set(k.slice(2), nextArg);
          i++;
        } else {
          args.set(k.slice(2), true);
        }
      } else if (k) {
        args.set(k.slice(2), true);
      }
    }
  }
  return {
    reset: Boolean(args.get('reset')),
    users: Number(args.get('users') ?? 10),
    products: Number(args.get('products') ?? 50),
    orders: Number(args.get('orders') ?? 25),
    dry: Boolean(args.get('dry')),
    verbose: Boolean(args.get('verbose')),
  };
}

// --- Utils
function pick<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index] as T;
}
const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (n: number, d: number = 1): boolean => Math.random() < n / (d || 1);

function slugify(s: string): string {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function priceTo(x: number, decimals: number = 2): number {
  return Number(x.toFixed(decimals));
}

// Remote image URLs to rotate randomly for seeded products
const IMAGE_URLS = [
  'https://www.westcoastseeds.com/cdn/shop/files/CN374_CaramelPopcorn_2015_STOCK_R400MR_4.jpg?crop=center&height=1024&v=1708444445&width=1024',
  'https://upload.wikimedia.org/wikipedia/commons/d/d6/Popcorn_-_Studio_-_2011.jpg',
  'https://growhoss.com/cdn/shop/products/south-american-popcorn_460x@2x.jpg?v=1691783141',
  'https://altonbrown.com/wp-content/uploads/2016/04/alton-brown-kettle-corn-recipe.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/G-H-Cretors-Caramel-Corn.jpg/1200px-G-H-Cretors-Caramel-Corn.jpg',
  'https://www.forestwholefoods.co.uk/wp-content/uploads/2017/05/Organic-Popping-Corn-1500px.jpg',
];

// --- Generators (human-friendly, not gibberish)
const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'Grace', 'Hector', 'Ivy', 'Jack',
  'Kara', 'Liam', 'Maya', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Riley', 'Sophie', 'Theo',
  'Uma', 'Viktor', 'Wes', 'Xander', 'Yara', 'Zane'
];
const LAST_NAMES = [
  'Anderson', 'Baker', 'Carter', 'Diaz', 'Evans', 'Foster', 'Garcia', 'Hughes', 'Irwin', 'Jones',
  'Kim', 'Lopez', 'Miller', 'Nguyen', 'Owens', 'Patel', 'Quintero', 'Reed', 'Singh', 'Turner',
  'Usman', 'Vega', 'Wright', 'Xu', 'Young', 'Zimmerman'
];
const EMAIL_DOMAINS = ['example.com', 'mail.test', 'bobs.corn'];

function makeUser(i: number): GeneratedUser {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const name = `${first} ${last}`;
  const email = `${first}.${last}${i ? '.' + i : ''}@${pick(EMAIL_DOMAINS)}`.toLowerCase();
  const address: Address = {
    street: `${randInt(100, 9999)} ${pick(['Maple', 'Cedar', 'Oak', 'Pine', 'Elm'])} ${pick(['St', 'Ave', 'Blvd', 'Rd'])}`,
    city: pick(['Snohomish', 'Monroe', 'Everett', 'Seattle', 'Lynnwood', 'Bothell']),
    state: 'WA',
    zipCode: `${randInt(98000, 98999)}`,
    country: 'US',
  };
  return { name, email, address };
}

const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    family: 'Kernels',
    adjectives: ['Heirloom', 'Farm-fresh', 'Golden', 'Ruby', 'Pearl', 'Butterfly', 'Mushroom'],
    nouns: ['Yellow Kernels', 'White Kernels', 'Blue Kernels', 'Ruby Red Kernels'],
    price: () => priceTo(randInt(499, 1199) / 100), // 4.99 - 11.99
    subtitle: 'Pop big, fluffy, and flavorful',
    badges: ['Non-GMO', 'Gluten-Free', 'Small-Batch'],
    options: [
      { id: 'size', name: 'Size', values: [{ id: '1lb', label: '1 lb' }, { id: '2lb', label: '2 lb' }, { id: '5lb', label: '5 lb' }] },
    ],
  },
  {
    family: 'Seasonings',
    adjectives: ['Classic', 'Zesty', 'Smoky', 'Creamy', 'Savory', 'Tangy'],
    nouns: ['White Cheddar', 'Sea Salt', 'Kettle Corn Sugar', 'Sour Cream & Onion', 'Ranch', 'BBQ'],
    price: () => priceTo(randInt(299, 899) / 100), // 2.99 - 8.99
    subtitle: 'Sweet & savory toppers',
    badges: ['Vegan Friendly'],
  },
  {
    family: 'Gourmet',
    adjectives: ['Maple', 'Bourbon', 'Vanilla', 'Cocoa', 'Caramel', 'Cinnamon'],
    nouns: ['Caramel Corn', 'Chocolate Drizzle', 'Snickerdoodle Drizzle', 'Sea Salt Caramel'],
    price: () => priceTo(randInt(899, 1999) / 100), // 8.99 - 19.99
    subtitle: 'Small-batch treats',
    badges: ['Limited'],
  },
  {
    family: 'Gifts',
    adjectives: ['Sampler', 'Movie Night', 'Family', 'Variety'],
    nouns: ['Gift Box', 'Bundle', 'Pack'],
    price: () => priceTo(randInt(1299, 3999) / 100), // 12.99 - 39.99
    subtitle: 'Share the joy',
    badges: ['Giftable'],
  },
];

function makeProduct(i: number): GeneratedProduct {
  const fam = pick(PRODUCT_FAMILIES);
  const title = `${pick(fam.adjectives)} ${pick(fam.nouns)}`;
  const slug = slugify(`${title}-${i}`);
  const images = [pick(IMAGE_URLS)];
  const price = fam.price();
  const rating = chance(3, 4) ? Number((3.8 + Math.random() * 1.2).toFixed(1)) : Number((3.0 + Math.random() * 2.0).toFixed(1));
  const ratingCount = randInt(10, 1200);
  const tags = [fam.family, ...(chance(1, 5) ? ['Best Seller'] : []), ...(chance(1, 4) ? ['New'] : [])];
  const badges = fam.badges ? [...fam.badges] : undefined;
  const options = fam.options;
  const description = `Our ${title} brings the ${fam.family.toLowerCase()} experience home. Carefully crafted for quality and great taste.`;
  const details = [
    { title: 'Ingredients', content: fam.family === 'Kernels' ? '100% Popcorn Kernels' : 'See package for details' },
    { title: 'Allergens', content: 'Packaged in a facility that also handles dairy and soy.' },
  ];
  const specs: Record<string, string> = {
    'Origin': pick(['Local family farm', 'Pacific Northwest', 'Midwest']),
    'Best by': `${randInt(6, 18)} months from pack date`,
  };
  return { slug, title, subtitle: fam.subtitle, price, rating, ratingCount, tags, images, options, description, details, specs, badges };
}

function buildProducts(targetCount: number): GeneratedProduct[] {
  // Generate all products dynamically
  const products: GeneratedProduct[] = [];
  for (let i = 0; i < targetCount; i++) {
    products.push(makeProduct(i + 1));
  }
  return products;
}

function makeShippingAddress(name: string): any {
  const addr: any = {
    name,
    line1: `${randInt(100, 9999)} ${pick(['Birch', 'Canyon', 'River', 'Sunset', 'Willow'])} ${pick(['Way', 'Ave', 'St', 'Dr'])}`,
    city: pick(['Snohomish', 'Monroe', 'Everett', 'Seattle', 'Lynnwood', 'Bothell']),
    state: 'WA',
    postalCode: `${randInt(98000, 98999)}`,
    country: 'US',
  };
  if (chance(1, 4)) addr.line2 = `Unit ${randInt(1, 50)}`;
  return addr;
}

// --- Seed operations
async function resetAll(): Promise<void> {
  // Order matters due to FKs
  await knex('order_items').del();
  await knex('orders').del();
  await knex('products').del();
  await knex('users').del();
  // Reset AUTOINCREMENT for SQLite
  try { await knex.raw("DELETE FROM sqlite_sequence WHERE name IN ('users','products','orders','order_items')"); } catch {}
}

async function upsertProducts(products: GeneratedProduct[]): Promise<{ total?: number; inserted?: number }> {
  const rows = products.map((p) => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle ?? null,
    price: p.price,
    original_price: p.originalPrice ?? null,
    rating: p.rating ?? null,
    rating_count: p.ratingCount ?? null,
    tags: p.tags ? JSON.stringify(p.tags) : null,
    images: p.images ? JSON.stringify(p.images) : JSON.stringify([]),
    options: p.options ? JSON.stringify(p.options) : null,
    description: p.description ?? '',
    details: p.details ? JSON.stringify(p.details) : null,
    specs: p.specs ? JSON.stringify(p.specs) : null,
    badges: p.badges ? JSON.stringify(p.badges) : null,
  }));
  if (!rows.length) return { inserted: 0 };
  await knex('products').insert(rows).onConflict('slug').merge();
  const [{ c }] = await knex('products').count({ c: '*' }) as any;
  return { total: Number(c) };
}

async function upsertUsers(n: number): Promise<User[]> {
  const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const password = process.env.SEED_PASSWORD || 'Passw0rd!';
  const rows = [];

  // Precompute a shared hash for speed (all seeded users share the same password)
  const sharedHash = await bcrypt.hash(password, saltRounds);

  // Add a deterministic demo account
  rows.push({ 
    name: 'Demo User', 
    email: 'demo@bobs.corn', 
    password_hash: sharedHash, 
    address: JSON.stringify(makeShippingAddress('Demo User')) 
  });

  for (let i = 0; i < n; i++) {
    const u = makeUser(i + 1);
    rows.push({ 
      name: u.name, 
      email: u.email, 
      password_hash: sharedHash, 
      address: JSON.stringify(u.address) 
    });
  }
  await knex('users').insert(rows).onConflict('email').merge();
  const users = await knex<User>('users').select('*');
  return users;
}

function asMoneyString(n: number | string): string {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

async function createOrders(count: number, users: User[]): Promise<number> {
  if (!count) return 0;
  const products = await knex<Product>('products').select('id', 'slug', 'title', 'price');
  if (!products.length || !users.length) return 0;

  let created = 0;
  for (let i = 0; i < count; i++) {
    const user = pick(users);
    const numItems = randInt(1, 5);
    const chosen = new Set<number>();
    const items: Array<{product_id: number, slug: string, title: string, price: string, quantity: number}> = [];
    for (let j = 0; j < numItems; j++) {
      const p = pick(products);
      if (chosen.has(p.id)) continue;
      chosen.add(p.id);
      const quantity = randInt(1, 3);
      items.push({ 
        product_id: p.id, 
        slug: p.slug, 
        title: p.title, 
        price: asMoneyString(p.price), 
        quantity 
      });
    }
    if (!items.length) continue;
    const total = items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);

    await knex.transaction(async (trx) => {
      const [orderId] = await trx('orders').insert({
        user_id: user.id,
        total: asMoneyString(total),
        shipping_address: user.address || JSON.stringify(makeShippingAddress(user.name)),
        status: 'paid',
      });
      await trx('order_items').insert(items.map((oi) => ({ ...oi, order_id: orderId })));
    });
    created++;
  }
  return created;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const start = Date.now();
  console.log('Seed options:', opts);

  await initDb();

  if (opts.reset) {
    console.log('Resetting data...');
    await resetAll();
  }

  // Products
  const products = buildProducts(opts.products);
  if (opts.verbose) console.log(`Prepared ${products.length} products`);
  if (!opts.dry) {
    const r = await upsertProducts(products);
    console.log(`Products upserted. Total products now: ${r.total ?? products.length}`);
  } else {
    console.log('(dry) Skipped product writes');
  }

  // Users
  let users: User[] = [];
  if (!opts.dry) {
    users = await upsertUsers(opts.users);
    console.log(`Users upserted. Total users now: ${users.length}`);
  } else {
    console.log('(dry) Skipped user writes');
  }

  // Orders
  if (!opts.dry) {
    const created = await createOrders(opts.orders, users);
    console.log(`Orders created: ${created}`);
  } else {
    console.log('(dry) Skipped orders');
  }

  await knex.destroy();
  console.log(`Done in ${(Date.now() - start)}ms`);
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  try { await knex.destroy(); } catch {}
  process.exit(1);
});
