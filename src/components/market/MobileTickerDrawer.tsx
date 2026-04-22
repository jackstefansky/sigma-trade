'use client';
import { useState } from 'react';
import type { WatchlistTicker } from '@/lib/news/types';
import { Menu, X } from 'lucide-react';
import { useChartStore } from '@/store/chartStore';
import { cn } from '@/lib/utils';

interface Props {
	tickers: WatchlistTicker[];
}
export default function MobileTickerDrawer({ tickers }: Props) {
	const activeTicker = useChartStore((s) => s.activeTicker);
	const setActiveTicker = useChartStore((s) => s.setActiveTicker);
	const [isOpen, setIsOpen] = useState(false); // ← tutaj
	return (
		<>
			<button onClick={() => setIsOpen(true)} className='p-1 text-zinc-400 hover:text-accent'>
				<Menu size={20} />
			</button>

			{/* Ciemne tło — klik poza panelem zamyka drawer */}
			<div
				className={cn(
					'fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300',
					isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
				)}
				onClick={() => setIsOpen(false)}
			/>

			{/* Panel — zawsze w DOM, animacja przez translate */}
			<div
				className={cn(
					'fixed top-0 left-0 h-full w-[260px] bg-bg-panel border-r border-border-subtle z-50 md:hidden',
					'transition-transform duration-300 ease-in-out',
					isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none',
				)}
				onClick={e => e.stopPropagation()}
			>
				<div className='flex items-center justify-between px-4 py-3 border-b border-border-subtle'>
					<span className='font-mono text-[11px] text-zinc-500 uppercase tracking-wider'>
						Watchlist
					</span>
					<button onClick={() => setIsOpen(false)} className='text-zinc-500 hover:text-accent p-1'>
						<X size={20} />
					</button>
				</div>
				<div className='flex flex-col overflow-y-auto h-full pb-12'>
					{tickers.map((ticker) => {
						const isActive = ticker.symbol === activeTicker;
						return (
							<button
								key={ticker.symbol}
								onClick={() => {
									setActiveTicker(ticker.symbol);
									setIsOpen(false);
								}}
								className={cn(
									'text-left px-3 py-3 border-b border-border-subtle transition-colors duration-150',
									isActive
										? 'border-l-2 border-l-accent bg-accent/5'
										: 'border-l-2 border-l-transparent hover:bg-zinc-900',
								)}
							>
								<span
									className={cn(
										'block font-mono text-xs font-bold tracking-wide',
										isActive ? 'text-accent' : 'text-zinc-400',
									)}
								>
									{ticker.symbol}
								</span>
								<span className='block font-mono text-[10px] text-zinc-600 truncate mt-0.5'>
									{ticker.name}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</>
	);
}
