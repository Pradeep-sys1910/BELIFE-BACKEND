/**
 * BeLife demo content seeder.
 *
 *  Run:    npm run seed
 *  Wipe:   npm run unseed
 *
 *  Every account created here uses the email domain `@seed.belife.site` — that is
 *  the cleanup marker. `unseed` deletes exactly those users and cascade-removes all
 *  their content, so seeded data never tangles with real users.
 *
 *  All seed accounts share one password (below) and are verified + onboarded, so you
 *  can log in as any of them to demo the app.
 */

import { PrismaClient, ForumCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_DOMAIN   = 'seed.belife.site';
const SEED_PASSWORD = 'BeLifeDemo!2026';

// ── helpers ────────────────────────────────────────────────────────────────────
const rand    = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const sample  = <T,>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000 - randInt(0, 86_400_000));
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);

// ── content pools ────────────────────────────────────────────────────────────
const PEOPLE = [
  'Maya Greenfield', 'Liam Forrester', 'Aisha Rahman', 'Noah Rivers', 'Priya Sharma',
  'Eli Brooks', 'Sofia Marchetti', 'Kofi Mensah', 'Hana Tanaka', 'Diego Fuentes',
  'Freya Lindqvist', 'Arjun Patel', 'Clara Webb', 'Mateo Silva', 'Nadia Haddad',
  'Theo Okafor', 'Ingrid Solberg', 'Ravi Nair', 'Lena Vogel', 'Yuki Sato',
  'Amara Diop', 'Owen Hughes', 'Camila Rojas', 'Sven Bauer',
];

const BIOS = [
  'Zero-waste enthusiast & weekend forager 🌿',
  'Climate writer. Plant parent. Tea addict.',
  'Helping people swap habits, not lifestyles.',
  'Permaculture nerd documenting my balcony garden.',
  'Slow living, second-hand everything.',
  'Renewable energy engineer by day, composter by night.',
  'On a mission to make sustainability un-boring.',
  'Cycling everywhere & writing about it.',
  "Vegan recipes that don't taste like cardboard.",
  'Ocean conservation volunteer 🌊',
  'Repair, reuse, refuse. In that order.',
  'Just a human trying to leave it better than I found it.',
];

const CATEGORIES = [
  { name: 'Zero Waste',          slug: 'zero-waste',          icon: '♻️', description: 'Trim the trash from everyday life.' },
  { name: 'Climate',             slug: 'climate',             icon: '🌡️', description: 'Understanding and acting on the climate crisis.' },
  { name: 'Plant-Based',         slug: 'plant-based',         icon: '🌱', description: "Food that's kind to the planet." },
  { name: 'Sustainable Living',  slug: 'sustainable-living',  icon: '🏡', description: 'Greener homes, habits, and choices.' },
  { name: 'Activism',            slug: 'activism',            icon: '✊', description: 'Movements, policy, and people power.' },
  { name: 'Gardening',           slug: 'gardening',           icon: '🌻', description: 'Grow your own, big or balcony-sized.' },
  { name: 'Clean Energy',        slug: 'clean-energy',        icon: '⚡', description: 'Solar, wind, and the road off fossil fuels.' },
  { name: 'Mindful Living',      slug: 'mindful-living',      icon: '🧘', description: 'Slowing down and consuming less.' },
];

// Curated, long-stable Unsplash nature/eco photo IDs.
const IMAGES = [
  '1441974231531-c6227db76b6e', '1448375240586-882707db888b', '1469474968028-56623f02e42e',
  '1470071459604-3b5ec3a7fe05', '1500382017468-9049fed747ef', '1501785888041-af3ef285b470',
  '1502082553048-f009c37129b9', '1506744038136-46273834b3fb', '1511497584788-876760111969',
  '1518837695005-2083093ee35b', '1542601906990-b4d3fb778b09', '1466611653911-95081537e5b7',
  '1472214103451-9374bd1c798e', '1485470733090-0aae1788d5af', '1487730116645-74489c95b41b',
  '1490750967868-88aa4486c946', '1493246507139-91e8fad9978e', '1497436072909-60f360e1d4b1',
  '1518173946687-a4c8892bbd9f', '1523712999610-f77fbcfc3843', '1528184039930-bd03972bd974',
  '1441260038675-7329ab4cc264', '1574263867128-a3d5c1b1deae', '1416879595882-3373a0480b5b',
];
const img = (i: number) =>
  `https://images.unsplash.com/photo-${IMAGES[i % IMAGES.length]}?auto=format&fit=crop&w=1200&q=80`;

