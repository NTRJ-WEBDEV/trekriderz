import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Runs daily at 2 AM via Supabase scheduled function
// Deploy: supabase functions deploy cleanup-trip-photos --schedule "0 2 * * *"

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = cutoff.toISOString().split('T')[0];

  // Find trips whose end_date was 30+ days ago and still have photos
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, photos')
    .lt('end_date', cutoffDate)
    .not('photos', 'is', null)
    .neq('photos', '[]');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let cleaned = 0;

  for (const trip of trips ?? []) {
    const photos = (trip.photos as string[]) ?? [];
    if (!photos.length) continue;

    // Extract storage paths from public URLs
    // URL format: .../storage/v1/object/public/trip-photos/{userId}/{filename}
    const paths = photos
      .map((url: string) => {
        const match = url.match(/\/trip-photos\/(.+)$/);
        return match?.[1] ?? null;
      })
      .filter(Boolean) as string[];

    if (paths.length > 0) {
      const { error: delErr } = await supabase.storage
        .from('trip-photos')
        .remove(paths);
      if (delErr) console.error(`Storage delete error for trip ${trip.id}:`, delErr.message);
    }

    // Clear photos array in DB
    await supabase
      .from('trips')
      .update({ photos: [], updated_at: new Date().toISOString() })
      .eq('id', trip.id);

    cleaned++;
  }

  return new Response(
    JSON.stringify({ cleaned, cutoff: cutoffDate }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
