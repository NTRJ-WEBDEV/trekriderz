import { uploadImage, uploadMedia } from '../storage';

// One reusable upload layer over lib/storage.ts's uploadImage/uploadMedia
// primitives (fetch + arrayBuffer + supabase.storage.upload — unchanged).
// Each function here just fixes the bucket/path/content-type convention
// for one content type, matching exactly what each screen already does
// today, so new call sites stop hand-rolling bucket names and paths
// inline and existing ones can move over without a behavior change.
//
// Thumbnail generation, video transcoding, compression, and CDN delivery
// are explicitly future work — this consolidates the upload CALL, not the
// pipeline behind it (no new library added, per the Phase 1 audit finding
// that none exists in the codebase).

export function uploadFeedImage(userId: string, uri: string): Promise<string | null> {
  return uploadImage('feed-posts', `${userId}/post-${Date.now()}.jpg`, uri);
}

export function uploadReelVideo(userId: string, uri: string): Promise<string | null> {
  return uploadMedia('feed-posts', `${userId}/reel-${Date.now()}.mp4`, uri, 'video/mp4');
}

export function uploadStoryMedia(userId: string, uri: string, contentType: string): Promise<string | null> {
  const ext = contentType.startsWith('video') ? 'mp4' : 'jpg';
  return uploadMedia('feed-stories', `${userId}/story-${Date.now()}.${ext}`, uri, contentType);
}

export function uploadTravelStoryPhoto(userId: string, index: number, uri: string): Promise<string | null> {
  return uploadImage('travel-stories', `${userId}/${Date.now()}-${index}.jpg`, uri);
}

export function uploadProfilePhoto(userId: string, uri: string): Promise<string | null> {
  return uploadImage('avatars', `${userId}/${Date.now()}.jpg`, uri);
}

export function uploadGuidePhoto(userId: string, uri: string, contentType: string): Promise<string | null> {
  return uploadMedia('guide-photos', `${userId}/${Date.now()}.${contentType.split('/')[1] || 'jpg'}`, uri, contentType);
}

export function uploadVerificationDocument(userId: string, uri: string, contentType: string, label: string): Promise<string | null> {
  return uploadMedia('guide-documents', `${userId}/${label}-${Date.now()}.${contentType.split('/')[1] || 'jpg'}`, uri, contentType);
}

export function uploadHomestayPhoto(userId: string, uri: string, contentType: string): Promise<string | null> {
  return uploadMedia('homestays', `${userId}/${Date.now()}.${contentType.split('/')[1] || 'jpg'}`, uri, contentType);
}

export function uploadRentalPhoto(userId: string, uri: string, contentType: string): Promise<string | null> {
  return uploadMedia('vehicle-photos', `${userId}/${Date.now()}.${contentType.split('/')[1] || 'jpg'}`, uri, contentType);
}

export function uploadTripGalleryPhoto(tripId: string, uri: string, contentType: string): Promise<string | null> {
  return uploadMedia('trip-photos', `${tripId}/${Date.now()}.${contentType.split('/')[1] || 'jpg'}`, uri, contentType);
}

export function uploadPoiPhoto(userId: string, uri: string): Promise<string | null> {
  return uploadImage('poi-photos', `${userId}/${Date.now()}.jpg`, uri);
}

export function uploadChatImage(tripId: string, uri: string): Promise<string | null> {
  return uploadImage('chat-images', `${tripId}/${Date.now()}.jpg`, uri);
}