// 50 distinct, realistic eco article titles + matching excerpts + category slug.
const ARTICLES: { title: string; excerpt: string; cat: string; tags: string[] }[] = [
  { title: "I Went Zero-Waste for 30 Days — Here's What Actually Stuck", excerpt: 'Most of the swaps were hype. A handful genuinely changed how I shop, cook, and throw things away.', cat: 'zero-waste', tags: ['zero-waste', 'habits', 'experiment'] },
  { title: 'The Quiet Power of a Repair Café', excerpt: 'A toaster, a torn jacket, and a stranger with a soldering iron taught me more about waste than any documentary.', cat: 'zero-waste', tags: ['repair', 'community'] },
  { title: 'Composting in a Tiny Apartment (Without the Smell)', excerpt: "You don't need a backyard. You need a bin, some worms, and about ten minutes a week.", cat: 'zero-waste', tags: ['compost', 'apartment'] },
  { title: 'Fast Fashion Is a Climate Problem We Keep Ignoring', excerpt: "The clothes in your closet have a bigger carbon footprint than your last flight. Here's the math.", cat: 'climate', tags: ['fashion', 'carbon'] },
  { title: 'What a Carbon Footprint Actually Measures', excerpt: "The term gets thrown around constantly. Let's break down what's counted, what isn't, and why it matters.", cat: 'climate', tags: ['carbon', 'explainer'] },
  { title: "Heatwaves Are the New Normal. Our Cities Aren't Ready.", excerpt: 'Concrete traps heat. Trees release it. The fix is cheaper than you think — if we start now.', cat: 'climate', tags: ['heat', 'cities'] },
  { title: "A Beginner's Guide to Eating Lower on the Food Chain", excerpt: "You don't have to go fully vegan. Even small shifts in protein add up to a big climate win.", cat: 'plant-based', tags: ['food', 'diet'] },
  { title: '7 Lentil Recipes That Converted My Meat-Loving Family', excerpt: 'Cheap, filling, and shockingly good. These are the ones that disappeared from the table first.', cat: 'plant-based', tags: ['recipes', 'lentils'] },
  { title: 'Why Seasonal Eating Is the Easiest Green Habit', excerpt: 'It tastes better, costs less, and quietly slashes the emissions hiding in your grocery cart.', cat: 'plant-based', tags: ['seasonal', 'food'] },
  { title: "The 5 Things I Wish I'd Done When I Moved Into a New Flat", excerpt: 'Small setup choices lock in years of energy use. I learned the hard way so you don\'t have to.', cat: 'sustainable-living', tags: ['home', 'energy'] },
  { title: 'Secondhand First: How Thrifting Changed My Spending', excerpt: 'A year of buying nothing new taught me that "new" was almost never the point.', cat: 'sustainable-living', tags: ['thrift', 'minimalism'] },
  { title: 'The Real Cost of Cheap Stuff', excerpt: "That $5 gadget isn't cheap. Someone, somewhere, is paying the difference.", cat: 'sustainable-living', tags: ['consumption'] },
  { title: 'How a Local Climate Group Got a Bike Lane Built', excerpt: 'Twelve people, eighteen months, one stubborn city council. A story about showing up.', cat: 'activism', tags: ['organizing', 'cycling'] },
  { title: "You Don't Need to Be an Expert to Be an Activist", excerpt: "Impostor syndrome keeps good people on the sidelines. Here's how to start anyway.", cat: 'activism', tags: ['activism', 'beginners'] },
  { title: 'Writing to Your Representative Actually Works — If You Do It Right', excerpt: 'A template, a few rules, and the one thing that makes staffers actually read your letter.', cat: 'activism', tags: ['policy', 'letters'] },
  { title: 'Balcony Gardening: My First Harvest in Photos', excerpt: 'Six pots, one rail, and a summer of tomatoes that ruined store-bought ones for me forever.', cat: 'gardening', tags: ['gardening', 'balcony'] },
  { title: "No Dig, No Problem: The Lazy Gardener's Best Friend", excerpt: 'Stop turning your soil. Your back, your weekends, and your worms will thank you.', cat: 'gardening', tags: ['no-dig', 'soil'] },
  { title: 'Pollinators Are Vanishing. Your Garden Can Help.', excerpt: 'A patch of the right flowers turns any space into a lifeline for bees and butterflies.', cat: 'gardening', tags: ['pollinators', 'biodiversity'] },
  { title: 'Solar Panels Paid for Themselves Faster Than I Expected', excerpt: 'Five years of bills, one spreadsheet, and the honest numbers nobody shows you upfront.', cat: 'clean-energy', tags: ['solar', 'money'] },
  { title: 'Heat Pumps, Explained Without the Jargon', excerpt: "They're not magic, but they're close. Here's how they heat your home for a fraction of the carbon.", cat: 'clean-energy', tags: ['heat-pump', 'explainer'] },
  { title: 'The Myth of "Clean Coal" and Other Energy Fairytales', excerpt: 'Some phrases exist to make us comfortable. This is one of them.', cat: 'clean-energy', tags: ['energy', 'myths'] },
  { title: 'I Deleted Half My Apps and Felt Lighter', excerpt: 'Digital clutter is clutter too. A month of mindful screens did more for me than any detox tea.', cat: 'mindful-living', tags: ['mindfulness', 'digital'] },
  { title: 'The Case for Owning Less', excerpt: 'Every object asks for a little of your attention. I started asking which ones earned it.', cat: 'mindful-living', tags: ['minimalism'] },
  { title: 'Slow Mornings: My Three Non-Negotiables', excerpt: 'No phone, real coffee, and ten minutes outside. The cheapest upgrade my days ever got.', cat: 'mindful-living', tags: ['routine', 'slow-living'] },
  { title: 'Plastic-Free Bathroom: The Swaps Worth It vs the Ones That Aren\'t', excerpt: 'Shampoo bars, yes. Some of the rest? Greenwashed nonsense. An honest review.', cat: 'zero-waste', tags: ['plastic-free', 'bathroom'] },
  { title: "Refill Shops Are Having a Moment — And It's Earned", excerpt: 'Bring your own jar, leave with exactly what you need. The future is bulk bins.', cat: 'zero-waste', tags: ['refill', 'shopping'] },
  { title: 'How Much Water Is in Your Wardrobe?', excerpt: 'One cotton t-shirt: 2,700 litres. The hidden water cost of getting dressed.', cat: 'climate', tags: ['water', 'fashion'] },
  { title: "The Ocean Is Doing the Heavy Lifting. We're Not Helping.", excerpt: 'It absorbs a third of our carbon and most of our heat. Then we dump plastic in it.', cat: 'climate', tags: ['ocean'] },
  { title: 'Tofu, Done Right, Is Genuinely Delicious', excerpt: "If you think you hate tofu, you've only had it cooked badly. Let me fix that.", cat: 'plant-based', tags: ['tofu', 'recipes'] },
  { title: "Meal Prep That Doesn't Waste Food (or Your Sunday)", excerpt: 'A flexible system that bends around your week instead of guilting you when life happens.', cat: 'plant-based', tags: ['meal-prep'] },
  { title: "Line-Drying Saved Me €120 a Year. Here's the Math.", excerpt: 'The dryer is one of the hungriest machines in your home. The fix is a piece of string.', cat: 'sustainable-living', tags: ['energy', 'savings'] },
  { title: 'Everything I Stopped Buying in 2025', excerpt: "A list, an honest reflection, and the surprising things I didn't miss at all.", cat: 'sustainable-living', tags: ['minimalism', 'consumption'] },
  { title: 'How to Talk About Climate Without Killing the Vibe', excerpt: "Doom doesn't persuade. Here's how to bring people in instead of pushing them out.", cat: 'activism', tags: ['communication'] },
  { title: 'Community Gardens Are Quiet Climate Infrastructure', excerpt: "They cool streets, feed neighbours, and rebuild soil. Why aren't there more of them?", cat: 'gardening', tags: ['community', 'climate'] },
  { title: 'Saving Seeds: A Skill We Almost Forgot', excerpt: "For most of history, gardeners saved their own seed. Here's how to start again.", cat: 'gardening', tags: ['seeds', 'self-reliance'] },
  { title: 'The Grid Is Greener Than You Think (and Getting Better)', excerpt: 'Renewables crossed a line most people missed. The numbers are genuinely hopeful.', cat: 'clean-energy', tags: ['grid', 'hope'] },
  { title: 'Why I Stopped Flying for Short Trips', excerpt: "The train takes longer. It also gave me back something I didn't know I'd lost.", cat: 'climate', tags: ['travel', 'trains'] },
  { title: 'A Love Letter to the Humble Bicycle', excerpt: 'No fuel, no traffic, no gym membership. The most efficient machine ever built.', cat: 'sustainable-living', tags: ['cycling'] },
  { title: 'Greenwashing 101: How to Spot a Fake Eco Claim', excerpt: '"Natural," "eco," "green" — words with no legal meaning. Here\'s what to look for instead.', cat: 'activism', tags: ['greenwashing'] },
  { title: 'The Beauty of a Mended Thing', excerpt: 'Visible mending turns a flaw into a story. My jeans have never looked better.', cat: 'mindful-living', tags: ['repair', 'craft'] },
  { title: 'What 50 Houseplants Taught Me About Patience', excerpt: "They don't respond to urgency. Turns out, neither do most good things.", cat: 'mindful-living', tags: ['plants', 'patience'] },
  { title: 'Rainwater Harvesting for Normal People', excerpt: "You don't need a tank farm. A barrel and a downpipe will water your garden all summer.", cat: 'gardening', tags: ['water', 'diy'] },
  { title: 'The Most Sustainable Product Is the One You Already Own', excerpt: 'Before you buy the eco-version, ask if you need a version at all.', cat: 'zero-waste', tags: ['consumption'] },
  { title: 'Batch Cooking Beans From Scratch Is Weirdly Satisfying', excerpt: 'Cheaper than cans, no BPA, no tins to recycle. Plus the freezer stash feels like wealth.', cat: 'plant-based', tags: ['beans', 'batch-cooking'] },
  { title: 'How Cities Are Quietly Banning Cars (and Thriving)', excerpt: 'From Paris to Pontevedra, the data on car-free centres keeps surprising the skeptics.', cat: 'climate', tags: ['cities', 'transport'] },
  { title: 'The Energy Vampires Hiding in Your Living Room', excerpt: 'Standby power is a slow leak on your bill and the grid. Find them, kill them.', cat: 'clean-energy', tags: ['energy', 'savings'] },
  { title: 'Why Biodiversity Is the Climate Story We Undersell', excerpt: 'Carbon gets the headlines. But a living planet is what actually keeps us alive.', cat: 'climate', tags: ['biodiversity'] },
  { title: 'My Year Without New Clothes', excerpt: 'Twelve months, zero new garments, and a wardrobe I finally actually like.', cat: 'sustainable-living', tags: ['fashion', 'challenge'] },
  { title: 'The Friendliest Way to Start Composting at Work', excerpt: 'One bin, one sign, one champion. How a single desk turned into an office-wide habit.', cat: 'zero-waste', tags: ['compost', 'workplace'] },
  { title: 'Hope Is a Discipline, Not a Mood', excerpt: 'On the days the news is bleak, choosing to act anyway is the most radical thing we can do.', cat: 'activism', tags: ['hope', 'mindset'] },
];

