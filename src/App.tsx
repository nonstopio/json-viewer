import { useState, useCallback, useEffect } from 'react';
import { FileCode, BarChart3, Upload, Copy, Square, Trash2, FileText, FoldVertical, UnfoldVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { JsonInput } from './components/JsonInput';
import { JsonTree } from './components/JsonTree';
import { ThemeToggle } from './components/ThemeToggle';
import { JsonTableView } from './components/JsonTableView';
import { ResizablePanel } from './components/ResizablePanel';
import { jsonParser } from './utils/jsonParser';
import { trackEvent } from './utils/analytics';
import { JsonNode } from './types/json';

function App() {
  const [jsonData, setJsonData] = useState<any>(null);
  const [nodes, setNodes] = useState<JsonNode[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<JsonNode[]>([]);
  const [originalNodes, setOriginalNodes] = useState<JsonNode[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchMatchIndices, setSearchMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'viewer' | 'text'>('text');
  const [inputText, setInputText] = useState<string>('');
  const [selectedNodePath, setSelectedNodePath] = useState<string>('');

  useEffect(() => {
    trackEvent('app_loaded', {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }, []);

  const handleJsonSubmit = useCallback(async (jsonText: string, shouldSwitchTab = false) => {
    setIsLoading(true);
    setError('');
    setInputText(jsonText);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = jsonParser.parseJson(jsonText);
      
      if (result.success && result.data !== undefined) {
        setJsonData(result.data);
        const newNodes = jsonParser.convertToNodes(result.data);
        setNodes(newNodes);
        setFilteredNodes(newNodes);
        setOriginalNodes(newNodes);
        // Auto-select root node when data is loaded
        setSelectedNodePath('root');
        // Switch to viewer tab only if parsing was successful and requested
        if (shouldSwitchTab) {
          setActiveTab('viewer');
        }
      } else {
        setError(result.error || 'Failed to parse JSON');
        setJsonData(null);
        setNodes([]);
        setFilteredNodes([]);
        setOriginalNodes([]);
      }
    } catch (err) {
      setError('Unexpected error occurred while parsing JSON');
      trackEvent('error_encountered', {
        errorType: 'unexpected_parse_error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);


  const handleToggleNode = useCallback((path: string) => {
    // When searching, we don't allow manual toggle to maintain search results
    if (searchQuery) return;
    
    const targetNode = nodes.find(node => node.path === path);
    if (!targetNode) return;

    let updatedNodes: JsonNode[];
    
    if (targetNode.isExpanded) {
      updatedNodes = jsonParser.collapseNode(nodes, path);
    } else {
      updatedNodes = jsonParser.expandNode(nodes, path);
    }
    
    setNodes(updatedNodes);
    setOriginalNodes(updatedNodes);
    setFilteredNodes(updatedNodes);
  }, [nodes, searchQuery]);

  const handleSelectNode = useCallback((path: string) => {
    setSelectedNodePath(path);
  }, []);

  const handleSearch = useCallback((query: string, isCaseSensitive: boolean) => {
    setSearchQuery(query);
    setCaseSensitive(isCaseSensitive);
    
    if (query.trim()) {
      const searchResult = jsonParser.searchNodes(originalNodes, query, isCaseSensitive);
      // Update both nodes and filtered nodes since search may expand the tree
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
      
      // Auto-select the first match if available
      if (searchResult.matchIndices.length > 0) {
        const firstMatchNode = searchResult.nodes[searchResult.matchIndices[0]];
        if (firstMatchNode) {
          setSelectedNodePath(firstMatchNode.path);
        }
      }
    } else {
      // Restore to current state of nodes (which may have been manually expanded/collapsed)
      setFilteredNodes(nodes);
      setSearchMatchIndices([]);
      setCurrentMatchIndex(0);
    }
  }, [originalNodes, nodes]);

  const handlePaste = useCallback(async () => {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setError('Clipboard API not available. Please use Ctrl+V or Cmd+V to paste.');
        return;
      }

      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('Clipboard is empty or contains no text.');
        return;
      }

      handleJsonSubmit(text, false); // Don't switch tabs for paste
      trackEvent('feature_used', { featureName: 'paste' });
    } catch (err) {
      console.warn('Failed to read clipboard:', err);
      setError('Failed to read from clipboard. Make sure you have given permission to access clipboard, or try using Ctrl+V or Cmd+V to paste directly into the text area.');
    }
  }, [handleJsonSubmit]);

  const handleCopy = useCallback(() => {
    if (jsonData) {
      navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
      trackEvent('feature_used', { featureName: 'copy' });
    }
  }, [jsonData]);

  const handleFormat = useCallback(() => {
    if (jsonData) {
      const formatted = JSON.stringify(jsonData, null, 2);
      setInputText(formatted);
      trackEvent('feature_used', { featureName: 'format' });
    }
  }, [jsonData]);

  const handleRemoveWhitespace = useCallback(() => {
    if (jsonData) {
      const compressed = JSON.stringify(jsonData);
      setInputText(compressed);
      trackEvent('feature_used', { featureName: 'remove_whitespace' });
    }
  }, [jsonData]);

  const handleClear = useCallback(() => {
    setJsonData(null);
    setNodes([]);
    setFilteredNodes([]);
    setOriginalNodes([]);
    setInputText('');
    setError('');
    setSearchQuery('');
    setSearchMatchIndices([]);
    setCurrentMatchIndex(0);
    setSelectedNodePath('');
    trackEvent('feature_used', { featureName: 'clear' });
  }, []);

  const handleLoadData = useCallback(() => {
    const sampleData = {
      "api": {
        "version": "2.1.4",
        "name": "E-Commerce Platform API",
        "description": "Comprehensive REST API for modern e-commerce solutions",
        "documentation": "https://api.example.com/docs",
        "endpoints": {
          "authentication": "/auth",
          "users": "/users",
          "products": "/products",
          "orders": "/orders",
          "analytics": "/analytics"
        }
      },
      "database": {
        "users": [
          {
            "id": 1001,
            "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "profile": {
              "firstName": "Alexandra",
              "lastName": "Rodriguez",
              "email": "alexandra.rodriguez@techcorp.com",
              "phone": "+1-555-0123",
              "avatar": "https://cdn.example.com/avatars/alexandra.jpg",
              "bio": "Senior Full-Stack Developer with 8+ years of experience in React, Node.js, and cloud architecture.",
              "location": {
                "country": "United States",
                "state": "California",
                "city": "San Francisco",
                "timezone": "America/Los_Angeles",
                "coordinates": {
                  "latitude": 37.7749,
                  "longitude": -122.4194
                }
              }
            },
            "account": {
              "status": "active",
              "type": "premium",
              "created": "2019-03-15T10:30:00Z",
              "lastLogin": "2024-01-23T14:22:00Z",
              "preferences": {
                "theme": "dark",
                "language": "en-US",
                "currency": "USD",
                "notifications": {
                  "email": true,
                  "push": false,
                  "sms": true
                }
              },
              "subscription": {
                "plan": "professional",
                "billing": "annual",
                "price": 299.99,
                "nextBilling": "2024-03-15T00:00:00Z",
                "features": ["unlimited_projects", "priority_support", "advanced_analytics"]
              }
            },
            "activities": [
              {
                "id": "act_001",
                "type": "login",
                "timestamp": "2024-01-23T14:22:00Z",
                "metadata": {
                  "ip": "192.168.1.100",
                  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                  "device": "desktop"
                }
              },
              {
                "id": "act_002",
                "type": "purchase",
                "timestamp": "2024-01-20T09:15:30Z",
                "metadata": {
                  "orderId": "ORD-2024-001234",
                  "amount": 149.99,
                  "currency": "USD"
                }
              }
            ]
          },
          {
            "id": 1002,
            "uuid": "b2c3d4e5-f6g7-8901-bcde-f23456789012",
            "profile": {
              "firstName": "Michael",
              "lastName": "Chen",
              "email": "m.chen@designstudio.co",
              "phone": "+44-20-7946-0958",
              "avatar": "https://cdn.example.com/avatars/michael.jpg",
              "bio": "Creative Director specializing in UX/UI design and brand identity.",
              "location": {
                "country": "United Kingdom",
                "state": "England",
                "city": "London",
                "timezone": "Europe/London",
                "coordinates": {
                  "latitude": 51.5074,
                  "longitude": -0.1278
                }
              }
            },
            "account": {
              "status": "active",
              "type": "standard",
              "created": "2020-07-22T16:45:00Z",
              "lastLogin": "2024-01-22T11:30:00Z",
              "preferences": {
                "theme": "light",
                "language": "en-GB",
                "currency": "GBP",
                "notifications": {
                  "email": false,
                  "push": true,
                  "sms": false
                }
              }
            }
          }
        ],
        "products": [
          {
            "id": "prod_001",
            "sku": "LAPTOP-GAMING-RTX4080",
            "name": "UltraPerformance Gaming Laptop Pro",
            "description": "High-end gaming laptop with RTX 4080, 32GB RAM, and 1TB NVMe SSD",
            "category": {
              "primary": "Electronics",
              "secondary": "Computers",
              "tertiary": "Laptops"
            },
            "pricing": {
              "currency": "USD",
              "basePrice": 2499.99,
              "salePrice": 2199.99,
              "discount": {
                "type": "percentage",
                "value": 12,
                "validUntil": "2024-02-29T23:59:59Z"
              },
              "tiers": [
                { "quantity": 1, "price": 2199.99 },
                { "quantity": 5, "price": 2099.99 },
                { "quantity": 10, "price": 1999.99 }
              ]
            },
            "specifications": {
              "processor": {
                "brand": "Intel",
                "model": "Core i9-13900HX",
                "cores": 24,
                "baseFreq": 2.2,
                "boostFreq": 5.4,
                "cache": "36MB L3"
              },
              "graphics": {
                "brand": "NVIDIA",
                "model": "GeForce RTX 4080",
                "memory": "12GB GDDR6X",
                "rayTracing": true
              },
              "memory": {
                "size": "32GB",
                "type": "DDR5-5600",
                "slots": 2,
                "maxCapacity": "64GB"
              },
              "storage": [
                {
                  "type": "NVMe SSD",
                  "capacity": "1TB",
                  "interface": "PCIe 4.0",
                  "readSpeed": 7000,
                  "writeSpeed": 6500
                }
              ],
              "display": {
                "size": 17.3,
                "resolution": "2560x1600",
                "refreshRate": 240,
                "panelType": "IPS",
                "colorGamut": "100% DCI-P3"
              }
            },
            "inventory": {
              "inStock": true,
              "quantity": 47,
              "reserved": 3,
              "warehouse": {
                "location": "West Coast DC",
                "section": "A-12-B",
                "lastUpdated": "2024-01-23T08:00:00Z"
              }
            },
            "reviews": {
              "average": 4.7,
              "count": 234,
              "distribution": {
                "5": 145,
                "4": 67,
                "3": 15,
                "2": 4,
                "1": 3
              },
              "featured": [
                {
                  "id": "rev_001",
                  "userId": 1001,
                  "rating": 5,
                  "title": "Exceptional performance for gaming and work",
                  "content": "This laptop exceeded my expectations. The RTX 4080 handles all modern games at high settings...",
                  "date": "2024-01-15T20:30:00Z",
                  "verified": true,
                  "helpful": 23
                }
              ]
            }
          }
        ],
        "orders": [
          {
            "id": "ORD-2024-001234",
            "number": "NSP-240123-001",
            "status": "processing",
            "customer": {
              "id": 1001,
              "email": "alexandra.rodriguez@techcorp.com",
              "shippingAddress": {
                "firstName": "Alexandra",
                "lastName": "Rodriguez",
                "company": "TechCorp Inc.",
                "address1": "123 Market Street",
                "address2": "Suite 450",
                "city": "San Francisco",
                "state": "CA",
                "postalCode": "94102",
                "country": "US",
                "phone": "+1-555-0123"
              },
              "billingAddress": {
                "firstName": "Alexandra",
                "lastName": "Rodriguez",
                "address1": "456 Pine Street",
                "address2": "Apt 78",
                "city": "San Francisco",
                "state": "CA",
                "postalCode": "94108",
                "country": "US"
              }
            },
            "items": [
              {
                "productId": "prod_001",
                "sku": "LAPTOP-GAMING-RTX4080",
                "name": "UltraPerformance Gaming Laptop Pro",
                "quantity": 1,
                "unitPrice": 2199.99,
                "totalPrice": 2199.99,
                "customizations": [
                  {
                    "type": "memory_upgrade",
                    "from": "32GB",
                    "to": "64GB",
                    "additionalCost": 299.99
                  },
                  {
                    "type": "warranty_extension",
                    "duration": "3 years",
                    "additionalCost": 199.99
                  }
                ]
              }
            ],
            "pricing": {
              "subtotal": 2199.99,
              "customizations": 499.98,
              "shipping": 0.00,
              "tax": 243.60,
              "discount": -100.00,
              "total": 2843.57,
              "currency": "USD"
            },
            "payment": {
              "method": "credit_card",
              "status": "paid",
              "transactionId": "txn_1234567890abcdef",
              "processor": "stripe",
              "card": {
                "brand": "visa",
                "last4": "4242",
                "expiry": "12/27"
              },
              "processedAt": "2024-01-20T09:15:45Z"
            },
            "fulfillment": {
              "status": "processing",
              "estimatedShip": "2024-01-25T00:00:00Z",
              "estimatedDelivery": "2024-01-30T00:00:00Z",
              "carrier": "FedEx",
              "service": "Priority Overnight",
              "tracking": null
            },
            "timeline": [
              {
                "status": "placed",
                "timestamp": "2024-01-20T09:15:30Z",
                "note": "Order successfully placed"
              },
              {
                "status": "payment_confirmed",
                "timestamp": "2024-01-20T09:15:45Z",
                "note": "Payment processed successfully"
              },
              {
                "status": "processing",
                "timestamp": "2024-01-20T10:30:00Z",
                "note": "Order moved to fulfillment queue"
              }
            ]
          }
        ]
      },
      "analytics": {
        "performance": {
          "responseTime": {
            "average": 156.7,
            "p50": 142,
            "p95": 387,
            "p99": 892,
            "unit": "milliseconds"
          },
          "throughput": {
            "requestsPerSecond": 1247.3,
            "peakRPS": 2103,
            "averageRPS": 967.8
          },
          "errors": {
            "rate": 0.23,
            "count": 47,
            "types": {
              "4xx": 31,
              "5xx": 16
            }
          }
        },
        "business": {
          "revenue": {
            "total": 127459.23,
            "currency": "USD",
            "period": "2024-01",
            "growth": 12.4,
            "breakdown": {
              "products": 89234.56,
              "services": 23419.87,
              "subscriptions": 14804.80
            }
          },
          "customers": {
            "total": 2847,
            "new": 234,
            "returning": 2613,
            "churnRate": 3.2,
            "ltv": 2847.92
          }
        }
      },
      "metadata": {
        "timestamp": "2024-01-24T10:30:00Z",
        "version": "1.0.0",
        "environment": "production",
        "generatedBy": "NONSTOPIO JSON Viewer Test Suite",
        "dataPoints": 15847,
        "processingTime": 0.234,
        "checksum": "sha256:a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234"
      }
    };
    const jsonText = JSON.stringify(sampleData, null, 2);
    setInputText(jsonText);
    handleJsonSubmit(jsonText, false); // Don't switch tabs for load data
    trackEvent('feature_used', { featureName: 'load_sample' });
  }, [handleJsonSubmit]);

  const handleExpandAll = useCallback(() => {
    const expandedNodes = jsonParser.expandAllNodes(originalNodes);
    setOriginalNodes(expandedNodes);
    
    if (searchQuery) {
      const searchResult = jsonParser.searchNodes(expandedNodes, searchQuery, caseSensitive);
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
    } else {
      setNodes(expandedNodes);
      setFilteredNodes(expandedNodes);
    }
    
    trackEvent('feature_used', { featureName: 'expand_all' });
  }, [originalNodes, searchQuery, caseSensitive]);

  const handleCollapseAll = useCallback(() => {
    const collapsedNodes = jsonParser.collapseAllNodes(originalNodes);
    setOriginalNodes(collapsedNodes);
    
    if (searchQuery) {
      const searchResult = jsonParser.searchNodes(collapsedNodes, searchQuery, caseSensitive);
      setNodes(searchResult.nodes);
      setFilteredNodes(searchResult.nodes);
      setSearchMatchIndices(searchResult.matchIndices);
      setCurrentMatchIndex(0);
    } else {
      setNodes(collapsedNodes);
      setFilteredNodes(collapsedNodes);
    }
    
    trackEvent('feature_used', { featureName: 'collapse_all' });
  }, [originalNodes, searchQuery, caseSensitive]);

  const handleNavigateToNextMatch = useCallback(() => {
    if (searchMatchIndices.length > 0) {
      const nextIndex = (currentMatchIndex + 1) % searchMatchIndices.length;
      setCurrentMatchIndex(nextIndex);
      const nodeIndex = searchMatchIndices[nextIndex];
      const node = filteredNodes[nodeIndex];
      if (node) {
        setSelectedNodePath(node.path);
      }
      
      trackEvent('search_navigation', {
        direction: 'next',
        currentIndex: nextIndex,
        totalMatches: searchMatchIndices.length
      });
    }
  }, [searchMatchIndices, currentMatchIndex, filteredNodes]);

  const handleNavigateToPrevMatch = useCallback(() => {
    if (searchMatchIndices.length > 0) {
      const prevIndex = currentMatchIndex === 0 ? searchMatchIndices.length - 1 : currentMatchIndex - 1;
      setCurrentMatchIndex(prevIndex);
      const nodeIndex = searchMatchIndices[prevIndex];
      const node = filteredNodes[nodeIndex];
      if (node) {
        setSelectedNodePath(node.path);
      }
      
      trackEvent('search_navigation', {
        direction: 'prev',
        currentIndex: prevIndex,
        totalMatches: searchMatchIndices.length
      });
    }
  }, [searchMatchIndices, currentMatchIndex, filteredNodes]);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Top Tab Bar - Fixed */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center">
          <div className="flex">
            <button
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'text'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setActiveTab('viewer')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'viewer'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              Viewer
            </button>
          </div>
          <div className="ml-auto pr-4">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Toolbar - Only show for text tab - Fixed */}
      {activeTab === 'text' && (
        <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePaste}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Paste from clipboard (or use Ctrl+V/Cmd+V in the JSON input area)"
            >
              <Upload size={14} />
              <span>Paste</span>
            </button>
            
            <button
              onClick={handleCopy}
              disabled={!jsonData}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy formatted JSON"
            >
              <Copy size={14} />
              <span>Copy</span>
            </button>
            
            <button
              onClick={handleFormat}
              disabled={!jsonData}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Format JSON"
            >
              <Square size={14} />
              <span>Format</span>
            </button>
            
            <button
              onClick={handleRemoveWhitespace}
              disabled={!jsonData}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove whitespace"
            >
              Remove white space
            </button>
            
            <button
              onClick={handleClear}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Clear all"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
            
            <button
              onClick={handleLoadData}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Load complex test JSON data"
            >
              <FileText size={14} />
              <span>Load Test JSON</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar - Only show for viewer tab - Fixed */}
      {activeTab === 'viewer' && jsonData && (
        <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExpandAll}
              className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              title="Expand all nodes - Shows all nested objects and arrays"
            >
              <UnfoldVertical size={16} />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              title="Collapse all nodes - Hides all nested objects and arrays"
            >
              <FoldVertical size={16} />
            </button>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value, caseSensitive)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.shiftKey) {
                    handleNavigateToPrevMatch();
                  } else {
                    handleNavigateToNextMatch();
                  }
                  e.preventDefault();
                } else if (e.key === 'F3') {
                  if (e.shiftKey) {
                    handleNavigateToPrevMatch();
                  } else {
                    handleNavigateToNextMatch();
                  }
                  e.preventDefault();
                }
              }}
              placeholder="Search JSON... (Enter: next, Shift+Enter: prev)"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-3 py-2 text-sm rounded transition-colors ${
                caseSensitive 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
              title="Toggle case sensitivity - Match exact case when enabled"
            >
              Aa
            </button>
            <button
              onClick={() => handleSearch('', caseSensitive)}
              className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              title="Clear search - Remove search query and show all nodes"
            >
              Clear
            </button>
            {searchQuery && searchMatchIndices.length > 0 && (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {currentMatchIndex + 1} of {searchMatchIndices.length}
                </div>
                <button
                  onClick={handleNavigateToPrevMatch}
                  className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  title="Previous match (Shift+Enter or Shift+F3)"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={handleNavigateToNextMatch}
                  className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  title="Next match (Enter or F3)"
                >
                  <ChevronDown size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel - Text Input */}
        {activeTab === 'text' && (
          <div className="w-full p-4 overflow-hidden">
            <JsonInput
              onJsonSubmit={handleJsonSubmit}
              isLoading={isLoading}
              error={error}
              initialValue={inputText}
            />
          </div>
        )}

        {/* Viewer Tab Content */}
        {activeTab === 'viewer' && (
          <ResizablePanel 
            initialLeftWidth={70} 
            minLeftWidth={50} 
            minRightWidth={30}
            className="flex-1"
          >
            {/* Left Panel - Tree View */}
            <div className="h-full bg-white dark:bg-gray-800 min-w-0 overflow-hidden">
              {jsonData ? (
                <div className="h-full flex flex-col">
                  {/* Tree Content - Independent Scroll */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    <div className="min-w-0">
                      <JsonTree
                        nodes={filteredNodes}
                        onToggleNode={handleToggleNode}
                        onSelectNode={handleSelectNode}
                        selectedNodePath={selectedNodePath}
                        searchQuery={searchQuery}
                        caseSensitive={caseSensitive}
                        searchMatchIndices={searchMatchIndices}
                        currentMatchIndex={currentMatchIndex}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No JSON data loaded</p>
                    <p className="text-sm">Use the JSON tab or toolbar buttons to load JSON</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Property Details */}
            <div className="h-full bg-gray-50 dark:bg-gray-800 min-w-0 overflow-hidden">
              {jsonData ? (
                <JsonTableView 
                  data={jsonData} 
                  searchQuery={searchQuery}
                  selectedNodePath={selectedNodePath}
                  nodes={nodes}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Property details will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        )}
      </div>

    </div>
  );
}

export default App;