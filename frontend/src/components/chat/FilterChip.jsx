import React from 'react';
import clsx from 'clsx';

const FilterChip = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={clsx(
      "text-sm px-3 py-1.5 rounded-full whitespace-nowrap transition-colors select-none",
      active ? "bg-wa-chip-active text-wa-chip-active-text" : "bg-wa-chip text-wa-text-muted hover:bg-wa-bg-hover"
    )}
  >
    {label}
  </button>
);

export default React.memo(FilterChip);
