// World Cup Oracle backend
// Serves AI-generated match analysis, gated behind custom signatures.
//
// Free endpoints: match list, odds/pool sizes (drives engagement, no paywall)
// Paid endpoint:  /api/analysis/:matchId — AI-generated prediction writeup, 0.05 USDC/request

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
    // Allow requests with no origin (like mobile apps or curl requests)
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
    'PAYMENT-SIGNATURE' // Allows the frontend to send the signature back
  ],
  exposedHeaders: [
    'PAYMENT-REQUIRED',  // Allows the frontend to read the payment terms/destination
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
  "0": { homeTeam: "Argentina", awayTeam: "France", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0" },
  "1": { homeTeam: "Brazil", awayTeam: "Germany", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0" },
  "2": { homeTeam: "England", awayTeam: "Spain", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0" },
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

  console.log(`--> Received request for Match ID URL parameter: "${matchId}" (Type: ${typeof matchId})`);

  if (!signatureHeader) {
    return res.status(402).json({ error: "PAYMENT-SIGNATURE header is required" });
  }

  // Fallback check: look it up as a string key or directly
  const matchDetails = matches[matchId] || matches[String(matchId).trim()];
  
  if (!matchDetails) {
    console.error(`❌ Database Lookup Failed! Active keys are:`, Object.keys(matches));
    return res.status(404).json({ error: "Requested match configuration not found." });
  }

  console.log(`✅ Found match details for ID ${matchId}:`, matchDetails);

  try {
    // 1. Decode and verify signature payload
    const base64Decoded = Buffer.from(signatureHeader, 'base64').toString('utf-8');
    const decodedJSON = decodeURIComponent(base64Decoded);
    
    const envelope = JSON.parse(decodedJSON);
    const { signature, message } = envelope.payload;
    const userAddress = envelope.payload.from;

    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(401).json({ error: "Invalid signature or unauthorized wallet" });
    }

    console.log("Verification successful. Querying Gemini for analysis...");

    // Generate content using the new Google Gen AI SDK syntax and free-tier flash model
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a premium, comprehensive sports betting analysis for the upcoming tournament match: ${matchDetails.homeTeam} vs ${matchDetails.awayTeam}. Focus heavily on structural tactical setups and metric trends.`,
      config: {
        systemInstruction: "You are an elite football metrics analyst and sports oracle. Provide razor-sharp, analytical insights tracking team form, key tactical matchups, set-piece variance, and expected goals (xG) profiles. Conclude with a clear, logical, and reasoned prediction.",
        temperature: 0.7,
      }
    });

    // Safely extract the generated prediction text
    const verifiedAnalysis = response.text;
    
    return res.json({
      message: "Payment verified successfully",
      analysis: verifiedAnalysis 
    });

  } catch (error) {
    console.error("Internal processing failure:", error);
    return res.status(400).json({ error: "Backend failed to compile payload or authenticate terms." });
  } 
});

// --- THE SERVER START ---
app.listen(PORT, () => {
  console.log(`Backend server running cleanly on port ${PORT}`);
});
