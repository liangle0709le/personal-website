# 个人主页 · 作品集 + 简历

一个纯静态（HTML / CSS / JS，零依赖、零构建）的个人网站，单页滚动式，用于展示个人经历、作品与项目。

## 目录结构

```
.
├── index.html          # 主页面（所有区块）
├── css/style.css       # 样式（顶部有主题色变量，改色只需改这里）
├── js/main.js          # 移动端菜单、滚动高亮、淡入动画
├── assets/             # 占位图片（替换为你的真实图片）
└── .gitignore
```

## 本地预览

在项目根目录执行：

```bash
python3 -m http.server 8000
```

然后浏览器打开 http://localhost:8000 。

## 替换内容清单（把占位文字换成你自己的）

页面里所有需要替换的地方都用 `【占位：…】` 标出，搜索即可定位。

1. **通用**
   - `index.html` 里所有 `【占位：你的姓名】`、`【姓名】` → 你的名字
   - `<title>` 与 `meta description` → 你的名字与简介
   - 联系方式里的邮箱 / GitHub 用户名 / 微信

2. **头像与作品图**
   - 把 `assets/avatar.svg`、`project-zcx.svg`、`project-gh.svg`、`project-research.svg`
     替换成你的真实图片（保持同名，或改 `index.html` 里对应的 `src`）。
   - 支持 jpg / png / webp，建议图片宽度 ≥ 800px。

3. **各区块**
   - 关于我：修改 `#about` 下的三段简介
   - 教育背景：复制 `#education` 里的 `.edu-item` 可增加条目
   - 作品集：修改 `#projects` 里卡片的标题 / 描述 / 标签 / 链接
   - 项目经历：修改 `#experience` 里时间线的角色 / 时间 / 描述（可复制 `.timeline__item` 增加）
   - 技能：修改 `#skills` 里的标签

4. **换主题色**
   - 打开 `css/style.css`，修改 `:root` 里的 `--primary` / `--primary-dark` / `--accent` 等变量即可。

## 部署到 GitHub Pages

> 本机未安装 `gh` CLI，以下用网页 + git 命令行方式。需要先有 GitHub 账号。

1. **配置 git 身份（首次）**
   ```bash
   git config --global user.name "你的名字"
   git config --global user.email "你的GitHub邮箱"
   ```

2. **在 github.com 新建仓库**
   - 仓库名可设为 `personal-website`，或 `<你的用户名>.github.io`（后者会成为用户页 `https://<你的用户名>.github.io/`）。

3. **本地提交并推送**
   ```bash
   git init
   git add .
   git commit -m "Initial personal website"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
   > 首次推送若要求登录：使用你的 GitHub 用户名，密码处填写 **Personal Access Token**（不是账号密码）。
   > 可在 GitHub → Settings → Developer settings → Personal access tokens 生成，勾选 `repo` 权限。

4. **开启 GitHub Pages**
   - 进入仓库 **Settings → Pages**，Source 选择 `main` 分支、`/(root)`，点击 Save。
   - 等待 1–2 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

5. **之后更新内容**
   ```bash
   git add . && git commit -m "更新内容" && git push
   ```