const COMMENTS = [
  'This is exactly the nudge I needed — saving it for the weekend.',
  'Love how practical this is. So many eco posts are just guilt.',
  'Tried the composting tip last month and honestly, no smell at all!',
  'The math on this surprised me. Sharing with my flatmates.',
  'Finally someone says it without the doom. Thank you 🌿',
  'Started doing this after reading and already noticing a difference.',
  "Bookmarking. My partner will roll their eyes but I'm doing it anyway.",
  'Great write-up. Any tips for doing this on a tight budget?',
  'This deserves way more attention. Beautifully put.',
  "I was skeptical but you've genuinely changed my mind.",
  'The repair café point hit home. There\'s one near me I never visited.',
  'Sending this to my climate group, perfect discussion starter.',
  'Such a calm, useful take. More of this please.',
  'Did this for a month — the line-drying one is so underrated.',
  "Honestly the best thing I've read on here all week.",
  'Wish I\'d known this before my last grocery run 😅',
  'Tofu point is SO true. People just cook it wrong.',
  'The seasonal eating tip alone is worth the read.',
  'You explained heat pumps better than my installer did.',
  'Quietly inspiring. Thanks for writing this.',
];

const THOUGHTS = [
  'Refused a plastic bag, brought my own jar, and felt unreasonably proud of myself today. 🌿',
  "Reminder: the most sustainable thing you own is the thing you don't buy.",
  'My tomatoes are finally ripening and I have never felt more powerful.',
  'Took the train instead of flying. Slower, calmer, watched a whole sunset. Worth it.',
  'Hot take: "eco-friendly" on a label means nothing unless they tell you why.',
  "Three weeks of no new clothes and honestly I don't miss the scroll.",
  'Compost bin is thriving. The worms are living better than I am.',
  'Switched every bulb to LED last year. The bill difference is real, people.',
  "Your small actions are not pointless. They're practice for the big ones.",
  'Line-dried laundry smells like childhood and saves a fortune. Two for one.',
  'Found a repair café in my town. Fixed a lamp I almost threw out. Magic.',
  'The climate news is heavy today. Going to plant something instead of doom-scrolling.',
  'PSA: secondhand bookshops are the original circular economy.',
  'Started saying no to receipts. Tiny thing. Adds up. Keep going.',
  'Cycled to work in the rain and weirdly it was the best part of my day.',
  'Meal-prepped beans from scratch. Freezer full. Feeling rich.',
  'Bees in the balcony flowers this morning. The garden is working. 🐝',
  "We don't need a few people doing zero waste perfectly. We need millions doing it imperfectly.",
  'Turned off the standby vampires last night. Petty victory, real savings.',
  'Hope is a discipline. Show up anyway.',
];

