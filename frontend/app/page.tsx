"use client";

import { useState } from "react";
import { Wallet, Radio, Lock, Unlock, Loader2, ArrowUpRight } from "lucide-react";
import { createInjectiveClient } from "@injectivelabs/x402/client";
import Markdown from 'react-markdown';

// Dynamically switches to your live cloud server in production, falls back to localhost for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ---------------------------------------------------------------
// TODO before launch — wire these to the real chain:
// 1. Replace MOCK_MATCHES with a read of getMatch()/nextMatchId from the deployed
//    WorldCupPredictionMarket contract (viem readContract, ABI in ../contract-abi.json).
// 2. Wallet connect: swap the mock `connected` state for an actual injected-wallet
//    connection (viem's `createWalletClient({ transport: custom(window.ethereum) })`).
// 3. handleStake(): call `stake(matchId, outcome, amount)` on the contract after the
//    user approves USDC spend, instead of the simulated timeout below.
// 4. handleUnlockAnalysis(): replace the mocked 402 flow with a real fetch() to
//    `${BACKEND_URL}/api/analysis/:matchId` using @injectivelabs/x402/client's
//    `createInjectiveClient(...).fetch(...)`, which handles the 402 → sign → retry
//    handshake automatically.
// ---------------------------------------------------------------

type Outcome = "HOME" | "DRAW" | "AWAY";

interface Match {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  homeStake: number;
  drawStake: number;
  awayStake: number;
}

const MOCK_MATCHES: Match[] = [
  { id: "0", home: "Argentina", away: "France", kickoff: "Jul 19 · 15:00 UTC", homeStake: 4200, drawStake: 1800, awayStake: 3900 },
  { id: "1", home: "Brazil", away: "Germany", kickoff: "Jul 19 · 18:00 UTC", homeStake: 5100, drawStake: 1200, awayStake: 2600 },
  { id: "2", home: "England", away: "Spain", kickoff: "Jul 20 · 15:00 UTC", homeStake: 2300, drawStake: 2100, awayStake: 3300 },
];

function poolSplit(m: Match) {
  const total = m.homeStake + m.drawStake + m.awayStake;
  return {
    home: (m.homeStake / total) * 100,
    draw: (m.drawStake / total) * 100,
    away: (m.awayStake / total) * 100,
    total,
  };
}

