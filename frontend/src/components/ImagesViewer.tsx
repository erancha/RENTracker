import { Undo2 } from 'lucide-react';
import React from 'react';

interface ImagesViewerProps {
  presignedUrls: Record<string, string>;
  onClose?: () => void;
}

class ImagesViewer extends React.Component<ImagesViewerProps> {
  render() {
    const { presignedUrls, onClose } = this.props;
    return (
      <div className='images-viewer'>
        <div className='images-viewer-header'>
          {onClose && (
            <button onClick={onClose} className='action-button cancel' title='Close'>
              <Undo2 />
            </button>
          )}
        </div>
        <div className='images-viewer-content'>
          {Object.entries(presignedUrls).map(([key, url]) => (
            <div key={key} className='images-viewer-item'>
              <img src={url} alt={key} />
              <p>{key}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

export default ImagesViewer;
