import React, { useRef, useState } from 'react';
import { withTranslation } from 'react-i18next';
import { Stage, Layer, Line } from 'react-konva';
import { Check, Undo2 } from 'lucide-react';

const SignatureMaker: React.FC<SignatureMakerProps> = ({ onSave, onCancel, t }) => {
  const [lines, setLines] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y] }]);
    setHasChanges(true);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || lines.length === 0) return; // Ensure there is at least one line
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
    setHasChanges(true);
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
    <div>
      {/* @ts-ignore */}
      <Stage
        width={window.innerWidth * 0.9}
        height={300}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onMousemove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseup={handleMouseUp}
        onTouchEnd={handleMouseUp}
        ref={stageRef}
        style={{ border: '1px solid black', margin: '0 auto', touchAction: 'none' }} // Prevent default touch behavior
      >
        <Layer>
          {lines.map((line, i) => (
            <Line key={i} points={line.points} stroke='#000' strokeWidth={2} tension={0.5} lineCap='round' globalCompositeOperation='source-over' />
          ))}
        </Layer>
      </Stage>

      <div className='actions' style={{ marginTop: '10px' }}>
        {hasChanges && (
          <button type='button' className='action-button save has-changes' title={t('common.save')} onClick={handleSave}>
            <Check />
          </button>
        )}
        <button type='button' className='action-button cancel' title={t('common.cancel')} onClick={handleClear}>
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
