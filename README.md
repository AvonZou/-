# NextStep OS

中文、本地优先的个人成长工作台。第一阶段已实现首页、公共任务、求职投递与流程看板，所有数据使用 SQLite 持久化。没有预置私人数据，无需账户或 API 密钥。

## Windows 快速启动

1. 安装 **Node.js 24 LTS**（包含 npm），将项目下载/克隆到本机的可写目录。
2. 首次双击 **setup.bat**：安装锁定依赖、初始化数据库、生产构建。
3. 之后双击 **start.bat**：仅监听 `127.0.0.1:3000`，准备好后自动打开浏览器。
4. 保持终端窗口打开，按 `Ctrl+C` 停止。错误时脚本保留窗口。

完整说明见 [README_启动说明.md](README_启动说明.md)。

## 开发与验证

```sh
npm ci
npm run db:init
npm run dev
```

生产运行：`npm run build` 后 `npm start`。开发与生产都使用本机 3000 端口，同一时刻只运行一种服务。

```sh
npm run typecheck
npm test
npm run build
npm run test:restart
npx playwright install chromium
npm run test:e2e
```

重启测试自动使用临时数据库与 3001 端口，验证服务停止后数据仍在。E2E 自动启动生产服务，使用 `.cache/e2e-data` 独立数据库；运行前停止占用 3000 端口的服务。云端已装浏览器时，可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向已有 Chromium，避免下载。Linux 首次安装 Chromium 系统依赖可使用 `npx playwright install --with-deps chromium`。

## 阶段 A 的实际功能

- 首页：今日/逾期任务、7 天内的面试与论文任务节点、需跟进岗位、四模块任务完成率、本周真实完成数量与实际用时。
- 规则排程：3/6/8 小时或自定义分钟，按优先级和截止日期排序；48 小时面试优先及一项论文任务时间预留；拖动或上下移调整当日顺序。
- 任务：新建、编辑、完成/重新打开、延期一天、删除、归档、搜索、按模块/时间/状态筛选、岗位关联、手动实际用时。
- 求职：完整岗位字段、JD 保存、人工匹配分数、表格/看板、拖动或选择阶段、公司/方向/时间筛选、搜索、详情、归档/删除。
- 面试与流程：安排及日志 CRUD、自动阶段变更日志、一键创建关联面试训练任务。删除岗位后关联任务保留，流程日志随岗位删除。
- 数据：完整 JSON 导出、导入预览/校验/重复 ID 跳过、空库恢复、岗位 CSV 导出（含公式注入防护）。
- 中文响应式界面、浅/深色主题、空状态、可恢复错误提示和删除确认。

没有假岗位、虚构图表或“AI 自动评分”。面试题库/录音/答案版本为阶段 B；论文文献与雅思训练为阶段 C；AI 为需明确指示才启动的阶段 E。专属模块入口明确标记待实现，当前可管理这些模块的公共任务。完整 PRD 的四模块验收不属于本次阶段 A 完成声明。

## 数据和隐私

默认数据库为 `data/nextstep.db`，附件目录预留 `data/uploads/`；两者不在公开静态目录。`data/`、备份目录、数据库、录音、`.env*`、测试产物均由 `.gitignore` 排除。个人 JSON/CSV 备份请保存到仓库外；不要上传私人备份到 GitHub。`NEXTSTEP_DATA_DIR` 可指定独立本地数据目录，未设置时使用项目 data 目录。

基础功能运行时不依赖互联网；首次安装依赖需要联网。应用是单用户本机工具，不含登录系统，不适合部署到公网。API 校验本机 Host 与请求 Origin。打开岗位官方链接是用户主动外部操作。

## 设计与交付

- [原始需求](NextStep_OS_Codex_PRD.md)
- [技术决策](docs/TECH_DECISIONS.md)
- [手动验收清单](TEST_PLAN.md)
- [测试结果](docs/TEST_RESULTS.md)

数据库迁移由 `lib/db.ts` 中编号 SQL 与 SQLite `user_version` 管理，在事务中升级；初始化重复执行不重置数据。未来结构变更追加迁移，升级前先导出备份。
