-- Organised Trips: Coorg Monsoon & Hammiyala Wilderness + Baramahal Forts Exploration Ride
-- Run this after ensuring at least one approved guide exists in the guides table.
-- The DO block picks the first approved guide automatically.
-- Update cover_photos URLs after uploading your flyer/event images to Supabase storage.

DO $$
DECLARE
  v_guide_id UUID;
  v_coorg_id  UUID;
  v_bara_id   UUID;
BEGIN

  -- ─── Pick an approved guide (the TrekRiderz organiser account) ───────────────
  SELECT id INTO v_guide_id
  FROM public.guides
  WHERE status = 'approved'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_guide_id IS NULL THEN
    RAISE EXCEPTION
      'No approved guide found. Please approve a guide profile in the admin panel first, then re-run this migration.';
  END IF;

  -- ════════════════════════════════════════════════════════════════════════════════
  -- EXPEDITION 1: Coorg Monsoon & Hammiyala Wilderness  (July 11–12, 2026)
  -- ════════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.guided_expeditions (
    guide_id, title, description, destination,
    lat, lng,
    cover_photos,
    start_date, end_date,
    difficulty, max_seats, booked_seats, status,
    what_to_bring,
    cancellation_policy,
    meeting_point
  ) VALUES (
    v_guide_id,
    'Coorg Monsoon & Hammiyala Wilderness',
    'One Epic Trek + Off-Road Village Exploration through the Western Ghats. '
    || 'We trail through dense coffee estates, cross silent Shola forests, and walk the raw open ridge line to Kopatty Peak. '
    || 'Heavy fog and rain are guaranteed — insane frames for the vlog! '
    || 'Day 2 takes us deep into Hammiyala: muddy estate tracks, perennial freshwater stream crossings, '
    || 'and the hidden Hammiyala waterfalls. No commercial tourists, just pure offbeat footage and intense stream-crossing action. '
    || 'Location may change due to animal movement restriction & weather conditions, but fun is FULL GUARANTEE!',
    'Coorg (Kodagu), Karnataka',
    12.4244, 75.7382,
    '[]'::jsonb,  -- upload your event flyer/photos and replace this
    '2026-07-11',
    '2026-07-12',
    'moderate',
    20, 0, 'published',
    '["Full-face helmet, riding jacket, gloves, and hard shoes (mandatory for rider + pillion)",
      "High-quality raincoat / rain liners",
      "Plastic dry bags to double-wrap all clothes and cameras",
      "Leech socks or a packet of salt for the forest trails",
      "Power bank and fully charged phone",
      "Personal medications and first-aid basics"]'::jsonb,
    'Non-refundable once confirmed. Trip may be rescheduled (not cancelled) due to severe weather. '
    || 'Emergency exit is always available.',
    'Varthur Meetup Point, Bangalore (exact pin shared on WhatsApp group)'
  )
  RETURNING id INTO v_coorg_id;

  -- Package for Coorg trip
  INSERT INTO public.expedition_packages (
    expedition_id, name, price_per_person, inclusions, exclusions, sort_order
  ) VALUES (
    v_coorg_id,
    'All-Inclusive Pool Fee',
    3500,
    '["1 Night comfortable group stay at a traditional estate homestay / dorm",
      "2 Breakfasts (Day 1 Kodava breakfast + Day 2 heavy breakfast)",
      "1 Heavy Saturday Estate Lunch",
      "1 Saturday Group Dinner",
      "Forest department entry fees",
      "Local guide charges for Kopatty",
      "Village entry tokens",
      "Shared group fuel allowance pool (managed by club trackers)",
      "First-aid kits and anti-leech emergency spray",
      "Basic mechanical backup tools"]'::jsonb,
    '["Personal fuel beyond the shared pool",
      "Alcoholic beverages",
      "Personal shopping",
      "Any expenses not listed under inclusions"]'::jsonb,
    0
  );

  -- Itinerary for Coorg trip
  INSERT INTO public.expedition_itinerary_days (
    expedition_id, day_number, title, description, activities,
    accommodation, meals_included, distance_km, elevation_gain_m
  ) VALUES
  (
    v_coorg_id, 0,
    'Day 0 – The Night Flight (Friday, July 10)',
    'Gather at the Varthur meetup point for rain gear check and rider safety briefing. '
    || 'Roll out at 10 PM on an overnight cruise via Mysore Expressway toward our Coorg jungle base camp (~280 km).',
    '["Rain gear check at Varthur", "Rider safety briefing", "Night ride via Mysore Expressway (~280 km)"]'::jsonb,
    'Arrive at estate homestay early morning',
    '[]'::jsonb,
    280, 0
  ),
  (
    v_coorg_id, 1,
    'Day 1 – The Great Ridge Trek (Saturday, July 11)',
    'Arrive at the Western Ghats estate homestay at 6 AM. Fresh up and enjoy hot local Kodava breakfast. '
    || 'Kopatty Peak Trek (~12 KM total, 8 AM – 1:30 PM): trail through dense coffee estates, cross silent Shola forests, '
    || 'walk the raw open ridge line to the peak. Heavy fog and rain guaranteed. '
    || 'Return to base for a heavy traditional estate lunch at 2 PM. '
    || 'Evening: unwind, dry gear, prep camera rigs. Group dinner and indoor acoustic session.',
    '["Arrive at estate homestay 6 AM", "Hot Kodava breakfast", "Kopatty Peak Trek ~12 KM", "Traditional estate lunch", "Group dinner & acoustic session"]'::jsonb,
    'Estate homestay / dorm',
    '["Breakfast", "Lunch", "Dinner"]'::jsonb,
    12, 900
  ),
  (
    v_coorg_id, 2,
    'Day 2 – Hammiyala Village Exploration (Sunday, July 12)',
    'Heavy breakfast and morning hot filter coffee at 7:30 AM. '
    || '9 AM – 1:30 PM: Head deep into Hammiyala — riding through muddy estate tracks, '
    || 'crossing perennial freshwater streams, visiting hidden Hammiyala waterfalls. '
    || 'No commercial tourists. Quick town lunch at 2 PM, pack bags in waterproof layers. '
    || 'Departure push back to Bangalore at 3:30 PM, returning to Varthur by 9:30 PM.',
    '["Heavy breakfast + filter coffee", "Hammiyala off-road village exploration", "Stream crossings + waterfall visit", "Town lunch", "Departure to Bangalore 3:30 PM", "Return to Varthur 9:30 PM"]'::jsonb,
    NULL,
    '["Breakfast", "Lunch"]'::jsonb,
    60, 200
  );

  -- ════════════════════════════════════════════════════════════════════════════════
  -- EXPEDITION 2: Baramahal Forts Exploration Ride  (July 5, 2026)
  -- ════════════════════════════════════════════════════════════════════════════════
  INSERT INTO public.guided_expeditions (
    guide_id, title, description, destination,
    lat, lng,
    cover_photos,
    start_date, end_date,
    difficulty, max_seats, booked_seats, status,
    what_to_bring,
    cancellation_policy,
    meeting_point
  ) VALUES (
    v_guide_id,
    'Baramahal Forts Exploration Ride',
    'One Day Trip — Ride. Trek. Explore. Repeat. '
    || '~250 km through smooth highways, scenic interior country roads, and raw rocky fort trails. '
    || 'Route: Varthur → Bolumalai Fort (Sunrise Overlook) → Krishnagiri Dam & Park → '
    || 'Rayakottai Fort (Heritage Trek, ~45 min ascent, massive ancient stone gateways & British-era ruins) → '
    || 'Ankushagiri Fort (The Offbeat Monolith — lonely peak temple with sheer cliff-drop backdrop). '
    || 'Perfect for all riders and trekkers. Easy to Moderate difficulty.',
    'Baramahal Region, Karnataka–Tamil Nadu Border',
    12.05, 78.03,
    '[]'::jsonb,  -- upload your event flyer/photos and replace this
    '2026-07-05',
    '2026-07-05',
    'easy',
    25, 0, 'published',
    '["Full-face helmet, sturdy shoes, jacket, gloves (mandatory — pillions must wear helmets too)",
      "Valid DL, RC, and insurance copy (digital or physical)",
      "Comfortable clothing suitable for trekking",
      "Small backpack with water bottle and a cap",
      "Action cameras, phone storage, and power banks (fully charged)",
      "Cash for fuel, food, and entry fees"]'::jsonb,
    'Non-refundable once confirmed. Trip is weather-dependent; severe conditions may lead to rescheduling.',
    'Near Varthur, Bangalore (exact coordinates shared on WhatsApp group before the ride)'
  )
  RETURNING id INTO v_bara_id;

  -- Packages for Baramahal trip (estimated costs per person)
  INSERT INTO public.expedition_packages (
    expedition_id, name, price_per_person, inclusions, exclusions, sort_order
  ) VALUES
  (
    v_bara_id,
    'With Pillion (Estimated)',
    800,
    '["Shared fuel cost (estimated ₹400–₹800 split with pillion)",
      "Breakfast stop",
      "Lunch",
      "Snacks & hydration",
      "Entry & parking fees (₹30–₹50)"]'::jsonb,
    '["Club maintenance fee (optional, your choice)",
      "Personal shopping",
      "Any expenses above the estimate"]'::jsonb,
    0
  ),
  (
    v_bara_id,
    'Solo Rider (Estimated)',
    1300,
    '["Solo fuel cost (estimated ₹400–₹800)",
      "Breakfast stop",
      "Lunch",
      "Snacks & hydration",
      "Entry & parking fees (₹30–₹50)"]'::jsonb,
    '["Club maintenance fee (optional, your choice)",
      "Personal shopping",
      "Any expenses above the estimate"]'::jsonb,
    1
  );

  -- Itinerary for Baramahal trip
  INSERT INTO public.expedition_itinerary_days (
    expedition_id, day_number, title, description, activities,
    accommodation, meals_included, distance_km, elevation_gain_m
  ) VALUES
  (
    v_bara_id, 1,
    'Day 1 – Baramahal Forts Full Day (Sunday, July 5)',
    '04:30 AM: Gathering & Briefing near Varthur. '
    || '05:00 AM: Flag Off — roll out early to beat the Bangalore city border traffic. '
    || '07:00–08:15 AM: Spot 1 — Bolumalai Fort (Sunrise Overlook): quick 15-min hike to the peak, catch morning fog lifting off the farmlands — perfect for group photos and cinematic introductory drone shots. '
    || '08:30–09:15 AM: Breakfast Stop at a traditional South Indian hotel (hot idlis, dosas, filter coffee). '
    || '09:30–10:45 AM: Spot 2 — Krishnagiri Dam & Park: relaxing stroll along the massive reservoir park, group tracking shots. '
    || '11:30 AM–1:30 PM: Spot 3 — Rayakottai Fort (The Heritage Trek): moderate difficulty, ~45 min ascent, massive ancient stone gateways, British-era ruins, natural cave structures overlooking the valley. '
    || '01:45–02:45 PM: Lunch Break — heavy South Indian meals or Biryani. '
    || '03:15–05:15 PM: Spot 4 — Ankushagiri Fort (The Offbeat Monolith): scenic interior road, slightly steep adventurous climb, lonely peak temple with sheer cliff-drop backdrop. '
    || '05:30 PM: Sunset Debrief & Outro — final club photos and video wrap-up as the sun sets over Shoolagiri hills. '
    || '06:00 PM: Return Journey — reach Bangalore by 08:00 PM.',
    '["4:30 AM – Gathering & Briefing at Varthur",
      "5:00 AM – Flag Off",
      "7:00–8:15 AM – Bolumalai Fort (Sunrise Overlook)",
      "8:30–9:15 AM – Breakfast Stop (idlis, dosas, filter coffee)",
      "9:30–10:45 AM – Krishnagiri Dam & Park",
      "11:30 AM–1:30 PM – Rayakottai Fort Heritage Trek",
      "1:45–2:45 PM – Lunch Break",
      "3:15–5:15 PM – Ankushagiri Fort (Offbeat Monolith)",
      "5:30 PM – Sunset Debrief & Club Photos",
      "6:00 PM – Return to Bangalore (arrive by 8 PM)"]'::jsonb,
    NULL,
    '["Breakfast", "Lunch"]'::jsonb,
    250, 600
  );

  RAISE NOTICE 'Organised trips inserted successfully. guide_id used: %', v_guide_id;
  RAISE NOTICE 'Coorg expedition id: %', v_coorg_id;
  RAISE NOTICE 'Baramahal expedition id: %', v_bara_id;
  RAISE NOTICE 'Remember to upload cover photos to Supabase storage and update cover_photos JSONB for both expeditions.';

END $$;
