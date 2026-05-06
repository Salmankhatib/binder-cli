// tests/fixtures/advanced-scenarios/src/SubscriptionHard.tsx
import React, { useState, useEffect } from 'react';

const MOCK_TICKER = { symbol: 'BTC', price: 50000 };

export const CryptoTicker = () => {
    const [price, setPrice] = useState(MOCK_TICKER.price);

    useEffect(() => {
        // Pattern: subscription-refresh -> useSubscription
        const interval = setInterval(() => {
            setPrice(MOCK_TICKER.price + Math.random());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            {MOCK_TICKER.symbol}: ${price}
        </div>
    );
};
