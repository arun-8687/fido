/**
 * Context Summarization Loader
 *
 * Loads pre-computed summaries from cron job and combines with recent messages.
 * Summaries are stored in ~/.clawdis/sessions/<sessionId>.summary.json
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AppMessage } from "@mariozechner/pi-agent-core";

// Configuration
const SESSIONS_DIR = path.join(os.homedir(), ".clawdis", "sessions");
const KEEP_RECENT_MINUTES = 60; // Keep last hour of messages verbatim

export interface StoredSummary {
    period: string;
    hourKey: string;
    text: string;
    messageCount: number;
    createdAt: string;
}

export interface SummaryFile {
    summaries: StoredSummary[];
    lastSummarizedAt: string | null;
    lastProcessedLine: number;
}

export interface CompactedContext {
    summaryPrefix: string;
    recentMessages: AppMessage[];
    wasSummarized: boolean;
    summaryCount: number;
}

/**
 * Estimate tokens for messages (rough: ~4 chars per token)
 */
function estimateTokens(messages: AppMessage[]): number {
    let chars = 0;
    for (const msg of messages) {
        const content = (msg as { content?: unknown })?.content;
        if (typeof content === "string") {
            chars += content.length;
        } else if (Array.isArray(content)) {
            for (const block of content) {
                if (typeof block === "string") chars += block.length;
                else if (block && typeof block === "object" && "text" in block) {
                    chars += String((block as { text?: unknown }).text ?? "").length;
                }
            }
        }
    }
    return Math.ceil(chars / 4);
}

/**
 * Extract timestamp from a message
 */
function extractTimestamp(msg: AppMessage): Date | null {
    const msgAny = msg as unknown as Record<string, unknown>;
    const ts = msgAny.timestamp ?? msgAny.ts ?? msgAny.createdAt;
    if (ts instanceof Date) return ts;
    if (typeof ts === "string" || typeof ts === "number") {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

/**
 * Load stored summaries for a session
 */
export function loadStoredSummaries(sessionId: string): SummaryFile | null {
    const summaryPath = path.join(SESSIONS_DIR, `${sessionId}.summary.json`);
    try {
        if (!fs.existsSync(summaryPath)) {
            return null;
        }
        const raw = fs.readFileSync(summaryPath, "utf8");
        return JSON.parse(raw) as SummaryFile;
    } catch {
        return null;
    }
}

/**
 * Format summaries as a context prefix for the agent
 */
export function formatSummariesAsContext(summaries: StoredSummary[]): string {
    if (summaries.length === 0) return "";

    // Keep only last 6 summaries (6 hours) to reduce context bloat
    const recentSummaries = summaries.slice(-6);

    const header = "[Context: Earlier conversation summary - for reference only]\n";
    const body = recentSummaries
        .map((s) => `• ${s.period}: ${s.text}`)
        .join("\n");

    return header + body + "\n[End summary - respond briefly to recent messages below]\n";
}

/**
 * Main entry point: Load stored summaries and filter recent messages
 */
export function loadCompactedContext(
    sessionId: string,
    allMessages: AppMessage[],
): CompactedContext {
    // Load pre-computed summaries
    const summaryFile = loadStoredSummaries(sessionId);

    // Find cutoff for recent messages (last hour)
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - KEEP_RECENT_MINUTES * 60 * 1000);

    // Filter to only recent messages
    const recentMessages: AppMessage[] = [];
    for (const msg of allMessages) {
        const ts = extractTimestamp(msg);
        // Keep messages without timestamp (safer) or recent ones
        if (!ts || ts >= cutoffTime) {
            recentMessages.push(msg);
        }
    }

    // If no summaries available, return all messages
    if (!summaryFile || summaryFile.summaries.length === 0) {
        return {
            summaryPrefix: "",
            recentMessages: allMessages,
            wasSummarized: false,
            summaryCount: 0,
        };
    }

    // Format summaries as context
    const summaryPrefix = formatSummariesAsContext(summaryFile.summaries);

    console.log(
        `[context] Loaded ${summaryFile.summaries.length} summaries + ${recentMessages.length} recent messages (from ${allMessages.length} total)`,
    );

    return {
        summaryPrefix,
        recentMessages,
        wasSummarized: true,
        summaryCount: summaryFile.summaries.length,
    };
}

// Re-export for compatibility
export { estimateTokens as estimateMessageTokens };
