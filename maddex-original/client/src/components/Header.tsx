import logoImg from "@assets/454B9EBA-20A2-4DAD-BBBC-B59154BC7F7A_4_5005_c_1761799206805.jpeg";

export default function Header() {
  return (
    <header className="border-b border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img 
            src={logoImg} 
            alt="Pulse Logo" 
            className="h-12 w-12 object-contain"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Maddex</h1>
          <p className="text-xs text-muted-foreground">Powered by MaddenAI</p>
        </div>
      </div>
    </header>
  );
}
