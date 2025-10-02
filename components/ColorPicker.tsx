
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- Helper Functions for Color Conversion ---

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};


const hsvToRgb = (h: number, s: number, v: number) => {
    s /= 100; v /= 100;
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};


interface ColorPickerProps {
  onClose: (color: string) => void;
  currentColor: string;
}

const AdvancedColorPicker: React.FC<ColorPickerProps> = ({ onClose, currentColor }) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const initialHsv = rgbToHsv(hexToRgb(currentColor).r, hexToRgb(currentColor).g, hexToRgb(currentColor).b);
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [value, setValue] = useState(initialHsv.v);
  const [previewColor, setPreviewColor] = useState(currentColor);

  const saturationHandleStyle = {
    left: `${saturation}%`,
    top: `${100 - value}%`,
  };

  const hueHandleStyle = {
    left: `${(hue / 360) * 100}%`,
  };

  const handleSaturationValueChange = useCallback((e: MouseEvent) => {
    if (saturationRef.current) {
      const { width, height, left, top } = saturationRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, e.clientX - left));
      const y = Math.max(0, Math.min(height, e.clientY - top));
      const newSaturation = (x / width) * 100;
      const newValue = 100 - (y / height) * 100;
      setSaturation(newSaturation);
      setValue(newValue);
    }
  }, []);

  const handleHueChange = useCallback((e: MouseEvent) => {
    if (hueRef.current) {
      const { width, left } = hueRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, e.clientX - left));
      const newHue = (x / width) * 360;
      setHue(newHue);
    }
  }, []);

  const stopDragging = useCallback(() => {
    document.removeEventListener('mousemove', handleSaturationValueChange);
    document.removeEventListener('mouseup', stopDragging);
    document.removeEventListener('mousemove', handleHueChange);
  }, [handleSaturationValueChange, handleHueChange]);

  const startSaturationDrag = useCallback((e: React.MouseEvent) => {
      handleSaturationValueChange(e.nativeEvent);
      document.addEventListener('mousemove', handleSaturationValueChange);
      document.addEventListener('mouseup', stopDragging);
  }, [handleSaturationValueChange, stopDragging]);
  
  const startHueDrag = useCallback((e: React.MouseEvent) => {
      handleHueChange(e.nativeEvent);
      document.addEventListener('mousemove', handleHueChange);
      document.addEventListener('mouseup', stopDragging);
  }, [handleHueChange, stopDragging]);

  useEffect(() => {
    const { r, g, b } = hsvToRgb(hue, saturation, value);
    setPreviewColor(rgbToHex(r, g, b));
  }, [hue, saturation, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose(previewColor);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      stopDragging();
    };
  }, [onClose, stopDragging, previewColor]);

  return (
    <div
      ref={pickerRef}
      className="absolute z-10 top-full right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 w-56 flex flex-col gap-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={saturationRef}
        className="relative w-full h-40 rounded-md cursor-pointer"
        style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        onMouseDown={startSaturationDrag}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={saturationHandleStyle}
        />
      </div>

      <div className="relative w-full h-4" ref={hueRef} onMouseDown={startHueDrag}>
        <div 
            className="w-full h-full rounded-full cursor-pointer"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        />
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-white"
          style={hueHandleStyle}
        >
          <div className="w-full h-full rounded-full" style={{backgroundColor: `hsl(${hue}, 100%, 50%)`}}></div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
         <div className="w-8 h-8 rounded-md border border-gray-600" style={{ backgroundColor: previewColor }}></div>
         <input 
            type="text" 
            value={previewColor} 
            readOnly 
            className="flex-grow bg-gray-700 text-center text-sm font-mono rounded-md py-1 px-2 border border-gray-600 focus:outline-none"
        />
      </div>

    </div>
  );
};

export default AdvancedColorPicker;