const FORUM_THREADS = [
  { title: "What's the ONE swap that actually stuck for you?", content: 'Curious what habit genuinely became permanent vs the stuff you tried once and dropped. For me it was a safety razor — never looked back.', cat: 'ZERO_WASTE' },
  { title: 'Best beginner vegetables for a north-facing balcony?', content: 'Limited light, small space, lots of enthusiasm. What grew well for you in tricky conditions?', cat: 'SUSTAINABLE_LIVING' },
  { title: 'How do you talk to family who think climate change is overblown?', content: "Holidays are coming. Looking for approaches that don't end in an argument. What's worked?", cat: 'CLIMATE' },
  { title: 'Heat pump owners — would you do it again?', content: 'About to pull the trigger on an install and would love honest experiences, good and bad.', cat: 'GENERAL' },
  { title: "Favourite plant-based protein that isn't tofu or beans?", content: 'Love both but running out of ideas. Tempeh? Seitan? Hit me with your staples.', cat: 'PLANT_BASED' },
  { title: 'Is carbon offsetting actually worth it or just guilt insurance?', content: "Genuinely torn on this. Some say it's vital, others say it's a distraction. Where do you land?", cat: 'CLIMATE' },
  { title: 'Share your best zero-waste win this month 🌿', content: "Big or small. Let's hype each other up a bit. I finally found a bulk refill shop nearby!", cat: 'ZERO_WASTE' },
  { title: 'How do you stay motivated when the news is bleak?', content: "Some weeks it's hard not to feel like nothing matters. How do you keep going?", cat: 'ACTIVISM' },
  { title: 'Composting in winter — does it just stop?', content: "First winter with a bin and it's slowed right down. Normal? Anything I should do?", cat: 'SUSTAINABLE_LIVING' },
  { title: 'Cheapest meaningful change for renters?', content: "Can't install solar or change the boiler. What actually moves the needle when you don't own the place?", cat: 'GENERAL' },
];

