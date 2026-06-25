import { useState } from 'react';
import WatchlistButton from '../WatchlistButton';

export default function WatchlistButtonExample() {
  const [watchlist, setWatchlist] = useState<string[]>(['NVDA']);
  
  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };
  
  return (
    <div className="p-4 flex gap-4">
      <WatchlistButton
        symbol="NVDA"
        isInWatchlist={watchlist.includes('NVDA')}
        onToggle={toggleWatchlist}
      />
      <WatchlistButton
        symbol="BTC"
        isInWatchlist={watchlist.includes('BTC')}
        onToggle={toggleWatchlist}
      />
    </div>
  );
}
