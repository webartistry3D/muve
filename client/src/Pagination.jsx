import React from 'react';

// Reusable pagination: prev/next + page indicator, 10 items per page by default
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Previous
      </button>
      <span className="pagination-info num">Page {page} of {totalPages}</span>
      <button
        className="pagination-btn"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
