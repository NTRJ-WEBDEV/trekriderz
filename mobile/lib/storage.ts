import { supabase } from './supabase';

export async function uploadImage(bucket: string, path: string, uri: string): Promise<string | null> {
  return uploadMedia(bucket, path, uri, 'image/jpeg');
}

// Generic upload — used for story video clips alongside images
export async function uploadMedia(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<string | null> {
  try {
    // ArrayBuffer is more reliable than Blob in React Native
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Failed to read file: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  } catch (error) {
    console.error(`uploadMedia error [${bucket}/${path}]:`, error);
    return null;
  }
}
