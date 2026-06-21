import { supabase } from './supabase';

export async function uploadImage(bucket: string, path: string, uri: string): Promise<string | null> {
  try {
    // ArrayBuffer is more reliable than Blob in React Native
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Failed to read file: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  } catch (error) {
    console.error(`uploadImage error [${bucket}/${path}]:`, error);
    return null;
  }
}
