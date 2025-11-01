export const DebugEnvPage = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Environment Variables</h1>
      <pre style={{ background: '#f5f5f5', padding: '20px', borderRadius: '5px' }}>
        {JSON.stringify({
          VITE_API_URL: import.meta.env.VITE_API_URL,
          MODE: import.meta.env.MODE,
          DEV: import.meta.env.DEV,
          PROD: import.meta.env.PROD,
        }, null, 2)}
      </pre>
      <h2>Expected URL:</h2>
      <p>http://localhost:8000/api</p>
    </div>
  )
}
