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

// 🚪 1. LOGIN REDIRECT TO SPOTIFY
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

// 🔄 2. CALLBACK TO GET TOKENS
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

    console.log('✅ Spotify Access Token fetched:', access_token ? '✔️' : '❌');

    res.redirect('/');
  } catch (err) {
    console.error('❌ Token fetch error:', err);
    res.status(500).send('Token exchange failed');
  }
});

// 🧪 3. TEST TOKEN ENDPOINT
app.get('/token', (req, res) => {
  if (!access_token) {
    return res.status(401).json({ error: 'Token not available. Please /login first.' });
  }
  res.json({ access_token });
});

// 🎧 4. FETCH PLAYLIST DATA
app.get('/playlist', async (req, res) => {
  const playlistId = '5ZLzQVTP13MFjQLOeCsygX'; // Change this to your desired playlist

  if (!access_token) {
    return res.status(401).json({ error: 'Access token missing. Please login first.' });
  }

  try {
    const spotifyRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!spotifyRes.ok) {
      const error = await spotifyRes.json();
      console.warn('⚠️ Spotify API failed:', spotifyRes.status);
      console.log('👉 Error details:', error);
      return res.status(spotifyRes.status).json({ error: error.error.message });
    }

    const playlistData = await spotifyRes.json();
    res.json(playlistData);
  } catch (err) {
    console.error('❌ Playlist fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch playlist from Spotify' });
  }
});

app.listen(port, () => {
  console.log(`🔥 Server running at http://localhost:${port}`);
});
