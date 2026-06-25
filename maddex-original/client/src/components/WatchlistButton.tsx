import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WatchlistButtonProps {
  symbol: string;
  isInWatchlist: boolean;
  onToggle: (symbol: string) => void;
}

export default function WatchlistButton({ symbol, isInWatchlist, onToggle }: WatchlistButtonProps) {
  const { toast } = useToast();

  const handleClick = () => {
    onToggle(symbol);
    toast({
      title: isInWatchlist ? "Removed from watchlist" : "Added to watchlist",
      description: `${symbol} has been ${isInWatchlist ? "removed from" : "added to"} your watchlist.`,
    });
  };

  return (
    <Button
      variant={isInWatchlist ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      className="gap-2"
      data-testid={`button-watchlist-${symbol.toLowerCase()}`}
    >
      <Star className={`w-4 h-4 ${isInWatchlist ? "fill-current" : ""}`} />
      {isInWatchlist ? "In Watchlist" : "Add to Watchlist"}
    </Button>
  );
}
