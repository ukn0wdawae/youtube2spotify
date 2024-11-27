import { google } from "googleapis";

// Fetch playlists with their tracks
export async function fetchPlaylistsWithTracks(oauth2Client) {
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  let musicPlaylists = [];
  let nextPageToken = null;

  try {
    // Fetch all playlists
    do {
      const response = await youtube.playlists.list({
        part: "snippet",
        mine: true,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const filteredPlaylists = response.data.items.filter((playlist) =>
        playlist.snippet.title.toLowerCase().startsWith("music/")
      );

      // Simplify playlist structure
      musicPlaylists = musicPlaylists.concat(
        filteredPlaylists.map((playlist) => ({
          id: playlist.id,
          title: playlist.snippet.title,
          tracks: [], 
        }))
      );

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Fetch tracks for each playlist
    for (const playlist of musicPlaylists) {
      const tracks = await fetchTracksForPlaylist(oauth2Client, playlist.id);
      playlist.tracks = tracks; // Update tracks for the playlist
    }

    console.log("Playlists with Tracks Fetched:", musicPlaylists);
    return musicPlaylists;
  } catch (error) {
    console.error("Error fetching playlists or tracks:", error);
    return [];
  }
}

// Fetch tracks for a specific playlist
async function fetchTracksForPlaylist(oauth2Client, playlistId) {
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  let tracks = [];
  let nextPageToken = null;

  try {
    do {
      const response = await youtube.playlistItems.list({
        part: "snippet",
        playlistId: playlistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      // Simplify track structure
      tracks = tracks.concat(
        response.data.items.map((item) => ({
          title: item.snippet.title,
          videoId: item.snippet.resourceId.videoId,
        }))
      );

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return tracks;
  } catch (error) {
    console.error(`Error fetching tracks for playlist ${playlistId}:`, error);
    return [];
  }
}