const FORUM_REPLIES = [
  'Safety razor for me too. Pays for itself in a few months.',
  "Honestly just bringing my own containers everywhere. Small but it stuck.",
  'I grew lettuce and spinach in low light, did great. Avoid tomatoes there.',
  "Lead with curiosity, not facts. Ask what they've noticed about the weather.",
  'Did the heat pump last year — zero regrets, house is cosier than ever.',
  'Tempeh marinated overnight is a game changer, give it a go.',
  'I think offsets are fine as a last step, not a first one.',
  "Winter compost slows but doesn't stop. Add more browns and be patient.",
  'Draught-proofing! Cheapest win for renters by a mile.',
  'This thread is exactly why I love this place 🌿',
  'Switched to a refill shop and it weirdly made shopping fun again.',
  'I keep a list of small wins. On bad days I reread it.',
];

const GROUPS = [
  { name: 'Zero Waste Beginners', cat: 'ZERO_WASTE', description: 'No judgement, no perfection. Just people figuring out low-waste living one swap at a time.' },
  { name: 'Balcony & Small-Space Growers', cat: 'SUSTAINABLE_LIVING', description: "Pots, rails, and windowsills. Proof you don't need a garden to grow food." },
  { name: 'Plant-Based Kitchen', cat: 'PLANT_BASED', description: 'Recipes, swaps, and the occasional gloriously failed experiment.' },
  { name: 'Local Climate Action', cat: 'ACTIVISM', description: 'Organising, petitions, and turning frustration into something useful.' },
  { name: 'Renewable Home Nerds', cat: 'GENERAL', description: 'Solar, heat pumps, batteries, and spreadsheets. Lots of spreadsheets.' },
  { name: 'Slow Living Circle', cat: 'GENERAL', description: 'Less hustle, less stuff, more intention. A calm corner of the internet.' },
];

const GROUP_POSTS = [
  'Just joined — excited to learn from you all! First goal: cut my plastic packaging in half.',
  "Anyone got a good source for bulk oats that doesn't cost a fortune?",
  'Win of the week: my whole team at work now composts ☕→🌱',
  'Sharing my balcony setup photos in the comments, would love feedback!',
  "Reminder there's a community litter pick this Saturday if anyone's local.",
  'Made oat milk at home for the first time. Cheaper and zero cartons!',
];

