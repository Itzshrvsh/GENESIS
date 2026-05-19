import React from 'react';
import { BoardContext } from '../context/BoardContext';

const Toolbar: React.FC = () => {
  const {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
  } = React.useContext(BoardContext) as any; // Cast as any to avoid type issues for now

  return (
    <div className="glass-card" style={toolbarStyle}>
      <div style={toolGroupStyle}>
        <button
          className={tool === 'pen' ? 'primary-button' : 'secondary-button'}
          style={buttonStyle}
          onClick={() => setTool('pen')}
          title="Pen Tool"
        >
          ✏️
        </button>
        <button
          className={tool === 'eraser' ? 'primary-button' : 'secondary-button'}
          style={buttonStyle}
          onClick={() => setTool('eraser')}
          title="Eraser Tool"
        >
          🧽
        </button>
      </div>

      <div style={dividerStyle} />

      <div style={toolGroupStyle}>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={colorInputStyle}
          title="Select Color"
        />
        <select
          className="secondary-button"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
          style={selectStyle}
          title="Stroke Width"
        >
          {[2, 4, 8, 12, 16, 24].map((w) => (
            <option key={w} value={w}>
              {w}px
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  padding: '1.5rem 1rem',
  margin: '1rem',
  borderRadius: '20px',
  height: 'fit-content',
  alignSelf: 'center',
  zIndex: 100,
};

const toolGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
};

const buttonStyle: React.CSSProperties = {
  width: '50px',
  height: '50px',
  padding: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.5rem',
};

const colorInputStyle: React.CSSProperties = {
  width: '50px',
  height: '50px',
  padding: '2px',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.1)',
};

const selectStyle: React.CSSProperties = {
  width: '50px',
  height: '40px',
  padding: '0',
  fontSize: '0.8rem',
  textAlign: 'center',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: 'rgba(255,255,255,0.1)',
  width: '100%',
};

export default Toolbar;