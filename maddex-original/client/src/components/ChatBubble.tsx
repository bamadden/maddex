import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  actionButtons?: string[];
  onActionClick?: (action: string) => void;
}

export default function ChatBubble({ message, isUser, actionButtons, onActionClick }: ChatBubbleProps) {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <Card 
          className={`p-4 ${
            isUser 
              ? "bg-primary text-primary-foreground" 
              : "bg-card"
          }`}
          style={!isUser ? {
            boxShadow: "0 0 20px rgba(40, 123, 255, 0.15)",
            border: "1px solid rgba(40, 123, 255, 0.2)",
          } : {}}
          data-testid={`chat-bubble-${isUser ? 'user' : 'ai'}`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </Card>
        
        {!isUser && actionButtons && actionButtons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actionButtons.map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                onClick={() => onActionClick?.(action)}
                className="text-xs"
                data-testid={`action-${action.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {action}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
