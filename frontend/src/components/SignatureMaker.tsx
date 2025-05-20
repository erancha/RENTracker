import React, { useRef, useState, useEffect } from 'react';
import { withTranslation } from 'react-i18next';
import { Stage, Layer, Line } from 'react-konva';
import { Check, Undo2 } from 'lucide-react';

const SignatureMaker: React.FC<SignatureMakerProps> = ({ onSave, onCancel, t }) => {
  const [lines, setLines] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);

  useEffect(() => {
    if (hasChanges) {
      // Just prevent scrolling without changing position
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [hasChanges]);



  const handleMouseDown = (e: any) => {
    if (!hasChanges) {
      setHasChanges(true);
      return;
    }

    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || lines.length === 0 || !hasChanges) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleSave = () => {
    const stage = stageRef.current;
    const layer = stage.getLayers()[0];

    // Create a white background
    const background = new (window as any).Konva.Rect({
      x: 0,
      y: 0,
      width: stage.width(),
      height: stage.height(),
      fill: 'white',
    });

    layer.add(background);
    background.moveToBottom();
    layer.draw();

    // Ensure the signature lines are black
    layer.getChildren().forEach((child: any) => {
      if (child instanceof (window as any).Konva.Line) {
        child.stroke('black');
      }
    });

    const uri = stage.toDataURL();
    onSave(uri);

    // Remove the background after saving
    background.destroy();
    layer.draw();
  };

  const handleClear = () => {
    setLines([]);
    if (hasChanges) setHasChanges(false);
    else onCancel();
  };

  return (
    <div
      className='signature-maker'
      style={{
        ...(hasChanges
          ? {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '90vh',
              width: '100vw',
              backgroundColor: 'white',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }
          : {
              position: 'relative',
              margin: '0 auto',
            }),
      }}
    >
      {hasChanges && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '20vh',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 998,
            }}
          />
          {lines.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                color: '#666',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {t('signature.tapToStartDrawing')}
            </div>
          )}
        </>
      )}
      {/* @ts-ignore */}
      <Stage
        width={window.innerWidth * 0.9}
        height={hasChanges ? window.innerHeight * 0.7 : 300}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          e.evt.preventDefault();
          handleMouseDown(e);
        }}
        onMousemove={handleMouseMove}
        onTouchMove={(e) => {
          e.evt.preventDefault();
          handleMouseMove(e);
        }}
        onMouseup={handleMouseUp}
        onTouchEnd={(e) => {
          e.evt.preventDefault();
          handleMouseUp();
        }}
        ref={stageRef}
        style={{
          border: '1px solid black',
          margin: '0 auto',
          touchAction: 'none',
          position: 'relative',
          zIndex: 999,
          backgroundColor: 'white',
        }}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line key={i} points={line.points} stroke='#000' strokeWidth={2} tension={0.5} lineCap='round' globalCompositeOperation='source-over' />
          ))}
        </Layer>
      </Stage>

      <div className='actions' style={{ 
          marginTop: '10px', 
          justifyContent: 'center',
          display: 'flex',
          gap: '1rem',
          padding: '0.5rem',
          touchAction: 'manipulation',
        }}>
        {hasChanges && (
          <button 
            type='button' 
            className='action-button save has-changes' 
            title={t('common.save')} 
            onClick={handleSave}
          >
            <Check />
          </button>
        )}
        <button 
          type='button' 
          className='action-button cancel' 
          title={t('common.cancel')} 
          onClick={handleClear}
          style={{
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            cursor: 'pointer'
          }}
        >
          <Undo2 />
        </button>
      </div>
    </div>
  );
};

interface SignatureMakerProps {
  t: (key: string, options?: any) => string;
  onSave: (imageData: string) => void;
  onCancel: () => void;
}

export default withTranslation()(SignatureMaker);
