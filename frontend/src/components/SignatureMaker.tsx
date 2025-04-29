import React, { useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import { Check, Undo2 } from 'lucide-react';

interface SignatureMakerProps {
  onSave: (imageData: string) => void;
}

const SignatureMaker: React.FC<SignatureMakerProps> = ({ onSave }) => {
  const [lines, setLines] = useState<any[]>([]);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || lines.length === 0) return; // Ensure there is at least one line
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
    const background = new Konva.Rect({
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
    layer.getChildren().forEach((child: Konva.Node) => {
      if (child instanceof Konva.Line) {
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
  };

  return (
    <div>
      <Stage
        width={window.innerWidth * 0.9} // Adjust width to 90% of the window width
        height={300}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown} // Add touch support
        onMousemove={handleMouseMove}
        onTouchMove={handleMouseMove} // Add touch support
        onMouseup={handleMouseUp}
        onTouchEnd={handleMouseUp} // Add touch support
        ref={stageRef}
        style={{ border: '1px solid black', margin: '0 auto', touchAction: 'none' }} // Prevent default touch behavior
      >
        <Layer>
          {lines.map((line, i) => (
            <Line key={i} points={line.points} stroke='darkblue' strokeWidth={4} tension={0.5} lineCap='round' globalCompositeOperation='source-over' />
          ))}
        </Layer>
      </Stage>

      <div className='actions' style={{ marginTop: '10px' }}>
        <button type='button' className='action-button save' title='Save' onClick={handleSave}>
          <Check />
        </button>
        <button type='button' className='action-button cancel' title='Cancel' onClick={handleClear}>
          <Undo2 />
        </button>
      </div>
    </div>
  );
};

export default SignatureMaker;
