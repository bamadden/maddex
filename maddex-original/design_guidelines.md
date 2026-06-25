# Pulse – Powered by MaddenAI Design Guidelines

## Design Approach
**Reference-Based**: Modern fintech dashboard inspired by leading financial platforms (Robinhood, Wealthfront, Coinbase) with AI-powered insights similar to Bloomberg Terminal but with consumer-friendly UX.

## Color Palette
- **Primary Background**: #0B1222 (Dark Navy)
- **Accent/Interactive**: #287BFF (Electric Blue)
- **Surface/Cards**: #1E2A44 (Card Background)
- **Primary Text**: #FFFFFF (White)
- **Secondary Text**: #B3B9C4 (Light Gray)

## Typography
- **Font Family**: Inter, Sans-serif
- **Hierarchy**:
  - Page Titles: 32px, Bold, #FFFFFF
  - Section Headers: 24px, Semibold, #FFFFFF
  - Card Titles: 18px, Medium, #FFFFFF
  - Body Text: 16px, Regular, #FFFFFF
  - Secondary/Meta: 14px, Regular, #B3B9C4
  - Small Labels: 12px, Medium, #B3B9C4

## Layout System
- **Spacing**: Use Tailwind units of 2, 4, 6, 8, 12, 16 (e.g., p-4, m-8, gap-6)
- **Container**: Max-width 1280px, centered with px-4 mobile, px-6 tablet, px-8 desktop
- **Grid**: 12-column responsive grid
- **Card Padding**: p-6 mobile, p-8 desktop
- **Section Spacing**: mb-8 between major sections

## Component Library

### Cards
- Background: #1E2A44
- Border Radius: 20px
- Box Shadow: 0 4px 16px rgba(0, 0, 0, 0.3)
- Hover State: Subtle lift with shadow increase
- Padding: 24px

### Navigation (Bottom Fixed)
- Height: 80px
- Background: #1E2A44
- 5 evenly spaced icons: Portfolio (📊), Trends (📈), Home (🏠), News (📰), Chat (💬)
- Active State: #287BFF color with subtle glow effect
- Inactive State: #B3B9C4

### AI Elements (Special Treatment)
- Background: Linear gradient from #287BFF to darker blue
- Glow Effect: 0 0 20px rgba(40, 123, 255, 0.4)
- Border: 1px solid rgba(40, 123, 255, 0.3)

### Buttons
- Primary: Background #287BFF, text white, rounded-lg, px-6 py-3
- Secondary: Border 1px #287BFF, text #287BFF, rounded-lg, px-6 py-3
- Hover: Brightness increase, subtle scale
- Action buttons on Chat: Small pills, rounded-full, px-4 py-2

### Data Visualization
- Charts: Use #287BFF as primary color, with gradients for fills
- Positive Values: #10B981 (Green)
- Negative Values: #EF4444 (Red)
- Chart Background: Transparent or #1E2A44

## Page-Specific Layouts

### Home Screen
- **Portfolio Value Card**: Full-width, prominent at top, large text for value, smaller for percentage change
- **Quick Metrics Grid**: 2x2 grid on mobile, 4 columns on desktop, each metric in card
- **AI Recommendations**: Horizontal scrollable cards on mobile, 3-column grid on desktop, each with glow effect
- **News Summary**: Vertical list, each item clickable

### Portfolio Screen
- **Tabs**: Horizontal tab bar, underline active tab with #287BFF
- **Pie Chart**: Centered, 300px diameter on desktop, responsive sizing
- **Holdings Table**: Full-width, sticky header, alternating row colors, mobile shows cards instead

### Trends Screen
- **Market Overview**: 2x2 grid of stat cards
- **Sector Chart**: Radar chart, centered, 400px square on desktop
- **Top Movers**: Vertical list with icons/logos
- **Momentum Gauge**: Semi-circle gauge, centered below movers

### News Screen
- **Highlights Card**: Featured at top, larger card with gradient background
- **News Feed**: Infinite scroll, each card shows headline, timestamp, AI impact tag (small pill badge in #287BFF)

### Chat Screen
- **Message Layout**: User messages align right with #287BFF background, AI messages align left with #1E2A44 background and glow
- **Input Area**: Fixed at bottom, rounded text input with send button
- **Action Buttons**: Below AI messages, horizontal flex wrap, small rounded pills
- **Bubble Style**: Rounded corners 16px, max-width 80%, padding 12px 16px

## Animations
- **Page Transitions**: Fade and slide (300ms)
- **Card Hover**: Subtle lift (transform translateY(-4px), 200ms)
- **Chart Entrance**: Animate from 0 with easing (800ms)
- **Loading States**: Pulse animation for skeleton screens
- **AI Response**: Typing indicator with bouncing dots

## Responsive Breakpoints
- Mobile: < 640px (single column, stacked layouts)
- Tablet: 640px - 1024px (2-column grids)
- Desktop: > 1024px (multi-column, full features)

## Images
No hero images required - this is a data-dense dashboard application. All visual interest comes from:
- Chart visualizations
- Glowing AI elements
- Color-coded financial data
- MaddenAI logo (SVG placeholder in header, approximately 40px height)

## Accessibility
- Minimum contrast ratio: 4.5:1 for all text
- Focus states: 2px outline in #287BFF
- Keyboard navigation: Full support for all interactive elements
- Screen reader labels for all icons and charts