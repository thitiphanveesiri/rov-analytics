import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLatestVideos, titleMatchesKeywords } from "@/lib/youtube";
import { getValidAccessToken } from "@/lib/googleAuth";

// ── GET /api/cron/youtube-sync ──
// Called by Vercel Cron on a schedule (see vercel.json) — NOT by a logged-in
// user, so auth here is the CRON_SECRET header Vercel sends automatically
// when a Cron Job is configured, not a session check.
//
// For every team with at least one watched YouTube channel: pull the
// channel's latest uploads, keep only titles starting with one of the
// team's configured keywords, skip anything already synced before, and
// append the rest to TeamData.videos.
//
// Deliberately does a targeted read-then-append of just the `videos`
// field (not a full TeamData overwrite) — this runs independently of any
// user's save, so touching only this one field keeps it safe to run
// concurrently with someone actively editing other parts of the team's
// data at the same time.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    where: { youtubeChannels: { some: {} } },
    select: { id: true, youtubeKeywords: true, youtubeChannels: true },
  });

  const summary = [];
  let idCounter = 0; // monotonic, avoids id collisions when multiple channels/teams add videos within the same run (Date.now() alone isn't fine-grained enough for a tight loop)
  const nextId = () => Date.now() * 1000 + (idCounter++);

  for (const team of teams) {
    let addedForTeam = 0;
    const errors = [];

    for (const channel of team.youtubeChannels) {
      try {
        const accessToken = await getValidAccessToken(channel.userId);
        if (!accessToken) {
          // Owner disconnected their Google account since adding this
          // channel — nothing we can do until they reconnect. Not an
          // error worth alerting on every 15-minute run, just skip it.
          continue;
        }

        const videos = await fetchLatestVideos(accessToken, channel.uploadsPlaylistId, 10);
        const matching = videos.filter(v => titleMatchesKeywords(v.title, team.youtubeKeywords));
        if (matching.length === 0) continue;

        // Filter out anything already synced before (checked in bulk, one
        // query per channel instead of one per video)
        const alreadySynced = await prisma.youtubeSyncedVideo.findMany({
          where: { teamId: team.id, youtubeId: { in: matching.map(v => v.youtubeId) } },
          select: { youtubeId: true },
        });
        const syncedIds = new Set(alreadySynced.map(s => s.youtubeId));
        const newVideos = matching.filter(v => !syncedIds.has(v.youtubeId));
        if (newVideos.length === 0) continue;

        // Append to TeamData.videos — read current value, add the new
        // entries, write back just that field.
        const teamData = await prisma.teamData.findUnique({
          where: { teamId: team.id },
          select: { videos: true },
        });
        const existingVideos = Array.isArray(teamData?.videos) ? teamData.videos : [];
        const newEntries = newVideos.map(v => ({
          id: nextId(),
          title: v.title,
          url: v.url,
          date: v.publishedAt ? v.publishedAt.slice(0, 10) : null,
          type: "youtube-auto",
          note: `นำเข้าอัตโนมัติจากช่อง ${channel.channelTitle || channel.channelId}`,
          tags: [],
        }));

        await prisma.teamData.update({
          where: { teamId: team.id },
          data: { videos: [...newEntries, ...existingVideos] },
        });

        await prisma.youtubeSyncedVideo.createMany({
          data: newVideos.map(v => ({ teamId: team.id, youtubeId: v.youtubeId })),
          skipDuplicates: true,
        });

        addedForTeam += newEntries.length;
      } catch (err) {
        console.error(`YouTube sync failed for team ${team.id}, channel ${channel.channelId}:`, err);
        errors.push(channel.channelId);
      }
    }

    if (addedForTeam > 0 || errors.length > 0) {
      summary.push({ teamId: team.id, added: addedForTeam, errors });
    }
  }

  return NextResponse.json({ ok: true, teamsChecked: teams.length, summary });
}
