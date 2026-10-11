# 阶段 A 测试结果

验证日期：2026-10-11。环境：Linux 云机器，Node.js 24.19.0、npm 11.9.0，Next.js 16.4.0、React 19.3.0、Tailwind CSS 4.3.3，系统 Chromium。结果针对此阶段代码及当前机器；不代表 Windows 实机或 GitHub Actions 已通过。

| 检查                          | 实际结果                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| `npm ci --no-audit --no-fund` | 通过，使用提交的锁文件重新安装 63 个包                      |
| `npm run db:init` 连续运行    | 通过，user_version=1，重复执行不重置数据                    |
| `npm run typecheck`           | 通过                                                        |
| `npm test`                    | 5 项通过，0 失败，0 跳过                                    |
| `npm run build`               | 生产构建通过，首页静态构建、API Node 动态路由               |
| `npm run test:restart`        | 通过，真实生产服务写入记录，停止并重启后同 ID 与字段仍在    |
| 浏览器 E2E                    | 4 项通过，0 失败，约 10 秒                                  |
| `npm audit --omit=dev`        | 生产依赖 0 个已报告漏洞                                     |
| Git 忽略规则                  | 数据库、附件、录音、.env、备份、测试库均被排除              |
| 截图检查                      | 1440px 中文首页布局已目视检查；390px 无横向溢出自动检查通过 |

数据层覆盖 CRUD、岗位关联、删除后的外键清理、流程日志、训练任务、数据库关闭重开、备份预览/恢复/重复跳过、无效引用、无效日期/链接/数值、48 小时面试优先和论文预算预留、当日手动排序、本周统计。

浏览器覆盖实际表单创建/编辑/完成/删除任务、刷新持久化、搜索空态、岗位与 JD 录入、面试安排、关联训练任务、表格/看板阶段变更及日志、JSON 导入预览与确认、CSV 响应、API 校验与跨站拒绝、手机导航与主题、任务延期/归档、任务排序与看板拖动、保存请求失败时保留表单并成功重试。没有未处理的客户端异常。

测试数据写入临时目录或 `.cache/e2e-data`，带显式示例标记；默认 data 数据库保持空白，没有写入私人数据。

## 本机复现浏览器测试

默认需要先安装 Playwright Chromium。当前云环境的下载域名被代理拒绝，因此使用已安装的系统 Chromium：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Windows 一般使用 `npx playwright install chromium` 后运行 `npm run test:e2e`，无需该环境变量。E2E 占用 3000 端口，应先停止自己的应用服务；重启测试使用 3001 端口。

## 明确未验证

- 没有在真实 Windows 机器双击 setup.bat/start.bat；脚本已检查 Node 版本、安装错误、构建缺失、路径空格处理、自动打开浏览器及错误暂停分支。需按 TEST_PLAN.md 完成实机验收。
- 已配置 Ubuntu/Windows GitHub Actions 的类型检查、数据层、构建及重启验证，Ubuntu 额外运行浏览器测试；本报告不声称远程 CI 已执行或成功。
- 面试录音、权限拒绝、题库/多版本答案、论文文献及 IELTS 专属功能尚未开发，不在本次测试通过声明内。
