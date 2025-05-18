import React from 'react';
import { Loader2 } from 'lucide-react';

interface ISpinnerProps {
  title?: string;
  className?: string;
}

const Spinner: React.FC<ISpinnerProps> = ({ title, className }) => (
  <div className={`app-spinner-container${className ? ` ${className}` : ''}`} title={title}>
    <Loader2 className='spinner' />
  </div>
);

export default Spinner;
