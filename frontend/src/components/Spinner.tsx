import React from 'react';
import { Loader2 } from 'lucide-react';

interface ISpinnerProps {
  title?: string;
}

const Spinner: React.FC<ISpinnerProps> = ({ title }) => (
  <div className='flex items-center justify-center w-full h-32' title={title}>
    <Loader2 className='w-8 h-8 animate-spin text-blue-500 spinner' />
  </div>
);

export default Spinner;
