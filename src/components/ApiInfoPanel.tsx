/**
 * API Documentation and endpoint information panel
 */

import { useState } from 'react';

export function ApiInfoPanel() {
  const [isExpanded, setIsExpanded] = useState(false);

  const endpoints = [
    {
      method: 'POST',
      path: '/api/v1/water/log',
      description: 'Log water intake',
      params: '{ "amount_ml": 250 }',
    },
    {
      method: 'GET',
      path: '/api/v1/water/today',
      description: "Get today's logs",
    },
    {
      method: 'DELETE',
      path: '/api/v1/water/last',
      description: 'Remove last entry',
    },
    {
      method: 'GET',
      path: '/api/v1/water/stats',
      description: 'Get streak stats',
    },
    {
      method: 'GET',
      path: '/api/v1/reminder/check',
      description: 'Check reminder engine',
    },
    {
      method: 'GET/PUT',
      path: '/api/v1/reminder/settings',
      description: 'View/update settings',
    },
  ];

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500',
    POST: 'bg-blue-500',
    DELETE: 'bg-red-500',
    'GET/PUT': 'bg-violet-500',
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📡</span>
          <span className="font-semibold text-slate-800">API Endpoints</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            For Scriptable / Shortcuts
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-6">
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <h4 className="font-medium text-slate-700 mb-2">Integration Pattern</h4>
            <p className="text-sm text-slate-600">
              iOS Scriptable polls <code className="bg-slate-200 px-1 rounded">GET /check</code> every 30 min.
              If <code className="bg-slate-200 px-1 rounded">"remind": true</code>, trigger native notification.
            </p>
          </div>

          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.path}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl"
              >
                <span
                  className={`${methodColors[endpoint.method]} text-white text-xs font-bold px-2 py-1 rounded`}
                >
                  {endpoint.method}
                </span>
                <div className="flex-1">
                  <code className="text-sm text-slate-700 font-mono">{endpoint.path}</code>
                  <p className="text-xs text-slate-500 mt-1">{endpoint.description}</p>
                  {endpoint.params && (
                    <code className="text-xs text-slate-600 bg-slate-200 px-2 py-1 rounded mt-2 inline-block">
                      {endpoint.params}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
