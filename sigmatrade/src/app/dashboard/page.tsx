import { loadConfig } from '@/lib/config';
import AgentSidebar, { type AgentId, type AgentMeta } from '@/components/agents/AgentSidebar';
import NewsFeed from '@/components/agents/NewsFeed';
import MarketView from '@/components/market/MarketView';
import ProfileButton from '@/components/ui/ProfileButton';

export default async function DashboardPage() {
  const config = loadConfig();
  const tickers = config.watchlist.tickers;
  const features = config.features;

  const agents: AgentMeta[] = [
    {
      id: 'news' as AgentId,
      name: 'News Agent',
      enabled: features.news_agent.enabled,
      badgeCount: 0, // live z newsStore — obsługiwane w AgentSidebar
      badgeVariant: 'default',
    },
    {
      id: 'technical' as AgentId,
      name: 'Technical Agent',
      enabled: features.technical_agent.enabled,
      badgeCount: 0,
      badgeVariant: 'default',
    },
    {
      id: 'sentiment' as AgentId,
      name: 'Sentiment Agent',
      enabled: features.sentiment_agent.enabled,
      badgeCount: 0,
      badgeVariant: 'default',
    },
    {
      id: 'orchestrator' as AgentId,
      name: 'Orchestrator',
      enabled: features.orchestrator_agent.enabled,
      badgeCount: 0,
      badgeVariant: 'default',
    },
    {
      id: 'coach' as AgentId,
      name: 'Coach Agent',
      enabled: features.coach_agent.enabled,
      badgeCount: 0,
      badgeVariant: 'default',
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      {/* TopBar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-gray-100 tracking-wide">
            StockPilot AI
          </span>
          <span className="font-mono text-xs text-gray-600">v0.1.0</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">
              Paper Trading
            </span>
          </div>
        </div>
        <ProfileButton />
      </header>

      {/* Main 2-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Market View — 60% */}
        <div className="w-[60%] border-r border-border-subtle overflow-hidden">
          <MarketView tickers={tickers} />
        </div>

        {/* Right panel — Agent Workspace — 40% */}
        <div className="w-[40%] flex overflow-hidden">
          {/* Agent Sidebar — 80px wide */}
          <div className="w-20 shrink-0 border-r border-border-subtle overflow-y-auto">
            <AgentSidebar agents={agents} />
          </div>

          {/* Chat area — fills remaining space */}
          <div className="flex-1 overflow-hidden">
            <NewsFeed
              intervalSeconds={features.news_agent.fetch_interval_seconds}
              autoFetch={features.news_agent.auto_fetch}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
