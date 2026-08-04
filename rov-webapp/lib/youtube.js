// lib/youtube.js
// OAuth-based (not API-key-based) — this is specifically what lets it see
// UNLISTED videos, which a plain API key can never do (anonymous API key
// access to a channel's uploads only ever returns PUBLIC videos). Uses the
// same Google connection as lib/googleCalendar.js — see lib/googleAuth.js.

const API_BASE = "https://www.googleapis.com/youtube/v3";

// Fetches the connected user's OWN channel — deliberately "mine=true"
// only. There's no path here to add someone else's channel by pasting a
// URL: you can only ever see unlisted videos on a channel by being
// authenticated as that channel's owner, so "connect your account, we
// grab your channel" is the only flow that actually works for the
// unlisted case (this is also just simpler for the person using it —
// one click, no copying channel IDs).
export async function fetchMyChannel(accessToken) {
  const params = new URLSearchParams({ part: "snippet,contentDetails", mine: "true" });
  const res = await fetch(`${API_BASE}/channels?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`YouTube channels.list failed: ${await res.text()}`);
  const data = await res.json();
  const channel = data.items?.[0];
  if (!channel) return null;

  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title || null,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || null,
  };
}

// Fetches the most recent videos from a channel's uploads playlist,
// authenticated as the owner (accessToken) — this is what surfaces
// unlisted uploads alongside public ones. Private videos still won't
// appear here even so; only public + unlisted show in the uploads
// playlist via the API, private videos are excluded regardless of auth.
export async function fetchLatestVideos(accessToken, uploadsPlaylistId, maxResults = 10) {
  const params = new URLSearchParams({
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });
  const res = await fetch(`${API_BASE}/playlistItems?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`YouTube playlistItems.list failed: ${await res.text()}`);
  const data = await res.json();

  return (data.items || []).map(item => ({
    youtubeId: item.snippet?.resourceId?.videoId,
    title: item.snippet?.title || "",
    publishedAt: item.snippet?.publishedAt || null,
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || null,
    url: item.snippet?.resourceId?.videoId
      ? `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
      : null,
  })).filter(v => v.youtubeId);
}

// Case-insensitive "title starts with one of these keywords" check.
export function titleMatchesKeywords(title, keywords) {
  if (!keywords || keywords.length === 0) return false;
  const normalized = title.trim().toLowerCase();
  return keywords.some(k => normalized.startsWith(k.trim().toLowerCase()));
}
