import { useState, useRef, useEffect } from "react";
import ChatBubble from "@/components/ChatBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Message {
  text: string;
  isUser: boolean;
  actionButtons?: string[];
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hello! I'm your AI financial advisor. Ask me anything about investments, market trends, or portfolio strategies.",
      isUser: false,
      actionButtons: ["Market Overview", "Portfolio Analysis", "Investment Tips"],
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    
    setMessages((prev) => [...prev, { text: userMessage, isUser: true }]);
    
    setIsTyping(true);
    
    setTimeout(() => {
      const aiResponse = generateAIResponse(userMessage);
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string): Message => {
    const input = userInput.toLowerCase();
    
    if (input.includes("tesla") || input.includes("tsla")) {
      return {
        text: "Tesla (TSLA) is currently showing mixed signals. The stock has strong fundamentals with growing EV market share and energy storage business. However, increased competition and valuation concerns exist. Current AI confidence: 68%. Consider your risk tolerance and investment timeline before making a decision.",
        isUser: false,
        actionButtons: ["Add to Watchlist", "Compare vs NVDA", "Show Chart"],
      };
    } else if (input.includes("bitcoin") || input.includes("btc") || input.includes("crypto")) {
      return {
        text: "Bitcoin is experiencing positive momentum with institutional adoption increasing. Current price is $43,250 (+2.1%). Our AI models show 75% confidence for holding. The crypto momentum index is at 56, indicating mildly bullish sentiment. Consider portfolio allocation based on your risk profile.",
        isUser: false,
        actionButtons: ["View Crypto Trends", "Add to Portfolio", "Set Price Alert"],
      };
    } else if (input.includes("portfolio") || input.includes("allocation")) {
      return {
        text: "Your current portfolio allocation is: Equities 56%, Crypto 22%, Cash 7%, Bonds 9%, Alternatives 6%. Based on market conditions and your risk profile, consider rebalancing if crypto allocation exceeds 25% or if cash position falls below 5%.",
        isUser: false,
        actionButtons: ["View Full Portfolio", "Rebalancing Suggestions", "Risk Analysis"],
      };
    } else if (input.includes("market") || input.includes("trend")) {
      return {
        text: "Current market trends show: S&P 500 up 0.49%, NASDAQ up 0.71%, with strong tech sector performance. AI and semiconductor stocks are leading gains. Energy sector showing resilience. Our sector strength analysis ranks Tech (85), Finance (78), and Healthcare (71) as top performers.",
        isUser: false,
        actionButtons: ["View Trends", "Sector Analysis", "Top Movers"],
      };
    } else {
      return {
        text: "I've analyzed your query using real-time market data and AI models. For personalized investment advice, I recommend reviewing your portfolio allocation, current market trends, and consulting with your financial advisor for strategies aligned with your goals.",
        isUser: false,
        actionButtons: ["View Portfolio", "Market Analysis", "News Updates"],
      };
    }
  };

  const handleActionClick = (action: string) => {
    console.log(`Action clicked: ${action}`);
    setInput(action);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="page-chat">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">AI Financial Advisor</h2>
        <p className="text-sm text-muted-foreground">Get intelligent insights powered by MaddenAI</p>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.map((message, index) => (
          <ChatBubble
            key={index}
            message={message.text}
            isUser={message.isUser}
            actionButtons={message.actionButtons}
            onActionClick={handleActionClick}
          />
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card p-4 rounded-lg max-w-[80%]">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about investments, markets, or your portfolio..."
          className="flex-1"
          data-testid="input-chat"
        />
        <Button 
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          data-testid="button-send"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
