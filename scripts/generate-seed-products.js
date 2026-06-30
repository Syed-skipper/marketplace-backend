const fs = require('fs');
const path = require('path');

const CATALOG = {
  Electronics: {
    Mobiles: ['Apple', 'Motorola', 'vivo', 'Samsung', 'realme', 'OPPO', 'POCO', 'Nothing', 'Google', 'Redmi'],
    'Mobile Accessories': ['Mobile Cases', 'Headphones & Headsets', 'Power Banks', 'Screenguards', 'Memory Cards', 'Mobile Chargers', 'Mobile Cables', 'Mobile Holders'],
    'Smart Wearables': ['Smart Watches', 'Smart Bands', 'Smart Glasses (VR)'],
    'Health Care Appliances': ['BP Monitors', 'Weighing Scale'],
    Laptops: ['Gaming Laptops', 'Business Laptops', 'Ultrabooks'],
    'Computer Accessories': ['Mouse', 'Keyboards', 'Pendrives', 'External Hard Disks', 'Laptop Bags'],
    Televisions: ['Smart TV', 'OLED TV', 'LED TV'],
    Audio: ['Bluetooth Speakers', 'Soundbars', 'Home Theatres'],
    Camera: ['DSLR', 'Mirrorless', 'Tripods', 'Lens'],
    Networking: ['Routers'],
  },
  'TVs & Appliances': {
    'Washing Machine': ['Front Load', 'Top Load', 'Semi Automatic'],
    'Air Conditioners': ['Split AC', 'Window AC', 'Inverter AC'],
    Refrigerators: ['Single Door', 'Double Door', 'Side by Side'],
    'Kitchen Appliances': ['Microwave', 'Mixer Grinder', 'Electric Kettle', 'Induction Cooktop', 'Coffee Maker'],
    'Home Appliances': ['Vacuum Cleaner', 'Water Purifier', 'Fans', 'Water Geyser', 'Iron'],
  },
  "Men's Fashion": {
    Footwear: ['Sports Shoes', 'Sneakers', 'Formal Shoes', 'Casual Shoes', 'Sandals'],
    Clothing: ['T-Shirts', 'Formal Shirts', 'Casual Shirts', 'Jeans', 'Trousers', 'Shorts', 'Cargos'],
    'Winter Wear': ['Jackets', 'Sweatshirts', 'Sweaters'],
    'Ethnic Wear': ['Kurta', 'Sherwani', 'Dhoti'],
    Accessories: ['Wallets', 'Belts', 'Backpacks', 'Sunglasses'],
    Watches: ['Fastrack', 'Titan', 'Casio'],
    Grooming: ['Trimmers', 'Perfumes', 'Beard Care'],
  },
  "Women's Fashion": {
    'Western Wear': ['Tops', 'Dresses', 'Jeans', 'Skirts', 'Trousers'],
    'Ethnic Wear': ['Sarees', 'Kurtis', 'Lehenga Choli', 'Salwar Suits', 'Dupattas'],
    Lingerie: ['Bras', 'Panties', 'Nightwear'],
    Footwear: ['Sandals', 'Heels', 'Flats', 'Boots'],
    Beauty: ['Makeup', 'Skin Care', 'Hair Care', 'Perfumes'],
    Accessories: ['Handbags', 'Sling Bags', 'Wallets', 'Jewellery', 'Sunglasses'],
  },
  'Baby & Kids': {
    'Kids Clothing': ['Boys T-Shirts', 'Girls Dresses', 'Ethnic Wear'],
    Footwear: ['Sandals', 'Sports Shoes', 'Character Shoes'],
    Toys: ['Remote Control Toys', 'Educational Toys', 'Soft Toys', 'Dolls', 'STEM Toys', 'Board Games'],
    'Baby Care': ['Diapers', 'Wipes', 'Baby Food', 'Feeding Bottles', 'Baby Grooming'],
    'School Supplies': ['School Bags', 'Lunch Box'],
  },
  'Home & Furniture': {
    Kitchen: ['Pressure Cookers', 'Gas Stove', 'Dinner Set', 'Water Bottles', 'Lunch Boxes'],
    Furniture: ['Beds', 'Sofa', 'Dining Tables', 'TV Units', 'Wardrobes', 'Office Chairs'],
    Furnishing: ['Bedsheets', 'Curtains', 'Pillows', 'Blankets'],
    'Home Decor': ['Paintings', 'Wall Shelves', 'Showpieces', 'Clocks'],
    Lighting: ['Bulbs', 'Wall Lamps', 'Ceiling Lamps'],
    'Pet Supplies': ['Dog Food', 'Cat Toys', 'Aquarium Supplies'],
  },
  'Sports Books & More': {
    Sports: ['Cricket Bat', 'Football', 'Badminton Racquet', 'Cycling Helmet', 'Yoga Mat'],
    Fitness: ['Dumbbells', 'Home Gym', 'Gym Gloves', 'Protein Shaker'],
    'Food Essentials': ['Dry Fruits', 'Tea', 'Coffee', 'Chocolates', 'Snacks'],
    'Health Supplements': ['Protein Powder', 'Vitamins', 'Health Drinks'],
    Books: ['Fiction', 'Self Help', 'Academic Books', 'Entrance Exams'],
    Stationery: ['Pens', 'Diaries', 'Calculators'],
    Gaming: ['Gaming Consoles', 'Gaming Accessories', 'VR Headsets'],
    Automotive: ['Helmets', 'Car Mobile Holder', 'Bike Lubricants'],
  },
};

