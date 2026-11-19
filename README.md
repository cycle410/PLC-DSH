# PLC 工程台 · AgentPLC workspace

左侧栏里的 PLC 工程工作区，把对话、工程工具和项目知识放在同一个面板里，思路取自 [AgentPLC](https://agentplc.com/) 的「AI 对话 + PLC 工程工具 + 知识库插件」工作区。当前版本聚焦你实际在用的两条线：**欧姆龙 Sysmac Studio** 和 **西门子 TIA Portal**。

## 面板能做什么

- **离线读 `.smc2`**：不需要装 Sysmac Studio。控制器型号/固件、任务、POU 列表、每个 POU 的 ST 源码或梯形图梯级、全局与局部变量表都能读出来，变量表可一键导出 CSV。
- **识别博途工程**：不要求文件夹名以 `.ap16/.ap18` 结尾——只要文件夹里有 `<name>.ap16/.ap18` 文件（旁边有 `System/`、`IM/` 等项目结构）就会被识别，并标出版本。点「读取设备与块」会通过 Openness 列出设备和全部程序块（首次会启动后台 TIA，约 20–40 秒）。
- **静态校验**：选中 `.smc2` 点「运行校验」，离线检查未声明标识符、重复变量、重复 AT 地址、IF/CASE/FOR/WHILE 块不配平，直接列出 POU 和行号；生成工程时自动跑一次。
- **ST → Sysmac XML**：把 `.st` 源文件（`TYPE` / `FUNCTION_BLOCK` / `PROGRAM`）转换成 Sysmac Studio 可导入的 **IEC 61131-10 XML**。转换器沿用工作区里已用官方 XSD 校验过的那套实现。
- **博途 Openness**：用官方 `Siemens.Engineering` 接口列设备/块、导入 SCL 外部源并编译、编译 PLC、导出块 XML。`plan` 只生成命令文件不动博途，`run` 才真正连博途。
- **工具链体检**：TIA Portal / Openness 程序集 / `Siemens TIA Openness` 用户组、Sysmac Studio、.NET Framework、PowerShell、Python 3，一次看清。

## 直接生成工程文件

这是给 Agent 用的主路径：你描述要求，Agent 写 ST/SCL，插件把结果落成工程文件。

### 欧姆龙 `.smc2`（已验证可被 Sysmac 打开）

`plc_sysmac` 的 `create` 动作以**一个现有工程为模板**，把内容写进模板再打包：

```jsonc
{
  "action": "create",
  "template": "D:\\Desktop\\真实工程.smc2",        // 模板：决定控制器、POU 集合、任务、IO 配置
  "output": "D:\\项目\\输送线.smc2",
  "projectName": "输送线",
  "controller": "NX502-1600 Ver. 1.66",         // 可选，改的就是 manifest 里的 SetUnit 字符串
  "variables": [                                 // 全局变量表；variablesMode 默认 replace
    { "name": "启动按钮", "dataType": "BOOL", "comment": "HMI 启动" },
    { "name": "伸出输出", "dataType": "BOOL", "address": "ECAT://node#[2,0]/..." }
  ],
  "pous": [                                      // 按名字写模板里已有的 POU 的 ST 正文
    { "name": "PRG_Init", "stText": "IF P_First_Run THEN ... END_IF;" }
  ],
  "variablesMode": "replace"                     // replace | merge | keep
}
```

生成后用 `plc_sysmac overview` 复查，或在 Sysmac Studio 里直接打开编译。已实测：改名、换变量表、写 ST 正文、改控制器字符串这四类改动单独和组合都通过；用 11 个 ST POU、25 个变量的中文示例生成的 `.smc2`，在 Sysmac Studio 中打开显示为 `AgentPLC_项目A示例 - new_Controller_0`。

生成后默认自动跑一次**静态校验**（`verify: false` 可关闭），结果写在工具返回里；也可以用 `plc_sysmac` 的 `verify` 动作单独复查。校验不是原厂编译器：它抓的是生成最容易犯的错（未声明变量、重复定义、地址冲突、块不配平）。

要**生成后立刻拿原厂编译结果**，给 `create` 加 `compile: true`：写完工程就复制副本、提权打开 Sysmac、跑 F7 + 重编译，并把真实错误带回来。实测一个「漏声明变量」的闭环：

```
第 1 次 create（compile=true）→ Vendor compile: 2 error(s) — 未定义的标识符'启动按钮' (PRG_Init line 2, column 5) …
第 2 次 create（variablesMode=merge，补上 启动按钮/报警灯）→ Static check: 0；Vendor compile: 0 error(s), 0 warning(s)
```

- **新增 POU**：`create` 的 `newPous: [{name, stText, variables}]` 会克隆模板里的 ST 程序实体（新 GUID、正文、局部变量表、任务关联），重名直接报错，失败时删除半成品。实测新增 `PRG_NewDemo2`（局部变量 `计数2`）后原厂编译 `0 error(s), 0 warning(s)`。

错误用来改，警告一般可以忽略（`warningCount` 仍会返回，但不挡流程）。也可以单独用 `plc_sysmac action=compile path=...` 复查，它会复制一份工程、先按 F7「检查所有程序」、再「重编译控制器」，重编译确认框自动点「是(Y)」，然后读回错误/警告数量和每条消息（含 POU、行、列）。实测坏工程返回：

```
2 error(s), 0 warning(s)
未定义的标识符'未声明变量A' (PRG_Init line 3, column 5)
未定义的标识符'未声明变量B' (PRG_Init line 4, column 5)
```

这个动作每次会弹一次 UAC（Sysmac 本身要求管理员权限），工程原件不会被改动（操作的是临时副本），跑完自动关闭探针实例。编译窗口是自绘界面，主通道是 UIA 文本，另保留截图 + OCR 作兜底（`keepScreenshot: true` 可留图）。

模板策略的边界：

- **POU 集合由模板决定**。`pous` 里给模板没有的名字会被跳过并提示；要新增/删除 POU，先用 Sysmac Studio 建一个带这些 POU 的模板工程。
- **只改 ST 正文**。梯形图 POU、局部变量表、任务配置、IO 映射保持模板原样。
- 模板里的其它 POU 若引用被替换掉的全局变量，编译会报未声明；要干净通过就用 `variablesMode: merge` 保留模板变量，或把所有 POU 都替换掉。

### 西门子 `.ap16` / `.ap18`（Openness，已实测可生成）

本机 V16 用得比 V18 多，所以**默认走 V16**：`tiaDefaultVersion: V16`。`projectPath` 可以只写到工程名，带上 `version` 就会补成对应后缀；路径里已带 `.ap16/.ap18` 时以后缀为准。

```jsonc
{
  "action": "run",                 // 先 plan 审查命令，再 run
  "operation": "create",
  "projectPath": "D:\\项目\\Line1",  // 不写后缀 → 按 version 补成 Line1.ap16
  "version": "V16",               // 省略时用 agentplc.tiaDefaultVersion
  "projectName": "Line1",
  "deviceOrderNumber": "OrderNumber:6ES7 214-1AG40-0XB0/V4.4",
  "sourceFiles": ["D:\\项目\\FB_Main.scl"]  // 可选：建完设备后导入 SCL 并编译
}
```

已在本机验证：

- `plc_tia run create` 生成 `AgentPlcV16.ap16`（V16 API，PLC_1 设备，导入 `FB_Conveyor.scl`，编译 `Success`）。
- 同一工程上 `list` 读回 `Main, FB_Conveyor`，`importScl` 返回 `state: Success`，`compile` 返回 `Success`。
- 不写后缀、也不传 `version` 时按 `tiaDefaultVersion` 建 `.ap16`：`V16Final` 工程（PLC_1 + `FB_Conveyor`，编译 `Success`，`list` 读回 `Main, FB_Conveyor`）。
- 传文件夹路径（如 `...\LineV16`）也能自动找到里面的 `.ap16` 工程文件。
- V18 同样可用：`AgentPlcDemo.ap18`（V18 API，PLC_1，导入 `FB_Conveyor.scl`，编译 `Success`，`list` 读回 `Main, FB_Conveyor`）。
- 偶发 `Connection to TiaPortal failed.` 是 TIA 后台实例没连上，工具会自动重试一次；仍失败时再调一次即可。
- 前提是当前 Windows 用户已加入 `Siemens TIA Openness` 组并**重新登录**（本机已完成）。Openness 首次调用 TIA 时可能弹出「Openness 访问」授权框，选「全部确定」后不再询问。

驱动实现上有两个不显然的点：PLC 软件要通过 `SoftwareContainer` 服务取（`PlcSoftware` 不满足泛型 `GetService<T>` 的约束），外部源导入用 `ExternalSources.CreateFromFile(name, path)` 再 `GenerateBlocksFromSource`，编译用 `ICompilable.Compile()`；PowerShell 绑不了泛型 `GetService<T>()`，驱动里用反射调用闭合泛型方法。

## 入口

会话列表上方的全局面板图标里多一个 **PLC 工程台**（排在 Plugins、Schedules 之后）；点开后是主面板。侧栏标签、面板文案都走 DSH 的语言服务，中英文都提供。

主面板的用法：

- 左栏列出扫描目录里的 `.smc2` / 博途工程目录 / `.st` 源文件，可搜索。
- 选 `.smc2`：概览（控制器、任务、变量表、解析提示）、变量（搜索 + 下载 CSV）、程序（POU 列表 → ST 源码或梯形图逐级；MultipartLadder 的每一段分开显示，内嵌 ST 可展开）。
- 选 `.st`：预览源码，一键生成并下载 Sysmac 可导入的 XML；失败时面板内显示原因，不会跳转。
- 选博途工程：说明为什么必须走 Openness，并给出可复制的 Agent 指令。
- 顶部三张卡片是环境体检；「刷新」会重新扫描目录并重读当前工程。

## Agent 工具

| 工具 | 用途 |
|---|---|
| `plc_env` | 探测本机 PLC 工具链（只读） |
| `plc_sysmac` | `scan` / `overview` / `variables` / `pou` / `export-variables`：离线读 `.smc2` |
| `plc_st` | `scan` / `convert`：`.st` → Sysmac 可导入的 IEC 61131-10 XML |
| `plc_tia` | `plan` / `run`：通过 TIA Openness 列块、导入 SCL、编译、导出块 |

面板和工具用的是同一套 Host 实现，面板上的按钮只是把这些操作做成了可视化入口。

## 安装

```powershell
# 在 DSH 的 Plugins 页面用「添加插件」选择本目录，或用 plugin_manager 安装
```

本包是本地目录包（`@local/dsh-agentplc`），安装后立即生效，不需要重启。

## 配置

`cordis.patch.yml` 里的 `agentplc` 行：

```yaml
- insert:
    - id: agentplc
      name: '@local/dsh-agentplc'
      config:
        projectRoots: []          # 额外扫描目录；留空则用 文档 / 桌面 / OneDrive\文档
        scanDepth: 4              # 扫描深度
        scanLimit: 200            # 最多列出多少个工程
        tiaDefaultVersion: V16    # 建工程时没写 .ap<版本> 后缀用的版本（本机默认 V16）
```

面板只展示**扫描目录内**的工程；`plc_sysmac` / `plc_st` 也只接受这些目录内的路径，避免面板变成任意文件读取入口。

## 前提与已知限制

- **`.smc2` 格式是逆向出来的**，不是官方格式。当前实现覆盖：`.oem` 实体树、`.manifest`、ST 主体（`StructuredTextModel`）、SLWD 变量表、梯形图 JSON 梯级。生成用的是「模板 + 替换」而不是从零构造，POU 集合和局部变量表沿用模板。
- **TIA Openness 已可用**：V16/V18 与 Openness 程序集齐全，用户已加入 `Siemens TIA Openness` 组并重新登录；首次调用 TIA 时若弹出 Openness 访问授权框，选「全部确定」。`.ap16`/`.ap18` 的生成不依赖 TIA 图形界面，但会启动后台 TIA 实例，单次创建约 20–40 秒。
- **ST 转换需要 Python 3**（本机 `D:\Python\python.exe` 可用）。转换器是 `python/` 下的三个脚本，转换失败会返回完整错误。
- **博途工程目录无法离线解析**：`.ap16/.ap18` 是博途自己的工程库，必须走 Openness。
- 读取全程只读；`export-variables`、`plc_sysmac create`、`plc_st convert`、`plc_tia run` 会写文件或驱动工程。

## 本机验证情况

已验证（用本机真实工程）：

- 侧栏入口与主面板都注册成功（`sidebar.panellist` 的 `agentplc` 占位、`main` 的 `agentplc` 键都是 active）。
- 扫描 `D:\Desktop`、`D:\Documents`、`D:\项目`：79 个条目（62 个 `.smc2`、3 个博途工程、14 个 `.st`）。三个博途工程是 `D:\项目\工程1`（V16）、`D:\项目\现场程序\现场V18工程`（V18）、`D:\项目\项目A\历史程序\项目A_旧`（V16）。
- 博途工程读取：`现场V18工程` 通过面板路由读到 1 个设备（S7-1200 station_1）和 34 个块，耗时 21 秒；`项目A_旧` 读到 7 个块（`Main, 气缸块, 点位参数, 夹紧气缸, 夹爪气缸, 升降气缸, 定位气缸`）。
- 解析真实工程：ST 工程 `main_ST` 738 行、`气缸块_ST` 49 行；梯形图工程 `main` 9 段 82 级、`气缸块` 12 级，变量 353 条 / 4 张表。
- 面板路由：`/state`、`/project`、`/pou`、`/variables.csv`、`/st-source`、`/st-xml` 全部 200，CSV 带 BOM 且中文正常。
- `plc_st convert` 用 6 个 `.st` 生成 45680 字节 XML（6 个数据类型、5 个功能块、2 个程序），XML 可被标准解析器解析。
- **`.smc2` 生成链路逐项验证**：以 `D:\Desktop\真实工程.smc2` 为模板，先只重打包（原始内容）→ Sysmac 打开成功；再分别只改名、只换全局变量表、只换 ST 正文、改名+变量+正文组合、改控制器字符串——六个变体全部在 Sysmac Studio 中打开成功。最后用 `plc_sysmac create` 生成 `AgentPLC_输送线示例.smc2`（11 个变量、2 个 POU、中文 ST），Sysmac 窗口标题为 `AgentPLC_输送线示例 - new_Controller_0 - Sysmac Studio (64bit)`。
- **静态校验**：故意写坏的工程报 `2 error(s)`（未声明变量A/B，带行号），正常工程报 `0 error(s)`；`plc_sysmac create` 生成时自动校验，坏样例直接返回 `1 error(s) — 未声明标识符 未声明输出（第 2 行）`；面板路由 `/agentplc/api/sysmac/verify` 返回 200 和问题列表。
- **原厂编译校验**：`plc_sysmac compile` 在提权副本上执行 F7「检查所有程序」+「重编译控制器」（自动确认「所有程序将重新编译，你要继续吗？」→ 是(Y)），从编译窗口读回 `2 error(s), 0 warning(s)` 和两条带 `PRG_Init line 3/4` 的消息；探针实例跑完自动关闭，原工程未改动。
- `plc_tia plan`（create/list/importScl 等）能按工程后缀选中 V16 或 V18 API 并生成命令文件。
- **`.ap18` / `.ap16` 真实生成**：`plc_tia run create` 在本机创建 `AgentPlcDemo.ap18`（V18 API，PLC_1 + 导入 `FB_Conveyor.scl`，编译 `Success`，`list` 读回 `Main, FB_Conveyor`）和 `AgentPlcV16.ap16`（V16 API，PLC_1，编译 `Success`）。
- `plc_tia run importScl` 对已有工程导入 SCL 并编译，返回 `state: Success` 与编译器消息。

未验证（环境或权限不具备）：

- 面板的**实际渲染**：本会话没有浏览器控制，只做了代码级 UI 复核（已按复核意见修掉死路重试、截断说明、下载错误处理、加载态误报、无障碍标签等问题），没有截图。
- **原厂编译每次要一次 UAC**：Sysmac Studio 以管理员权限运行，助手必须提权才能读它的窗口；`plc_sysmac compile` 每次会弹一次 UAC，确认后跑 F7 + 重编译，约 1–2 分钟。
- **编译窗口是自绘界面**：错误行靠 UIA 文本读取（实测能拿到消息、POU、行列），截图 + OCR 仅作兜底；如果某天 OMRON 改版导致 UIA 文本变化，OCR 结果可能不完整。
- **Sysmac Studio 编译生成工程**：生成的 `.smc2` 已确认能在 Sysmac 里打开；也可以直接用 `plc_sysmac compile` 跑原厂编译取证（生成工程里未替换的 POU 可能引用旧变量，编译会如实报出来）。
- **博途下载到真实 PLC / 仿真**：Openness 只做到创建、导入、编译、导出；下载与在线监视不在本插件范围。

## 来源

- `.smc2` 解析思路与 ST 转换器来自本机工作区 `D:\Documents\deepseek-harness\default-workspace\_脚本\`（`ladder.py`、`st2plcopen.py`、`st2iec61131.py`），转换器已按插件需要包成 `python/convert_st.py`。
- 面板与工具的实现约定见 DSH 插件文档：`sidebar.panellist` 全局面板入口、`main` 面板插槽、Host 侧 `webServer` 只读数据路由。

## 分发给别人用

前提：Windows、DSH 本体；Sysmac/TIA/Python 都是可选的（缺了对应功能报错，面板照常启动）。

安装方式二选一：

```powershell
# 1) 打 tarball 后安装
npm pack            # 得到 local-dsh-agentplc-0.1.0.tgz
# 然后在 DSH 里 plugin_manager install_bundle，target 指向该 tgz

# 2) 直接指向目录（开发/内部分发）
#    plugin_manager install_bundle，target 为解压后的目录
```

配置项（profile 的 cordis.patch.yml 里 agentplc 行）：

- `projectRoots`：扫描目录，空表示用户 Documents/Desktop；
- `scanDepth` / `scanLimit`：扫描深度与上限；
- `tiaDefaultVersion`：V16 或 V18，默认 V16。

注意：sysmac 原厂编译与 TIA 建工程需要管理员权限（会弹 UAC / Openness 授权）；`Siemens TIA Openness` 组需要把用户加进去并重新登录。
