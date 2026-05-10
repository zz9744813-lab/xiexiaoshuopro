'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const [isReported, setIsReported] = useState(false);

  useEffect(() => {
    logger.error('Global error caught', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const handleReport = () => {
    setIsReported(true);
    // 可以在这里添加错误上报逻辑
  };

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full mx-4 p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            出错了
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error.message || '发生了意外错误，请稍后再试'}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              错误代码: {error.digest}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              重试
            </button>
            <button
              onClick={handleReport}
              disabled={isReported}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md transition-colors disabled:opacity-50"
            >
              {isReported ? '已上报' : '上报问题'}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
