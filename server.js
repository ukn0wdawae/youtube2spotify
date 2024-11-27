import express from "express";
import bodyParser from "body-parser";
import open from "open";
import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import {
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  YOUTUBE_REDIRECT_URI,
  YOUTUBE_SCOPES,
} from "./constants.js";
import { updateSpotifyPlaylists, failedTracks } from "./update-spotify-playlist.js";

import dotenv from "dotenv";
dotenv.config();


const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

let spotifyAccessToken = null;

// Express setup
const app = express();
app.use(bodyParser.json());

const youtubeOauth2Client = new google.auth.OAuth2(
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REDIRECT_URI
);


// YouTube Authorization Routes
app.get("/youtube-login", async (req, res) => {
  try {
    const refreshTokenPath = path.resolve(".env");
    const envContent = await fs
      .readFile(refreshTokenPath, "utf-8")
      .catch(() => "");

    if (envContent.includes("YOUTUBE_REFRESH_TOKEN")) {
      console.log(
        "YouTube refresh token exists. No need to request a new token."
      );
      res.send(`
        <h1>YouTube Authentication Already Set Up!</h1>
        <p>Your refresh token already exists. You don't need to re-authenticate.</p>
        <p><a href="/">Return to Home</a></p>
      `);
    } else {
      const authUrl = youtubeOauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: YOUTUBE_SCOPES,
        prompt: "consent", // Force refresh token
      });

      res.redirect(authUrl);
    }
  } catch (error) {
    console.error("Error during YouTube login setup:", error);
    res.status(500).send(`
      <h1>Error during YouTube Login</h1>
      <p>An error occurred. Please try again.</p>
    `);
  }
});

app.get("/youtube-callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await youtubeOauth2Client.getToken(code);
    youtubeOauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      const envPath = path.resolve(".env");
      let envContent = await fs.readFile(envPath, "utf-8").catch(() => "");
      envContent = envContent.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, ""); 
      envContent += `\nYOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`;

      await fs.writeFile(envPath, envContent.trim());
      console.log("YouTube refresh token saved successfully.");
    }

    res.send(`
      <h1>YouTube Authentication Successful!</h1>
      <p><a href="/">click here</a> to return to the home page.</p>
    `);
  } catch (error) {
    console.error("Error during YouTube authentication:", error);
    res.status(500).send(`
      <h1>YouTube Authentication Failed</h1>
      <p><a href="/">Return to Home</a></p>
    `);
  }
});


// Spotify Authorization Routes
app.get("/spotify-login", async (req, res) => {
  try {
    const refreshTokenPath = path.resolve(".env");
    const envContent = await fs
      .readFile(refreshTokenPath, "utf-8")
      .catch(() => "");

    if (envContent.includes("SPOTIFY_REFRESH_TOKEN")) {
      console.log(
        "Spotify refresh token exists. No need to request a new token."
      );
      res.send(`
        <h1>Spotify Authentication Already Set Up!</h1>
        <p>Your refresh token already exists. You don't need to re-authenticate.</p>
        <p><a href="/">Return to Home</a></p>
      `);
    } else {
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
        SPOTIFY_REDIRECT_URI
      )}&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(" "))}`;

      res.redirect(authUrl);
    }
  } catch (error) {
    console.error("Error during Spotify login setup:", error);
    res.status(500).send(`
      <h1>Error during Spotify Login</h1>
      <p>An error occurred. Please try again.</p>
    `);
  }
});

app.get("/spotify-callback", async (req, res) => {
  const code = req.query.code;

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error("Failed to exchange Spotify code for tokens");
    }

    const tokens = await response.json();
    spotifyAccessToken = tokens.access_token;

    if (tokens.refresh_token) {
      const envPath = path.resolve(".env");
      let envContent = await fs.readFile(envPath, "utf-8").catch(() => "");
      envContent = envContent.replace(/^SPOTIFY_REFRESH_TOKEN=.*$/m, ""); // Remove existing token if present
      envContent += `\nSPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}\n`;

      await fs.writeFile(envPath, envContent.trim());
      console.log("Spotify refresh token saved successfully.");
    }

    res.send(`
      <h1>Spotify Authentication Successful!</h1>
      <p><a href="/">click here</a> to return to the home page.</p>
    `);
  } catch (error) {
    console.error("Error during Spotify authentication:", error);
    res.status(500).send(`
      <h1>Spotify Authentication Failed</h1>
      <p><a href="/">Return to Home</a></p>
    `);
  }
});

// Root route
app.get("/", (req, res) => {
  res.send(
    `<h1>Welcome</h1>
     <p><a href="/youtube-login">Login to YouTube</a></p>
     <p><a href="/spotify-login">Login to Spotify</a></p>
     <p><a href="/sync-playlists">Manually Sync YouTube Playlists to Spotify</a></p>`
  );
});

app.get("/sync-playlists", async (req, res) => {
  try {
    await updateSpotifyPlaylists(youtubeOauth2Client, spotifyAccessToken);
    res.send("Spotify playlists updated successfully!");

    if (failedTracks.length > 0) {
      console.log("Failed Tracks:", failedTracks);
    }
  } catch (error) {
    console.error("Error syncing playlists:", error);
    res.status(500).send("Failed to sync playlists.");
  }
});

// Start the server
PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`);
});
