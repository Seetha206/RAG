import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { postUpload } from '../../services/api/ragService';

interface UploadButtonProps {
  onUploadSuccess?: (filename: string, chunksAdded: number) => void;
  variant?: 'icon' | 'prominent';
}

export function UploadButton({
  onUploadSuccess,
  variant = 'icon',
}: UploadButtonProps) {
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setErrorMsg('');

    try {
      const result = await postUpload(file);
      setStatus('success');
      onUploadSuccess?.(result.filename, result.chunks_added);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: unknown) {
      setStatus('error');
      const message =
        err instanceof Error ? err.message : 'Upload failed';
      setErrorMsg(message);
      setTimeout(() => setStatus('idle'), 5000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (variant === 'prominent') {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.xlsx,.txt"
        />
        <button
          onClick={handleClick}
          disabled={status === 'uploading'}
          className="mt-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
        >
          {status === 'uploading' && (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Uploading...
            </span>
          )}
          {status === 'success' && (
            <span className="flex items-center gap-2 text-emerald-600">
              <CheckCircle size={14} />
              Uploaded!
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-2 text-red-500">
              <AlertCircle size={14} />
              Failed
            </span>
          )}
          {status === 'idle' && 'Select Files'}
        </button>
      </>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.xlsx,.txt"
      />
      <button
        onClick={handleClick}
        disabled={status === 'uploading'}
        className="p-2 rounded-xl border-2 border-slate-200 text-slate-400 hover:border-primary hover:text-primary hover:bg-primary/5 disabled:opacity-50 transition-all duration-200"
        title={
          status === 'uploading'
            ? 'Uploading...'
            : status === 'success'
              ? 'Upload successful'
              : status === 'error'
                ? errorMsg
                : 'Upload document (PDF, DOCX, XLSX, TXT)'
        }
        aria-label="Upload document"
      >
        {status === 'uploading' && (
          <Loader2 size={18} className="animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle size={18} className="text-emerald-500" />
        )}
        {status === 'error' && (
          <AlertCircle size={18} className="text-red-500" />
        )}
        {status === 'idle' && <Upload size={18} />}
      </button>
    </>
  );
}

export default UploadButton;
