import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelProps {
  children: [React.ReactNode, React.ReactNode];
  initialLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  initialLeftWidth = 70,
  minLeftWidth = 50,
  minRightWidth = 20,
  className = '',
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;
    
    const newLeftWidthPx = Math.max(minLeftWidth, Math.min(mouseX, containerWidth - minRightWidth));
    const newLeftWidthPercent = (newLeftWidthPx / containerWidth) * 100;
    
    setLeftWidth(Math.max(minLeftWidth, Math.min(newLeftWidthPercent, 100 - minRightWidth)));
  }, [isDragging, minLeftWidth, minRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const rightWidth = 100 - leftWidth;

  return (
    <div ref={containerRef} className={`flex h-full ${className}`}>
      {/* Left Panel */}
      <div 
        className="overflow-hidden min-w-0"
        style={{ width: `${leftWidth}%` }}
      >
        {children[0]}
      </div>
      
      {/* Resizer */}
      <div
        className={`w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors duration-150 ${
          isDragging ? 'bg-blue-400 dark:bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-full h-full relative">
          <div className="absolute inset-y-0 -left-1 -right-1 hover:bg-blue-400/20 dark:hover:bg-blue-500/20" />
        </div>
      </div>
      
      {/* Right Panel */}
      <div 
        className="overflow-hidden min-w-0"
        style={{ width: `${rightWidth}%` }}
      >
        {children[1]}
      </div>
    </div>
  );
};