const CAMPAIGNS = [
  { title: 'Plant 1,000 Trees This Season', goal: 'Reach 1,000 native trees planted across our city by autumn.', cat: 'CLIMATE', target: 1000, description: "We're partnering with local councils and volunteers to plant native, pollinator-friendly trees in underused public land. Every supporter pledges to plant or fund at least one tree. Track our progress and join a planting day near you." },
  { title: "Refill, Don't Landfill", goal: 'Get 50 local shops to offer a refill option.', cat: 'ZERO_WASTE', target: 50, description: 'A community push to bring bulk and refill stations to everyday shops. We provide the starter kit and signage; shops provide the shelf space. Support to help us reach the next neighbourhood.' },
  { title: 'Meat-Free Mondays at Schools', goal: 'Bring one plant-based day a week to 20 schools.', cat: 'PLANT_BASED', target: 20, description: 'Working with caterers and parents to introduce a tasty, affordable plant-based menu one day a week. Better for kids, budgets, and the planet. Add your name to show demand.' },
  { title: 'Safe Cycling Routes for Everyone', goal: 'Petition for 10km of protected bike lanes.', cat: 'ACTIVISM', target: 500, description: 'A grassroots campaign for protected, connected cycle routes so people of all ages can ride safely. Sign on to add weight to our submission to the city transport board.' },
  { title: 'Solar for Community Halls', goal: 'Fund rooftop solar on 5 community buildings.', cat: 'GENERAL', target: 5, description: 'Community halls are the heart of our neighbourhoods — and they have big, sunny roofs. Help us fund panels that cut their bills and carbon for decades.' },
];

const CHALLENGES = [
  { title: 'Write Your Eco Origin Story', prompt: 'In 300 words or less, tell us the moment sustainability clicked for you. The mess, the doubt, the turning point.', cat: 'GENERAL', description: 'No perfect heroes — we want the real, messy beginnings. The most relatable entries win a feature on the homepage.' },
  { title: 'A Letter to the Planet in 2050', prompt: 'Write a short letter to the world 25 years from now. Hopeful, honest, or both.', cat: 'CLIMATE', description: "Imagination is a climate tool. Show us the future you're working toward (or warning against)." },
  { title: "The Best Swap You Almost Didn't Make", prompt: 'Tell the story of a sustainable change you resisted — and what finally won you over.', cat: 'ZERO_WASTE', description: 'Practical, funny, personal. Help someone else over the same hurdle.' },
];

const SUBMISSIONS = [
  "It clicked the day I cleared out my flat and counted nine half-used bottles of the same cleaner. Nine. I'd been buying solutions to problems I'd invented. I started asking one question before any purchase: do I already own something that does this? Most of the time, I did.",
  'Dear 2050 — I hope the trains still run on time and the summers are kinder than we feared. I hope someone reads this and laughs at how worried we were, because we finally did enough. I hope the river by my house is clean enough to swim in. We\'re trying. We\'re really trying.',
  "I resisted the safety razor for two years. Convinced I'd shred myself. Bought one on a whim, watched one video, and now I genuinely look forward to shaving. Forty disposable razors a year, gone, just like that. The thing I dreaded became the thing I recommend most.",
  "My origin story is a wilted basil plant. I'd killed every plant I touched, but something about that one made me read, water properly, pay attention. It lived. Then I grew tomatoes. Then I started composting to feed them. One plant pulled the whole thread loose.",
  'The swap I almost skipped was line-drying. Felt like a chore from another century. Then the dryer broke and I strung a line out of stubbornness. Now my clothes last longer, smell better, and my bill dropped. The "inconvenience" became ten quiet minutes I look forward to.',
];

// ── main ─────────────────────────────────────────────────────────────────────
async function wipeSeed() {
  const deleted = await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  if (deleted.count) console.log(`🧹 Removed ${deleted.count} existing seed users (cascade).`);
}

