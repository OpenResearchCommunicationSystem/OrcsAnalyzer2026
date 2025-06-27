import React from 'react';

interface TableCell {
  content: string;
  row: number;
  col: number;
}

interface MarkdownTable {
  headers: string[];
  rows: string[][];
  rawMarkdown: string;
  startIndex: number;
  endIndex: number;
}

export function parseMarkdownTables(content: string): MarkdownTable[] {
  const lines = content.split('\n');
  const tables: MarkdownTable[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check if current line looks like a table header
    if (line.includes('|') && line.split('|').length > 2) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      
      // Check if next line is a separator (contains dashes and pipes)
      if (nextLine.includes('|') && nextLine.includes('-')) {
        const startIndex = content.indexOf(lines[i]);
        const headers = line.split('|').map(h => h.trim()).filter(h => h !== '');
        const rows: string[][] = [];
        
        // Skip the separator line
        i += 2;
        
        // Parse table rows
        while (i < lines.length && lines[i].trim().includes('|')) {
          const rowLine = lines[i].trim();
          if (rowLine) {
            const rowCells = rowLine.split('|').map(c => c.trim()).filter(c => c !== '');
            if (rowCells.length > 0) {
              rows.push(rowCells);
            }
          }
          i++;
        }
        
        // Calculate end index
        const endIndex = i > 0 ? content.indexOf(lines[i - 1]) + lines[i - 1].length : content.length;
        
        // Extract raw markdown for this table
        const rawMarkdown = content.substring(startIndex, endIndex);
        
        tables.push({
          headers,
          rows,
          rawMarkdown,
          startIndex,
          endIndex
        });
        
        continue;
      }
    }
    i++;
  }
  
  return tables;
}

interface MarkdownTableProps {
  table: MarkdownTable;
  onCellClick?: (row: number, col: number, content: string) => void;
  selectedCell?: { row: number; col: number } | null;
}

export function MarkdownTableComponent({ table, onCellClick, selectedCell }: MarkdownTableProps) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border border-gray-300 dark:border-gray-600">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            {table.headers.map((header, colIndex) => (
              <th
                key={colIndex}
                className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-600"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  className={`px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                    selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : ''
                  }`}
                  onClick={() => onCellClick?.(rowIndex, colIndex, cell)}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function renderContentWithTables(
  content: string,
  renderHighlightedContent: (text: string) => React.ReactNode,
  onCellClick?: (row: number, col: number, content: string) => void,
  selectedCell?: { row: number; col: number } | null
): React.ReactNode[] {
  const tables = parseMarkdownTables(content);
  
  if (tables.length === 0) {
    // No tables found, return content with highlighting
    return [<div key="content" className="whitespace-pre-wrap font-mono text-sm">{renderHighlightedContent(content)}</div>];
  }
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  tables.forEach((table, tableIndex) => {
    // Add content before this table
    if (table.startIndex > lastIndex) {
      const beforeTable = content.substring(lastIndex, table.startIndex);
      if (beforeTable.trim()) {
        elements.push(
          <div key={`before-${tableIndex}`} className="whitespace-pre-wrap font-mono text-sm">
            {renderHighlightedContent(beforeTable)}
          </div>
        );
      }
    }
    
    // Add the table
    elements.push(
      <MarkdownTableComponent
        key={`table-${tableIndex}`}
        table={table}
        onCellClick={onCellClick}
        selectedCell={selectedCell}
      />
    );
    
    lastIndex = table.endIndex;
  });
  
  // Add remaining content after last table
  if (lastIndex < content.length) {
    const afterTables = content.substring(lastIndex);
    if (afterTables.trim()) {
      elements.push(
        <div key="after-tables" className="whitespace-pre-wrap font-mono text-sm">
          {renderHighlightedContent(afterTables)}
        </div>
      );
    }
  }
  
  return elements;
}