-- Affiliate Products & Click Tracking
-- Admins add products; each product maps to packing/gear item keywords

CREATE TABLE IF NOT EXISTS public.affiliate_products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name  TEXT NOT NULL,
  brand         TEXT,
  store         TEXT NOT NULL CHECK (store IN ('amazon', 'decathlon', 'flipkart', 'myntra', 'offline', 'other')),
  store_label   TEXT NOT NULL,           -- display name: "Amazon India", "Decathlon", etc.
  image_url     TEXT,
  price_inr     INTEGER,                 -- approx price in INR (shown to user)
  affiliate_url TEXT NOT NULL,           -- tracked affiliate / referral link
  item_keywords TEXT[] NOT NULL DEFAULT '{}',  -- match against packing item names
  trip_types    TEXT[] NOT NULL DEFAULT '{}',  -- filter by trip type; empty = all
  category      TEXT,                    -- 'footwear', 'gear', 'clothing', 'safety', etc.
  is_active     BOOLEAN DEFAULT true,
  sort_order    INTEGER DEFAULT 0,       -- higher = shown first
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES public.affiliate_products(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id),
  trip_id     UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  item_name   TEXT,                      -- which packing item triggered this
  clicked_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_products_active  ON public.affiliate_products (is_active, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_product   ON public.affiliate_clicks (product_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user      ON public.affiliate_clicks (user_id, clicked_at DESC);

-- RLS
ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active affiliate products"
  ON public.affiliate_products FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage affiliate products"
  ON public.affiliate_products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert their own clicks"
  ON public.affiliate_clicks FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins can view all clicks"
  ON public.affiliate_clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ── SEED DATA ──────────────────────────────────────────────────────────────
-- Replace affiliate_url values with your actual Amazon Associates / Decathlon
-- affiliate links before going live. Placeholder URLs are used here.

INSERT INTO public.affiliate_products
  (product_name, brand, store, store_label, price_inr, affiliate_url, item_keywords, trip_types, category, sort_order)
VALUES
  -- TREKKING FOOTWEAR
  ('Trekking Shoes Forclaz 500', 'Decathlon', 'decathlon', 'Decathlon India', 3999,
   'https://www.decathlon.in/p/8392733/forclaz-500-trekking-shoes',
   ARRAY['trekking shoe', 'trek shoe', 'hiking shoe', 'shoe'], ARRAY['trek'], 'footwear', 10),

  ('Quechua NH500 Hiking Shoes', 'Quechua', 'decathlon', 'Decathlon India', 2999,
   'https://www.decathlon.in/p/8493214/nh500-hiking-shoes',
   ARRAY['hiking shoe', 'shoe', 'walking shoe', 'trek shoe'], ARRAY['trek', 'weekend'], 'footwear', 9),

  ('Columbia Montrail Trail Running Shoes', 'Columbia', 'amazon', 'Amazon India', 6499,
   'https://amzn.to/trekshoes-placeholder',
   ARRAY['trekking shoe', 'trail shoe', 'shoe'], ARRAY['trek'], 'footwear', 8),

  -- BACKPACKS
  ('Quechua Arpenaz 40L Trekking Backpack', 'Quechua', 'decathlon', 'Decathlon India', 2499,
   'https://www.decathlon.in/p/8388561/40l-trekking-backpack',
   ARRAY['backpack', 'rucksack', '40l', '40-60l', 'bag'], ARRAY['trek', 'backpacking'], 'gear', 10),

  ('Wildcraft 45L Trekking Backpack', 'Wildcraft', 'amazon', 'Amazon India', 1899,
   'https://amzn.to/wildcraft45-placeholder',
   ARRAY['backpack', 'rucksack', '45l', 'bag'], ARRAY['trek', 'backpacking'], 'gear', 9),

  ('Decathlon 70L Hiking Backpack', 'Quechua', 'decathlon', 'Decathlon India', 4499,
   'https://www.decathlon.in/p/8388562/70l-trekking-backpack',
   ARRAY['backpack', '70l', '50-70l', 'rucksack'], ARRAY['backpacking'], 'gear', 10),

  -- TREKKING POLES
  ('Forclaz Trek 700 Trekking Poles Pair', 'Forclaz', 'decathlon', 'Decathlon India', 1999,
   'https://www.decathlon.in/p/8388563/trekking-poles',
   ARRAY['trekking pole', 'pole', 'walking stick', 'trek pole'], ARRAY['trek'], 'gear', 10),

  ('Black Diamond Trail Trekking Poles', 'Black Diamond', 'amazon', 'Amazon India', 4999,
   'https://amzn.to/bdpoles-placeholder',
   ARRAY['trekking pole', 'pole', 'walking stick'], ARRAY['trek'], 'gear', 8),

  -- HEADLAMPS
  ('Petzl Actik Core 450 Lumen Headlamp', 'Petzl', 'amazon', 'Amazon India', 3500,
   'https://amzn.to/petzlactik-placeholder',
   ARRAY['headlamp', 'flashlight', 'torch', 'lamp'], ARRAY['trek', 'backpacking'], 'gear', 10),

  ('Quechua Onnight 100 Headlamp', 'Quechua', 'decathlon', 'Decathlon India', 699,
   'https://www.decathlon.in/p/8388571/headlamp-onnight-100',
   ARRAY['headlamp', 'lamp', 'torch', 'flashlight'], ARRAY['trek', 'backpacking', 'weekend'], 'gear', 9),

  -- RAIN JACKET
  ('Quechua MH500 Rain Jacket', 'Quechua', 'decathlon', 'Decathlon India', 2999,
   'https://www.decathlon.in/p/8388565/rain-jacket-mh500',
   ARRAY['rain jacket', 'jacket', 'waterproof', 'poncho', 'raincoat'], ARRAY['trek', 'bike', 'backpacking'], 'clothing', 10),

  ('Columbia Watertight II Rain Jacket', 'Columbia', 'amazon', 'Amazon India', 5499,
   'https://amzn.to/columbiarain-placeholder',
   ARRAY['rain jacket', 'jacket', 'waterproof'], ARRAY['trek', 'bike'], 'clothing', 8),

  -- THERMAL WEAR
  ('Decathlon Techfresh 50 Thermal Top', 'Quechua', 'decathlon', 'Decathlon India', 999,
   'https://www.decathlon.in/p/8388566/thermal-top',
   ARRAY['thermal', 'thermal wear', 'base layer', 'inner layer'], ARRAY['trek'], 'clothing', 10),

  ('Wildcraft Merino Wool Thermal Set', 'Wildcraft', 'amazon', 'Amazon India', 1499,
   'https://amzn.to/wildcraft-thermal-placeholder',
   ARRAY['thermal', 'thermal wear', 'base layer'], ARRAY['trek'], 'clothing', 8),

  -- SUNSCREEN
  ('Lotus Herbals Safe Sun SPF 70', 'Lotus Herbals', 'amazon', 'Amazon India', 399,
   'https://amzn.to/lotussunscreen-placeholder',
   ARRAY['sunscreen', 'spf', 'sun protection', 'sunblock'], ARRAY['trek', 'bike', 'backpacking', 'weekend', 'temple'], 'toiletries', 10),

  ('Decathlon Sport 50+ Sunscreen', 'Decathlon', 'decathlon', 'Decathlon India', 349,
   'https://www.decathlon.in/p/8388569/sunscreen-sport',
   ARRAY['sunscreen', 'spf', 'sun protection'], ARRAY['trek', 'bike', 'weekend'], 'toiletries', 9),

  -- WATER BOTTLE
  ('Decathlon 1L Ecozen Trek Bottle', 'Quechua', 'decathlon', 'Decathlon India', 699,
   'https://www.decathlon.in/p/8388570/water-bottle-1l',
   ARRAY['water bottle', 'bottle', 'flask', 'hydration'], ARRAY['trek', 'backpacking', 'weekend', 'temple'], 'gear', 10),

  ('Nalgene 32oz Wide Mouth Bottle', 'Nalgene', 'amazon', 'Amazon India', 1299,
   'https://amzn.to/nalgene32-placeholder',
   ARRAY['water bottle', 'bottle', '2l', 'hydration'], ARRAY['trek', 'backpacking'], 'gear', 8),

  -- POWER BANK
  ('Ambrane 20000mAh Power Bank', 'Ambrane', 'amazon', 'Amazon India', 1199,
   'https://amzn.to/ambrane20k-placeholder',
   ARRAY['power bank', 'powerbank', 'portable charger', 'battery pack'], ARRAY['trek', 'bike', 'backpacking', 'weekend'], 'electronics', 10),

  ('Anker 26800mAh Power Bank', 'Anker', 'amazon', 'Amazon India', 2999,
   'https://amzn.to/anker26800-placeholder',
   ARRAY['power bank', 'powerbank', 'portable charger', 'battery'], ARRAY['trek', 'backpacking'], 'electronics', 9),

  -- BIKE HELMET
  ('Steelbird SBA-21 Full Face Helmet', 'Steelbird', 'amazon', 'Amazon India', 2499,
   'https://amzn.to/steelbirdhel-placeholder',
   ARRAY['helmet', 'bike helmet', 'riding helmet', 'head protection'], ARRAY['bike'], 'safety', 10),

  ('Royal Enfield Pudding Helmet', 'Royal Enfield', 'amazon', 'Amazon India', 3999,
   'https://amzn.to/rehelmeet-placeholder',
   ARRAY['helmet', 'bike helmet', 'riding helmet'], ARRAY['bike'], 'safety', 8),

  -- RIDING JACKET
  ('Rynox Air GT Riding Jacket', 'Rynox', 'amazon', 'Amazon India', 5999,
   'https://amzn.to/rynoxairgt-placeholder',
   ARRAY['riding jacket', 'jacket', 'biker jacket', 'moto jacket'], ARRAY['bike'], 'clothing', 10),

  -- FIRST AID
  ('Lifeline First Aid Kit 85-piece', 'Lifeline', 'amazon', 'Amazon India', 899,
   'https://amzn.to/lifeline85-placeholder',
   ARRAY['first aid', 'first aid kit', 'medical kit', 'emergency kit'], ARRAY['trek', 'bike', 'backpacking', 'weekend'], 'safety', 10),

  -- SUNGLASSES
  ('PETER JONES Sports Sunglasses UV400', 'Peter Jones', 'amazon', 'Amazon India', 499,
   'https://amzn.to/peterjonesuv-placeholder',
   ARRAY['sunglasses', 'glasses', 'eye protection', 'shades'], ARRAY['trek', 'bike', 'backpacking'], 'accessories', 10),

  -- TREKKING PANTS
  ('Decathlon MH500 Hiking Pants', 'Quechua', 'decathlon', 'Decathlon India', 1499,
   'https://www.decathlon.in/p/8388572/hiking-pants',
   ARRAY['hiking pant', 'trekking pant', 'pant', 'trouser'], ARRAY['trek', 'backpacking'], 'clothing', 10),

  -- MONEY BELT
  ('Pacsafe Coversafe Money Belt', 'Pacsafe', 'amazon', 'Amazon India', 1299,
   'https://amzn.to/pacsafe-placeholder',
   ARRAY['money belt', 'travel belt', 'security belt', 'passport holder'], ARRAY['backpacking'], 'accessories', 10),

  -- QUICK-DRY CLOTHES
  ('Wildcraft Quick Dry T-Shirt Pack', 'Wildcraft', 'amazon', 'Amazon India', 999,
   'https://amzn.to/wildcraftqd-placeholder',
   ARRAY['quick dry', 'quick-dry', 'dri-fit', 't-shirt', 'tshirt'], ARRAY['backpacking', 'weekend'], 'clothing', 9),

  -- PADLOCK
  ('Godrej NavTal 3-Dial Combination Lock', 'Godrej', 'amazon', 'Amazon India', 349,
   'https://amzn.to/godrejlock-placeholder',
   ARRAY['padlock', 'lock', 'combination lock', 'luggage lock'], ARRAY['backpacking'], 'accessories', 10),

  -- UNIVERSAL ADAPTER
  ('Portronics Adapto Universal Travel Adapter', 'Portronics', 'amazon', 'Amazon India', 699,
   'https://amzn.to/portroadaptor-placeholder',
   ARRAY['universal adapter', 'travel adapter', 'adapter', 'adaptor'], ARRAY['backpacking'], 'electronics', 10)

ON CONFLICT DO NOTHING;