// Build a believable markdown article body from the title/excerpt/tags.
function buildBody(excerpt: string, tags: string[]): string {
  const topic = tags[0]?.replace(/-/g, ' ') || 'sustainability';
  return `${excerpt}

## Why this matters

When I first started paying attention to ${topic}, I assumed change meant overhauling my whole life overnight. It doesn't. The shift that lasted was small, almost boring — and that's exactly why it stuck.

We tend to overestimate the grand gestures and underestimate the quiet, repeatable ones. A single habit, done consistently, compounds in a way a one-off burst of effort never does.

## What I actually changed

- I started with **one** thing instead of ten, so it never felt like a punishment.
- I made the greener option the *easy* option — visible, ready, and friction-free.
- I tracked it loosely. Not to obsess, just to notice the trend.

> The most sustainable change is the one you'll still be doing next year.

## The honest trade-offs

It wasn't all effortless. Some swaps cost a little more upfront, and one or two simply didn't fit my life — so I dropped them without guilt. That permission to *not* be perfect is, ironically, what kept me going.

## Where to start

If you take one thing from this: pick the smallest version of the change that still counts, and do it until it's automatic. Then pick the next one. That's the whole method. The planet doesn't need a few people doing this flawlessly — it needs a lot of us doing it imperfectly.

*Have your own take on ${topic}? Share it in the comments — I read every one.*`;
}

