# 英语作业批改系统 (English Homework Checker)

一个基于 AI 的英语作业自动批改系统，支持图片上传、题目识别、自动批改和错误标注。

## 功能特性

- 📷 **图片上传** - 支持拖拽或点击上传学生作业图片
- 🔍 **题目识别** - 自动识别图片中的英语题目和学生答案
- ✅ **自动批改** - AI 判断答案是否正确
- 🎯 **错误标注** - 在原图上红色标注错误位置，并显示正确答案
- 📊 **统计概览** - 显示总题数、正确数、错误数
- 📱 **响应式设计** - 支持各种屏幕尺寸

## 技术栈

### 前端
- React 18
- Vite
- Axios
- Lucide React (图标)

### 后端
- Node.js
- Express
- Sharp (图片处理)
- Multer (文件上传)

### AI 服务
- MiniMax API (视觉语言模型)

## 项目结构

```
homework-check/
├── client/                 # React 前端
│   ├── src/
│   │   ├── App.jsx        # 主组件
│   │   ├── App.css        # 组件样式
│   │   └── main.jsx       # 入口文件
│   ├── index.html
│   ├── vite.config.js     # Vite 配置
│   └── package.json
├── server/                 # Express 后端
│   ├── index.js           # 服务器入口
│   ├── package.json
│   └── uploads/           # 上传文件目录
├── README.md
└── package.json           # 根目录 package.json (可选)
```

## 安装与运行

### 前置要求

- Node.js >= 16
- npm 或 yarn

### 安装依赖

```bash
# 安装前端依赖
cd client
npm install

# 安装后端依赖
cd ../server
npm install
```

### 配置环境变量

在后端目录创建 `.env` 文件：

```env
MINIMAX_API_KEY=your_api_key_here
MINIMAX_API_HOST=https://api.minimaxi.com  # 可选，默认使用此地址
PORT=3001  # 可选，默认 3001
```

### 运行项目

```bash
# 启动后端 (在 server 目录)
cd server
npm run dev

# 启动前端 (在 client 目录，另开终端)
cd client
npm run dev
```

访问 http://localhost:5173 即可使用。

## API 接口

### POST /api/upload

上传图片进行批改。

**请求:**
- Content-Type: `multipart/form-data`
- Body: `image` (图片文件)

**响应:**
```json
{
  "success": true,
  "markedImageUrl": "/uploads/marked_xxx.png",
  "results": [
    {
      "question": "题目内容",
      "studentAnswer": "学生答案",
      "correctAnswer": "正确答案",
      "isCorrect": false,
      "position": {
        "x": 0.15,
        "y": 0.08,
        "width": 0.1,
        "height": 0.04
      }
    }
  ],
  "summary": {
    "total": 10,
    "correct": 7,
    "incorrect": 3
  }
}
```

### GET /api/health

健康检查接口。

**响应:**
```json
{
  "status": "ok"
}
```

## 图片要求

- 支持格式: JPEG, PNG, WebP
- 最大文件大小: 10MB
- 建议图片方向: 竖版作业图片效果最佳

## 坐标系统

位置坐标使用相对值 (0-1 范围)：
- `x`: 左上角 x 坐标 / 图片宽度
- `y`: 左上角 y 坐标 / 图片高度
- `width`: 边界框宽度 / 图片宽度
- `height`: 边界框高度 / 图片高度

## 开发说明

### 添加新的 AI API

如果需要更换 AI 服务提供商，修改 `server/index.js` 中的 `callMiniMaxImageUnderstanding` 函数即可。

### 修改标注样式

标注样式在 `server/index.js` 的 `markErrorsOnImage` 函数中定义，包括：
- 边框颜色和宽度
- 字体大小和样式
- 文字偏移位置

## License

MIT
