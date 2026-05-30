import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';
import { BookOpen, Search, Save, Trash2, Loader2, FileText, AlertCircle } from 'lucide-react';
import { useWt } from '@/store/wt';
import type { WtPolicyNote } from '@/types/wt';

const POLICY_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

async function getAvailableAnthropicModels(apiKey: string): Promise<string[]> {
  const resp = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });

  if (!resp.ok) return POLICY_MODELS;

  const data = await resp.json() as { data?: Array<{ id?: string }> };
  const available = (data.data || [])
    .map(model => model.id)
    .filter((id): id is string => Boolean(id));

  const preferred = POLICY_MODELS.filter(model => available.includes(model));
  const remainingClaudeModels = available.filter(model => model.startsWith('claude-') && !preferred.includes(model));
  return [...preferred, ...remainingClaudeModels];
}

async function callAnthropicPolicy(prompt: string, apiKey: string, model: string, withSearch: boolean): Promise<string> {
  const payload: Record<string, unknown> = {
    model,
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  };

  if (withSearch) {
    payload.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      },
    ];
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    if (resp.status === 401) throw new Error('INVALID_API_KEY');
    if (resp.status === 429) throw new Error('RATE_LIMITED');
    if (resp.status === 404 || errText.includes('not_found_error') || errText.includes('model:')) {
      throw new Error('MODEL_NOT_AVAILABLE');
    }
    if (errText.includes('web_search') || errText.includes('tool')) {
      throw new Error('WEB_SEARCH_NOT_AVAILABLE');
    }
    throw new Error('API_ERROR_' + resp.status + (errText ? ': ' + errText.slice(0, 200) : ''));
  }

  const data = await resp.json() as { content: Array<{ type: string; text?: string }> };
  const textBlocks = data.content
    .filter(b => b.type === 'text' && b.text)
    .map(b => b.text as string);

  return textBlocks.join('\n').trim() || 'No analysis returned.';
}

