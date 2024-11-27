import fetch from "node-fetch";
import { fetchPlaylistsWithTracks } from "./get-youtube-playlist.js";


const failedTracks = [];


async function updateSpotifyPlaylists(oauth2Client, spotifyAccessToken) {
  const playlists = await fetchPlaylistsWithTracks(oauth2Client);

  for (const playlist of playlists) {
    console.log(`Syncing playlist: ${playlist.title}`);

    const trackUris = [];
    for (const track of playlist.tracks) {
      const trackId = await searchSpotifyTrack(track.title, spotifyAccessToken);
      if (trackId) {
        trackUris.push(`spotify:track:${trackId}`);
      }
    }

    await createOrUpdateSpotifyPlaylist(
      playlist.title,
      trackUris,
      spotifyAccessToken
    );
  }
}

async function searchSpotifyTrack(query, spotifyAccessToken) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=1`,
      {
        headers: { Authorization: `Bearer ${spotifyAccessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search Spotify for query: ${query}`);
    }

    const data = await response.json();
    const track = data.tracks.items[0];
    return track ? track.id : null;
  } catch (error) {
    console.error("Error searching Spotify track:", error);
    failedTracks.push({ query, error: error.message });
    return null;
  }
}

async function createOrUpdateSpotifyPlaylist(
  title,
  trackUris,
  spotifyAccessToken
) {
  try {
    const userProfileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${spotifyAccessToken}` },
    });
    const userProfile = await userProfileResponse.json();

    const playlistsResponse = await fetch(
      "https://api.spotify.com/v1/me/playlists",
      {
        headers: { Authorization: `Bearer ${spotifyAccessToken}` },
      }
    );
    const playlists = await playlistsResponse.json();
    const existingPlaylist = playlists.items.find((p) => p.name === title);

    let playlistId;

    if (existingPlaylist) {
      playlistId = existingPlaylist.id;
      console.log(`Updating playlist: ${title}`);
    } else {
      const createResponse = await fetch(
        `https://api.spotify.com/v1/users/${userProfile.id}/playlists`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${spotifyAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: title, public: false }),
        }
      );
      const newPlaylist = await createResponse.json();
      playlistId = newPlaylist.id;
      console.log(`Created playlist: ${title}`);
    }

    if (trackUris.length > 0) {
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: trackUris }),
      });
      console.log(`Playlist "${title}" updated.`);
    }
    console.log('Creating playlists and adding tracks is done.')
  } catch (error) {
    console.error(`Error updating playlist "${title}":`, error);
  }
}

export { updateSpotifyPlaylists, failedTracks };


