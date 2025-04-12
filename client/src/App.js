import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Separate ConnectionForm component
const ConnectionForm = ({ onConnect, initialValues, isEditing, onCancel }) => {
  const [formData, setFormData] = useState(initialValues);

  const handleSubmit = async (e) => {
    e.preventDefault();
    onConnect(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="connection-form" autoComplete="on">
      <div>
        <label>Database Type:</label>
        <select
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value)}
          autoComplete="off"
        >
          <option value="mysql">MySQL</option>
          <option value="postgresql">PostgreSQL</option>
        </select>
      </div>
      
      <div>
        <label>Host:</label>
        <input
          type="text"
          value={formData.host}
          onChange={(e) => handleChange('host', e.target.value)}
          placeholder="localhost"
          autoComplete="off"
        />
      </div>
      
      <div>
        <label>Port:</label>
        <input
          type="text"
          value={formData.port}
          onChange={(e) => handleChange('port', e.target.value)}
          placeholder={formData.type === 'mysql' ? '3306' : '5432'}
          autoComplete="off"
        />
      </div>
      
      <div>
        <label>Database:</label>
        <input
          type="text"
          value={formData.database}
          onChange={(e) => handleChange('database', e.target.value)}
          autoComplete="off"
        />
      </div>
      
      {formData.type === 'postgresql' && (
        <div>
          <label>Schema:</label>
          <input
            type="text"
            value={formData.schema}
            onChange={(e) => handleChange('schema', e.target.value)}
            placeholder="public"
            autoComplete="off"
          />
        </div>
      )}
      
      <div>
        <label>Username:</label>
        <input
          type="text"
          value={formData.user}
          onChange={(e) => handleChange('user', e.target.value)}
          autoComplete="username"
        />
      </div>
      
      <div>
        <label>Password:</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          autoComplete="current-password"
        />
      </div>
      
      <div className="form-buttons">
        {isEditing && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit">Connect</button>
      </div>
    </form>
  );
};

function App() {
  const [dbConfig, setDbConfig] = useState({
    type: 'mysql',
    host: '',
    user: '',
    password: '',
    database: '',
    port: '',
    schema: 'public'
  });
  const [tables, setTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [availableSchemas, setAvailableSchemas] = useState([]);
  const [isEditingConnection, setIsEditingConnection] = useState(false);

  // Memoize the change handler
  const handleInputChange = useCallback((field, value) => {
    setDbConfig(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const fetchSchemas = async () => {
    try {
      const response = await fetch(`${API_URL}/api/schemas`);
      const data = await response.json();
      if (data.success) {
        setAvailableSchemas(data.schemas);
        if (!data.schemas.includes(dbConfig.schema) && data.schemas.length > 0) {
          setDbConfig(prev => ({ ...prev, schema: data.schemas[0] }));
        }
      }
    } catch (err) {
      setError('Failed to fetch schemas');
    }
  };

  const handleConnect = async (formData) => {
    try {
      const response = await fetch(`${API_URL}/api/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      if (data.success) {
        setDbConfig(formData);
        setIsConnected(true);
        setIsEditingConnection(false);
        setError('');
        
        if (formData.type === 'postgresql') {
          await fetchSchemas();
        }
        
        await fetchTables();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to connect to database');
    }
  };

  const handleSchemaChange = async (e) => {
    const newSchema = e.target.value;
    setDbConfig({ ...dbConfig, schema: newSchema });
    try {
      const response = await fetch(`${API_URL}/api/tables?type=${dbConfig.type}&schema=${newSchema}`);
      const data = await response.json();
      if (data.success) {
        setTables(data.tables);
        setSelectedTables([]);
      }
    } catch (err) {
      setError('Failed to fetch tables for the selected schema');
    }
  };

  const fetchTables = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${API_URL}/api/tables?type=${dbConfig.type}&schema=${dbConfig.schema}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch tables: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setTables(data.tables);
      } else {
        throw new Error(data.message || 'Failed to fetch tables');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.message || 'Failed to fetch tables');
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTables([...tables]);
    } else {
      setSelectedTables([]);
    }
  };

  const handleTableSelect = (table) => {
    if (selectedTables.includes(table)) {
      setSelectedTables(selectedTables.filter(t => t !== table));
    } else {
      setSelectedTables([...selectedTables, table]);
    }
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      setError('Please select at least one table');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${API_URL}/api/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: dbConfig.type,
          tables: selectedTables,
          schema: dbConfig.schema
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      // Create URL in a try block to handle potential memory issues
      try {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tables-export.zip';
        document.body.appendChild(a);
        a.click();
        // Clean up
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      } catch (err) {
        throw new Error('Failed to create download link');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Export timed out. Please try with fewer tables or contact support.');
      } else {
        setError(err.message || 'Failed to export tables');
      }
    }
  };

  return (
    <div className="App">
      <h1>Database Export Tool</h1>
      
      {error && <div className="error">{error}</div>}
      
      {(!isConnected || isEditingConnection) ? (
        <ConnectionForm 
          onConnect={handleConnect}
          initialValues={dbConfig}
          isEditing={isEditingConnection}
          onCancel={() => setIsEditingConnection(false)}
        />
      ) : (
        <div className="tables-section">
          <div className="connection-header">
            <h2>Connected to: {dbConfig.database}</h2>
            <button 
              className="edit-connection" 
              onClick={() => setIsEditingConnection(true)}
              title="Edit Connection"
            >
              ✏️
            </button>
          </div>

          {dbConfig.type === 'postgresql' && (
            <div className="schema-selector">
              <label>Schema:</label>
              <select value={dbConfig.schema} onChange={handleSchemaChange}>
                {availableSchemas.map(schema => (
                  <option key={schema} value={schema}>{schema}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="select-all">
            <input
              type="checkbox"
              checked={selectedTables.length === tables.length}
              onChange={handleSelectAll}
            />
            <label>Select All</label>
          </div>
          
          <div className="tables-list">
            {tables.map(table => (
              <div key={table} className="table-item">
                <input
                  type="checkbox"
                  checked={selectedTables.includes(table)}
                  onChange={() => handleTableSelect(table)}
                />
                <label>{table}</label>
              </div>
            ))}
          </div>
          
          <button
            onClick={handleExport}
            disabled={selectedTables.length === 0}
            className="export-button"
          >
            Download Selected Tables
          </button>
        </div>
      )}
    </div>
  );
}

export default App; 