async function analyseUrl(url: string, apiKey: string): Promise<string> {
  let prompt = 'You are an HR compliance assistant. The user has provided the following URL for analysis:\n\n';
  prompt += url + '\n\n';
  prompt += 'Please fetch and analyse the content of this URL. ';
  prompt += 'In your response, cover:\n';
  prompt += '1. What the document is about (title, type, issuing authority)\n';
  prompt += '2. Key changes or requirements introduced\n';
  prompt += '3. What an HR officer should update or action as a result\n';
  prompt += '4. Any deadlines or effective dates mentioned\n\n';
  prompt += 'Format your response with clear sections using headers. Be concise and practical.';

  let lastError: unknown = null;
  const models = await getAvailableAnthropicModels(apiKey);
  for (const model of models) {
    try {
      const text = await callAnthropicPolicy(prompt, apiKey, model, true);
      return 'Model used: ' + model + '\n\n' + text;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'INVALID_API_KEY' || message === 'RATE_LIMITED') throw err;
      if (message === 'WEB_SEARCH_NOT_AVAILABLE') {
        const text = await callAnthropicPolicy(prompt + '\n\nIf you cannot access the URL directly, explain that web search is not available and provide a checklist for manual review.', apiKey, model, false);
        return 'Model used: ' + model + '\n\n' + text;
      }
    }
  }
  if (lastError instanceof Error && lastError.message === 'MODEL_NOT_AVAILABLE') {
    throw new Error('NO_AVAILABLE_MODEL');
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function NoteCard({ note, onDelete }: { note: WtPolicyNote; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const savedDate = new Date(note.savedAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={13} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400">{savedDate}</span>
              {note.isManual && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Manual</span>
              )}
            </div>
            {note.title && (
              <div className="text-sm font-semibold text-slate-800 mb-1">{note.title}</div>
            )}
            {note.url && !note.isManual && (
              <div className="text-xs text-blue-600 truncate mb-2">{note.url}</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-slate-400 hover:text-blue-600 px-2 py-1 rounded"
            >
              {expanded ? 'Hide' : 'View'}
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="text-red-300 hover:text-red-600 p-1 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-slate-50">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{note.analysis}</pre>
        </div>
      )}
    </div>
  );
}

export default function WtPolicyReader() {
  const { policyNotes, addPolicyNote, deletePolicyNote, apiKey, setApiKey } = useWt();
  const search = useSearch();

  const [url, setUrl] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  // Manual note state
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  // Read ?url= from query string (from Dashboard quick-check)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const qUrl = params.get('url');
    if (qUrl) setUrl(decodeURIComponent(qUrl));
  }, [search]);

  async function handleAnalyse() {
    if (!url.trim()) return;
    const key = localApiKey.trim();
    if (!key) {
      setError('Please enter your Anthropic API key.');
      return;
    }
    if (!key.startsWith('sk-ant-')) {
      setError('This does not look like an Anthropic API key. It should start with sk-ant-.');
      return;
    }
    setAnalysing(true);
    setError('');
    setResult('');
    try {
      const text = await analyseUrl(url.trim(), key);
      if (key !== apiKey) setApiKey(key);
      setResult(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'INVALID_API_KEY') {
        setError('Anthropic rejected this API key. Paste a valid Anthropic key, then click Analyse again.');
        if (key === apiKey) setApiKey('');
      } else if (message === 'RATE_LIMITED') {
        setError('Anthropic rate limit or credit limit reached. Try again later or use a key with available credits.');
      } else if (message === 'NO_AVAILABLE_MODEL' || message === 'MODEL_NOT_AVAILABLE') {
        setError('No supported Claude API model is available for this key. Please check the key in the Anthropic Console, billing, and model access.');
      } else {
        setError(message.replace(/^Error:\s*/, ''));
      }
    }
    setAnalysing(false);
  }

  function handleSave() {
    if (!result) return;
    addPolicyNote({
      url: url.trim(),
      title: url.trim().slice(0, 80),
      analysis: result,
      isManual: false,
    });
    setResult('');
    setUrl('');
  }

  function handleSaveManual() {
    if (!manualText.trim()) return;
    addPolicyNote({
      url: '',
      title: manualTitle.trim() || 'Manual note',
      analysis: manualText.trim(),
      isManual: true,
    });
    setManualTitle('');
    setManualText('');
    setShowManual(false);
  }

  const sorted = [...policyNotes].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Policy Reader</h1>
        <p className="text-slate-500 text-sm mt-0.5">Analyse policy URLs and save compliance notes</p>
      </div>

      {/* AI URL Analyser */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Search size={14} />
          AI URL Analyser
        </h2>

        {/* API key */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Anthropic API Key</label>
          <div className="flex gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={localApiKey}
              onChange={e => setLocalApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              onClick={() => setShowApiKey(s => !s)}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => {
                const key = localApiKey.trim();
                if (!key) {
                  setApiKey('');
                  setError('');
                  return;
                }
                if (!key.startsWith('sk-ant-')) {
                  setError('This does not look like an Anthropic API key. It should start with sk-ant-.');
                  return;
                }
                setApiKey(key);
                setError('Key saved locally. Click Analyse to test it with Anthropic.');
              }}
              className="bg-slate-700 hover:bg-slate-800 text-white text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Save key
            </button>
            <button
              onClick={() => {
                setLocalApiKey('');
                setApiKey('');
                setError('');
              }}
              className="bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </div>

        {/* URL input */}
        <div className="flex gap-2 mb-4">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAnalyse(); }}
            placeholder="https://mohre.gov.ae/... or any policy/circular URL"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAnalyse}
            disabled={!url.trim() || analysing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {analysing ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
            {analysing ? 'Analysing...' : 'Analyse'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{result}</pre>
            </div>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Save size={14} />
              Save note
            </button>
          </div>
        )}
      </div>

      {/* Saved Notes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText size={14} />
            Saved Policy Notes
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{policyNotes.length}</span>
          </h2>
          <button
            onClick={() => setShowManual(s => !s)}
            className="text-xs text-blue-600 hover:underline"
          >
            + Manual note
          </button>
        </div>

        {/* Manual note form */}
        {showManual && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
              <input
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Note *</label>
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                rows={4}
                placeholder="Your notes, observations, or policy summary..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveManual}
                disabled={!manualText.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowManual(false)}
                className="text-slate-600 text-sm px-4 py-1.5 border border-gray-300 rounded-lg transition-colors bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No saved notes yet. Analyse a URL or add a manual note.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(note => (
              <NoteCard key={note.id} note={note} onDelete={deletePolicyNote} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
 
