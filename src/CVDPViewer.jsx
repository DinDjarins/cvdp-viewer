import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Code, FileCode, ChevronDown, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CVDPViewer = () => {
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [userSolution, setUserSolution] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ category: 'all', difficulty: 'all' });
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [expandedContextFiles, setExpandedContextFiles] = useState(new Set());
  const [expandedHarnessFiles, setExpandedHarnessFiles] = useState(new Set());
  const [copiedFiles, setCopiedFiles] = useState(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);

  const MIN_SIDEBAR_WIDTH = 250;
  const MAX_SIDEBAR_WIDTH = window.innerWidth * 0.5;

  const categories = {
    'cid002': { name: 'RTL Code Completion', color: 'blue' },
    'cid003': { name: 'Specification to RTL', color: 'green' },
    'cid004': { name: 'RTL Code Modification', color: 'purple' },
    'cid005': { name: 'Code Translation', color: 'amber' },
    'cid007': { name: 'Code Improvement', color: 'orange' },
    'cid012': { name: 'Testbench Stimulus Generation', color: 'pink' },
    'cid013': { name: 'Testbench Checker Generation', color: 'rose' },
    'cid014': { name: 'Assertion Generation', color: 'red' },
    'cid016': { name: 'Debugging', color: 'yellow' },
    'cid020': { name: 'RTL to Specification', color: 'teal' },
    'cid021': { name: 'Specification to Testbench', color: 'cyan' },
    'cid022': { name: 'RTL Technical Q&A', color: 'indigo' },
    'cid023': { name: 'Testbench Technical Q&A', color: 'violet' },
    'cid024': { name: 'RTL-Spec Matching', color: 'lime' }
  };

  const difficulties = {
    'easy': { color: 'green', label: 'Easy' },
    'medium': { color: 'yellow', label: 'Medium' },
    'hard': { color: 'red', label: 'Hard' }
  };

  useEffect(() => {
    loadSavedProblems();
  }, []);

  const loadSavedProblems = async () => {
    try {
      const saved = localStorage.getItem('cvdp-problems');
      if (saved) {
        const parsedProblems = JSON.parse(saved);
        const cleanedProblems = parsedProblems.map(p => ({
          ...p,
          id: String(p.id || ''),
          title: String(p.title || ''),
          category: String(p.category || ''),
          difficulty: String(p.difficulty || ''),
          description: String(p.description || ''),
          prompt: String(p.prompt || ''),
          contextData: p.contextData || {},
          patchData: p.patchData || {},
          harnessData: p.harnessData || {},
          systemMessage: p.systemMessage ? String(p.systemMessage) : null,
          isAgentic: p.isAgentic !== undefined ? p.isAgentic : true
        }));
        setProblems(cleanedProblems);
        setFileUploaded(true);
        const savedFileName = localStorage.getItem('cvdp-filename');
        if (savedFileName) {
          setUploadedFileName(savedFileName);
        }
      }
    } catch (error) {
      console.log('No saved problems found');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      const parsedProblems = [];

      for (const line of lines) {
        try {
          const problem = JSON.parse(line);
          
          const categoryId = problem.categories?.[0] || 'unknown';
          const difficulty = problem.categories?.[1] || 'medium';
          
          let description = '';
          let promptText = '';
          let contextData = {};
          let patchData = {};
          let harnessData = {};
          let isAgentic = false;
          
          if (problem.prompt) {
            isAgentic = true;
            description = problem.prompt || 'No description available';
            promptText = problem.prompt;
            if (problem.context && typeof problem.context === 'object') {
              contextData = JSON.parse(JSON.stringify(problem.context));
            }
            if (problem.patch && typeof problem.patch === 'object') {
              patchData = JSON.parse(JSON.stringify(problem.patch));
            }
            if (problem.harness && typeof problem.harness === 'object') {
              harnessData = JSON.parse(JSON.stringify(problem.harness));
            }
          } else if (problem.input || problem.output) {
            isAgentic = false;
            if (problem.input && typeof problem.input === 'object' && problem.input.prompt) {
              description = String(problem.input.prompt);
              promptText = String(problem.input.prompt);
            } else if (typeof problem.input === 'string') {
              description = problem.input;
              promptText = problem.input;
            } else {
              description = 'No description available';
              promptText = '';
            }
            
            if (problem.output) {
              patchData = { 'expected_output': String(problem.output) };
            }
            
            if (problem.harness && typeof problem.harness === 'object') {
              if (problem.harness.files && typeof problem.harness.files === 'object') {
                Object.keys(problem.harness.files).forEach(filename => {
                  const content = problem.harness.files[filename];
                  harnessData[filename] = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                });
              } else {
                Object.keys(problem.harness).forEach(key => {
                  const value = problem.harness[key];
                  harnessData[key] = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
                });
              }
            }
          }
          
          parsedProblems.push({
            id: String(problem.id || `problem_${parsedProblems.length}`),
            title: String(problem.id || 'Unknown Problem')
              .replace(/_/g, ' ')
              .replace('cvdp agentic ', '')
              .replace('cvdp ', '')
              .replace(/copilot\s*/gi, '')
              .replace(/\s+\d+$/, '')
              .trim(),
            category: String(categoryId),
            difficulty: String(difficulty),
            description: String(description),
            prompt: String(promptText),
            contextData: contextData,
            patchData: patchData,
            harnessData: harnessData,
            systemMessage: problem.system_message ? String(problem.system_message) : null,
            isAgentic: isAgentic
          });
        } catch (e) {
          console.error('Error parsing line:', e);
        }
      }

      setProblems(parsedProblems);
      setFileUploaded(true);
      setUploadedFileName(file.name);
      localStorage.setItem('cvdp-problems', JSON.stringify(parsedProblems));
      localStorage.setItem('cvdp-filename', file.name);
      
    } catch (error) {
      alert('Error reading file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProblems = problems.filter(p => {
    if (filter.category !== 'all' && p.category !== filter.category) return false;
    if (filter.difficulty !== 'all' && p.difficulty !== filter.difficulty) return false;
    return true;
  });

  const selectProblem = (problem) => {
    setSelectedProblem(problem);
    setShowSolution(false);
    setUserSolution('');
    setExpandedContextFiles(new Set());
    setExpandedHarnessFiles(new Set());
    setCopiedFiles(new Set());
  };

  const saveSolution = async () => {
    if (!selectedProblem || !userSolution.trim()) return;
    
    try {
      const key = `solution-${selectedProblem.id}`;
      localStorage.setItem(key, userSolution);
      alert('Solution saved successfully!');
    } catch (error) {
      alert('Failed to save solution');
    }
  };

  const loadUserSolution = async () => {
    if (!selectedProblem) return;
    
    try {
      const key = `solution-${selectedProblem.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setUserSolution(saved);
      }
    } catch (error) {
      console.log('No saved solution found');
    }
  };

  useEffect(() => {
    if (selectedProblem) {
      loadUserSolution();
    }
  }, [selectedProblem]);

  const CategoryBadge = ({ categoryId }) => {
    const category = categories[categoryId] || { name: categoryId, color: 'gray' };
    const bgColors = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      purple: 'bg-purple-100 text-purple-800',
      amber: 'bg-amber-100 text-amber-800',
      orange: 'bg-orange-100 text-orange-800',
      pink: 'bg-pink-100 text-pink-800',
      rose: 'bg-rose-100 text-rose-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      teal: 'bg-teal-100 text-teal-800',
      cyan: 'bg-cyan-100 text-cyan-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      violet: 'bg-violet-100 text-violet-800',
      lime: 'bg-lime-100 text-lime-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${bgColors[category.color]}`}>
        {category.name}
      </span>
    );
  };

  const DifficultyBadge = ({ difficulty }) => {
    const diff = difficulties[difficulty] || { color: 'gray', label: difficulty };
    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[diff.color]}`}>
        {diff.label.toUpperCase()}
      </span>
    );
  };

  const toggleContextFile = (key) => {
    const newSet = new Set(expandedContextFiles);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedContextFiles(newSet);
  };

  const toggleHarnessFile = (key) => {
    const newSet = new Set(expandedHarnessFiles);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedHarnessFiles(newSet);
  };

  const copyToClipboard = async (text, fileId) => {
    try {
      await navigator.clipboard.writeText(text);
      const newSet = new Set(copiedFiles);
      newSet.add(fileId);
      setCopiedFiles(newSet);
      
      setTimeout(() => {
        setCopiedFiles(prev => {
          const updated = new Set(prev);
          updated.delete(fileId);
          return updated;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleMouseDown = (e) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    
    const newWidth = e.clientX;
    
    if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing JSONL file...</p>
        </div>
      </div>
    );
  }

  if (!fileUploaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <Code className="w-16 h-16 mx-auto mb-4 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">CVDP Viewer</h1>
            <p className="text-gray-600 text-sm">Upload a JSONL file to get started</p>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".jsonl,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <FileCode className="w-12 h-12 text-gray-400 mb-3" />
              <span className="text-sm font-medium text-gray-700 mb-1">
                Click to upload JSONL file
              </span>
              <span className="text-xs text-gray-500">
                CVDP benchmark dataset format
              </span>
            </label>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p className="mb-2 font-semibold">Supported formats:</p>
            <div className="space-y-2">
              <div>
                <p className="font-medium mb-1">Agentic format:</p>
                <code className="block bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {`{"id":"...","categories":["cid002","easy"],"prompt":"...","context":{...},"patch":{...},"harness":{...}}`}
                </code>
              </div>
              <div>
                <p className="font-medium mb-1">Non-agentic format:</p>
                <code className="block bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {`{"id":"...","categories":["cid002","easy"],"input":"...","output":"...","harness":{...}}`}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <style>{`
        .markdown-content h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #1f2937;
        }
        .markdown-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #1f2937;
        }
        .markdown-content h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #374151;
        }
        .markdown-content p {
          margin-bottom: 0.75rem;
          line-height: 1.6;
          color: #4b5563;
        }
        .markdown-content ul, .markdown-content ol {
          margin-left: 1.5rem;
          margin-bottom: 0.75rem;
          list-style-position: outside;
        }
        .markdown-content ul {
          list-style-type: disc;
        }
        .markdown-content ol {
          list-style-type: decimal;
        }
        .markdown-content li {
          margin-bottom: 0.25rem;
          line-height: 1.6;
          display: list-item;
        }
        .markdown-content ul ul {
          list-style-type: circle;
          margin-top: 0.25rem;
        }
        .markdown-content ul ul ul {
          list-style-type: square;
        }
        .markdown-content code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: 'Courier New', monospace;
          color: #ef4444;
        }
        .markdown-content pre {
          background-color: #1f2937;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
          color: #e5e7eb;
          font-size: 0.875rem;
        }
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .markdown-content th {
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 0.5rem;
          text-align: left;
          font-weight: 600;
          color: #1f2937;
        }
        .markdown-content td {
          border: 1px solid #d1d5db;
          padding: 0.5rem;
          color: #4b5563;
        }
        .markdown-content tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .markdown-content blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          margin-left: 0;
          margin-bottom: 1rem;
          color: #6b7280;
          font-style: italic;
        }
        .markdown-content a {
          color: #3b82f6;
          text-decoration: underline;
        }
        .markdown-content a:hover {
          color: #2563eb;
        }
        .markdown-content strong {
          font-weight: 600;
          color: #1f2937;
        }
        .markdown-content em {
          font-style: italic;
        }
        .markdown-content hr {
          border: none;
          border-top: 1px solid #d1d5db;
          margin: 1.5rem 0;
        }
      `}</style>
      <div className="flex">
        <div 
          ref={sidebarRef}
          className="bg-white border-r border-gray-200 overflow-y-auto overflow-x-hidden relative"
          style={{ width: `${sidebarWidth}px`, minWidth: `${MIN_SIDEBAR_WIDTH}px` }}
        >
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
            <h1 className="text-xl font-bold text-white mb-2">CVDP Viewer</h1>
            <p className="text-blue-100 text-xs">Comprehensive Verilog Design Problems</p>
            {uploadedFileName && (
              <div className="mt-2 text-xs text-blue-100 flex items-center gap-1">
                <FileCode className="w-3 h-3" />
                <span className="font-mono truncate">{uploadedFileName}</span>
              </div>
            )}
            <button
              onClick={() => {
                setFileUploaded(false);
                setProblems([]);
                setSelectedProblem(null);
                setUploadedFileName('');
                localStorage.removeItem('cvdp-problems');
                localStorage.removeItem('cvdp-filename');
              }}
              className="mt-2 text-xs text-blue-100 hover:text-white underline"
            >
              Upload different file
            </button>
          </div>
          
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filter.category}
                  onChange={(e) => setFilter({...filter, category: e.target.value})}
                >
                  <option value="all">All Categories</option>
                  <option value="cid002">cid002 - RTL Code Completion</option>
                  <option value="cid003">cid003 - Specification to RTL</option>
                  <option value="cid004">cid004 - RTL Code Modification</option>
                  <option value="cid005">cid005 - Code Translation</option>
                  <option value="cid007">cid007 - Code Improvement</option>
                  <option value="cid012">cid012 - Testbench Stimulus Generation</option>
                  <option value="cid013">cid013 - Testbench Checker Generation</option>
                  <option value="cid014">cid014 - Assertion Generation</option>
                  <option value="cid016">cid016 - Debugging</option>
                  <option value="cid020">cid020 - RTL to Specification</option>
                  <option value="cid021">cid021 - Specification to Testbench</option>
                  <option value="cid022">cid022 - RTL Technical Q&A</option>
                  <option value="cid023">cid023 - Testbench Technical Q&A</option>
                  <option value="cid024">cid024 - RTL-Spec Matching</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Difficulty</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filter.difficulty}
                  onChange={(e) => setFilter({...filter, difficulty: e.target.value})}
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            
            <div className="mt-3 text-xs text-gray-600">
              Showing {filteredProblems.length} of {problems.length} problems
            </div>
          </div>

          <div className="p-2">
            {filteredProblems.map((problem) => (
              <div
                key={problem.id}
                onClick={() => selectProblem(problem)}
                className={`p-3 mb-2 rounded-lg cursor-pointer transition-all ${
                  selectedProblem?.id === problem.id
                    ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                    : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm text-gray-900 flex-1 leading-tight">
                    {problem.title}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge categoryId={problem.category} />
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
                <div className="mt-2 text-xs text-gray-500 font-mono">
                  {problem.id}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="w-2 h-full bg-gray-300 cursor-col-resize hover:bg-blue-400 transition-colors"
          onMouseDown={handleMouseDown}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedProblem ? (
          <div className="max-w-5xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedProblem.title}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <CategoryBadge categoryId={selectedProblem.category} />
                    <DifficultyBadge difficulty={selectedProblem.difficulty} />
                    <span className="text-xs text-gray-500 font-mono">
                      {selectedProblem.id}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <Code className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileCode className="w-5 h-5" />
                    Problem Description
                  </h3>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedProblem.description}
                    </ReactMarkdown>
                  </div>
                </div>

                {selectedProblem.contextData && Object.keys(selectedProblem.contextData).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Context Files</h3>
                    <div className="space-y-3">
                      {Object.entries(selectedProblem.contextData).map(([key, value]) => {
                        const isExpanded = expandedContextFiles.has(key);
                        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                        const fileId = `context-${key}`;
                        const isCopied = copiedFiles.has(fileId);
                        return (
                          <div key={key} className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                            <div 
                              className="bg-blue-100 px-4 py-2 border-b border-blue-200 flex items-center justify-between"
                            >
                              <button 
                                className="flex items-center gap-2 flex-1 cursor-pointer text-left"
                                onClick={() => toggleContextFile(key)}
                              >
                                <ChevronDown 
                                  className={`w-4 h-4 text-blue-900 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-0' : 'rotate-[-90deg]'}`}
                                />
                                <span className="font-semibold text-blue-900 text-sm font-mono">{key}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(displayValue, fileId);
                                }}
                                className="ml-2 p-1.5 hover:bg-blue-200 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                                title="Copy file content"
                              >
                                {isCopied ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4 text-blue-900" />
                                )}
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="p-4 bg-gray-50">
                                {key.endsWith('.md') ? (
                                  <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {displayValue || 'N/A'}
                                    </ReactMarkdown>
                                  </div>
                                ) : (
                                  <pre className="text-xs font-mono text-gray-800 whitespace-pre overflow-x-auto">
                                    {displayValue || 'N/A'}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedProblem.harnessData && Object.keys(selectedProblem.harnessData).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Harness Files</h3>
                    <div className="space-y-3">
                      {Object.entries(selectedProblem.harnessData).map(([filename, content]) => {
                        const isExpanded = expandedHarnessFiles.has(filename);
                        const displayContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                        const fileId = `harness-${filename}`;
                        const isCopied = copiedFiles.has(fileId);
                        return (
                          <div key={filename} className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                            <div 
                              className="bg-purple-100 px-4 py-2 border-b border-purple-200 flex items-center justify-between"
                            >
                              <button 
                                className="flex items-center gap-2 flex-1 cursor-pointer text-left"
                                onClick={() => toggleHarnessFile(filename)}
                              >
                                <ChevronDown 
                                  className={`w-4 h-4 text-purple-900 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-0' : 'rotate-[-90deg]'}`}
                                />
                                <span className="font-semibold text-purple-900 text-sm font-mono">{filename}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(displayContent, fileId);
                                }}
                                className="ml-2 p-1.5 hover:bg-purple-200 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                                title="Copy file content"
                              >
                                {isCopied ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4 text-purple-900" />
                                )}
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="p-4 bg-gray-50">
                                {filename.endsWith('.md') ? (
                                  <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {displayContent}
                                    </ReactMarkdown>
                                  </div>
                                ) : (
                                  <pre className="text-xs font-mono text-gray-800 whitespace-pre overflow-x-auto">
                                    {displayContent}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Your Solution</h3>
                <button
                  onClick={saveSolution}
                  disabled={!userSolution.trim()}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    userSolution.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Save Solution
                </button>
              </div>
              
              <textarea
                value={userSolution}
                onChange={(e) => setUserSolution(e.target.value)}
                placeholder="Write your SystemVerilog solution here..."
                className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="mt-2 text-xs text-gray-500">
                {userSolution.length} characters
              </div>
            </div>

            {selectedProblem.patchData && Object.keys(selectedProblem.patchData).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedProblem.isAgentic ? 
                      (selectedProblem.systemMessage ? 'Expected Patch' : 'Expected Solution') :
                      'Expected Output'
                    }
                  </h3>
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    {showSolution ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Hide Solution
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Show Solution
                      </>
                    )}
                  </button>
                </div>
                
                {showSolution && (
                  <div className="space-y-3">
                    {Object.entries(selectedProblem.patchData).map(([filename, patch]) => {
                      const displayPatch = typeof patch === 'object' ? JSON.stringify(patch, null, 2) : String(patch);
                      return (
                        <div key={filename}>
                          {filename !== 'solution' && filename !== 'expected_output' && (
                            <div className="text-sm font-semibold text-gray-700 mb-1">{filename}</div>
                          )}
                          <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-amber-50 p-4 rounded-lg border border-amber-200 overflow-x-auto font-mono">
                            {displayPatch || 'No solution available'}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Code className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Select a problem to get started</p>
              <p className="text-sm">Choose from {filteredProblems.length} available problems</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CVDPViewer;
