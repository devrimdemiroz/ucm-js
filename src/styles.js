const getStyles = (options) =>
  `
  .path-line {
    fill: none;
    stroke: #000000;
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .component-rect {
    fill: rgba(255, 255, 255, 0.1); 
    stroke: #FF0000; /* Red Outline */
    stroke-width: 2px;
    rx: 0;
    ry: 0;
    cursor: pointer;
  }

  .component-rect:hover {
    stroke-width: 3px;
    fill: rgba(255, 0, 0, 0.05);
  }
  
  .component-rect.selected {
      stroke: #FF0000;
      stroke-width: 4px;
      stroke-dasharray: 4,2;
  }

  .component-text {
    font-family: 'Arial', sans-serif;
    font-size: 14px;
    fill: #000000;
    font-weight: bold;
    text-anchor: middle;
  }

  .responsibility-mark {
    stroke: #000000;
    stroke-width: 2px;
    fill: none;
  }

  .responsibility-text {
    font-family: 'Arial', sans-serif;
    font-size: 12px;
    fill: #000000;
    text-anchor: middle;
  }
  
  .start-node {
     fill: #000000;
     stroke: none;
  }
  
  .end-node {
      fill: #000000;
      stroke: none;
  }
  
  /* Tube Colors for Colored Path Style */
  .tube-color-0 { stroke: #E53935; fill: #E53935; } /* Red */
  .tube-color-1 { stroke: #1E88E5; fill: #1E88E5; } /* Blue */
  .tube-color-2 { stroke: #43A047; fill: #43A047; } /* Green */
  .tube-color-3 { stroke: #FB8C00; fill: #FB8C00; } /* Orange */
  .tube-color-4 { stroke: #8E24AA; fill: #8E24AA; } /* Purple */
  .tube-color-5 { stroke: #00ACC1; fill: #00ACC1; } /* Cyan */
  
  .path-line.tube-color-0 { fill: none; }
  .path-line.tube-color-1 { fill: none; }
  .path-line.tube-color-2 { fill: none; }
  .path-line.tube-color-3 { fill: none; }
  .path-line.tube-color-4 { fill: none; }
  .path-line.tube-color-5 { fill: none; }
  
  /* Station Style Responsibilities */
  .responsibility-station {
      cursor: pointer;
  }
  
  .responsibility-station:hover {
      stroke-width: 4px;
  }
`;

export default getStyles;
