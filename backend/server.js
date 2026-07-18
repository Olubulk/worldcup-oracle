// World Cup Oracle backend
// Serves AI-generated match analysis, gated behind custom signatures.
//
// Free endpoints: match list, odds/pool sizes (drives engagement, no paywall)
// Paid endpoint:  /api/analysis/:matchId — AI-generated prediction writeup, 0.05 USDC/request

import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import cors from 'cors';
import { ethers } from "ethers";

const app = express();

app.use(cors({
  origin: 'http://localhost:3000', // Allows your Next.js frontend to talk to this backend
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

app.use(express.json());

const PORT = process.env.PORT || 3001;
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ---------------------------------------------------------------
// In-memory match store — mirrors on-chain matches for fast reads.
// In production, sync this from contract events instead of duplicating state by hand.
// ---------------------------------------------------------------
// 📑 Update this block in backend/server.js
const matches = {
  "0": { homeTeam: "Argentina", awayTeam: "France", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0" },
  "1": { homeTeam: "Brazil", awayTeam: "Germany", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0" },
  "2": { homeTeam: "England", awayTeam: "Spain", kickoffTime: null, totalHome: "0", totalAway: "0", totalDraw: "0" }, // <-- Added this!
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
// ---------------------------------------------------------------
// Paid route — Verified Anthropic Generation Engine
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// Paid route — Cleaned Lookup & Generation Engine
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

    console.log("Verification successful. Querying Anthropic for analysis...");

    // Update the configuration block inside backend/server.js
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5", // Or whichever active identifier you used
      max_tokens: 1000,
      system: "You are an elite football metrics analyst and sports oracle. Provide razor-sharp, analytical insights tracking team form, key tactical matchups, set-piece variance, and expected goals (xG) profiles. Conclude with a clear, logical, and reasoned prediction.",
      messages: [
        {
          role: "user",
          content: `Generate a premium, comprehensive sports betting analysis for the upcoming tournament match: ${matchDetails.homeTeam} vs ${matchDetails.awayTeam}. Focus heavily on structural tactical setups and metric trends.`
        }
      ]
    });

    const verifiedAnalysis = response.content[0].text;
    
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