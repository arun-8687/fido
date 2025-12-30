import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Hardcoded path to match the VPS setup we've been using (~/clawd/usage-history.json)
// Using os.homedir() ensures getting the right user directory (/home/ubuntu)
const HISTORY_FILE = path.join(os.homedir(), "clawd", "usage-history.json");

export type HistoryEntry = {
    type: "inbound" | "outbound" | "system";
    timestamp: string; // ISO string
    from?: string; // JID or name
    to?: string; // JID or name
    sender?: string; // User JID in group
    body: string;
    metadata?: any;
};

// Ensure directory exists
try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
} catch (err) {
    console.error("Failed to ensure history directory:", err);
}

export function logToHistory(entry: HistoryEntry) {
    try {
        const line = JSON.stringify(entry);
        fs.appendFileSync(HISTORY_FILE, line + "\n", "utf8");
    } catch (err) {
        console.error("Failed to write to history:", err);
    }
}
