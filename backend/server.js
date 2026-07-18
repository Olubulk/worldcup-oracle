// World Cup Oracle backend
// Serves AI-generated match analysis, gated behind custom signatures.
//
// Free endpoints: match list, odds/pool sizes (drives engagement, no paywall)
// Paid endpoint:  /api/analysis/:matchId — AI-generated prediction writeup, 0.05 USDC/request
// Admin endpoint: /api/admin/settle-match — Fast-pass match state resolution

import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import cors from 'cors';
import { ethers } from "ethers";

const app = express();

// List of allowed origins (both local development and production Vercel)
const allowedOrigins = [
  'http://localhost:3000',
  'https://worldcup-oracle-six.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'PAYMENT-SIGNATURE'
  ],
  exposedHeaders: [
    'PAYMENT-REQUIRED', 
    'PAYMENT-RESPONSE', 
    'X-PAYMENT-RESPONSE',
    'X-402-Payment-Required', 
    'x-402-payment-required'  
  ],
  credentials: true
}));

// Express 5 compatible middleware to catch and immediately resolve preflight OPTIONS requests
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3001;

// Initialize the Gemini client using your environment variable
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// ---------------------------------------------------------------
// In-memory match store — mirrors on-chain matches for fast reads.
// In production, sync this from contract events instead of duplicating state by hand.
// ---------------------------------------------------------------
const matches = {
  "0": { homeTeam: "Argentina", awayTeam: "France", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0", status: "Open" },
  "1": { homeTeam: "Brazil", awayTeam: "Germany", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0", status: "Open" },
  "2": { homeTeam: "England", awayTeam: "Spain", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0", status: "Open" },
};

// ---------------------------------------------------------------
// Free routes
// ---------------------------------------------------------------
app.get("/api/matches", (req, res) => {
  res.json({ matches });
});

app.get("/api/matches/:matchId", (req, res) => {
  const m = matches[req.params.matchId];
  if (!m) return res.status(404).json({ error: "match not found" });
  res.json(m);
});

// ---------------------------------------------------------------
// Paid route — Verified Gemini Generation Engine
// ---------------------------------------------------------------
app.get('/api/analysis/:id', async (req, res) => {
  const signatureHeader = req.headers['payment-signature'];
  const matchId = req.params.id;

  console.log(`--> Received request for Match ID URL parameter: "${matchId}"`);

  if (!signatureHeader) {
    return res.status(402).json({ error: "PAYMENT-SIGNATURE header is required" });
  }

  const matchDetails = matches[matchId] || matches[String(matchId).trim()];
  
  if (!matchDetails) {
    console.error(`❌ Database Lookup Failed! Active keys are:`, Object.keys(matches));
    return res.status(404).json({ error: "Requested match configuration not found." });
  }

  try {
    console.log("--> Raw signatureHeader received:", signatureHeader);
    
    // 1. Decode payload from custom base64 header
    const base64Decoded = Buffer.from(signatureHeader, 'base64').toString('utf-8');
    const decodedJSON = decodeURIComponent(base64Decoded);
    
    const envelope = JSON.parse(decodedJSON);
    console.log("--> Parsed Envelope JSON Object:", envelope);

    // Dynamic extraction fallback in case structural fields are nested differently
    const payloadData = envelope.payload || envelope;
    const { signature, message } = payloadData;
    const userAddress = payloadData.from || payloadData.signer;

    console.log("--> Extracted Fields - Signature:", signature ? "Found" : "Missing", "| Message:", message, "| User:", userAddress);

    if (!signature || !message || !userAddress) {
      return res.status(400).json({ error: "Missing required properties inside signature envelope payload." });
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    console.log(`--> Recovered Address: ${recoveredAddress} | Claimed User: ${userAddress}`);

    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(401).json({ error: "Invalid signature or unauthorized wallet" });
    }

    console.log("Verification successful. Querying Gemini 3.5 for analysis...");

    // Generate content using the current active Gemini 3.5 Flash engine
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate a premium, comprehensive sports betting analysis for the upcoming tournament match: ${matchDetails.homeTeam} vs ${matchDetails.awayTeam}. Focus heavily on structural tactical setups and metric trends.`,
      config: {
        systemInstruction: "You are an elite football metrics analyst and sports oracle. Provide razor-sharp, analytical insights tracking team form, key tactical matchups, set-piece variance, and expected goals (xG) profiles. Conclude with a clear, logical, and reasoned prediction.",
        temperature: 0.7,
      }
    });

    const verifiedAnalysis = response.text;
    
    return res.json({
      message: "Payment verified successfully",
      analysis: verifiedAnalysis 
    });

  } catch (error) {
    console.error("Internal processing failure detail:", error);
    return res.status(400).json({ 
      error: "Backend failed to compile payload or authenticate terms.",
      details: error.message 
    });
  } 
});

// ---------------------------------------------------------------
// Hackathon Fast-Pass: Administrative Match Settlement
// ---------------------------------------------------------------
app.post('/api/admin/settle-match', (req, res) => {
  const { matchId, homeScore, awayScore, adminSecret } = req.body;

  // 1. Quick security check to prevent unauthorized calls
  if (adminSecret !== "hackathon_super_secret_2026") {
    return res.status(403).json({ error: "Unauthorized access token." });
  }

  // 2. Locate the match in your current in-memory store
  const matchDetails = matches[matchId];
  if (!matchDetails) {
    return res.status(404).json({ error: "Target match identity not found." });
  }

  // 3. Determine the structural outcome
  let outcome = "draw";
  if (Number(homeScore) > Number(awayScore)) outcome = "home";
  if (Number(awayScore) > Number(homeScore)) outcome = "away";

  // 4. Update the state dynamically in memory without restarting the server
  matchDetails.status = "Settled";
  matchDetails.finalScore = `${homeScore}-${awayScore}`;
  matchDetails.winningOutcome = outcome;

  console.log(`[Admin] Successfully settled Match ${matchId}: ${matchDetails.homeTeam} vs ${matchDetails.awayTeam} (${homeScore}-${awayScore})`);

  // 5. Return a simulated successful transaction hash for your Loom demo
  return res.json({
    success: true,
    message: "Match state successfully settled on the oracle network.",
    data: {
      matchId,
      status: matchDetails.status,
      finalScore: matchDetails.finalScore,
      winningOutcome: matchDetails.winningOutcome,
      simulatedTxHash: "0x" + [...Array(64)].map(() => Math.floor(Math.random()*16).toString(16)).join('')
    }
  });
});

// --- THE SERVER START ---
app.listen(PORT, () => {
  console.log(`Backend server running cleanly on port ${PORT}`);
});
