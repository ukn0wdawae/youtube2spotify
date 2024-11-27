import { updateSpotifyPlaylists } from "../update-spotify-playlist.js";
import { google } from "googleapis";

// Environment variables
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const YOUTUBE_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;


// Serverless Function
export default async function handler(req, res) {
  try {
    // Refresh Spotify Access Token
    const spotifyAccessToken = await refreshSpotifyToken(SPOTIFY_REFRESH_TOKEN);

    // Set up YouTube OAuth client
    const youtubeOauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );

    // Set YouTube credentials from refresh token
    youtubeOauth2Client.setCredentials({
      refresh_token: YOUTUBE_REFRESH_TOKEN,
    });

    // Sync Playlists
    await updateSpotifyPlaylists(youtubeOauth2Client, spotifyAccessToken);
    res.status(200).send("Automatic Playlist syncing successfully!");
  } catch (error) {
    console.error("Error syncing playlists:", error);
    res.status(500).send("Error syncing playlists.");
  }
}

async function refreshSpotifyToken(refreshToken) {
  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error("Failed to refresh Spotify token");
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing Spotify token:", error);
    throw error;
  }
}
