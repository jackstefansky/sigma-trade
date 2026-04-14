// ============================================================
// Config loader — czyta config.yaml RAZ przy pierwszym imporcie
// i cache'uje. Działa tylko po stronie serwera (fs).
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { NewsAgentConfig, WatchlistTicker } from './news/types';

export interface AppConfig {
	app: {
		name: string;
		version: string;
		environment: 'development' | 'staging' | 'production';
		locale: 'en' | 'pl';
		currency: string;
	};
	data_provider: {
		name: string;
		base_url: string;
		rate_limit: { requests_per_minute: number };
		endpoints: Record<string, string>;
	};
	ai_provider: {
		provider: 'gemini' | 'claude';
		gemini: { model: string; max_tokens: number; temperature: number };
		claude: { model: string; max_tokens: number; temperature: number };
	};
	watchlist: { tickers: WatchlistTicker[] };
	features: {
		news_agent: NewsAgentConfig;
		technical_agent: { enabled: boolean };
		sentiment_agent: { enabled: boolean };
		orchestrator_agent: { enabled: boolean };
		coach_agent: { enabled: boolean };
		strategy_agent: { enabled: boolean };
		onboarding: {
			enabled: boolean;
			knowledge_quiz: boolean;
			strategy_setup: boolean;
			guided_first_trade: boolean;
		};
		ui: {
			dark_mode: boolean;
			agent_workspace_position: 'right' | 'left';
			show_debug_panel: boolean;
		};
	};
	dev: {
		use_mock_data: boolean;
		verbose_logging: boolean;
		artificial_delay_ms: number;
		max_api_calls_per_session: number;
	};
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
	if (cached) return cached;
	const configPath = path.join(process.cwd(), 'config.yaml');
	const raw = fs.readFileSync(configPath, 'utf-8');
	cached = parse(raw) as AppConfig;
	return cached;
}

// Convenience accessors — czytelniej w wywołaniach
export const getNewsAgentConfig = (): NewsAgentConfig =>
	loadConfig().features.news_agent;

export const getWatchlist = (): WatchlistTicker[] =>
	loadConfig().watchlist.tickers;

export const getAiProvider = () => loadConfig().ai_provider;
