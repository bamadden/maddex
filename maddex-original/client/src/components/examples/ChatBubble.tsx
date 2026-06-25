import ChatBubble from '../ChatBubble';

export default function ChatBubbleExample() {
  return (
    <div className="p-4 space-y-4">
      <ChatBubble
        message="Should I buy Tesla stock right now?"
        isUser={true}
      />
      <ChatBubble
        message="Based on current market analysis, Tesla (TSLA) is showing mixed signals. The stock has strong fundamentals with growing EV market share, but faces headwinds from increased competition. Consider your risk tolerance and investment timeline before making a decision."
        isUser={false}
        actionButtons={["Add to Watchlist", "Compare vs NVDA", "Show Chart"]}
        onActionClick={(action) => console.log(`Action clicked: ${action}`)}
      />
    </div>
  );
}
