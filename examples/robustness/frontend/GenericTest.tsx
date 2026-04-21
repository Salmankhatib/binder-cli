import React, { useState } from 'react';

const data = [
  { id: 1, text: "Initial Item" }
];

export default function GenericTest() {
  const [items, setItems] = useState(data);

  const handleDelete = (id: number) => {
    console.log("Delete", id);
  };

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          {item.text}
          <button onClick={() => handleDelete(item.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