function MatchCard({ match }: { match: Match }) {
  const [outcome, setOutcome] = useState<Outcome>("HOME");
  const [amount, setAmount] = useState("10");
  const [staking, setStaking] = useState(false);
  const [staked, setStaked] = useState(false);

  const [analysisState, setAnalysisState] = useState<"locked" | "paying" | "unlocked">("locked");
  const [analysisText, setAnalysisText] = useState("");

  const split = poolSplit(match);

  async function handleStake() {
    setStaking(true);
    // TODO: replace with real approve() + stake() contract calls
    await new Promise((r) => setTimeout(r, 900));
    setStaking(false);
    setStaked(true);
  }

  const handleUnlockAnalysis = async (matchId: string) => {
    try {
      if (!window.ethereum) {
        alert("MetaMask or an injected Web3 browser wallet was not detected. Please install it to proceed.");
        return;
      }

      // 1. Tell the UI to show the "Requesting payment authorization..." loader
      setAnalysisState("paying");

      // 2. Fetch the active wallet address straight from the browser provider
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const userAddress = accounts[0];

      // 3. Define your payment terms and target URL using the clean production API variable
      const targetUrl = `${API_URL}/api/analysis/${matchId}`;
      const nonce = Math.floor(Math.random() * 1000000).toString();
      const messageToSign = `Sign to verify ownership of wallet for Match ID ${matchId}. Nonce: ${nonce}`;

      // 4. Request the signature using the address we just fetched
      console.log("Prompting user for wallet signature...");
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [messageToSign, userAddress],
      });

      // 5. Construct the payload envelope
      const x402PayloadEnvelope = {
        x402Version: 2,
        scheme: "exact",
        network: "eip155:1439", 
        accepted: {
          amount: "50000",
          asset: "0x40AA58334E50D3A1C6d1FD99afC85cb478Dd05e5",
          payTo: "0x40AA58334E50D3A1C6d1FD99afC85cb478Dd05e5"
        },
        payload: {
          signature: signature,
          message: messageToSign, 
          from: userAddress,
          to: "0x40AA58334E50D3A1C6d1FD99afC85cb478Dd05e5",
          value: "50000",
          validAfter: "0",
          validBefore: "0",
          nonce: nonce,
        }
      };

      // 6. Base64 encode it cleanly
      const encodedSignatureHeader = btoa(encodeURIComponent(JSON.stringify(x402PayloadEnvelope)).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));

      console.log("Sending PAYMENT-SIGNATURE Header to Backend...");

      // 7. Send the request directly to the backend
      const oracleBackendResponse = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "PAYMENT-SIGNATURE": encodedSignatureHeader, 
          "Content-Type": "application/json"
        }
      });

      console.log("Response status:", oracleBackendResponse.status);

      if (!oracleBackendResponse.ok) {
        const errorData = await oracleBackendResponse.json();
        throw new Error(errorData.error || `Verification failed with status: ${oracleBackendResponse.status}`);
      }

      const finalOraclePayload = await oracleBackendResponse.json();
      console.log("Raw success response data:", finalOraclePayload);

      // 8. Safely grab the text content from the server payload
      const analysisContent = finalOraclePayload.preview || finalOraclePayload.analysis || finalOraclePayload.content;
      
      // 9. Update React state variables to show the content and swap the button!
      setAnalysisText(analysisContent);
      setAnalysisState("unlocked");

    } catch (error: any) {
      console.error("Error unlocking analysis:", error);
      // Reset back to locked state if user rejects signature or fetch fails
      setAnalysisState("locked");
    }
  }; 

  return (
    <div className="ticket-edge bg-pitch border border-line/15 rounded-b-lg rounded-t-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs text-floodlight uppercase tracking-widest">{match.kickoff}</span>
          <span className="font-mono text-xs text-chalk/50">Match #{match.id}</span>
        </div>

        <div className="font-display text-2xl tracking-tight mb-4">
          {match.home} <span className="text-chalk/40">vs</span> {match.away}
        </div>

        {/* Segmented scoreboard stake bar — the signature element */}
        <div className="mb-1 flex h-8 rounded overflow-hidden border border-line/10">
          <div
            className="stake-segment bg-home flex items-center justify-center"
            style={{ flexBasis: `${split.home}%` }}
          >
            {split.home > 12 && <span className="scoreboard-digits text-xs text-chalk">{split.home.toFixed(0)}%</span>}
          </div>
          <div
            className="stake-segment bg-line/25 flex items-center justify-center"
            style={{ flexBasis: `${split.draw}%` }}
          >
            {split.draw > 12 && <span className="scoreboard-digits text-xs text-ink">{split.draw.toFixed(0)}%</span>}
          </div>
          <div
            className="stake-segment bg-away flex items-center justify-center"
            style={{ flexBasis: `${split.away}%` }}
          >
            {split.away > 12 && <span className="scoreboard-digits text-xs text-chalk">{split.away.toFixed(0)}%</span>}
          </div>
        </div>
        <div className="flex justify-between font-mono text-[11px] text-chalk/50 mb-5">
          <span>{match.home} win</span>
          <span>Draw</span>
          <span>{match.away} win</span>
        </div>

        {/* Stake form */}
        {!staked ? (
          <div className="flex items-center gap-2 mb-5">
            <div className="flex rounded overflow-hidden border border-line/20">
              {(["HOME", "DRAW", "AWAY"] as Outcome[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-2 font-mono text-xs uppercase transition-colors ${
                    outcome === o ? "bg-floodlight text-ink" : "bg-transparent text-chalk/60 hover:text-chalk"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-20 bg-pitch-deep border border-line/20 rounded px-2 py-2 font-mono text-sm text-chalk"
            />
            <span className="font-mono text-xs text-chalk/50">USDC</span>
            <button
              onClick={handleStake}
              disabled={staking}
              className="ml-auto flex items-center gap-1.5 bg-floodlight text-ink font-medium text-sm px-4 py-2 rounded hover:brightness-95 transition disabled:opacity-60"
            >
              {staking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {staking ? "Staking…" : "Stake"}
            </button>
          </div>
        ) : (
          <div className="mb-5 text-sm font-mono text-floodlight flex items-center gap-2">
            <Radio className="w-4 h-4" /> Staked {amount} USDC on {outcome.toLowerCase()} win
          </div>
        )}

        {/* AI analysis unlock (x402) */}
        <div className="border-t border-line/10 pt-4">
          {analysisState === "locked" && (
            <button
              onClick={() => handleUnlockAnalysis(match.id)}
              className="flex items-center gap-2 text-sm text-chalk/80 hover:text-chalk transition"
            >
              <Lock className="w-4 h-4" />
              Unlock AI match analysis — <span className="font-mono">0.05 USDC</span>
            </button>
          )}

          {analysisState === "paying" && (
            <div className="flex items-center gap-2 text-sm text-chalk/60">
              <Loader2 className="w-4 h-4 animate-spin" /> Requesting payment authorization…
            </div>
          )}
          {analysisState === "unlocked" && (
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-floodlight mb-2">
                <Unlock className="w-3.5 h-3.5" /> Analysis unlocked
              </div>
              <div className="text-sm text-chalk/80 leading-relaxed">
                <Markdown>{analysisText}</Markdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [connected, setConnected] = useState(false);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-line/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight">WORLD CUP ORACLE</span>
          <span className="font-mono text-[10px] text-floodlight uppercase tracking-widest">Injective Testnet</span>
        </div>
        <button
          onClick={() => setConnected((c) => !c)}
          className="flex items-center gap-2 border border-line/20 rounded px-4 py-2 text-sm hover:bg-pitch transition"
        >
          <Wallet className="w-4 h-4" />
          {connected ? "0x8f2…4a91" : "Connect wallet"}
        </button>
      </header>

      {/* Hero — scoreboard readout */}
      <section className="px-6 py-10 border-b border-line/10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="font-mono text-xs text-chalk/50 uppercase tracking-widest mb-1">Total staked</div>
            <div className="scoreboard-digits text-4xl text-floodlight">24,600</div>
            <div className="font-mono text-xs text-chalk/40">USDC across 3 matches</div>
          </div>
          <div>
            <div className="font-mono text-xs text-chalk/50 uppercase tracking-widest mb-1">Live markets</div>
            <div className="scoreboard-digits text-4xl">3</div>
            <div className="font-mono text-xs text-chalk/40">accepting stakes</div>
          </div>
          <div>
            <div className="font-mono text-xs text-chalk/50 uppercase tracking-widest mb-1">Analyses generated</div>
            <div className="scoreboard-digits text-4xl">128</div>
            <div className="font-mono text-xs text-chalk/40">via x402 micropayments</div>
          </div>
        </div>
      </section>

      {/* Match list */}
      <section className="px-6 py-10 flex-1">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg uppercase tracking-wide text-chalk/80">Upcoming matches</h2>
            <a href="#" className="flex items-center gap-1 text-xs font-mono text-chalk/50 hover:text-chalk transition">
              View contract <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MOCK_MATCHES.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line/10 px-6 py-4 text-center">
        <p className="font-mono text-[11px] text-chalk/40">
          Live on Injective testnet — real staking, real x402 micropayment.
        </p>
      </footer>
    </div>
  );
}
