import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

let access_token = '';
let refresh_token = '';

const scopes = 'user-read-playback-state user-modify-playback-state streaming';

// 🟢 1. LOGIN REDIRECT TO SPOTIFY
app.get('/login', (req, res) => {
  const authUrl = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scopes,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }).toString();
  res.redirect(authUrl);
});

// 🔁 2. GET TOKEN FROM CODE
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send('No code in callback');

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString()
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('⚠️ Token error:', tokenData);
      return res.status(400).json({ error: tokenData.error_description });
    }

    access_token = tokenData.access_token;
    refresh_token = tokenData.refresh_token;

    console.log('✅ Access token fetched');

    // 🔄 After successful login, redirect to your Aeon frontend
    res.redirect('https://spotify-clone-by-kahan.iceiy.com'); // <-- 🔁 replace with your actual frontend URL
  } catch (err) {
    console.error('❌ Token fetch error:', err);
    res.status(500).send('Token exchange failed');
  }
});

// 🔄 3. REFRESH TOKEN LOGIC
async function refreshAccessToken() {
  if (!refresh_token) return;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }).toString()
    });

    const data = await res.json();
    if (data.access_token) {
      access_token = data.access_token;
      console.log('♻️ Access token refreshed');
    } else {
      console.warn('⚠️ Could not refresh access token:', data);
    }
  } catch (err) {
    console.error('❌ Failed to refresh token:', err);
  }
}

// 🔐 4. PROVIDE TOKEN
app.get('/token', async (req, res) => {
  if (!access_token) return res.status(401).json({ error: 'No token. Login at /login' });

  await refreshAccessToken(); // optional refresh
  res.json({ access_token });
});

// 🎵 5. PLAYLIST FETCH
app.get('/playlist', async (req, res) => {
  const playlistId = '5ZLzQVTP13MFjQLOeCsygX';

  if (!access_token) return res.status(401).json({ error: 'Login required' });

  try {
    const spotifyRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await spotifyRes.json();

    if (!spotifyRes.ok) {
      console.warn('⚠️ API error:', data);
      return res.status(spotifyRes.status).json({ error: data.error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('❌ Playlist fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

app.listen(port, () => {
  console.log(`🔥 Server running at http://localhost:${port}`);
});
