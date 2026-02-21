# Supply Breakdown Chart Feature

## Overview

The Supply Breakdown Chart provides a visual representation of token supply distribution across different categories. It uses a donut chart to display:

- **Circulating Supply**: Tokens actively available for trading
- **Locked (Vesting)**: Tokens locked in vesting contracts
- **Total Burned**: Tokens permanently removed from supply

## Implementation

### Components

#### SupplyBreakdownChart (`frontend/components/charts/SupplyBreakdownChart.tsx`)

A responsive donut chart component built with Recharts that visualizes token supply distribution.

**Features:**

- Responsive design that adapts to different screen sizes
- Interactive tooltips showing detailed information
- Custom legend with icons and statistics
- Center label displaying total supply
- Color-coded segments for easy identification
- Percentage calculations for each category

**Props:**

```typescript
interface SupplyBreakdownChartProps {
  data: {
    circulating: number;
    locked: number;
    burned: number;
    total: number;
  };
  symbol: string;
  decimals: number;
}
```

**Color Scheme:**

- Circulating: `#54a3ff` (Stellar blue)
- Locked: `#f59e0b` (Amber)
- Burned: `#ef4444` (Red)

### Data Fetching

#### fetchSupplyBreakdown (`frontend/lib/stellar.ts`)

Fetches and calculates supply breakdown from the token contract.

```typescript
async function fetchSupplyBreakdown(
  tokenContractId: string,
  vestingContractId?: string,
): Promise<SupplyBreakdown>;
```

**Current Implementation:**

- Fetches total supply from token contract
- Calculates circulating supply
- Placeholder for locked supply (requires vesting contract enumeration)
- Placeholder for burned supply (requires max_supply comparison)

**Future Enhancements:**

1. Enumerate all vesting schedules to calculate actual locked supply
2. Query max_supply to calculate burned tokens
3. Support multiple vesting contracts
4. Cache results for performance

## Usage

The chart is automatically displayed on the token dashboard when supply data is available:

```tsx
<SupplyBreakdownChart
  data={{
    circulating: 50000000,
    locked: 30000000,
    burned: 5000000,
    total: 85000000,
  }}
  symbol="TOKEN"
  decimals={7}
/>
```

## Design Decisions

### Why Donut Chart?

1. **Visual Clarity**: Donut charts effectively show part-to-whole relationships
2. **Center Space**: Allows displaying total supply in the center
3. **Industry Standard**: Commonly used in DeFi dashboards (CoinGecko, CoinMarketCap)
4. **Accessibility**: Easier to read than pie charts with many segments

### Why Recharts?

1. **React Integration**: Built specifically for React applications
2. **Responsive**: Automatically adapts to container size
3. **Customizable**: Extensive customization options
4. **Performance**: Optimized for large datasets
5. **Active Maintenance**: Regular updates and bug fixes
6. **Bundle Size**: Reasonable size (~100KB gzipped)

### Color Choices

Colors were chosen based on:

- **Circulating (Blue)**: Matches Stellar brand color, represents active/liquid
- **Locked (Amber)**: Warning color, indicates restricted access
- **Burned (Red)**: Destructive action, permanently removed

## Accessibility

The chart includes several accessibility features:

1. **ARIA Labels**: Proper labeling for screen readers
2. **Keyboard Navigation**: Can be navigated with keyboard
3. **High Contrast**: Colors meet WCAG AA contrast requirements
4. **Tooltips**: Provide additional context on hover
5. **Legend**: Text-based alternative to visual representation

## Performance Considerations

### Optimization Strategies

1. **Memoization**: Chart data is memoized to prevent unnecessary recalculations
2. **Conditional Rendering**: Only renders when data is available
3. **Lazy Loading**: Chart library loaded on-demand
4. **Animation Duration**: Kept short (800ms) for better perceived performance

### Bundle Impact

- Recharts: ~100KB gzipped
- Chart Component: ~5KB
- Total Impact: ~105KB

## Testing

### Manual Testing

1. Navigate to token dashboard
2. Verify chart displays with correct data
3. Test responsive behavior on different screen sizes
4. Verify tooltips show on hover
5. Check legend displays correctly
6. Verify center label shows total supply

### Test Scenarios

- **All Categories Present**: Chart shows all three segments
- **Zero Values**: Segments with zero value are hidden
- **Large Numbers**: Numbers formatted with K/M/B suffixes
- **Small Numbers**: Numbers displayed with appropriate precision
- **Responsive**: Chart adapts to mobile, tablet, and desktop

## Future Enhancements

### Phase 1: Data Accuracy

- [ ] Implement actual vesting contract enumeration
- [ ] Calculate real locked supply from all vesting schedules
- [ ] Query max_supply for accurate burned calculation
- [ ] Support multiple vesting contracts

### Phase 2: Features

- [ ] Add time-series view showing supply changes over time
- [ ] Export chart as image
- [ ] Add comparison with other tokens
- [ ] Show historical supply data

### Phase 3: Advanced Analytics

- [ ] Predict future supply based on vesting schedules
- [ ] Show unlock schedule timeline
- [ ] Calculate velocity (rate of supply change)
- [ ] Add alerts for significant supply changes

## Troubleshooting

### Chart Not Displaying

**Possible Causes:**

1. Supply data not loaded
2. All values are zero
3. Recharts not installed
4. CSS conflicts

**Solutions:**

1. Check browser console for errors
2. Verify `fetchSupplyBreakdown` returns data
3. Run `npm install` to ensure dependencies
4. Check for CSS class conflicts

### Incorrect Data

**Possible Causes:**

1. Token contract doesn't implement `total_supply`
2. Vesting contract not provided
3. Network issues

**Solutions:**

1. Verify contract implements required methods
2. Provide vesting contract ID
3. Check network connectivity

### Performance Issues

**Possible Causes:**

1. Large dataset
2. Frequent re-renders
3. Animation lag

**Solutions:**

1. Implement data pagination
2. Use React.memo for chart component
3. Reduce animation duration

## References

- [Recharts Documentation](https://recharts.org/)
- [CoinGecko Supply Methodology](https://support.coingecko.com/hc/en-us/articles/32294647667865)
- [Token Supply Best Practices](https://cryptorobotics.ai/learn/how-token-supply-works-circulating-total-max-supply-explained/)
- [Donut Chart UX Guidelines](https://www.react-graph-gallery.com/donut)

## Changelog

- **2026-02-21**: Initial implementation with basic supply breakdown
- **Future**: Enhanced data accuracy with vesting contract integration