const PRODUCT_TEMPLATES = {
  'Apple': [
    { brand: 'Apple', names: ['iPhone 15 128GB', 'iPhone 15 Pro 256GB', 'iPhone 14 128GB', 'iPhone 13 128GB', 'iPhone 15 Plus 256GB', 'iPhone 14 Pro 256GB', 'iPhone SE 3rd Gen 64GB', 'iPhone 15 Pro Max 512GB', 'iPhone 12 64GB Refurbished', 'iPhone 14 Plus 128GB'], prices: [69900, 134900, 59900, 49900, 89900, 109900, 39900, 159900, 34900, 74900] },
  ],
  Motorola: [
    { brand: 'Motorola', names: ['Moto G84 5G 12GB', 'Moto Edge 40 Neo 256GB', 'Moto G54 5G 8GB', 'Moto Edge 50 Pro 256GB', 'Moto G34 5G 4GB', 'Moto G73 5G 8GB', 'Moto Edge 40 256GB', 'Moto G24 Power 4GB', 'Moto Razr 40 Ultra 256GB', 'Moto G52 6GB'], prices: [17999, 22999, 14999, 34999, 10999, 16999, 24999, 8999, 59999, 13999] },
  ],
  vivo: [
    { brand: 'vivo', names: ['Vivo V29 Pro 256GB', 'Vivo Y100 8GB', 'Vivo X100 Pro 256GB', 'Vivo T2 Pro 5G 8GB', 'Vivo Y27 6GB', 'Vivo V27 Pro 256GB', 'Vivo Y36 8GB', 'Vivo X90 256GB', 'Vivo Y17s 4GB', 'Vivo V29e 256GB'], prices: [39999, 18999, 89999, 23999, 14999, 37999, 16999, 59999, 10999, 26999] },
  ],
  Samsung: [
    { brand: 'Samsung', names: ['Galaxy S24 Ultra 256GB', 'Galaxy A55 5G 8GB', 'Galaxy M34 5G 8GB', 'Galaxy S23 FE 128GB', 'Galaxy A15 5G 6GB', 'Galaxy Z Flip5 256GB', 'Galaxy M14 5G 6GB', 'Galaxy S24 128GB', 'Galaxy A35 5G 8GB', 'Galaxy F54 5G 8GB'], prices: [129999, 29999, 17999, 49999, 15999, 99999, 13499, 79999, 30999, 27999] },
  ],
  realme: [
    { brand: 'realme', names: ['realme 12 Pro+ 5G 256GB', 'realme Narzo 70 Pro 5G', 'realme 11 Pro 5G 256GB', 'realme C67 5G 6GB', 'realme GT 6 256GB', 'realme 12x 5G 8GB', 'realme Narzo 60x 5G', 'realme 11x 5G 128GB', 'realme C55 8GB', 'realme GT Neo 5 SE'], prices: [29999, 19999, 26999, 13999, 40999, 14999, 12999, 17999, 11999, 34999] },
  ],
  OPPO: [
    { brand: 'OPPO', names: ['OPPO Reno11 Pro 5G 256GB', 'OPPO A79 5G 8GB', 'OPPO Find X6 Pro 256GB', 'OPPO F25 Pro 5G 8GB', 'OPPO A58 6GB', 'OPPO Reno10 Pro 5G', 'OPPO A38 4GB', 'OPPO Find N3 Flip 256GB', 'OPPO K12x 5G 8GB', 'OPPO A98 5G 8GB'], prices: [39999, 19999, 79999, 25999, 13999, 38999, 10999, 82999, 16999, 18999] },
  ],
  POCO: [
    { brand: 'POCO', names: ['POCO X6 Pro 5G 12GB', 'POCO M6 Pro 5G 8GB', 'POCO F6 256GB', 'POCO C65 6GB', 'POCO X5 Pro 5G 8GB', 'POCO F5 256GB', 'POCO M6 5G 4GB', 'POCO X6 5G 8GB', 'POCO C55 6GB', 'POCO F4 GT 256GB'], prices: [26999, 14999, 29999, 9999, 22999, 27999, 10999, 19999, 8999, 33999] },
  ],
  Nothing: [
    { brand: 'Nothing', names: ['Nothing Phone (2a) 8GB', 'Nothing Phone (2) 256GB', 'Nothing Phone (1) 128GB', 'Nothing Phone (2a) Plus 12GB', 'Nothing CMF Phone 1 8GB', 'Nothing Phone (2) 512GB', 'Nothing Ear Stick Bundle Pack', 'Nothing Phone (2a) 12GB Special', 'Nothing Phone (1) 256GB', 'Nothing Phone (2) 128GB'], prices: [23999, 44999, 29999, 27999, 17999, 49999, 34999, 25999, 32999, 39999] },
  ],
  Google: [
    { brand: 'Google', names: ['Pixel 8 Pro 256GB', 'Pixel 8a 128GB', 'Pixel 7a 128GB', 'Pixel 8 128GB', 'Pixel 6a 128GB Refurb', 'Pixel Fold 256GB', 'Pixel 7 Pro 128GB', 'Pixel 8 Pro 128GB', 'Pixel 7 128GB', 'Pixel 8 256GB'], prices: [106999, 52999, 38999, 75999, 27999, 154999, 66999, 99999, 49999, 85999] },
  ],
  Redmi: [
    { brand: 'Redmi', names: ['Redmi Note 13 Pro+ 5G 256GB', 'Redmi 13C 5G 4GB', 'Redmi Note 12 5G 6GB', 'Redmi 12 5G 6GB', 'Redmi Note 13 Pro 5G 8GB', 'Redmi A3 3GB', 'Redmi 13 5G 6GB', 'Redmi Note 12 Pro 5G', 'Redmi K70E 256GB Import', 'Redmi 12C 4GB'], prices: [31999, 10999, 14999, 12999, 24999, 7999, 13999, 19999, 28999, 8999] },
  ],
};

