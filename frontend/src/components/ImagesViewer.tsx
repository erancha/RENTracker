import { Undo2 } from 'lucide-react';
import React from 'react';
import { withTranslation } from 'react-i18next';

interface ImagesViewerProps {
  presignedUrls: Record<string, string>;
  onClose?: () => void;
  t: (key: string, options?: any) => string;
}

class ImagesViewer extends React.Component<ImagesViewerProps> {
  render() {
    const { presignedUrls, onClose, t } = this.props;
    return (
      <div className='images-viewer'>
        <div className='images-viewer-header'>
          {onClose && (
            <button onClick={onClose} className='action-button cancel' title={t('common.cancel')}>
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

export default withTranslation()(ImagesViewer);