async function main() {
  console.log('🌱 Seeding BeLife demo content...');
  await wipeSeed(); // clean slate so re-runs stay consistent

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // 1) Categories (upsert — shared with real data, never deleted by unseed)
  const cats: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, description: c.description },
      create: c,
    });
    cats[c.slug] = cat.id;
  }
  console.log(`📂 ${CATEGORIES.length} categories ready.`);

  // 2) Users
  const users: { id: string; name: string }[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const name = PEOPLE[i];
    const base = slugify(name).replace(/-/g, '_');
    const user = await prisma.user.create({
      data: {
        name,
        username: `${base}_${i}`.slice(0, 20),
        email: `${base}${i}@${SEED_DOMAIN}`,
        password: passwordHash,
        avatar: `https://i.pravatar.cc/300?img=${(i % 70) + 1}`,
        bio: rand(BIOS),
        verified: true,
        onboarded: true,
        createdAt: daysAgo(randInt(30, 200)),
      },
      select: { id: true, name: true },
    });
    users.push(user);
  }
  console.log(`👥 ${users.length} writers created.`);

  // 3) Blogs
  const blogs: { id: string; authorId: string }[] = [];
  for (let i = 0; i < ARTICLES.length; i++) {
    const a = ARTICLES[i];
    const author = rand(users);
    const blog = await prisma.blog.create({
      data: {
        title: a.title,
        slug: `${slugify(a.title)}-${Date.now().toString(36)}${i}`,
        excerpt: a.excerpt,
        content: buildBody(a.excerpt, a.tags),
        image: img(i),
        published: true,
        featured: i < 5,
        views: randInt(40, 4200),
        readTime: randInt(3, 9),
        tags: a.tags,
        authorId: author.id,
        categoryId: cats[a.cat],
        createdAt: daysAgo(randInt(0, 120)),
      },
      select: { id: true, authorId: true },
    });
    blogs.push(blog);
  }
  console.log(`📝 ${blogs.length} blogs published.`);

  // 4) Likes + Bookmarks + Comments
  let likeCount = 0, commentCount = 0, bookmarkCount = 0;
  for (const blog of blogs) {
    for (const u of sample(users, randInt(3, 18))) {
      try { await prisma.like.create({ data: { userId: u.id, blogId: blog.id } }); likeCount++; } catch {}
    }
    for (const u of sample(users, randInt(0, 4))) {
      try { await prisma.bookmark.create({ data: { userId: u.id, blogId: blog.id } }); bookmarkCount++; } catch {}
    }
    for (const u of sample(users.filter(x => x.id !== blog.authorId), randInt(0, 5))) {
      await prisma.comment.create({
        data: { content: rand(COMMENTS), authorId: u.id, blogId: blog.id, createdAt: daysAgo(randInt(0, 60)) },
      });
      commentCount++;
    }
  }
  console.log(`❤️  ${likeCount} likes · 💬 ${commentCount} comments · 🔖 ${bookmarkCount} bookmarks.`);

  // 5) Follows (random social graph)
  let followCount = 0;
  for (const u of users) {
    for (const target of sample(users.filter(x => x.id !== u.id), randInt(2, 8))) {
      try { await prisma.follow.create({ data: { followerId: u.id, followingId: target.id } }); followCount++; } catch {}
    }
  }
  console.log(`➿ ${followCount} follow relationships.`);

  // 6) Thoughts + likes
  for (const content of THOUGHTS) {
    const t = await prisma.thought.create({
      data: { content, authorId: rand(users).id, createdAt: daysAgo(randInt(0, 40)) },
      select: { id: true },
    });
    for (const u of sample(users, randInt(1, 15))) {
      try { await prisma.thoughtLike.create({ data: { userId: u.id, thoughtId: t.id } }); } catch {}
    }
  }
  console.log(`💡 ${THOUGHTS.length} thoughts posted.`);

  // 7) Forum threads + replies + votes
  for (const th of FORUM_THREADS) {
    const thread = await prisma.forumThread.create({
      data: {
        title: th.title, content: th.content,
        category: th.cat as ForumCategory,
        authorId: rand(users).id,
        views: randInt(20, 900),
        createdAt: daysAgo(randInt(0, 70)),
      },
      select: { id: true },
    });
    for (let r = 0; r < randInt(2, 7); r++) {
      await prisma.forumReply.create({
        data: { content: rand(FORUM_REPLIES), authorId: rand(users).id, threadId: thread.id, createdAt: daysAgo(randInt(0, 50)) },
      });
    }
    for (const u of sample(users, randInt(2, 14))) {
      try { await prisma.forumVote.create({ data: { userId: u.id, threadId: thread.id } }); } catch {}
    }
  }
  console.log(`🗣️  ${FORUM_THREADS.length} forum threads with replies & votes.`);

  // 8) Groups + members + posts
  for (const g of GROUPS) {
    const creator = rand(users);
    const group = await prisma.group.create({
      data: {
        name: g.name, slug: `${slugify(g.name)}-${Date.now().toString(36)}`,
        description: g.description, category: g.cat as ForumCategory,
        creatorId: creator.id, createdAt: daysAgo(randInt(10, 120)),
      },
      select: { id: true },
    });
    await prisma.groupMember.create({ data: { userId: creator.id, groupId: group.id, role: 'ADMIN' } });
    const members = sample(users.filter(u => u.id !== creator.id), randInt(4, 15));
    for (const m of members) {
      try { await prisma.groupMember.create({ data: { userId: m.id, groupId: group.id } }); } catch {}
    }
    for (let p = 0; p < randInt(2, 5); p++) {
      const poster = rand([creator, ...members]);
      const post = await prisma.groupPost.create({
        data: { content: rand(GROUP_POSTS), authorId: poster.id, groupId: group.id, createdAt: daysAgo(randInt(0, 60)) },
        select: { id: true },
      });
      for (const u of sample(members, randInt(0, 6))) {
        try { await prisma.groupPostLike.create({ data: { userId: u.id, postId: post.id } }); } catch {}
      }
    }
  }
  console.log(`👪 ${GROUPS.length} groups with members & posts.`);

  // 9) Campaigns + supporters
  for (const c of CAMPAIGNS) {
    const campaign = await prisma.campaign.create({
      data: {
        title: c.title, slug: `${slugify(c.title)}-${Date.now().toString(36)}`,
        description: c.description, goal: c.goal, category: c.cat as ForumCategory,
        targetCount: c.target, creatorId: rand(users).id, createdAt: daysAgo(randInt(5, 90)),
      },
      select: { id: true },
    });
    for (const u of sample(users, randInt(5, 24))) {
      try { await prisma.campaignSupport.create({ data: { userId: u.id, campaignId: campaign.id } }); } catch {}
    }
  }
  console.log(`📣 ${CAMPAIGNS.length} campaigns with supporters.`);

  // 10) Challenges + submissions + votes
  for (const ch of CHALLENGES) {
    const challenge = await prisma.challenge.create({
      data: {
        title: ch.title, prompt: ch.prompt, description: ch.description,
        category: ch.cat as ForumCategory,
        endsAt: new Date(Date.now() + randInt(5, 30) * 86_400_000),
        creatorId: rand(users).id, createdAt: daysAgo(randInt(2, 40)),
      },
      select: { id: true },
    });
    for (const s of sample(users, randInt(4, 12))) {
      const sub = await prisma.challengeSubmission.create({
        data: { content: rand(SUBMISSIONS), authorId: s.id, challengeId: challenge.id, createdAt: daysAgo(randInt(0, 30)) },
        select: { id: true },
      }).catch(() => null);
      if (!sub) continue;
      for (const u of sample(users, randInt(1, 10))) {
        try { await prisma.challengeVote.create({ data: { userId: u.id, submissionId: sub.id } }); } catch {}
      }
    }
  }
  console.log(`🏆 ${CHALLENGES.length} challenges with submissions & votes.`);

  console.log('\n✅ Seed complete.');
  console.log(`🔑 Log in as a seed user — email like "maya_greenfield0@${SEED_DOMAIN}", password "${SEED_PASSWORD}".`);
  console.log('🧹 Remove everything later with: npm run unseed\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
