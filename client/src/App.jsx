import { useState, useRef } from 'react'
import axios from 'axios'
import { Upload, Check, X, FileImage, Loader2, AlertCircle } from 'lucide-react'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [results, setResults] = useState(null)
  const [summary, setSummary] = useState(null)
  const [markedImageUrl, setMarkedImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setResults(null)
      setSummary(null)
      setMarkedImageUrl(null)
      setError(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile)
      setPreview(URL.createObjectURL(droppedFile))
      setResults(null)
      setSummary(null)
      setMarkedImageUrl(null)
      setError(null)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    setLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000
      })

      if (response.data.success) {
        setResults(response.data.results)
        setSummary(response.data.summary)
        setMarkedImageUrl(response.data.markedImageUrl)
      } else {
        setError(response.data.error || 'Upload failed')
      }
    } catch (err) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setResults(null)
    setSummary(null)
    setMarkedImageUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>📝 英语作业批改</h1>
        <p>上传学生英语作业图片，自动识别题目并批改</p>
      </header>

      <div className="content">
        <div className="upload-section">
          <div
            className={`drop-zone ${file ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />

            {preview ? (
              <div className="preview-container">
                <img src={preview} alt="Preview" className="preview-image" />
                <div className="preview-overlay">
                  <FileImage size={48} />
                  <span>{file?.name}</span>
                </div>
              </div>
            ) : (
              <div className="drop-zone-content">
                <Upload size={48} />
                <p>拖拽图片到这里，或点击选择文件</p>
                <span>支持 JPEG, PNG, WebP 格式</span>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="spin" />
                  <span>批改中...</span>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <span>开始批改</span>
                </>
              )}
            </button>

            {file && (
              <button className="btn btn-secondary" onClick={handleReset}>
                重置
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="loading-state">
            <Loader2 size={48} className="spin" />
            <p>正在分析图片，请稍候...</p>
          </div>
        )}

        {results && !loading && (
          <div className="results-section">
            <div className="summary-card">
              <h2>批改结果</h2>
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-number">{summary?.total || 0}</span>
                  <span className="stat-label">总题数</span>
                </div>
                <div className="stat correct">
                  <span className="stat-number">{summary?.correct || 0}</span>
                  <span className="stat-label">正确</span>
                </div>
                <div className="stat incorrect">
                  <span className="stat-number">{summary?.incorrect || 0}</span>
                  <span className="stat-label">错误</span>
                </div>
              </div>
            </div>

            {markedImageUrl && (
              <div className="marked-image-card">
                <h3>标注图片</h3>
                <p className="image-hint">红色框标记错误区域</p>
                <img
                  src={markedImageUrl}
                  alt="Marked homework"
                  className="marked-image"
                />
              </div>
            )}

            <div className="results-list">
              <h3>详细结果</h3>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}
                >
                  <div className="result-header">
                    <span className="result-icon">
                      {result.isCorrect ? (
                        <Check size={20} className="icon-correct" />
                      ) : (
                        <X size={20} className="icon-incorrect" />
                      )}
                    </span>
                    <span className="result-status">
                      {result.isCorrect ? '正确' : '错误'}
                    </span>
                  </div>
                  <div className="result-content">
                    <div className="result-row">
                      <span className="result-label">题目:</span>
                      <span className="result-value">{result.question}</span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">学生答案:</span>
                      <span className="result-value student-answer">
                        {result.studentAnswer}
                      </span>
                    </div>
                    {!result.isCorrect && (
                      <div className="result-row">
                        <span className="result-label">正确答案:</span>
                        <span className="result-value correct-answer">
                          {result.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
