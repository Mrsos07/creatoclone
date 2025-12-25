
import React, { useEffect, useRef } from 'react';
import { Trash2, Copy, ArrowUp, ArrowDown, X } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in duration-100"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onDuplicate(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
      >
        <Copy size={14} className="text-blue-500" />
        Duplicate Layer
      </button>
      <button
        onClick={() => { onBringToFront(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
      >
        <ArrowUp size={14} className="text-green-500" />
        Bring to Front
      </button>
      <button
        onClick={() => { onSendToBack(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
      >
        <ArrowDown size={14} className="text-orange-500" />
        Send to Back
      </button>
      <div className="h-px bg-zinc-800 my-1" />
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
      >
        <Trash2 size={14} />
        Delete Layer
      </button>
    </div>
  );
};

export default ContextMenu;