const SHARED_CATEGORIES = new Set(['Footwear', 'Accessories']);

function resolveCategory(section, category) {
  if (SHARED_CATEGORIES.has(category)) {
    const prefix = section.replace("'s Fashion", "'s").replace('Baby & Kids', 'Kids');
    return `${prefix} ${category}`;
  }
  return category;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function vendorId(seed) {
  return `vendor_${(seed % 20) + 1}`;
}

function discountPrice(price, idx) {
  const discounts = [0, 5, 8, 10, 12, 15, 18, 20, 22, 25];
  const pct = discounts[idx % discounts.length];
  if (pct === 0) return price;
  return Math.round(price * (1 - pct / 100));
}

function rating(idx) {
  return Number((3.2 + ((idx * 7) % 18) / 10).toFixed(1));
}

function reviewCount(idx) {
  return 12 + ((idx * 137) % 2847);
}

function stock(idx) {
  return 8 + ((idx * 43) % 492);
}

function sku(category, subcategory, idx) {
  const c = slugify(category).slice(0, 4).toUpperCase();
  const s = slugify(subcategory).slice(0, 4).toUpperCase();
  return `SKU-${c}-${s}-${String(idx + 1).padStart(3, '0')}`;
}

const BRAND_POOLS = {
  default: ['Bajaj', 'Philips', 'Prestige', 'Havells', 'Crompton', 'Orient', 'Butterfly', 'Milton', 'Cello', 'Pigeon'],
  fashion: ['Roadster', 'Peter England', 'Allen Solly', 'Levis', 'Puma', 'Nike', 'Adidas', 'Woodland', 'Bata', 'Red Tape'],
  women: ['Biba', 'W', 'FabIndia', 'Libas', 'Global Desi', 'Aurelia', 'Soch', 'Rangriti', 'Indo Era', 'Janasya'],
  kids: ['Hopscotch', 'UCB Kids', 'Mothercare', 'FirstCry', 'Max Kids', 'Pantaloons Junior', 'Disney', 'Barbie', 'Lilliput', 'Gini & Jony'],
  home: ['Wakefit', 'Urban Ladder', 'Nilkamal', 'Godrej Interio', 'Pepperfry', 'Durian', 'Sleepwell', 'Home Centre', 'Spaces', 'Story@Home'],
  appliances: ['LG', 'Samsung', 'Whirlpool', 'IFB', 'Bosch', 'Haier', 'Voltas', 'Blue Star', 'Godrej', 'Panasonic'],
  electronics: ['boAt', 'Sony', 'JBL', 'Anker', 'Noise', 'Logitech', 'Dell', 'HP', 'Lenovo', 'Asus'],
  food: ['Tata', 'Amul', 'Britannia', 'Parle', 'Haldirams', 'Nestle', 'Brooke Bond', 'Lipton', 'Cadbury', 'MTR'],
  books: ['Penguin', 'HarperCollins', 'Rupa', 'Arihant', 'Oswaal', 'S Chand', 'McGraw Hill', 'Pearson', 'Westland', 'Jaico'],
  sports: ['SG', 'MRF', 'Yonex', 'Nivia', 'Cosco', 'Strauss', 'Boldfit', 'Decathlon', 'Adidas', 'Nike'],
  pet: ['Pedigree', 'Drools', 'Whiskas', 'Royal Canin', 'Purepet', 'Me-O', 'Tetra', 'Optimum', 'Heads Up For Tails', 'Basil'],
};

function getBrandPool(section, category) {
  if (section.includes('Fashion') && section.includes('Men')) return BRAND_POOLS.fashion;
  if (section.includes('Fashion') && section.includes('Women')) return BRAND_POOLS.women;
  if (section === 'Baby & Kids') return BRAND_POOLS.kids;
  if (section === 'Home & Furniture') {
    if (['Kitchen', 'Furnishing', 'Home Decor', 'Lighting', 'Pet Supplies'].includes(category)) {
      if (category === 'Pet Supplies') return BRAND_POOLS.pet;
      return BRAND_POOLS.home;
    }
    return BRAND_POOLS.home;
  }
  if (section === 'TVs & Appliances') return BRAND_POOLS.appliances;
  if (section === 'Electronics') return BRAND_POOLS.electronics;
  if (section === 'Sports Books & More') {
    if (['Food Essentials', 'Health Supplements'].includes(category)) return BRAND_POOLS.food;
    if (category === 'Books') return BRAND_POOLS.books;
    if (['Sports', 'Fitness'].includes(category)) return BRAND_POOLS.sports;
    return BRAND_POOLS.electronics;
  }
  return BRAND_POOLS.default;
}

const PRICE_RANGES = {
  'Mobile Cases': [199, 2999],
  'Headphones & Headsets': [499, 24999],
  'Power Banks': [599, 4999],
  Screenguards: [99, 999],
  'Memory Cards': [399, 8999],
  'Mobile Chargers': [299, 3999],
  'Mobile Cables': [149, 1999],
  'Mobile Holders': [199, 2999],
  'Smart Watches': [1999, 49999],
  'Smart Bands': [999, 9999],
  'Smart Glasses (VR)': [2999, 74999],
  'BP Monitors': [999, 5999],
  'Weighing Scale': [499, 4999],
  'Gaming Laptops': [54999, 199999],
  'Business Laptops': [34999, 129999],
  Ultrabooks: [49999, 179999],
  Mouse: [299, 8999],
  Keyboards: [499, 14999],
  Pendrives: [399, 4999],
  'External Hard Disks': [2999, 14999],
  'Laptop Bags': [599, 4999],
  'Smart TV': [14999, 89999],
  'OLED TV': [49999, 299999],
  'LED TV': [9999, 49999],
  'Bluetooth Speakers': [999, 19999],
  Soundbars: [2999, 49999],
  'Home Theatres': [4999, 79999],
  DSLR: [34999, 149999],
  Mirrorless: [49999, 199999],
  Tripods: [799, 9999],
  Lens: [8999, 149999],
  Routers: [999, 19999],
  'Front Load': [24999, 69999],
  'Top Load': [14999, 44999],
  'Semi Automatic': [7999, 19999],
  'Split AC': [27999, 69999],
  'Window AC': [22999, 44999],
  'Inverter AC': [31999, 79999],
  'Single Door': [9999, 24999],
  'Double Door': [19999, 54999],
  'Side by Side': [44999, 149999],
  Microwave: [3999, 19999],
  'Mixer Grinder': [1999, 12999],
  'Electric Kettle': [599, 3999],
  'Induction Cooktop': [1499, 8999],
  'Coffee Maker': [2499, 14999],
  'Vacuum Cleaner': [2999, 24999],
  'Water Purifier': [7999, 44999],
  Fans: [1299, 9999],
  'Water Geyser': [3999, 14999],
  Iron: [699, 4999],
  'Sports Shoes': [999, 9999],
  Sneakers: [1499, 12999],
  'Formal Shoes': [1299, 8999],
  'Casual Shoes': [999, 6999],
  Sandals: [399, 3999],
  'T-Shirts': [299, 2999],
  'Formal Shirts': [699, 4999],
  'Casual Shirts': [499, 3999],
  Jeans: [799, 4999],
  Trousers: [699, 4499],
  Shorts: [399, 2499],
  Cargos: [799, 3999],
  Jackets: [999, 8999],
  Sweatshirts: [699, 3999],
  Sweaters: [799, 4999],
  Kurta: [599, 4999],
  Sherwani: [4999, 29999],
  Dhoti: [399, 2999],
  Wallets: [299, 2999],
  Belts: [399, 2499],
  Backpacks: [499, 4999],
  Sunglasses: [499, 9999],
  Fastrack: [999, 4999],
  Titan: [1999, 14999],
  Casio: [1499, 9999],
  Trimmers: [699, 4999],
  Perfumes: [499, 9999],
  'Beard Care': [199, 1999],
  Tops: [399, 3999],
  Dresses: [699, 9999],
  Skirts: [499, 3999],
  Sarees: [999, 24999],
  Kurtis: [399, 4999],
  'Lehenga Choli': [2999, 49999],
  'Salwar Suits': [999, 9999],
  Dupattas: [299, 2999],
  Bras: [299, 1999],
  Panties: [199, 999],
  Nightwear: [399, 2999],
  Heels: [699, 6999],
  Flats: [399, 3999],
  Boots: [999, 8999],
  Makeup: [199, 4999],
  'Skin Care': [299, 5999],
  'Hair Care': [199, 3999],
  Handbags: [499, 9999],
  'Sling Bags': [399, 4999],
  Jewellery: [299, 14999],
  'Boys T-Shirts': [199, 1499],
  'Girls Dresses': [399, 2499],
  'Character Shoes': [499, 2499],
  'Remote Control Toys': [499, 9999],
  'Educational Toys': [299, 4999],
  'Soft Toys': [199, 2999],
  Dolls: [299, 3999],
  'STEM Toys': [499, 7999],
  'Board Games': [399, 4999],
  Diapers: [399, 2999],
  Wipes: [99, 999],
  'Baby Food': [99, 999],
  'Feeding Bottles': [199, 1999],
  'Baby Grooming': [149, 1499],
  'School Bags': [399, 2999],
  'Lunch Box': [199, 1499],
  'Pressure Cookers': [799, 4999],
  'Gas Stove': [1499, 8999],
  'Dinner Set': [999, 9999],
  'Water Bottles': [199, 1999],
  'Lunch Boxes': [199, 1499],
  Beds: [7999, 49999],
  Sofa: [9999, 79999],
  'Dining Tables': [4999, 49999],
  'TV Units': [2999, 24999],
  Wardrobes: [5999, 59999],
  'Office Chairs': [2999, 19999],
  Bedsheets: [399, 3999],
  Curtains: [499, 4999],
  Pillows: [299, 2999],
  Blankets: [499, 4999],
  Paintings: [299, 9999],
  'Wall Shelves': [399, 4999],
  Showpieces: [199, 4999],
  Clocks: [299, 3999],
  Bulbs: [99, 1999],
  'Wall Lamps': [499, 4999],
  'Ceiling Lamps': [699, 9999],
  'Dog Food': [299, 4999],
  'Cat Toys': [149, 1999],
  'Aquarium Supplies': [199, 4999],
  'Cricket Bat': [499, 14999],
  Football: [299, 4999],
  'Badminton Racquet': [499, 9999],
  'Cycling Helmet': [699, 4999],
  'Yoga Mat': [299, 2999],
  Dumbbells: [499, 9999],
  'Home Gym': [4999, 49999],
  'Gym Gloves': [299, 1999],
  'Protein Shaker': [149, 999],
  'Dry Fruits': [199, 4999],
  Tea: [99, 1999],
  Coffee: [149, 2999],
  Chocolates: [49, 999],
  Snacks: [20, 499],
  'Protein Powder': [999, 5999],
  Vitamins: [299, 2999],
  'Health Drinks': [199, 1999],
  Fiction: [199, 999],
  'Self Help': [199, 799],
  'Academic Books': [299, 1999],
  'Entrance Exams': [399, 2499],
  Pens: [29, 999],
  Diaries: [99, 999],
  Calculators: [299, 2999],
  'Gaming Consoles': [29999, 59999],
  'Gaming Accessories': [499, 14999],
  'VR Headsets': [9999, 49999],
  Helmets: [799, 4999],
  'Car Mobile Holder': [199, 1999],
  'Bike Lubricants': [99, 999],
};

const ADJECTIVES = ['Premium', 'Classic', 'Pro', 'Ultra', 'Essential', 'Deluxe', 'Smart', 'Compact', 'Elite', 'Max'];
const VARIANTS = ['Black', 'Blue', 'White', 'Silver', 'Red', 'Green', 'Grey', 'Brown', 'Gold', 'Navy'];

function randomPrice(min, max, seed) {
  const range = max - min;
  const steps = Math.floor(range / 100) || 1;
  const step = seed % (steps + 1);
  return Math.round(min + step * Math.floor(range / steps / 100) * 100);
}

function generateDescription(name, brand, category, subcategory, idx) {
  const variant = VARIANTS[idx % VARIANTS.length];
  const templates = [
    `${name} by ${brand} — crafted for Indian homes with reliable build quality and everyday convenience.`,
    `Shop ${name} in ${variant}. Ideal ${subcategory.toLowerCase()} pick from our ${category} collection with fast delivery across India.`,
    `${brand} ${name}: trusted performance, value pricing in INR, and ${rating(idx)}★ customer satisfaction.`,
    `Premium ${subcategory.toLowerCase()} — ${name}. Features durable materials, ${variant.toLowerCase()} finish, and manufacturer warranty.`,
    `${name} (${variant}) — popular choice in ${category}. Perfect for online shoppers looking for authentic ${brand} products.`,
  ];
  return templates[idx % templates.length];
}

function generateProductName(subcategory, brand, idx, section) {
  if (PRODUCT_TEMPLATES[subcategory]) {
    const t = PRODUCT_TEMPLATES[subcategory][0];
    return { name: t.names[idx], brand: t.brand, price: t.prices[idx] };
  }

  const adj = ADJECTIVES[idx % ADJECTIVES.length];
  const variant = VARIANTS[idx % VARIANTS.length];

  const namePatterns = {
    'Mobile Cases': [`${brand} Shockproof Back Cover ${variant}`, `${brand} Silicone Case for Premium Phones`, `${brand} Transparent TPU Case`, `${brand} Rugged Armor Case ${variant}`, `${brand} Flip Cover with Card Slot`, `${brand} MagSafe Compatible Case`, `${brand} Carbon Fiber Texture Case`, `${brand} Leather Finish Back Cover`, `${brand} Ring Holder Case ${variant}`, `${brand} Slim Fit Matte Case`],
    'Headphones & Headsets': [`${brand} Wireless ANC Headphones`, `${brand} True Wireless Earbuds Pro`, `${brand} Over-Ear Studio Headphones`, `${brand} Neckband Bluetooth 5.3`, `${brand} Gaming Headset 7.1 Surround`, `${brand} Sports Earbuds IPX5`, `${brand} Foldable Bluetooth Headphones`, `${brand} ENC Calling Earbuds`, `${brand} Bass Boost Wireless Headset`, `${brand} Dual Mode BT + Wired Headphones`],
    'Power Banks': [`${brand} 10000mAh Fast Charge Power Bank`, `${brand} 20000mAh PD 22.5W Power Bank`, `${brand} Slim 5000mAh Pocket Power Bank`, `${brand} 30000mAh Triple Port Power Bank`, `${brand} MagSafe Wireless Power Bank`, `${brand} 10000mAh LED Display Power Bank`, `${brand} Solar Assist 15000mAh Power Bank`, `${brand} Mini 10000mAh Power Bank`, `${brand} 20000mAh Laptop Power Bank 65W`, `${brand} Rugged 10000mAh Power Bank`],
    Screenguards: [`${brand} Tempered Glass 9H Screen Guard`, `${brand} Privacy Tempered Glass`, `${brand} Edge-to-Edge Screen Protector`, `${brand} Anti-Glare Matte Screen Guard`, `${brand} UV Glue Full Cover Glass`, `${brand} Ceramic Matte Screen Guard`, `${brand} Hydrogel Flexible Screen Guard`, `${brand} Blue Light Cut Screen Guard`, `${brand} 2-Pack Tempered Glass Kit`, `${brand} Camera Lens + Screen Guard Combo`],
    'Memory Cards': [`${brand} 64GB Class 10 MicroSD Card`, `${brand} 128GB UHS-I MicroSDXC`, `${brand} 256GB A2 MicroSD for Phones`, `${brand} 32GB MicroSD with Adapter`, `${brand} 512GB V30 MicroSD Card`, `${brand} 128GB High Endurance Card`, `${brand} 64GB Dashcam Memory Card`, `${brand} 256GB Pro Plus MicroSD`, `${brand} 128GB SDXC Camera Card`, `${brand} 1TB MicroSD Express Card`],
    'Mobile Chargers': [`${brand} 33W Dart Charge Adapter`, `${brand} 65W GaN Dual Port Charger`, `${brand} 18W Fast USB Charger`, `${brand} 25W Type-C Wall Charger`, `${brand} 120W SuperVOOC Charger`, `${brand} 20W PD iPhone Charger`, `${brand} 45W Dual USB-C Charger`, `${brand} Car 30W Fast Charger`, `${brand} 80W Multi-Port GaN Charger`, `${brand} 12W Compact Travel Charger`],
    'Mobile Cables': [`${brand} USB-C to C 100W Cable 1.5m`, `${brand} Braided Lightning Cable 1m`, `${brand} Type-C 3A Fast Charging Cable 2m`, `${brand} Magnetic Charging Cable`, `${brand} USB-C to Lightning MFi Cable`, `${brand} 240W USB-C PD Cable`, `${brand} Right Angle Gaming USB-C Cable`, `${brand} 3-in-1 Multi Charging Cable`, `${brand} USB-C to A 3.0 Data Cable`, `${brand} Coiled USB-C Cable for Car`],
    'Mobile Holders': [`${brand} Car AC Vent Phone Holder`, `${brand} Dashboard Magnetic Phone Mount`, `${brand} Bike Handlebar Phone Holder`, `${brand} Desk Adjustable Phone Stand`, `${brand} Windshield Suction Phone Mount`, `${brand} CD Slot Car Phone Holder`, `${brand} Bed Gooseneck Phone Holder`, `${brand} Wireless Charging Car Mount`, `${brand} Tablet + Phone Car Headrest Holder`, `${brand} Anti-Slip Desk Phone Stand`],
    'Smart Watches': [`${brand} AMOLED Bluetooth Calling Watch`, `${brand} Fitness Tracker Smartwatch`, `${brand} Round Dial Premium Smart Watch`, `${brand} Rugged Outdoor GPS Smartwatch`, `${brand} Square Dial HD Smart Watch`, `${brand} Women's Fashion Smartwatch`, `${brand} Kids Safe Zone Smart Watch`, `${brand} Golf Edition GPS Smartwatch`, `${brand} Classic Hybrid Smart Watch`, `${brand} Health Pro ECG Smartwatch`],
    'Smart Bands': [`${brand} Fitness Band with SpO2`, `${brand} Color AMOLED Smart Band`, `${brand} Budget Fitness Tracker Band`, `${brand} Swim-Proof Activity Band`, `${brand} Alexa Built-in Smart Band`, `${brand} Stress Monitor Fitness Band`, `${brand} Long Battery Smart Band 14 Days`, `${brand} Women's Cycle Tracking Band`, `${brand} GPS Sports Smart Band`, `${brand} Kids Activity Fitness Band`],
    'Smart Glasses (VR)': [`${brand} VR Headset 3D Virtual Reality`, `${brand} All-in-One VR Gaming Headset`, `${brand} Smartphone VR Viewer`, `${brand} PC VR Headset with Controllers`, `${brand} Kids Safe VR Goggles`, `${brand} Standalone VR Headset 128GB`, `${brand} AR Smart Glasses Developer Kit`, `${brand} VR Headset with Spatial Audio`, `${brand} Compact Travel VR Viewer`, `${brand} Enterprise VR Training Headset`],
    'BP Monitors': [`${brand} Upper Arm Digital BP Monitor`, `${brand} Wrist BP Monitor with Memory`, `${brand} Bluetooth Smart BP Machine`, `${brand} Fully Automatic BP Monitor`, `${brand} Dual User BP Monitor 120 Memory`, `${brand} Compact Travel BP Monitor`, `${brand} Talking BP Monitor Hindi/English`, `${brand} USB Rechargeable BP Monitor`, `${brand} Doctor Recommended BP Monitor`, `${brand} BP Monitor with Irregular Heartbeat Detection`],
    'Weighing Scale': [`${brand} Digital Body Weighing Scale`, `${brand} Smart Bluetooth Body Composition Scale`, `${brand} Slim Glass Platform Weighing Scale`, `${brand} Mechanical Analog Weighing Scale`, `${brand} Rechargeable Smart Body Scale`, `${brand} BMI Fat Analyzer Weighing Scale`, `${brand} Heavy Duty 180kg Weighing Scale`, `${brand} Kids Cute Design Weighing Scale`, `${brand} Solar Powered Digital Scale`, `${brand} Wi-Fi Smart Family Body Scale`],
    'Gaming Laptops': [`${brand} RTX 4060 Gaming Laptop 16GB`, `${brand} AMD Ryzen 7 Gaming Laptop`, `${brand} 165Hz FHD Gaming Notebook`, `${brand} RGB Backlit Gaming Laptop`, `${brand} Thin & Light RTX 4050 Gaming Laptop`, `${brand} Intel i7 14th Gen Gaming Laptop`, `${brand} Budget GTX Gaming Laptop`, `${brand} QHD 240Hz Esports Laptop`, `${brand} 32GB RAM Creator Gaming Laptop`, `${brand} RTX 4070 Premium Gaming Laptop`],
    'Business Laptops': [`${brand} Intel i5 Business Laptop 8GB`, `${brand} ThinkPad Style Business Notebook`, `${brand} 14" FHD Business Ultralight Laptop`, `${brand} Ryzen 5 Business Laptop with Fingerprint`, `${brand} 16GB RAM Office Laptop`, `${brand} Convertible 2-in-1 Business Laptop`, `${brand} MIL-STD Business Rugged Laptop`, `${brand} Budget Student Business Laptop`, `${brand} Premium Aluminum Business Laptop`, `${brand} Docking-Ready Business Laptop`],
    Ultrabooks: [`${brand} 13" OLED Ultrabook 1kg`, `${brand} Intel Evo Certified Ultrabook`, `${brand} AMD Ryzen Ultrabook 16GB`, `${brand} 2K Touchscreen Ultrabook`, `${brand} Fanless Silent Ultrabook`, `${brand} Premium Magnesium Ultrabook`, `${brand} 18hr Battery Ultrabook`, `${brand} Copilot+ AI Ultrabook`, `${brand} 14" Compact Travel Ultrabook`, `${brand} Creator Ultrabook RTX Studio`],
    Mouse: [`${brand} Wireless Ergonomic Mouse`, `${brand} RGB Gaming Mouse 16000 DPI`, `${brand} Silent Click Office Mouse`, `${brand} Bluetooth Dual Mode Mouse`, `${brand} Vertical Ergonomic Mouse`, `${brand} Rechargeable Wireless Mouse`, `${brand} Trackball Thumb Mouse`, `${brand} Compact Travel Mouse`, `${brand} Programmable Macro Gaming Mouse`, `${brand} USB-C Rechargeable Pro Mouse`],
    Keyboards: [`${brand} Mechanical Gaming Keyboard RGB`, `${brand} Wireless Compact Keyboard`, `${brand} Membrane Silent Office Keyboard`, `${brand} Hot-Swappable Mechanical Keyboard`, `${brand} Bluetooth Multi-Device Keyboard`, `${brand} 60% Gaming Keyboard`, `${brand} Backlit USB Keyboard`, `${brand} Ergonomic Split Keyboard`, `${brand} Mini Bluetooth Keyboard`, `${brand} TKL Mechanical Keyboard`],
    Pendrives: [`${brand} 64GB USB 3.0 Pendrive`, `${brand} 128GB Metal Body Pendrive`, `${brand} 32GB OTG Dual Pendrive`, `${brand} 256GB High Speed USB 3.2 Drive`, `${brand} 64GB Type-C + USB Pendrive`, `${brand} 128GB Encrypted Secure Pendrive`, `${brand} 512GB USB 3.1 Flash Drive`, `${brand} 32GB Keychain Mini Pendrive`, `${brand} 128GB Rugged Waterproof Pendrive`, `${brand} 64GB Slider USB Pendrive`],
    'External Hard Disks': [`${brand} 1TB USB 3.0 Portable HDD`, `${brand} 2TB Slim External Hard Drive`, `${brand} 4TB Desktop External HDD`, `${brand} 1TB Shockproof External Drive`, `${brand} 2TB USB-C Portable SSD/HDD`, `${brand} 5TB Backup Plus External Drive`, `${brand} 1TB Gaming External HDD`, `${brand} 2TB Hardware Encrypted HDD`, `${brand} 4TB Rugged Outdoor HDD`, `${brand} 1TB Wireless Wi-Fi HDD`],
    'Laptop Bags': [`${brand} 15.6" Laptop Backpack`, `${brand} Anti-Theft Laptop Bag`, `${brand} Slim Laptop Sleeve Case`, `${brand} Rolling Laptop Trolley Bag`, `${brand} Waterproof Laptop Messenger Bag`, `${brand} Business Laptop Briefcase`, `${brand} Gaming Laptop Backpack 17"`, `${brand} Convertible Laptop Backpack`, `${brand} Eco Canvas Laptop Bag`, `${brand} RFID Laptop Travel Backpack`],
    'Smart TV': [`${brand} 43" 4K Android Smart TV`, `${brand} 55" Google TV 4K HDR`, `${brand} 32" HD Ready Smart TV`, `${brand} 50" 4K Fire TV Edition`, `${brand} 65" 4K QLED Smart TV`, `${brand} 40" Full HD Smart TV`, `${brand} 55" 144Hz Game Mode Smart TV`, `${brand} 43" Frameless Bezel Smart TV`, `${brand} 75" 4K Ultra HD Smart TV`, `${brand} 50" Dolby Vision Smart TV`],
    'OLED TV': [`${brand} 55" 4K OLED evo TV`, `${brand} 65" OLED 120Hz Gaming TV`, `${brand} 48" OLED 4K Cinema TV`, `${brand} 77" OLED Wallpaper TV`, `${brand} 55" OLED Dolby Atmos TV`, `${brand} 65" OLED AI Processor TV`, `${brand} 42" OLED PC Monitor TV`, `${brand} 55" Rollable OLED TV Concept`, `${brand} 65" OLED Bright Panel TV`, `${brand} 55" OLED Gallery Design TV`],
    'LED TV': [`${brand} 32" HD LED TV`, `${brand} 43" Full HD LED TV`, `${brand} 50" 4K UHD LED TV`, `${brand} 55" 4K LED TV with Soundbar Offer`, `${brand} 40" LED TV Triple HDMI`, `${brand} 24" LED TV for Kitchen`, `${brand} 65" 4K LED X-Reality TV`, `${brand} 43" LED TV with Screen Mirroring`, `${brand} 55" LED TV 3-sided Frameless`, `${brand} 32" LED TV with USB Movie`],
    'Bluetooth Speakers': [`${brand} Portable Bluetooth Speaker 20W`, `${brand} Waterproof IPX7 BT Speaker`, `${brand} Party Speaker with RGB Lights`, `${brand} Mini Pocket Bluetooth Speaker`, `${brand} 360° Surround BT Speaker`, `${brand} Outdoor Adventure BT Speaker`, `${brand} Wooden Retro Bluetooth Speaker`, `${brand} TWS Pair Stereo BT Speakers`, `${brand} Karaoke Bluetooth Speaker with Mic`, `${brand} Premium Aluminium BT Speaker`],
    Soundbars: [`${brand} 2.1 Channel Soundbar with Subwoofer`, `${brand} Dolby Atmos 3.1.2 Soundbar`, `${brand} Compact TV Soundbar 100W`, `${brand} Bluetooth Soundbar with HDMI ARC`, `${brand} 5.1 Wireless Soundbar System`, `${brand} Slim Wall-Mount Soundbar`, `${brand} Gaming Soundbar with RGB`, `${brand} 300W Party Soundbar`, `${brand} Soundbar with Built-in Subwoofer`, `${brand} Premium 4K Pass-through Soundbar`],
    'Home Theatres': [`${brand} 5.1 Channel Home Theatre System`, `${brand} Bluetooth Home Theatre 4.1`, `${brand} Compact Soundbar Home Theatre Combo`, `${brand} 7.1 Wireless Home Theatre`, `${brand} Tower Speaker Home Theatre Set`, `${brand} Budget 2.1 Home Theatre`, `${brand} Dolby Digital Home Theatre`, `${brand} Karaoke Home Theatre System`, `${brand} Premium Wooden Home Theatre`, `${brand} 5.1 USB FM Home Theatre`],
    DSLR: [`${brand} Entry Level DSLR 24MP Kit Lens`, `${brand} Mid-Range DSLR with 18-55mm`, `${brand} Full Frame DSLR Body Only`, `${brand} Beginner DSLR Twin Lens Kit`, `${brand} Weather Sealed DSLR Camera`, `${brand} Vlogging DSLR with Flip Screen`, `${brand} Sports DSLR 10fps Burst`, `${brand} Budget DSLR for Students`, `${brand} Professional DSLR 45MP`, `${brand} DSLR Video Creator Kit`],
    Mirrorless: [`${brand} APS-C Mirrorless Camera Kit`, `${brand} Full Frame Mirrorless 4K`, `${brand} Vlog Mirrorless with Mic Input`, `${brand} Compact Travel Mirrorless Camera`, `${brand} 8K Video Mirrorless Body`, `${brand} Entry Mirrorless with Kit Lens`, `${brand} Hybrid Photo/Video Mirrorless`, `${brand} Pro Mirrorless with IBIS`, `${brand} Budget Mirrorless for Beginners`, `${brand} Full Frame Mirrorless Portrait Kit`],
    Tripods: [`${brand} Aluminium Tripod with Ball Head`, `${brand} Compact Travel Tripod`, `${brand} Professional Carbon Fiber Tripod`, `${brand} Flexible Gorilla Tripod`, `${brand} Video Fluid Head Tripod`, `${brand} Tabletop Mini Tripod`, `${brand} Heavy Duty Studio Tripod`, `${brand} Smartphone + Camera Tripod`, `${brand} Monopod with Feet Tripod`, `${brand} Vlogging Selfie Tripod Stand`],
    Lens: [`${brand} 50mm f/1.8 Prime Portrait Lens`, `${brand} 24-70mm f/2.8 Zoom Lens`, `${brand} 70-200mm Telephoto Lens`, `${brand} Wide Angle 16-35mm Lens`, `${brand} Macro 100mm Lens`, `${brand} All-in-One 18-200mm Lens`, `${brand} 85mm f/1.4 Portrait Lens`, `${brand} Ultra Wide 14mm Lens`, `${brand} 35mm f/1.4 Street Lens`, `${brand} Telephoto 150-600mm Lens`],
    Routers: [`${brand} Dual Band WiFi 5 Router`, `${brand} WiFi 6 AX3000 Router`, `${brand} Mesh WiFi 6 Router 2-Pack`, `${brand} 4G LTE Backup WiFi Router`, `${brand} Gaming Router with QoS`, `${brand} Gigabit Dual Band Router`, `${brand} WiFi 6E Tri-Band Router`, `${brand} Budget N300 Home Router`, `${brand} Parental Control Smart Router`, `${brand} Enterprise Dual WAN Router`],
  };

  if (namePatterns[subcategory]) {
    return { name: namePatterns[subcategory][idx], brand, price: null };
  }

  const genericName = `${brand} ${adj} ${subcategory} ${variant} Edition`;
  return { name: genericName, brand, price: null };
}

let globalIdx = 0;
const products = [];
const usedSlugs = new Set();

for (const [section, categories] of Object.entries(CATALOG)) {
  for (const [category, subcategories] of Object.entries(categories)) {
    for (const subcategory of subcategories) {
      const brands = getBrandPool(section, category);
      const [priceMin, priceMax] = PRICE_RANGES[subcategory] || [199, 9999];

      for (let i = 0; i < 10; i++) {
        const brand = brands[i % brands.length];
        const generated = generateProductName(subcategory, brand, i, section);
        const resolvedCategory = resolveCategory(section, category);
        const price = generated.price ?? randomPrice(priceMin, priceMax, globalIdx + i * 3);
        const disc = discountPrice(price, i);
        let baseSlug = slugify(`${generated.name}-${subcategory}`);
        let slug = baseSlug;
        let suffix = 1;
        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix++}`;
        }
        usedSlugs.add(slug);

        products.push({
          name: generated.name,
          slug,
          description: generateDescription(generated.name, generated.brand, resolvedCategory, subcategory, i),
          brand: generated.brand,
          category: resolvedCategory,
          subcategory,
          price,
          discount_price: disc,
          stock: stock(globalIdx),
          sku: sku(resolvedCategory, subcategory, i),
          rating: rating(globalIdx),
          review_count: reviewCount(globalIdx),
          vendor_id: vendorId(globalIdx),
          thumbnail: 'https://dummyimage.com/600x600',
          is_active: true,
        });
        globalIdx++;
      }
    }
  }
}

const outPath = path.join(__dirname, '..', 'prisma', 'seed-products.json');
fs.writeFileSync(outPath, JSON.stringify(products), 'utf8');
console.log(`Generated ${products.length} products -> ${outPath}`);
