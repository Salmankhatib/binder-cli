// tests/fixtures/advanced-scenarios/src/AmateurMessy.tsx
import React from 'react';

var MOCK_DATA_items = [{val: 1, text: 'A'}, {val: 2, text: 'B'}];

export default function messy_comp_123(props) {
    // Pattern: direct-assignment -> Auto (should still work even with 'var' and messy names)
    let my_data = MOCK_DATA_items;
    
    // Pattern: simple-map -> Auto
    const rendered = my_data
        .sort((a, b) => a.val - b.val) // Pattern: sort-strategy -> Human
        .map(function(item) {
            return <div style={{color: 'red'}}>{item.text}</div>
        });

    // Pattern: length-check -> Auto
    if (MOCK_DATA_items.length === 0) return "No data here buddy";

    return (
        <section>
            {rendered}
            {/* Pattern: jsx-prop-direct -> Auto */}
            <footer data-count={MOCK_DATA_items.length}>
                Total items: {MOCK_DATA_items.length}
            </footer>
        </section>
    );
}
