import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Code, FileCode, ChevronDown, Copy, Check, Star, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CVDPViewer = () => {
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ category: 'all', difficulty: 'all', status: [] });
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [expandedContextFiles, setExpandedContextFiles] = useState(new Set());
  const [expandedHarnessFiles, setExpandedHarnessFiles] = useState(new Set());
  const [expandedPatchFiles, setExpandedPatchFiles] = useState(new Set());
  const [copiedFiles, setCopiedFiles] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [solved, setSolved] = useState(new Set());
  const [patchSolutions, setPatchSolutions] = useState({});
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);
  const filterDropdownRef = useRef(null);

  const MIN_SIDEBAR_WIDTH = 250;
  const MAX_SIDEBAR_WIDTH = window.innerWidth * 0.5;

  const categories = {
    'cid002': { name: 'RTL Code Completion' },
    'cid003': { name: 'RTL Spec to Code' },
    'cid004': { name: 'RTL Code Modification' },
    'cid005': { name: 'RTL Module Reuse' },
    'cid006': { name: 'RTL-Spec Correspondence' },
    'cid007': { name: 'RTL Code Improvement' },
    'cid008': { name: 'Testbench-Plan Correspondence' },
    'cid009': { name: 'RTL Q&A' },
    'cid010': { name: 'Testbench Q&A' },
    'cid012': { name: 'Testbench Stimulus Generation' },
    'cid013': { name: 'Testbench Checker Generation' },
    'cid014': { name: 'Assertion Generation' },
    'cid016': { name: 'Debugging / Bug Fixing' }
  };

  const difficulties = {
    'easy': { color: 'green', label: 'Easy' },
    'medium': { color: 'yellow', label: 'Medium' },
    'hard': { color: 'red', label: 'Hard' }
  };

  useEffect(() => {
    loadSavedProblems();
    loadFavorites();
    loadSolved();
    
    // Close filter dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadSavedProblems = () => {
    try {
      const saved = localStorage.getItem('cvdp-problems');
      if (saved) {
        const parsedProblems = JSON.parse(saved);
        setProblems(parsedProblems);
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

  const loadFavorites = () => {
    try {
      const saved = localStorage.getItem('cvdp-favorites');
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.log('No saved favorites found');
    }
  };

  const loadSolved = () => {
    try {
      const saved = localStorage.getItem('cvdp-solved');
      if (saved) {
        setSolved(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.log('No saved solved found');
    }
  };

  const toggleFavorite = (problemId, e) => {
    if (e) {
      e.stopPropagation();
    }
    const newFavorites = new Set(favorites);
    if (newFavorites.has(problemId)) {
      newFavorites.delete(problemId);
    } else {
      newFavorites.add(problemId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('cvdp-favorites', JSON.stringify([...newFavorites]));
  };

  const toggleSolved = (problemId, e) => {
    if (e) {
      e.stopPropagation();
    }
    const newSolved = new Set(solved);
    if (newSolved.has(problemId)) {
      newSolved.delete(problemId);
    } else {
      newSolved.add(problemId);
    }
    setSolved(newSolved);
    localStorage.setItem('cvdp-solved', JSON.stringify([...newSolved]));
  };

  // Recursive function to extract all nested content
  const extractNestedContent = (obj, parentKey = '') => {
    const result = {};
    
    if (obj === null || obj === undefined) {
      return result;
    }
    
    if (typeof obj !== 'object') {
      return { [parentKey || 'value']: String(obj) };
    }
    
    if (Array.isArray(obj)) {
      return { [parentKey || 'array']: JSON.stringify(obj, null, 2) };
    }
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = parentKey ? `${parentKey}/${key}` : key;
      
      if (value === null || value === undefined) {
        result[newKey] = 'null';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively extract nested objects
        const nested = extractNestedContent(value, newKey);
        Object.assign(result, nested);
      } else if (Array.isArray(value)) {
        result[newKey] = JSON.stringify(value, null, 2);
      } else {
        result[newKey] = String(value);
      }
    });
    
    return result;
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
          
          // Determine if agentic or non-agentic based on structure
          if (problem.prompt) {
            isAgentic = true;
            description = problem.prompt || 'No description available';
            promptText = problem.prompt;
            
            // Extract all context files recursively
            if (problem.context) {
              contextData = extractNestedContent(problem.context);
            }
            
            // Extract patch files recursively
            if (problem.patch) {
              patchData = extractNestedContent(problem.patch);
            }
            
            // Extract harness files recursively
            if (problem.harness) {
              harnessData = extractNestedContent(problem.harness);
            }
          } else if (problem.input || problem.output) {
            isAgentic = false;
            
            // Handle input (can be string or object with prompt)
            if (problem.input) {
              if (typeof problem.input === 'object') {
                // Extract prompt from input object
                if (problem.input.prompt) {
                  description = String(problem.input.prompt);
                  promptText = String(problem.input.prompt);
                }
                
                // Extract all other fields from input as context
                const inputContext = { ...problem.input };
                delete inputContext.prompt;
                if (Object.keys(inputContext).length > 0) {
                  contextData = extractNestedContent(inputContext, 'input');
                }
              } else if (typeof problem.input === 'string') {
                description = problem.input;
                promptText = problem.input;
              }
            }
            
            // Extract output as patch
            if (problem.output) {
              if (typeof problem.output === 'object') {
                patchData = extractNestedContent(problem.output, 'output');
              } else {
                patchData = { 'expected_output': String(problem.output) };
              }
            }
            
            // Extract harness files recursively
            if (problem.harness) {
              harnessData = extractNestedContent(problem.harness);
            }
          }
          
          if (!description && !promptText) {
            description = 'No description available';
            promptText = 'No prompt available';
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
    
    // Status filter
    if (filter.status.length > 0) {
      const isFavorite = favorites.has(p.id);
      const isSolved = solved.has(p.id);
      
      const hasFavoriteFilter = filter.status.includes('favorite');
      const hasSolvedFilter = filter.status.includes('solved');
      
      if (hasFavoriteFilter && hasSolvedFilter) {
        if (!isFavorite || !isSolved) return false;
      } else if (hasFavoriteFilter) {
        if (!isFavorite) return false;
      } else if (hasSolvedFilter) {
        if (!isSolved) return false;
      }
    }
    
    return true;
  });

  const selectProblem = (problem) => {
    setSelectedProblem(problem);
    setShowSolution(false);
    setExpandedContextFiles(new Set());
    setExpandedHarnessFiles(new Set());
    setCopiedFiles(new Set());
    loadPatchSolutions(problem.id);
    
    // Auto-expand editable patch files, collapse non-editable
    const newExpandedPatchFiles = new Set();
    if (problem.patchData) {
      Object.entries(problem.patchData).forEach(([filename, content]) => {
        const isEmpty = !content || content.trim() === '' || content === 'null';
        if (isEmpty) {
          newExpandedPatchFiles.add(filename);
        }
      });
    }
    setExpandedPatchFiles(newExpandedPatchFiles);
  };

  const loadPatchSolutions = (problemId) => {
    try {
      const key = `patch-solutions-${problemId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setPatchSolutions(JSON.parse(saved));
      } else {
        setPatchSolutions({});
      }
    } catch (error) {
      console.log('No saved patch solutions found');
      setPatchSolutions({});
    }
  };

  const savePatchSolution = (filename, content) => {
    if (!selectedProblem) return;
    
    const newSolutions = { ...patchSolutions, [filename]: content };
    setPatchSolutions(newSolutions);
    
    try {
      const key = `patch-solutions-${selectedProblem.id}`;
      localStorage.setItem(key, JSON.stringify(newSolutions));
    } catch (error) {
      console.error('Failed to save patch solution');
    }
  };

  const CategoryBadge = ({ categoryId }) => {
    const category = categories[categoryId] || { name: categoryId };
    
    return (
      <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
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

  const togglePatchFile = (key) => {
    const newSet = new Set(expandedPatchFiles);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedPatchFiles(newSet);
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

  const handleStatusFilterChange = (value) => {
    const newStatus = [...filter.status];
    const index = newStatus.indexOf(value);
    
    if (index > -1) {
      newStatus.splice(index, 1);
    } else {
      newStatus.push(value);
    }
    
    setFilter({...filter, status: newStatus});
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
            <p className="mb-2 font-semibold">Supported categories:</p>
            <p className="text-xs">cid002-cid010, cid012-cid014, cid016</p>
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
                  <option value="cid003">cid003 - RTL Spec to Code</option>
                  <option value="cid004">cid004 - RTL Code Modification</option>
                  <option value="cid005">cid005 - RTL Module Reuse</option>
                  <option value="cid006">cid006 - RTL-Spec Correspondence</option>
                  <option value="cid007">cid007 - RTL Code Improvement</option>
                  <option value="cid008">cid008 - Testbench-Plan Correspondence</option>
                  <option value="cid009">cid009 - RTL Q&A</option>
                  <option value="cid010">cid010 - Testbench Q&A</option>
                  <option value="cid012">cid012 - Testbench Stimulus Generation</option>
                  <option value="cid013">cid013 - Testbench Checker Generation</option>
                  <option value="cid014">cid014 - Assertion Generation</option>
                  <option value="cid016">cid016 - Debugging / Bug Fixing</option>
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

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Filters</label>
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                  >
                    <span className="text-gray-700">
                      {filter.status.length === 0 ? 'None' : 
                       filter.status.length === 1 ? (filter.status[0] === 'favorite' ? 'Favorites' : 'Solved') :
                       'Favorites & Solved'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isFilterDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
                      <div className="p-2 space-y-2">
                        <label className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={filter.status.includes('favorite')}
                            onChange={() => handleStatusFilterChange('favorite')}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Favorites</span>
                        </label>
                        <label className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={filter.status.includes('solved')}
                            onChange={() => handleStatusFilterChange('solved')}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Solved</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
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
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="font-semibold text-sm text-gray-900 flex-1 leading-tight">
                    {problem.title}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <DifficultyBadge difficulty={problem.difficulty} />
                    <button
                      onClick={(e) => toggleSolved(problem.id, e)}
                      className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                        solved.has(problem.id) ? 'text-green-600' : 'text-gray-400'
                      }`}
                      title={solved.has(problem.id) ? 'Mark as unsolved' : 'Mark as solved'}
                    >
                      <CheckCircle className="w-4 h-4" fill="none" strokeWidth={solved.has(problem.id) ? 2.5 : 2} />
                    </button>
                    <button
                      onClick={(e) => toggleFavorite(problem.id, e)}
                      className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                        favorites.has(problem.id) ? 'text-yellow-500' : 'text-gray-400'
                      }`}
                      title={favorites.has(problem.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className="w-4 h-4" fill={favorites.has(problem.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge categoryId={problem.category} />
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
                    <CategoryBadge categoryId={selectedProblem.category} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <DifficultyBadge difficulty={selectedProblem.difficulty} />
                    <span className="text-xs text-gray-500 font-mono">
                      {selectedProblem.id}
                    </span>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <button
                    onClick={(e) => toggleSolved(selectedProblem.id, e)}
                    className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                      solved.has(selectedProblem.id) ? 'text-green-600' : 'text-gray-400'
                    }`}
                    title={solved.has(selectedProblem.id) ? 'Mark as unsolved' : 'Mark as solved'}
                  >
                    <CheckCircle className="w-6 h-6" fill="none" strokeWidth={solved.has(selectedProblem.id) ? 2.5 : 2} />
                  </button>
                  <button
                    onClick={(e) => toggleFavorite(selectedProblem.id, e)}
                    className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                      favorites.has(selectedProblem.id) ? 'text-yellow-500' : 'text-gray-400'
                    }`}
                    title={favorites.has(selectedProblem.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star className="w-6 h-6" fill={favorites.has(selectedProblem.id) ? 'currentColor' : 'none'} />
                  </button>
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
                        const isMarkdown = key.endsWith('.md') || key.includes('.md/');
                        
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
                                {isMarkdown ? (
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
                        const isMarkdown = filename.endsWith('.md') || filename.includes('.md/');
                        
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
                                {isMarkdown ? (
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

            {selectedProblem.patchData && Object.keys(selectedProblem.patchData).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedProblem.isAgentic ? 
                      (selectedProblem.systemMessage ? 'Expected Patch' : 'Expected Solution') :
                      'Expected Output'
                    }
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(selectedProblem.patchData).map(([filename, content]) => {
                    const displayContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                    const isEmpty = !content || content.trim() === '' || content === 'null';
                    const isExpanded = expandedPatchFiles.has(filename);
                    const fileId = `patch-${filename}`;
                    const isCopied = copiedFiles.has(fileId);
                    const userContent = patchSolutions[filename] || '';
                    
                    // Check if content has markdown formatting
                    const hasMarkdown = !isEmpty && (
                      displayContent.includes('#') || 
                      displayContent.includes('**') || 
                      displayContent.includes('*') || 
                      displayContent.includes('`') ||
                      displayContent.includes('[') ||
                      displayContent.includes('|') ||
                      displayContent.includes('>') ||
                      /^\d+\./.test(displayContent) ||
                      /^-\s/.test(displayContent)
                    );
                    
                    return (
                      <div key={filename} className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                        <div 
                          className="bg-amber-100 px-4 py-2 border-b border-amber-200 flex items-center justify-between"
                        >
                          <button 
                            className="flex items-center gap-2 flex-1 cursor-pointer text-left"
                            onClick={() => togglePatchFile(filename)}
                          >
                            <ChevronDown 
                              className={`w-4 h-4 text-amber-900 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-0' : 'rotate-[-90deg]'}`}
                            />
                            <span className="font-semibold text-amber-900 text-sm font-mono">{filename}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const contentToCopy = isEmpty ? userContent : displayContent;
                              copyToClipboard(contentToCopy, fileId);
                            }}
                            className="ml-2 p-1.5 hover:bg-amber-200 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                            title="Copy file content"
                          >
                            {isCopied ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-amber-900" />
                            )}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="p-4 bg-white">
                            {isEmpty ? (
                              <div>
                                <textarea
                                  value={userContent}
                                  onChange={(e) => savePatchSolution(filename, e.target.value)}
                                  placeholder="Write your solution here..."
                                  className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none bg-white"
                                />
                                <div className="mt-2 text-xs text-gray-500">
                                  {userContent.length} characters
                                </div>
                              </div>
                            ) : (
                              <div>
                                {hasMarkdown ? (
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
                        )}
                      </div>
                    );
                  })}
                </div>
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
