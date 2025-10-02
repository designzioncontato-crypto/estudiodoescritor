import React, { useState, useRef, useEffect, useCallback } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const RECOMMENDED_WIDTH = 800;
const RECOMMENDED_HEIGHT = 600;

const ASPECT_RATIOS = {
    free: { name: 'Livre', value: null },
    '1:1': { name: '1:1', value: 1 },
    '4:3': { name: '4:3', value: 4 / 3 },
    '16:9': { name: '16:9', value: 16 / 9 },
};

type AspectRatioKey = keyof typeof ASPECT_RATIOS;

interface ImageCropModalProps {
    imageSrc: string;
    onSave: (croppedDataUrl: string) => void;
    onClose: () => void;
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({ imageSrc, onSave, onClose }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [crop, setCrop] = useState({ x: 0, y: 0, width: 300, height: 300 });
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
    const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 });
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

    const [activeAspectRatio, setActiveAspectRatio] = useState<AspectRatioKey>('free');
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialImageX: 0, initialImageY: 0 });

    const showSizeWarning = naturalSize.width < RECOMMENDED_WIDTH || naturalSize.height < RECOMMENDED_HEIGHT;

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setNaturalSize({ width: naturalWidth, height: naturalHeight });
        setZoom(MIN_ZOOM);
        setImagePos({ x: 0, y: 0 });

        const container = containerRef.current;
        if (container) {
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            const imgAspectRatio = naturalWidth / naturalHeight;
            const containerAspectRatio = containerWidth / containerHeight;
            
            let initialWidth, initialHeight;
            if (imgAspectRatio > containerAspectRatio) {
                initialWidth = containerWidth;
                initialHeight = containerWidth / imgAspectRatio;
            } else {
                initialHeight = containerHeight;
                initialWidth = containerHeight * imgAspectRatio;
            }
            setImageDisplaySize({ width: initialWidth, height: initialHeight });
        }
    }, []);

    useEffect(() => {
        if (!containerRef.current || imageDisplaySize.width === 0) return;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        const aspectRatioValue = ASPECT_RATIOS[activeAspectRatio].value;
        
        const padding = 40;
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        let newWidth, newHeight;

        if (!aspectRatioValue) {
            newWidth = availableWidth * 0.8;
            newHeight = availableHeight * 0.8;
        } else {
            const availableAspectRatio = availableWidth / availableHeight;
            if (aspectRatioValue > availableAspectRatio) {
                newWidth = availableWidth;
                newHeight = availableWidth / aspectRatioValue;
            } else {
                newHeight = availableHeight;
                newWidth = availableHeight * aspectRatioValue;
            }
        }
        
        setCrop({
            width: newWidth,
            height: newHeight,
            x: (containerWidth - newWidth) / 2,
            y: (containerHeight - newHeight) / 2,
        });
        setImagePos({ x: 0, y: 0 });
    }, [activeAspectRatio, imageDisplaySize]);

    const handleSave = useCallback(() => {
        const image = imgRef.current;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!image || !canvas || !container) return;
        
        const scale = naturalSize.width / imageDisplaySize.width;
        
        const scaledWidth = imageDisplaySize.width * zoom;
        const scaledHeight = imageDisplaySize.height * zoom;

        const imgXInContainer = (container.offsetWidth - scaledWidth) / 2 + imagePos.x;
        const imgYInContainer = (container.offsetHeight - scaledHeight) / 2 + imagePos.y;

        const srcX = (crop.x - imgXInContainer) / zoom * scale;
        const srcY = (crop.y - imgYInContainer) / zoom * scale;
        const srcWidth = crop.width / zoom * scale;
        const srcHeight = crop.height / zoom * scale;
        
        canvas.width = srcWidth;
        canvas.height = srcHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(image, srcX, srcY, srcWidth, srcHeight, 0, 0, srcWidth, srcHeight);
            onSave(canvas.toDataURL('image/jpeg'));
        }

    }, [crop, naturalSize, imageDisplaySize, zoom, imagePos, onSave]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ 
            x: e.clientX, 
            y: e.clientY,
            initialImageX: imagePos.x,
            initialImageY: imagePos.y
        });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        
        setImagePos(() => {
            const newPos = {
                x: dragStart.initialImageX + dx,
                y: dragStart.initialImageY + dy,
            };

            const scaledWidth = imageDisplaySize.width * zoom;
            const scaledHeight = imageDisplaySize.height * zoom;
            const container = containerRef.current!;

            const baseImageX = (container.offsetWidth - scaledWidth) / 2;
            const baseImageY = (container.offsetHeight - scaledHeight) / 2;

            const minImageXInContainer = crop.x - scaledWidth + crop.width;
            const maxImageXInContainer = crop.x;
            const minImageYInContainer = crop.y - scaledHeight + crop.height;
            const maxImageYInContainer = crop.y;

            const maxPosX = maxImageXInContainer - baseImageX;
            const minPosX = minImageXInContainer - baseImageX;
            const maxPosY = maxImageYInContainer - baseImageY;
            const minPosY = minImageYInContainer - baseImageY;

            newPos.x = Math.max(minPosX, Math.min(newPos.x, maxPosX));
            newPos.y = Math.max(minPosY, Math.min(newPos.y, maxPosY));
            
            if (scaledWidth <= crop.width) newPos.x = 0;
            if (scaledHeight <= crop.height) newPos.y = 0;

            return newPos;
        });

    }, [isDragging, dragStart, zoom, imageDisplaySize, crop]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);
    
    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-gray-800 w-full max-w-4xl h-[95vh] rounded-lg shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 text-center">
                    <h2 className="text-xl font-bold">Cortar Imagem</h2>
                </div>
                
                <div className="flex-grow flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
                    <div ref={containerRef} className="flex-grow bg-gray-900 rounded-md flex items-center justify-center overflow-hidden relative">
                        {naturalSize.width > 0 && (
                             <>
                                <img
                                    ref={imgRef}
                                    src={imageSrc}
                                    onLoad={onImageLoad}
                                    onMouseDown={handleMouseDown}
                                    style={{
                                        position: 'absolute',
                                        width: imageDisplaySize.width,
                                        height: imageDisplaySize.height,
                                        transform: `translate(${imagePos.x}px, ${imagePos.y}px) scale(${zoom})`,
                                        cursor: isDragging ? 'grabbing' : 'grab',
                                        transition: 'transform 0.1s ease-out',
                                    }}
                                    alt="Para cortar"
                                    draggable="false"
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: crop.y,
                                        left: crop.x,
                                        width: crop.width,
                                        height: crop.height,
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                                        border: '2px dashed white',
                                        pointerEvents: 'none',
                                    }}
                                />
                            </>
                        )}
                        {!naturalSize.width && <img ref={imgRef} src={imageSrc} onLoad={onImageLoad} className="opacity-0" alt="Carregando"/> }
                    </div>
                    <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
                       <div className="bg-gray-900/50 p-3 rounded-lg">
                           <label htmlFor="zoom" className="block text-sm font-medium text-gray-300 mb-2">Zoom</label>
                           <input
                                id="zoom"
                                type="range"
                                min={MIN_ZOOM}
                                max={MAX_ZOOM}
                                step={ZOOM_STEP}
                                value={zoom}
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                           />
                       </div>
                       <div className="bg-gray-900/50 p-3 rounded-lg">
                           <h4 className="text-sm font-medium text-gray-300 mb-2">Proporção</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(ASPECT_RATIOS).map(([key, { name }]) => (
                                     <button
                                        key={key}
                                        onClick={() => setActiveAspectRatio(key as AspectRatioKey)}
                                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                                            activeAspectRatio === key
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 hover:bg-gray-600'
                                        }`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                       </div>
                        {showSizeWarning && (
                            <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-xs p-3 rounded-lg">
                                Imagens menores que {RECOMMENDED_WIDTH}x{RECOMMENDED_HEIGHT}px podem perder qualidade.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center p-4 border-t border-gray-700">
                     <p className="text-xs text-gray-500">Recomendação: {RECOMMENDED_WIDTH}x{RECOMMENDED_HEIGHT}px ou maior.</p>
                     <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                        >
                            Salvar Corte
                        </button>
                    </div>
                </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default ImageCropModal;
