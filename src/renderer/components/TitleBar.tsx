import React from 'react';

function TitleBar() {
  return (
    <div
      className="h-12 flex items-center bg-inherit no-select shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic lights area - leave space */}
      <div className="w-20 shrink-0" />
    </div>
  );
}

export default TitleBar;
