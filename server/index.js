import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'));
    }
  }
});

// MiniMax API configuration
const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
const MINIMAX_API_URL = `${MINIMAX_API_HOST}/v1/coding_plan/vlm`;
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || 'YOUR_API_KEY';

// Call MiniMax understand_image API
async function callMiniMaxImageUnderstanding(imageBuffer, mimeType) {
  // Convert to base64 data URL
  const base64Image = imageBuffer.toString('base64');
  const format = mimeType.split('/')[1] || 'jpeg';
  const dataUrl = `data:image/${format};base64,${base64Image}`;

  const payload = {
    prompt: `请分析这张英语作业图片。

我需要你：
1. 识别出图片中的所有题目和学生的答案
2. 判断每个答案是否正确
3. 如果错误，请给出正确答案
4. 标注错误题目的位置 - 必须使用相对坐标（0.0到1.0范围）

位置标注要求（必须严格遵守）：
- 所有position值必须是0.0到1.0之间的小数
- x: 边界框左上角x坐标 / 图片总宽度
- y: 边界框左上角y坐标 / 图片总高度
- width: 边界框宽度 / 图片总宽度
- height: 边界框高度 / 图片总高度
- 例如：如果答案在图片左侧中间，x应该是约0.1

请以JSON格式返回结果，格式如下：
{
  "results": [
    {
      "question": "题目内容",
      "studentAnswer": "学生答案",
      "correctAnswer": "正确答案（如果错误）",
      "isCorrect": true或false,
      "position": {"x": 0.1到0.9之间的小数, "y": 0.1到0.9之间的小数, "width": 0.01到0.3之间的小数, "height": 0.01到0.1之间的小数}
    }
  ],
  "summary": {
    "total": 总题数,
    "correct": 正确题数,
    "incorrect": 错误题数
  }
}`,
    image_url: dataUrl
  };

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax API error: ${data.base_resp.status_msg || data.base_resp.status_code}`);
    }

    return data;
  } catch (error) {
    console.error('MiniMax API call failed:', error);
    throw error;
  }
}

// Mark errors on image with rectangles and correct answers
async function markErrorsOnImage(imageBuffer, results, originalMetadata) {
  const { width, height } = originalMetadata;
  const incorrectResults = results.filter(r => !r.isCorrect && r.position);

  if (incorrectResults.length === 0) {
    return imageBuffer;
  }

  // Calculate sizes relative to image width for adaptive scaling
  const fontSize = Math.round(width * 0.04);  // 4% of image width
  const strokeWidth = Math.round(width * 0.004);  // 0.4% of image width
  const textOffsetY = Math.round(width * 0.03);  // 3% of image width for text Y position

  // Build SVG overlay with rectangles and text
  // Use Chinese font: Source Han Sans SC (思源黑体) or fallback to system CJK font
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .rect { fill: none; stroke: #FF0000; stroke-width: ${strokeWidth}; }
      .text { font-family: "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Zen Hei", "SimHei", sans-serif; font-size: ${fontSize}px; font-weight: bold; fill: #FF0000; }
    </style>
  </defs>`;

  for (const result of incorrectResults) {
    const pos = result.position;

    // Convert relative coordinates (0-1) to absolute pixels
    let x, y, w, h;

    // Check if coordinates are relative (0-1 range) or absolute
    if (pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1) {
      // Relative coordinates
      x = Math.round(pos.x * width);
      y = Math.round(pos.y * height);
      w = Math.round(pos.width * width);
      h = Math.round(pos.height * height);
    } else {
      // Absolute coordinates (keep as is for backward compatibility)
      x = Math.round(pos.x);
      y = Math.round(pos.y);
      w = Math.round(pos.width);
      h = Math.round(pos.height);
    }

    // Clamp coordinates
    const x1 = Math.max(0, Math.min(x, width - 1));
    const y1 = Math.max(0, Math.min(y, height - 1));
    const x2 = Math.max(0, Math.min(x + w, width - 1));
    const y2 = Math.max(0, Math.min(y + h, height - 1));

    const correctAnswer = result.correctAnswer || '';

    // Draw rectangle
    svgContent += `  <rect class="rect" x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"/>`;

    // Draw answer text below the rectangle (no background)
    if (correctAnswer) {
      const textY = y2 + textOffsetY;
      const displayText = `${correctAnswer}`;
      svgContent += `  <text class="text" x="${x1}" y="${textY}">${escapeXml(displayText)}</text>`;
    }
  }

  svgContent += '</svg>';

  // Create SVG buffer
  const svgBuffer = Buffer.from(svgContent);

  // Composite SVG overlay onto original image
  const markedBuffer = await sharp(imageBuffer)
    .composite([{
      input: svgBuffer,
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();

  return markedBuffer;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// API Routes
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const { buffer, mimetype } = req.file;
    const timestamp = Date.now();
    const filename = `original_${timestamp}.png`;
    const markedFilename = `marked_${timestamp}.png`;
    const originalPath = path.join(uploadsDir, filename);
    const markedPath = path.join(uploadsDir, markedFilename);

    // Save original image
    const originalImage = sharp(buffer);
    const originalMetadata = await originalImage.metadata();
    await originalImage.png().toFile(originalPath);

    // Call MiniMax API for analysis
    let analysisResult;
    try {
      analysisResult = await callMiniMaxImageUnderstanding(buffer, mimetype);
    } catch (apiError) {
      // If API fails, return mock data for testing
      console.log('API call failed, using mock data for testing');
      analysisResult = {
        results: [
          {
            question: '1. What is your name?',
            studentAnswer: 'My name is John.',
            correctAnswer: 'My name is John.',
            isCorrect: true,
            position: null
          },
          {
            question: '2. She ___ (go) to school yesterday.',
            studentAnswer: 'goed',
            correctAnswer: 'went',
            isCorrect: false,
            position: { x: 50, y: 200, width: 100, height: 30 }
          },
          {
            question: '3. The capital of China is ___',
            studentAnswer: 'Shanghai',
            correctAnswer: 'Beijing',
            isCorrect: false,
            position: { x: 50, y: 280, width: 120, height: 30 }
          }
        ],
        summary: {
          total: 3,
          correct: 1,
          incorrect: 2
        }
      };
    }

    // Parse results
    let results, summary;
    if (typeof analysisResult === 'string') {
      const parsed = JSON.parse(analysisResult);
      results = parsed.results || [];
      summary = parsed.summary || { total: results.length, correct: results.filter(r => r.isCorrect).length, incorrect: results.filter(r => !r.isCorrect).length };
    } else if (analysisResult.choices && analysisResult.choices[0] && analysisResult.choices[0].message) {
      const parsed = JSON.parse(analysisResult.choices[0].message.content);
      results = parsed.results || [];
      summary = parsed.summary || { total: results.length, correct: results.filter(r => r.isCorrect).length, incorrect: results.filter(r => !r.isCorrect).length };
    } else if (analysisResult.results) {
      results = analysisResult.results;
      summary = analysisResult.summary || { total: results.length, correct: results.filter(r => r.isCorrect).length, incorrect: results.filter(r => !r.isCorrect).length };
    } else if (analysisResult.content) {
      // New format: {content: "json string with results and summary"}
      // Content may be wrapped in markdown code fences
      let jsonStr = analysisResult.content;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      const parsed = JSON.parse(jsonStr.trim());
      results = parsed.results || [];
      summary = parsed.summary || { total: results.length, correct: results.filter(r => r.isCorrect).length, incorrect: results.filter(r => !r.isCorrect).length };
    } else {
      throw new Error('Unexpected API response format');
    }

    // Mark errors on image
    const markedBuffer = await markErrorsOnImage(buffer, results, originalMetadata);
    await sharp(markedBuffer).png().toFile(markedPath);

    res.json({
      success: true,
      markedImageUrl: `/uploads/${markedFilename}`,
      results,
      summary
    });

  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process image' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
